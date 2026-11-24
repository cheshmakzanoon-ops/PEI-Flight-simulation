#!/usr/bin/env python3
"""Locked Standard and stock captures of existing Orby Head shore coverage."""
import argparse,importlib.util,json
from pathlib import Path
from urllib.parse import quote
from PIL import Image
import numpy as np
m=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'));f=importlib.util.module_from_spec(m);m.loader.exec_module(f)
initial=f.stage
views={
 'seaward':dict(lon=-63.3274,lat=46.494755,dist=365,east=.064,south=-.998,h=8.,agl=49),
 'alongshore':dict(lon=-63.3274,lat=46.494755,dist=465,east=.84,south=-.54,h=8.,agl=51),
}
def stamp(repo,root,deps,_):
 initial(repo,root,deps,False)
 optics=root/'src/render/world.ts'
 text=optics.read_text()
 optics.write_text(f.once(text,'if(skyDiagnostic>.5){gl_FragColor=vec4(1.,0.,1.,1.);return;}',
  'if(skyDiagnostic>.5){gl_FragColor=skyDiagnostic>1.5?vec4(0.,1.,0.,1.):vec4(1.,0.,1.,1.);return;}'))
 p=root/'src/main.ts';s=p.read_text()
 p.write_text(f.once(s,'const diagnostic=', '''(window as any).orbySky=(value:number)=>{
   (world as any).sky.material.uniforms.skyDiagnostic.value=value;
   return (window as any).reviewCamera.frame;
 };
 const diagnostic='''))
def run(a,browser,url):
 out=[]
 for name,pose in views.items():
  all_at_site={};settled=None
  for stock in [True,False]:
   use='stock' if stock else 'standard'
   c=browser.new_context(viewport={'width':650,'height':390},device_scale_factor=1)
   try:
    p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.on('console',lambda e:errors.append(e.text)if e.type=='error'else None)
    p.set_default_timeout(120000);p.goto(url+'/?diagnostics'+('&stockOrbyCoast' if stock else '')+'&qa='+quote(json.dumps(pose)),wait_until='domcontentloaded')
    d=f.settle(p,errors);assert not errors and bool(d['legacyShore'])!=(stock)
    if stock:
     pose={**pose,'fixedEyeY':d['eyeY'],'fixedBaseH':d['baseH']}
    p.screenshot(path=str(a.out/f'{name}-{use}.png'))
    two=[]
    for q in (1,2):
     frame=p.evaluate('v=>window.orbySky(v)',q)
     p.wait_for_function('t=>window.reviewCamera.frame>=t+2',arg=frame)
     fn=a.out/f'{name}-{use}-sky-{q}.png';p.screenshot(path=str(fn))
     two.append(np.array(Image.open(fn).convert('RGB'),dtype='int16'))
    all_at_site[use]=(*two,d)
   finally:c.close()
  (oldA,oldB,base),(newA,newB,candidate)=[all_at_site[w] for w in ('stock','standard')]
  old=np.max(np.abs(oldA-oldB),axis=2);new=np.max(np.abs(newA-newB),axis=2)
  removed=(old>=247)&(new<247)
  added=(new>0)&(old==0)
  increased=new>old+1
  result=dict(view=name,removedPureSkyPixels=int(np.count_nonzero(removed)),
   newlyExposed=int(added.sum()),increasedSkyCoverageAboveOneCode=int(increased.sum()),
   draws=[base['drawCalls'],candidate['drawCalls']],triangles=[base['triangles'],candidate['triangles']])
  assert result['removedPureSkyPixels']>18 and result['newlyExposed']==0 and result['increasedSkyCoverageAboveOneCode']==0,result
  out.append(result);print(result,flush=True)
 args.out.joinpath('report.json').write_text(json.dumps(out,indent=2)+'\n')
f.stage=stamp
p=argparse.ArgumentParser();p.add_argument('--checkout',type=Path,required=True);p.add_argument('--deps',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True);p.set_defaults(void_probe=False)
args=p.parse_args();f.capture=run;f.run(args)
