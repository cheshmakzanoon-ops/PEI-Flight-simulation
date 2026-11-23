#!/usr/bin/env python3
"""Actual same-tab water mask and stock/preview color comparison."""
import importlib.util,argparse,json
from pathlib import Path
from urllib.parse import quote
from PIL import Image
import numpy as np
s=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
prep=m.stage
root=Path(__file__).resolve().parents[2]
views=json.loads((root/'docs/qa/legacy-shore-arc-poses.json').read_text())
v=next(a for a in views if a['region']=='queens-harbour')['pose']
def stage(repo,stageRoot,deps,_):
 prep(repo,stageRoot,deps,False)
 w=stageRoot/'src/render/world.ts';s=w.read_text()
 needle='if(shore>=0.)discard;'
 assert s.count(needle)==1
 s=s.replace(needle,needle+'\n if(qaWaterOnly>.5){gl_FragColor=vec4(1.,0.,1.,1.);return;}')
 needle='uniform sampler2D imageMap,coverMap,rippleMap;'
 assert s.count(needle)==1
 s=s.replace(needle,'uniform float qaWaterOnly,qaFoamVariant; '+needle)
 needle="brokenShoreFoam(q,shore,t,dist,n,foamFootprint,foamPixelM)"
 assert s.count(needle)==2
 s=s.replace(needle,"(qaFoamVariant>.5?brokenShoreFoam(q,shore,t,dist,n,foamFootprint,foamPixelM):shoreFoam(q,shore,t,dist,n,foamFootprint))")
 needle='ocean.rotation.x=-Math.PI/2;ocean.position.y=OCEAN_Y;'
 assert s.count(needle)==1
 s=s.replace(needle,needle+'ocean.name="QA water only";oceanMaterial.uniforms.qaWaterOnly={value:0};oceanMaterial.uniforms.qaFoamVariant={value:0};')
 s=s.replace('this.t.value=12;','this.t.value=(window as any).qaFoamPhase??12;')
 w.write_text(s)
 p=stageRoot/'src/main.ts';s=p.read_text()
 p.write_text(m.once(s,'const diagnostic=', '''
 (window as any).qaTiles=()=> (world as any).tiles.filter((t:any)=>t.status==='ready').map((t:any)=>t.id).sort();
 (window as any).qaWater=(mask:boolean,branch:boolean,phase:number)=>{
  (window as any).qaFoamPhase=phase;
  const q=(scene.getObjectByName("QA water only") as THREE.Mesh).material as THREE.ShaderMaterial;
  q.uniforms.qaWaterOnly.value=mask?1:0;q.uniforms.qaFoamVariant.value=branch?1:0;
  return (window as any).reviewCamera?.frame??0;
 };
 const diagnostic='''))
m.stage=stage
def capture(args,browser,url):
 c=browser.new_context(viewport={'width':900,'height':570},device_scale_factor=1);page=c.new_page();errors=[]
 page.set_default_timeout(125000)
 page.on('pageerror',lambda x:errors.append(str(x)));page.on('console',lambda x:errors.append(x.text)if x.type=='error'else None)
 page.goto(url+'/?diagnostics&legacyShoreArcs&shoreFoamDetail&qa='+quote(json.dumps(v)),wait_until='domcontentloaded')
 page.wait_for_function('()=>window.qaTiles?.().length===16 && window.islandAirDiagnostics.detail.loading===0')
 pre=m.settle(page,errors)
 fields=[]
 def px(phase,key,branch,diag):
  n=page.evaluate('([a,b,c])=>window.qaWater(a,b,c)',[diag,branch,phase])
  page.wait_for_function('n=>window.reviewCamera.frame>=n+2',arg=n)
  p=args.out/f'{phase}-{key}.png';page.screenshot(path=str(p),timeout=125000)
  return np.asarray(Image.open(p).convert('RGB'),dtype='int16')
 for phase in [12,26]:
  a,b,q=px(phase,'stock',False,False),px(phase,'broken',True,False),px(phase,'water',True,True)
  wet=(q[:,:,0]>244)&(q[:,:,1]<10)&(q[:,:,2]>244)
  change=np.max(abs(a-b),axis=2)
  pix=change>2
  covered=wet.copy()
  covered[1:]|=wet[:-1];covered[:-1]|=wet[1:]
  covered[:,1:]|=wet[:,:-1];covered[:,:-1]|=wet[:,1:]
  outside=int((pix&~covered).sum());delta=int(pix.sum())
  fields.append({'phase':phase,'waterPixels':int(wet.sum()),'pixelsChangedAboveTwo':delta,'outsideWaterOrOnePxEdge':outside,'maximumOutsideChange':int(np.max(change[~covered]))})
  print(fields[-1],flush=True)
  assert outside<=2
 assert not errors,errors
 (args.out/'results.json').write_text(json.dumps(dict(camera=[pre['x'],pre['eyeY'],pre['z']],frames=fields,errors=errors),indent=2)+'\n')
 c.close()
m.capture=capture
p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True);a=p.parse_args()
a.checkout=Path.cwd();a.deps=a.pose_baseline=None;a.void_probe=False
m.run(a)
