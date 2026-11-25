#!/usr/bin/env python3
import argparse,base64,importlib.util,json
from pathlib import Path
from urllib.parse import quote
import numpy as np
from PIL import Image
p=argparse.ArgumentParser(description='Matched Cape Tryon shoreline coverage without changing the coast mask.')
p.add_argument('--checkout',type=Path,required=True);p.add_argument('--deps',type=Path,required=True)
p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True)
p.add_argument('--views',default='headland-north,headland-east,headland-grazing');p.add_argument('--poses',type=Path,required=True);p.set_defaults(void_probe=False)
a=p.parse_args()
sp=importlib.util.spec_from_file_location('fixed',a.checkout/'tools/qa/fixed-scenery.py')
fixed=importlib.util.module_from_spec(sp);sp.loader.exec_module(fixed);original=fixed.stage
def stage(repo,root,deps,void):
 original(repo,root,deps,False)
 j=root/'src/render/world.ts';s=j.read_text();j.write_text(fixed.once(s,
 'if(skyDiagnostic>.5){gl_FragColor=vec4(1.,0.,1.,1.);return;}',
 'if(skyDiagnostic>.5){gl_FragColor=skyDiagnostic>1.5?vec4(0.,1.,0.,1.):vec4(1.,0.,1.,1.);return;}'))
 j=root/'src/main.ts';s=j.read_text();key='  renderer.render(scene,camera);';j.write_text(fixed.once(s,key,key+'''
  (window as any).shoreSkyScout=()=>{
    const pal=(world as any).sky.material.uniforms.skyDiagnostic,capture=()=>{
     renderer.render(scene,camera);return renderer.domElement.toDataURL();
    };
    const arcs=scene.children.filter(q=>q.name==='Cape Tryon coverage repair'&&q.visible);
    const draw=()=>{
      pal.value=0;const actual=capture();
      const stats=[renderer.info.render.calls,renderer.info.render.triangles];
      pal.value=1;const one=capture();pal.value=2;const two=capture();pal.value=0;
      return {actual,one,two,stats};
    };
    for(const m of arcs)m.visible=false;const base=draw();
    for(const m of arcs)m.visible=true;const detail=draw();
    return {base,detail,armed:(window as any).islandAirDiagnostics.tryonCoast,visible:arcs.length};
  };'''))
# Separate the screen area below the open sky and above foreground open
# water. The north-east framing includes the foreground shore at the
# bottom edge; a shallower band would truncate that known foreground.
# Extents are image pixels, not grade or distance limits.
bands={'headland-north':[213,540],'headland-east':[258,540],'headland-grazing':[291,540],'orby-protected':[215,550],'panmure-protected':[255,540]}
def run(a,browser,url):
 byId=json.loads(a.poses.read_text());out={}
 for name in a.views.split(','):
  page=browser.new_page(viewport={'width':860,'height':580});errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
  page.goto(url+'/?diagnostics&qa='+quote(json.dumps(byId[name]["pose"])),wait_until='domcontentloaded')
  page.wait_for_function("window.reviewCamera?.frame>21 && window.islandAirDiagnostics?.roads && window.islandAirDiagnostics?.buildings && window.islandAirDiagnostics?.mainland && window.islandAirDiagnostics?.detail?.ready>0 && window.islandAirDiagnostics.detail.loading===0",timeout=150000)
  q=page.evaluate('()=>window.shoreSkyScout()');imgs={}
  for profile in ('base','detail'):
   tables={}
   for k,v in q[profile].items():
    if k=='stats':continue
    file=a.out/f'{name}-{profile}-{k}.png';file.write_bytes(base64.b64decode(v.split(',',1)[1]));tables[k]=np.asarray(Image.open(file).convert('RGB'),dtype=np.int16)
   imgs[profile]=tables
  assert not errors and not page.evaluate('window.islandAirDiagnostics.layerWarnings'),errors
  old,new=(np.max(np.abs(imgs[k]['one']-imgs[k]['two']),axis=2) for k in ('base','detail'))
  change=np.max(np.abs(imgs['detail']['actual']-imgs['base']['actual']),axis=2)
  y,z=bands[name];remove=old>new
  invented=((old==0)&(new>0)).sum();increased=(new>old+1).sum()
  row=out[name]=dict(bandY=[y,z],oldPartial=int((old[y:z]>0).sum()),newPartial=int((new[y:z]>0).sum()),
   oldPure=int((old[y:z]>=247).sum()),newPure=int((new[y:z]>=247).sum()),newSkyPixels=int(invented),
   increasedByMoreThanOne=int(increased),rgbChanged=int((change>0).sum()),
   rgbOutsideBand=int((change[:y]>0).sum()+(change[z:]>0).sum()),active=q['armed'],visible=q['visible'],
   stats=[q['base']['stats'],q['detail']['stats']])
  assert new.shape==old.shape and not invented and not increased,row
  assert row['rgbOutsideBand']==0 and row['oldPure']>=row['newPure'] and q['armed'],row
  if name.endswith('-protected'):
   assert row['rgbChanged']==0 and row['stats'][0]==row['stats'][1],row
  else:
   assert q['visible']==1 and row['oldPure']-row['newPure']>250 and row['stats'][1][1]-row['stats'][0][1]==554,row
  (a.out/'same-frame.json').write_text(json.dumps(out,indent=2)+'\n')
  print(name,row,flush=True);page.close()
fixed.stage=stage;fixed.capture=run;fixed.run(a)
