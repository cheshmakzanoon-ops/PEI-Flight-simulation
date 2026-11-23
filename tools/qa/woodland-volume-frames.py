#!/usr/bin/env python3
"""Matched production renderer views of existing canopy versus optional branch volumes."""
import argparse,base64,importlib.util,json
from pathlib import Path
from urllib.parse import quote
from PIL import Image,ImageFilter
import numpy as np
m=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(m);m.loader.exec_module(fixed)
base_stage=fixed.stage
def stage(repo,root,deps,void):
 base_stage(repo,root,deps,void)
 p=root/'src/main.ts';s=p.read_text()
 s=fixed.once(s,'const startPoint=projectSite(SITES[0].lon,SITES[0].lat),warmForest=', '''const qp=JSON.parse(new URLSearchParams(location.search).get('qa')!);
          const wc=projectSite(qp.lon,qp.lat),wn=Math.hypot(qp.east,qp.south);
          const startPoint={x:wc.x+qp.dist*qp.east/wn,z:wc.z+qp.dist*qp.south/wn},warmForest=''')
 s=fixed.once(s,'\n  renderer.render(scene,camera);','''
  renderer.render(scene,camera);
  (window as any).captureWoodlandVolume=()=>{
   const v=vegetation as any,volume=v.volume;
   const groups=volume?.groups??[],enabled=groups.map(g=>g.mesh.visible);
   const info=()=>({draws:renderer.info.render.calls,triangles:renderer.info.render.triangles});
   const snap=()=>{renderer.render(scene,camera);return {image:renderer.domElement.toDataURL('image/png'),...info()};};
   const n=volume?.count??0;
   const current=volume?.fade.value.z??0;const after=snap();
   if(volume)volume.fade.value.z=0;
   for(const g of groups)g.mesh.visible=false;
   const before=snap();
   v.crown.visible=false;const bare=snap();v.crown.visible=true;
   if(volume)volume.fade.value.z=current;
   groups.forEach((g,i)=>g.mesh.visible=enabled[i]);
   return {before,after,bare,n,exactRestored:snap().image===after.image};
  };''')
 if args.no_msaa:s=fixed.once(s,'antialias:true','antialias:false')
 p.write_text(s)
fixed.stage=stage
P={
 'queens-close':dict(lon=-63.373,lat=46.400,dist=46,east=.53,south=.85,h=12,agl=18),
 'prince-close':dict(lon=-64.238,lat=46.674,dist=54,east=.53,south=.85,h=10,agl=23),
 'kings-close':dict(lon=-62.169,lat=46.414,dist=56,east=.53,south=.85,h=10,agl=22),
 'queens-high-control':dict(lon=-63.373,lat=46.400,dist=62,east=.53,south=.85,h=8,agl=152),
}
def capture(a,browser,url):
 out={}
 for name in a.views.split(','):
  c=browser.new_context(viewport={'width':920,'height':580},device_scale_factor=1)
  try:
   pg=c.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
   pg.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
   pg.goto(url+'/?woodland3D&diagnostics&qa='+quote(json.dumps(P[name])),wait_until='domcontentloaded')
   for _ in range(180):
    state,frame=pg.evaluate('()=>[window.islandAirDiagnostics,window.reviewCamera?.frame]')
    if errors:raise RuntimeError(errors)
    if frame and frame>12 and state and ('control' in name or a.no_msaa or state.get('woodlandVolume',0)>0):break
    pg.wait_for_timeout(500)
   else:raise RuntimeError((name,state,frame))
   x=pg.evaluate('window.captureWoodlandVolume()')
   def img(k):
    p=a.out/(name+'-'+k+'.png');p.write_bytes(base64.b64decode(x[k].pop('image').split(',',1)[1]))
    return np.asarray(Image.open(p))[:,:,:3].astype(int)
   b,cand,bare=[img(k) for k in ('before','after','bare')]
   m=np.any(b!=bare,axis=2)|np.any(cand!=bare,axis=2)
   accept=np.asarray(Image.fromarray(np.uint8(m)*255).filter(ImageFilter.MaxFilter(3)))>0
   dd=np.max(np.abs(b-cand),axis=2)
   x['pixels']={'n':int(dd.size),'changed':int((dd>0).sum()),'over2':int((dd>2).sum()),'max':int(dd.max()),'outsideFoliage':int((dd[~accept]>0).sum())}
   assert x['exactRestored'] and x['n']<=121 and x['pixels']['outsideFoliage']==0,x
   if 'control' in name or a.no_msaa:assert x['n']==0 and not dd.max(),x
   out[name]=x
   print(name,x,flush=True)
  finally:c.close()
 (a.out/'report.json').write_text(json.dumps(out,indent=2)+'\n')
fixed.capture=capture
p=argparse.ArgumentParser();p.add_argument('--checkout',type=Path,required=True);p.add_argument('--deps',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True);p.add_argument('--views',default=','.join(P));p.add_argument('--no-msaa',action='store_true');p.set_defaults(void_probe=False)
args=p.parse_args();fixed.run(args)
