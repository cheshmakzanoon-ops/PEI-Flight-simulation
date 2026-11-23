#!/usr/bin/env python3
"""Locked shadow projection comparison on the real Three.js terrain."""
import argparse,base64,importlib.util,json
from pathlib import Path
from urllib.parse import quote
import numpy as np
from PIL import Image,ImageFilter
x=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(x);x.loader.exec_module(fixed)
old=fixed.stage
def stage(repo,root,deps,void):
 old(repo,root,deps,void)
 p=root/'src/main.ts';s=p.read_text()
 a='const startPoint=projectSite(SITES[0].lon,SITES[0].lat),warmForest='
 b="""const qp=JSON.parse(new URLSearchParams(location.search).get('qa')!);
 const cc=projectSite(qp.lon,qp.lat),nn=Math.hypot(qp.east,qp.south);
 const startPoint={x:cc.x+qp.dist*qp.east/nn,z:cc.z+qp.dist*qp.south/nn},warmForest="""
 s=fixed.once(s,a,b)
 s=fixed.once(s,'\n  renderer.render(scene,camera);','''
  renderer.render(scene,camera);
  (window as any).shadowWitness=()=>{
   const v=vegetation as any,f=v.groundedShadow;
   const draw=()=>{renderer.render(scene,camera);return {url:renderer.domElement.toDataURL('image/png'),draws:renderer.info.render.calls,tris:renderer.info.render.triangles};};
   const pointCount=f?.count??0;
   const newVisible=f?.mesh.visible??false,legacyVisible=v.shade.visible;
   const ground=draw(),mask=f?.mask.array.slice()??[],g=f?.mesh.geometry;
   if(f){f.mask.array.fill(0);f.mask.needsUpdate=true;f.mesh.visible=false;}
   const original=draw();v.shade.visible=false;const bare=draw();v.shade.visible=legacyVisible;
   if(f){f.mask.array.set(mask);f.mask.needsUpdate=true;f.mesh.visible=newVisible;}
   return {original,ground,bare,pointCount,verts:g?.getAttribute('position')?.count??0,restored:draw().url===ground.url};
  };
 ''')
 p.write_text(s)
fixed.stage=stage
P={
 'queens-hill':dict(lon=-63.373,lat=46.400,dist=45,east=.53,south=.85,h=0,agl=21),
 'queens-understory':dict(lon=-63.373,lat=46.400,dist=13,east=.53,south=.85,h=0,agl=8),
 'prince-near':dict(lon=-64.238,lat=46.674,dist=42,east=.53,south=.85,h=0,agl=23),
 'queens-high-control':dict(lon=-63.373,lat=46.400,dist=55,east=.53,south=.85,h=8,agl=154),
}
def capture(a,browser,url):
 out={}
 for label in a.views.split(','):
  pg=browser.new_page(viewport={'width':780,'height':490});errs=[]
  pg.on('pageerror',lambda e:errs.append(str(e)))
  pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
  try:
   pg.goto(url+'/?woodland3D&diagnostics'+('&forestFloor' if a.floor else '')+'&qa='+quote(json.dumps(P[label])),wait_until='domcontentloaded')
   for _ in range(150):
    d,c=pg.evaluate('()=>[window.islandAirDiagnostics,window.reviewCamera?.frame]')
    if errs:raise RuntimeError(errs)
    if (c or 0)>11 and d and ('control' in label or d.get('woodlandGroundedShadows',0)>10) and (not a.floor or d.get('forestFloor')=='ready'):break
    pg.wait_for_timeout(500)
   else:raise RuntimeError((d,c))
   r=pg.evaluate('window.shadowWitness()')
   def img(key):
    name=a.out/(label+'-'+key+'.png')
    name.write_bytes(base64.b64decode(r[key].pop('url').split(',',1)[1]))
    return np.asarray(Image.open(name))[:,:,:3].astype(int)
   old,new,bare=[img(k) for k in ('original','ground','bare')]
   layer=np.any(old!=bare,axis=2)|np.any(new!=bare,axis=2)
   allowed=np.asarray(Image.fromarray(np.uint8(layer)*255).filter(ImageFilter.MaxFilter(3)))>0
   d=np.max(np.abs(old-new),axis=2)
   r['image']={'pixels':int(d.size),'changed':int((d>0).sum()),'over2':int((d>2).sum()),'max':int(d.max()),'outside':int((d[~allowed]>0).sum())}
   assert r['restored'] and r['image']['outside']==0,r
   if 'control' in label:assert not d.max() and not r['pointCount'],r
   else:assert (d>2).sum()>0 and r['pointCount']<=121,r
   out[label]=r;print(label,r,flush=True)
  finally:pg.close()
 (a.out/'report.json').write_text(json.dumps(out,indent=2)+'\n')
fixed.capture=capture
p=argparse.ArgumentParser();p.add_argument('--checkout',type=Path,required=True);p.add_argument('--deps',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True);p.add_argument('--views',default=','.join(P));p.add_argument('--floor',action='store_true');p.set_defaults(void_probe=False)
fixed.run(p.parse_args())
