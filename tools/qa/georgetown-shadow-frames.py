#!/usr/bin/env python3
"""Same-frame ordinary terrain receiver A/B, supplied through the real visible church path."""
import argparse,base64,importlib.util,json
from pathlib import Path
from urllib.parse import quote
from PIL import Image
import numpy as np
fixture=Path(__file__).with_name('fixed-scenery.py')
m=importlib.util.spec_from_file_location('fixed',fixture);f=importlib.util.module_from_spec(m);m.loader.exec_module(f)
base_stage=f.stage
ROSTER={
 'close':dict(lon=-62.53415,lat=46.182076,dist=34,east=.82,south=.572,h=5,agl=14),
 'approach':dict(lon=-62.53415,lat=46.182076,dist=116,east=.87,south=.493,h=7,agl=75),
}
def stage(repo,root,deps,probe):
 base_stage(repo,root,deps,probe)
 main=root/'src/main.ts';text=main.read_text()
 main.write_text(f.once(text,'  renderer.render(scene,camera);','''  renderer.render(scene,camera);
   (window as any).pairedGeorgetownSun=()=>{
    const mask=georgetownGroundSun;
    if(!mask||mask.live.value!==1)throw Error('No active signed Georgetown mask');
    const capture=()=>{renderer.render(scene,camera);return {png:renderer.domElement.toDataURL('image/png'),
     draws:renderer.info.render.calls,triangles:renderer.info.render.triangles};};
    const active=capture();mask.live.value=0;
    let baseline;try{baseline=capture();}finally{mask.live.value=1;}
    return [baseline,active,capture()];};'''))
def capture(a,browser,url):
 rows=[]
 for k,v in ROSTER.items():
  c=browser.new_context(viewport={'width':620,'height':416},device_scale_factor=1)
  try:
   p=c.new_page();errs=[];downloads=[]
   p.on('pageerror',lambda e:errs.append(str(e)))
   p.on('console',lambda e:errs.append(e.text) if e.type=='error' else None)
   p.on('request',lambda r:downloads.append(r.url.rsplit('/',1)[-1]) if '/georgetown-st-davids-ground-' in r.url else None)
   p.set_default_timeout(120000);p.goto(url+'/?diagnostics&qa='+quote(json.dumps(v)),wait_until='domcontentloaded')
   p.wait_for_function('window.islandAirDiagnostics?.stDavidsGroundSun===true')
   d=f.settle(p,errs);base,active,res=p.evaluate('window.pairedGeorgetownSun()')
   assert res==active and not errs and len(downloads)==1 and d['stDavids'],(errs,downloads,d)
   output=[]
   for name,item in [('stock',base),('cast',active)]:
    filename=a.out/f'{k}-{name}.png';filename.write_bytes(base64.b64decode(item.pop('png').split(',',1)[1]));output.append(filename)
   assert base==active
   x,y=[np.asarray(Image.open(q).convert('RGB')).astype('i2') for q in output]
   delta=np.max(abs(x-y),axis=2);i,j=np.where(delta>0)
   assert len(i)>100,(k,len(i))
   row=dict(view=k,changedPixels=len(i),boundsXYXY=[int(j.min()),int(i.min()),int(j.max()+1),int(i.max()+1)],
            maxRgb=int(delta.max()),draws=base['draws'],triangles=base['triangles'],restoredExact=True,requests=downloads)
   rows.append(row);(a.out/'report.json').write_text(json.dumps(rows,indent=2)+'\n');print(row,flush=True)
  finally:c.close()
f.stage=stage;f.capture=capture
p=argparse.ArgumentParser();p.add_argument('--checkout',type=Path,required=True);p.add_argument('--deps',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True);p.set_defaults(void_probe=False)
f.run(p.parse_args())
