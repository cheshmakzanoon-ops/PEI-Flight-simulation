#!/usr/bin/env python3
"""Matched in-engine horizon and close-land proof for Standard atmospheric optics."""
import argparse,base64,importlib.util,json
from io import BytesIO
from pathlib import Path
from urllib.parse import quote
from PIL import Image
import numpy as np
m=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
f=importlib.util.module_from_spec(m);m.loader.exec_module(f)
base_stage=f.stage
views={
 'prince-north':dict(lon=-63.6660,lat=46.5954,dist=3300,east=-.96,south=.28,fixedEyeY=85,fixedBaseH=0,h=80,agl=0),
 'east-point':dict(lon=-61.9194,lat=46.4770,dist=4200,east=-.93,south=-.37,fixedEyeY=510,fixedBaseH=0,h=80,agl=0),
 'queens-land-close':dict(lon=-63.44143,lat=46.35524,dist=130,east=.67,south=.74,fixedEyeY=205,fixedBaseH=28,h=0,agl=0),
}
def stage(repo,root,deps,void_probe):
 base_stage(repo,root,deps,void_probe)
 main=root/'src/main.ts';s=main.read_text()
 main.write_text(f.once(s,'renderer.render(scene,camera);','''renderer.render(scene,camera);
   (window as any).aerialPair=()=>{
    if(!daylight||daylight.gain.value!==1)throw Error('Default daylight not armed');
    const shot=()=>{renderer.render(scene,camera);return {image:renderer.domElement.toDataURL('image/png'),
     draws:renderer.info.render.calls,triangles:renderer.info.render.triangles}};
    const active=shot();daylight.gain.value=0;
    let baseline;try{baseline=shot();}finally{daylight.gain.value=1;}
    return [baseline,active,shot()];};'''))
def capture(a,browser,url):
 out=[]
 for name in a.views.split(','):
  ctx=browser.new_context(viewport={'width':600,'height':395},device_scale_factor=1)
  try:
   p=ctx.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
   p.set_default_timeout(110000);p.goto(url+'/?diagnostics&qa='+quote(json.dumps(views[name])),wait_until='domcontentloaded')
   p.wait_for_function('window.islandAirDiagnostics?.aerialPerspective===true')
   d=f.settle(p,errors);stock,active,once=p.evaluate('window.aerialPair()')
   assert not errors and active==once
   print(name,'same counts',stock['draws'],stock['triangles'],flush=True)
   assert stock['draws']==active['draws'] and stock['triangles']==active['triangles']
   photos=[]
   for v,x in [('stock',stock),('standard',active)]:
    data=base64.b64decode(x.pop('image').split(',',1)[1])
    if not a.report_only:(a.out/f'{name}-{v}.png').write_bytes(data)
    photos.append(data)
   x,y=[np.asarray(Image.open(BytesIO(q)).convert('RGB')).astype('int16') for q in photos]
   delta=np.abs(x-y).max(axis=2);changed=int(np.count_nonzero(delta))
   assert changed==0 if name.endswith('close') else changed>1800,(name,changed)
   row=dict(view=name,changedPixels=changed,changedGt3=int((delta>3).sum()),maxChannelDelta=int(delta.max()),draws=stock['draws'],triangles=stock['triangles'],tiles=d['detail'],activeRestored=True)
   out.append(row);(a.out/'report.json').write_text(json.dumps(out,indent=2)+'\n');print(row,flush=True)
  finally:ctx.close()
f.stage=stage;f.capture=capture
p=argparse.ArgumentParser();p.add_argument('--checkout',type=Path,required=True);p.add_argument('--deps',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True);p.add_argument('--views',default=','.join(views));p.add_argument('--report-only',action='store_true');p.set_defaults(void_probe=False)
f.run(p.parse_args())
