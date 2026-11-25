#!/usr/bin/env python3
"""Scoped Standard woodland floor, paired in one live Three.js scene."""
import argparse,base64,importlib.util,json
from pathlib import Path
from urllib.parse import quote
from PIL import Image,ImageFilter
import numpy as np
m=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(m);m.loader.exec_module(fixed)
base=fixed.stage
def stage(repo,root,deps,void):
 base(repo,root,deps,void)
 p=root/'src/render/forest-floor.ts';s=p.read_text()
 s=fixed.once(s,'readonly uniforms={','readonly uniforms={forestFloorQA:{value:0},')
 s=fixed.once(s,'uniform float forestFloorMix,forestFloorDepth;','uniform float forestFloorMix,forestFloorDepth,forestFloorQA;')
 s=fixed.once(s,'if(max(weight,layer)<.002)return;','if(max(weight,layer)<.002)return; if(forestFloorQA>.5){col=forestFloorQA>1.5?vec3(0.,4.,0.):vec3(4.,0.,4.);return;}')
 p.write_text(s)
 p=root/'src/main.ts';s=p.read_text()
 s=fixed.once(s,'\n  renderer.render(scene,camera);','''
  renderer.render(scene,camera);
  (window as any).testSoil=()=>{
   const art=(world as any).floor,u=art?.uniforms;
   const draw=()=>{renderer.render(scene,camera);return {b64:renderer.domElement.toDataURL('image/png'),calls:renderer.info.render.calls,tris:renderer.info.render.triangles};};
   const gain=u?.forestFloorMix.value??0;if(u)u.forestFloorMix.value=0;
   const before=draw();
   if(u)u.forestFloorMix.value=gain>0?1:0;
   const after=draw();
   if(u)u.forestFloorQA.value=1;
   const mask=draw();
   if(u)u.forestFloorQA.value=2;
   const mask2=draw();
   if(u){u.forestFloorMix.value=0;u.forestFloorQA.value=0;}
   const exact=before.b64===draw().b64;if(u){u.forestFloorMix.value=gain;u.forestFloorDepth.value=1;}
   return {before,after,mask,mask2,gain,exact};
  };
 ''')
 p.write_text(s)
fixed.stage=stage
P={
 'queens-close-inspection':dict(lon=-63.373,lat=46.400,dist=11,east=.53,south=.85,h=0,agl=3.7),
 'queens-understory':dict(lon=-63.373,lat=46.400,dist=24,east=.53,south=.85,h=0,agl=12),
 'prince-needle':dict(lon=-64.04,lat=46.66,dist=29,east=.53,south=.85,h=0,agl=16),
 'prince-protected-control':dict(lon=-64.238,lat=46.674,dist=29,east=.53,south=.85,h=0,agl=16),
 'kings-approach':dict(lon=-62.29,lat=46.407,dist=90,east=.53,south=.85,h=0,agl=41),
 'east-coast-control':dict(lon=-61.9718333333,lat=46.452527778,east=.91,south=-.415,dist=125,h=19.5,agl=45),
 'queens-high-control':dict(lon=-63.373,lat=46.400,dist=46,east=.53,south=.85,h=0,agl=360),
}
def capture(a,browser,url):
 result={}
 for name in a.views.split(','):
  pg=browser.new_page(viewport={'width':864,'height':528});errors=[];resources=[]
  pg.on('pageerror',lambda e:errors.append(str(e)))
  if a.fault:pg.route('**/art/forest-floor/duff-2.webp',lambda r:r.fulfill(status=200,body='wrong image bytes'))
  pg.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
  pg.on('request',lambda e:resources.append(e.url.split('/')[-1]) if '/art/forest-floor/' in e.url else None)
  try:
   pg.goto(url+'/?diagnostics'+('&stockForestFloor' if a.stock else '')+'&qa='+quote(json.dumps(P[name])),wait_until='domcontentloaded')
   for _ in range(155):
    state,frame=pg.evaluate('()=>[window.islandAirDiagnostics,window.reviewCamera?.frame]')
    if errors:raise RuntimeError(errors)
    if state and (frame or 0)>8 and ((('control' in name or a.stock) and frame>24) or state['forestFloor']==('failed' if a.fault else 'ready')):break
    pg.wait_for_timeout(500)
   else:raise RuntimeError((name,state,frame))
   res=pg.evaluate('window.testSoil()')
   def image(key):
    p=a.out/(name+'-'+key+'.png');p.write_bytes(base64.b64decode(res[key].pop('b64').split(',',1)[1]))
    return np.asarray(Image.open(p))[:,:,:3].astype(int)
   old,new,mask,mask2=[image(k) for k in ('before','after','mask','mask2')]
   marker=np.any(mask!=mask2,axis=2)
   allowed=np.asarray(Image.fromarray(np.uint8(marker)*255).filter(ImageFilter.MaxFilter(3)))>0
   diff=np.max(np.abs(old-new),axis=-1)
   res['pixels']={'n':int(diff.size),'change':int((diff>0).sum()),'over2':int((diff>2).sum()),'max':int(diff.max()),'outside':int((diff[~allowed]>0).sum())}
   res['resources']=resources;res['state']=state['forestFloor']
   assert res['exact'] and res['before']==res['after'] and res['pixels']['outside']==0,res
   if 'control' in name or a.stock:assert not diff.max() and not resources
   elif a.fault:assert not diff.max() and len(resources)==2
   else:assert res['pixels']['over2']>100 and len(resources)==2,res
   result[name]=res;print(name,res,flush=True)
   (a.out/'report.json').write_text(json.dumps(result,indent=2)+'\n')
  finally:pg.close()
 (a.out/'report.json').write_text(json.dumps(result,indent=2)+'\n')
fixed.capture=capture
p=argparse.ArgumentParser();p.add_argument('--checkout',type=Path,required=True);p.add_argument('--deps',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True);p.add_argument('--views',default=','.join(P));p.add_argument('--fault',action='store_true');p.add_argument('--stock',action='store_true');p.set_defaults(void_probe=False)
fixed.run(p.parse_args())
