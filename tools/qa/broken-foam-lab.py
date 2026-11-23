#!/usr/bin/env python3
"""Compare original procedural breakers at matched actual shoreline cameras."""
import argparse,importlib.util,json
from pathlib import Path
from urllib.parse import quote
from PIL import Image
import numpy as np
p=Path(__file__).with_name('fixed-scenery.py')
sp=importlib.util.spec_from_file_location('fixed',p);fixed=importlib.util.module_from_spec(sp);sp.loader.exec_module(fixed)
poses=json.loads((p.resolve().parents[2]/'docs/qa/legacy-shore-arc-poses.json').read_text())
cams=[(a['region'],a['pose'],16 if a['region']=='queens-harbour' else 17,'legacyShoreArcs') for a in poses if a['region']!='kings-east-point']
cams.append(('kings-basin-wharf',dict(site='kings-basin-wharf',lon=-62.108062,lat=46.377384,h=1.97,east=.92,south=.3919,
           nearDist=48,nearAgl=16,fixedBaseH=1.97,fixedEyeY=17.4,dist=48,agl=16),11,'legacyShoreArcs&basinChannel&basinWharf'))
original=fixed.stage
def stage(repo,root,deps,_):
 original(repo,root,deps,False)
 p=root/'src/main.ts'
 a=p.read_text()
 p.write_text(fixed.once(a,'const diagnostic=', '''(window as any).qaMapTiles=()=> (world as any).tiles.filter((t:any)=>t.status==='ready').map((t:any)=>t.id).sort();
 const diagnostic='''))
fixed.stage=stage
def capture(args,browser,url):
 results=[]
 for k,pose,n,flags in cams:
  first=None
  for use in ['stock','broken']:
   context=browser.new_context(viewport={'width':900,'height':570},device_scale_factor=1)
   page=context.new_page()
   page.set_default_timeout(125000);errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.on('console',lambda e:errors.append(e.text)if e.type=='error'else None)
   flag='&shoreFoamDetail'if use=='broken'else ''
   page.goto(f'{url}/?diagnostics&{flags}{flag}&qa='+quote(json.dumps(pose)),wait_until='domcontentloaded',timeout=125000)
   page.wait_for_function('n=>window.qaMapTiles?.().length===n && window.islandAirDiagnostics?.detail?.loading===0',arg=n)
   d=fixed.settle(page,errors);ids=page.evaluate('window.qaMapTiles()')
   assert len(ids)==n and not errors
   frame=args.out/f'{k}-{use}.png';page.screenshot(path=str(frame),timeout=125000)
   s={'view':k,'mode':use,'camera':[d['x'],d['eyeY'],d['z']],'draws':d['drawCalls'],'triangles':d['triangles'],'ids':ids,'errors':errors}
   if first:
    for f in ('camera','draws','triangles','ids'):assert first[f]==s[f],(f,first,s)
    a,b=[np.array(Image.open(args.out/f'{k}-{m}.png').convert('RGB'),dtype='int16')for m in ['stock','broken']]
    pix=np.max(abs(a-b),axis=2)
    s['pixelsChangedAboveTwo']=int(np.count_nonzero(pix>2))
    assert s['pixelsChangedAboveTwo']>10
   else:first=s
   results.append(s)
   (args.out/'results.json').write_text(json.dumps(results,indent=2)+'\n')
   print(k,use,s,flush=True)
   context.close()
fixed.capture=capture
a=argparse.ArgumentParser();a.add_argument('--out',type=Path,required=True);a.add_argument('--chromium',required=True);args=a.parse_args()
args.checkout=Path.cwd();args.deps=args.pose_baseline=None;args.void_probe=False
fixed.run(args)
