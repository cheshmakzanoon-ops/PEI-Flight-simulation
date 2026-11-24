#!/usr/bin/env python3
"""Matched production-renderer grazing views of near woodland shape."""
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
   const buffers=groups.map(g=>g.lift?.array.slice(0,g.geometry.instanceCount));
   const lifts=buffers.flatMap(a=>a?Array.from(a).filter(q=>q>0):[]);
   const layer=()=>groups.forEach((g,i)=>{if(buffers[i]){g.lift.array.set(buffers[i]);g.lift.needsUpdate=true}});
   const after=snap();
   groups.forEach(g=>{if(g.lift){g.lift.array.fill(0,0,g.geometry.instanceCount);g.lift.needsUpdate=true}});
   const before=snap();
   groups.forEach(g=>g.mesh.visible=false);const bare=snap();
   groups.forEach((g,i)=>g.mesh.visible=enabled[i]);layer();
   return {before,after,bare,n,lifts:lifts.length,exactRestored:snap().image===after.image};
  };''')
 if args.no_msaa:s=fixed.once(s,'antialias:true','antialias:false')
 p.write_text(s)
fixed.stage=stage
P={
 'queens-close':dict(lon=-63.373,lat=46.400,dist=46,east=.53,south=.85,h=12,agl=18),
 'prince-close':dict(lon=-64.238,lat=46.674,dist=54,east=.53,south=.85,h=10,agl=23),
 'kings-close':dict(lon=-62.169,lat=46.414,dist=56,east=.53,south=.85,h=10,agl=22),
 'queens-mid-control':dict(lon=-63.373,lat=46.400,dist=46,east=.53,south=.85,h=12,agl=42),
 'queens-high-control':dict(lon=-63.373,lat=46.400,dist=62,east=.53,south=.85,h=8,agl=152),
}
P.update({'prince-grazing': {'lon': -64.23742108644893, 'lat': 46.674592790684684, 'dist': 26, 'east': -0.8660254037844388, 'south': -0.4999999999999997, 'agl': 4.5, 'h': 17.115747419377726, 'fixedBaseH': 22.99635020922593, 'fixedEyeY': 27.982200182291795}, 'queens-grazing': {'lon': -63.37304312827413, 'lat': 46.399546529914325, 'dist': 26, 'east': -0.7071067811865479, 'south': -0.7071067811865471, 'agl': 2.7, 'h': 13.05925039233503, 'fixedBaseH': 38.32404072790475, 'fixedEyeY': 43.2847173505938}, 'kings-grazing': {'lon': -62.16821337178259, 'lat': 46.413126704406004, 'dist': 23.5, 'east': -0.9659258262890683, 'south': -0.2588190451025208, 'agl': 4.5, 'h': 8.631676831574865, 'fixedBaseH': 39.42139035923698, 'fixedEyeY': 43.829067562749714}})
def capture(a,browser,url):
 out={}
 for name in a.views.split(','):
  c=browser.new_context(viewport={'width':460,'height':338},device_scale_factor=1)
  try:
   pg=c.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
   pg.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
   pg.goto(url+'/?woodlandCrownBase&diagnostics&qa='+quote(json.dumps(P[name])),wait_until='domcontentloaded')
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
   assert x['exactRestored'] and x['n']<=121 and x['before']['draws']==x['after']['draws'] and x['before']['triangles']==x['after']['triangles'] and x['pixels']['outsideFoliage']==0,x
   if 'control' in name or a.no_msaa:assert not dd.max(),x
   out[name]=x
   print(name,x,flush=True)
  finally:c.close()
 (a.out/'report.json').write_text(json.dumps(out,indent=2)+'\n')
fixed.capture=capture
p=argparse.ArgumentParser();p.add_argument('--checkout',type=Path,required=True);p.add_argument('--deps',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True);p.add_argument('--views',default='prince-grazing,queens-grazing,kings-grazing,queens-mid-control,queens-high-control');p.add_argument('--no-msaa',action='store_true');p.set_defaults(void_probe=False)
args=p.parse_args();fixed.run(args)
