#!/usr/bin/env python3
"""Paired Standard pale-sand material and protected-pixel checks in real WebGL."""
import argparse,base64,importlib.util,json
from pathlib import Path
from urllib.parse import quote
from PIL import Image
import numpy as np
sp=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
f=importlib.util.module_from_spec(sp);sp.loader.exec_module(f)
origin=f.stage
V={
 'west':dict(lon=-62.108125,lat=46.37745833333334,h=1.4,east=.60,south=.80,dist=36,agl=18),
 'east':dict(lon=-62.095125,lat=46.38404166666667,h=1.4,east=.89,south=.46,dist=67,agl=26),
 'high':dict(lon=-62.095125,lat=46.38404166666667,h=2.2,east=.83,south=.47,dist=1800,agl=1410),
}
def stamp(repo,root,deps,_):
 origin(repo,root,deps,False)
 p=root/'src/render/basin-head-sand.ts';s=p.read_text();k=' // Site documented as pale silica sand;'
 p.write_text(f.once(s,k," if(basinSandGain>1.5&&valid>0.)return basinSandGain>2.5?vec3(0.,9.,0.):vec3(9.,0.,9.);\n"+k))
 p=root/'src/main.ts';s=p.read_text();k='  renderer.render(scene,camera);'
 p.write_text(f.once(s,k,k+'''
  (window as any).basinStandardProof=()=>{
   if(!basinSandStandard)throw Error('Scope missing');
   const g=basinSandStandard.uniforms.basinSandGain,keep=g.value;
   const draw=(v:number)=>{g.value=v;renderer.render(scene,camera);return {png:renderer.domElement.toDataURL('image/png'),
    draws:renderer.info.render.calls,tris:renderer.info.render.triangles};};
   const before=draw(0),after=draw(keep),a=draw(keep>.99?2:0),b=draw(keep>.99?3:0);
   const exact=before.png===draw(0).png;g.value=keep;
   return {before,after,a,b,exact,state:basinSandStandard.state};
  };
  (window as any).basinStandardReady=()=>basinSandStandard?.uniforms.basinSandGain.value>.999;
 '''))
f.stage=stamp
def capture(a,browser,url):
 result={}
 for key,v in V.items():
  pg=browser.new_page(viewport={'width':650,'height':416});errors=[];requests=[]
  try:
   pg.on('pageerror',lambda e:errors.append(str(e)));pg.on('console',lambda e:errors.append(e.text)if e.type=='error'else None)
   pg.on('request',lambda r:requests.append(r.url.rsplit('/',1)[-1])if '/ground/basin-head/v1/'in r.url else None)
   pg.goto(url+'/?diagnostics&qa='+quote(json.dumps(v)),wait_until='domcontentloaded')
   f.settle(pg,errors)
   if key!='high':pg.wait_for_function('window.basinStandardReady?.()',timeout=85000)
   r=pg.evaluate('window.basinStandardProof()')
   arrays={}
   for k in ('before','after','a','b'):
    file=a.out/f'{key}-{k}.png';file.write_bytes(base64.b64decode(r[k].pop('png').split(',')[1]))
    arrays[k]=np.array(Image.open(file).convert('RGB'),dtype='int16')
   delta=abs(arrays['before']-arrays['after']).max(axis=2)
   mask=np.any(arrays['a']!=arrays['b'],axis=2)
   r['pixels']={'changedOverTwo':int((delta>2).sum()),'protected':int((~mask).sum()),'outsideChanges':int((delta[~mask]>0).sum())}
   r['requests']=requests
   assert r['before']==r['after'] and r['exact'] and not errors and r['pixels']['outsideChanges']==0,r
   if key=='high':assert not requests and not r['state']['active'] and r['pixels']['changedOverTwo']==0,r
   else:assert r['state']['active'] and len(requests)==2 and r['pixels']['changedOverTwo']>250,r
   result[key]=r;print(key,r,flush=True)
   (a.out/'report.json').write_text(json.dumps(result,indent=2)+'\n')
  finally:pg.close()
f.capture=capture
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--checkout',type=Path,required=True);p.add_argument('--deps',type=Path,required=True)
p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True)
p.set_defaults(void_probe=False)
f.run(p.parse_args())
