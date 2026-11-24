#!/usr/bin/env python3
"""Actual Standard foam and stock controls, scoped by the visible water mask."""
import importlib.util,argparse,json
from pathlib import Path
from urllib.parse import quote
from PIL import Image
import numpy as np
s=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
prep=m.stage
root=Path(__file__).resolve().parents[2]
views=json.loads((root/'docs/qa/legacy-shore-arc-poses.json').read_text())
v={a['region']:a['pose'] for a in views if a['region']!='kings-east-point'}
v['kings-basin-wharf']=dict(site='kings-basin-wharf',lon=-62.108062,lat=46.377384,h=1.97,east=.92,south=.3919,
 nearDist=48,nearAgl=16,fixedBaseH=1.97,fixedEyeY=17.4,dist=48,agl=16)
def stage(repo,stageRoot,deps,_):
 prep(repo,stageRoot,deps,False)
 w=stageRoot/'src/render/world.ts';s=w.read_text()
 needle='if(shore>=0.)discard;'
 assert s.count(needle)==1
 s=s.replace(needle,needle+'\n if(qaWaterOnly>.5){gl_FragColor=qaWaterOnly>1.5?vec4(0.,1.,0.,1.):vec4(1.,0.,1.,1.);return;}')
 needle='uniform sampler2D imageMap,coverMap,rippleMap;'
 assert s.count(needle)==1
 s=s.replace(needle,'uniform float qaWaterOnly,qaFoamVariant; '+needle)
 needle="brokenShoreFoam(q,shore,t,dist,n,foamFootprint,foamPixelM)"
 assert s.count(needle)==1
 s=s.replace(needle,"(qaFoamVariant>.5?brokenShoreFoam(q,shore,t,dist,n,foamFootprint,foamPixelM):shoreFoam(q,shore,t,dist,n,foamFootprint))")
 needle='ocean.rotation.x=-Math.PI/2;ocean.position.y=OCEAN_Y;'
 assert s.count(needle)==1
 s=s.replace(needle,needle+'ocean.name="QA water only";oceanMaterial.uniforms.qaWaterOnly={value:0};oceanMaterial.uniforms.qaFoamVariant={value:1};')
 s=s.replace('this.t.value=12;','this.t.value=(window as any).qaFoamPhase??12;')
 w.write_text(s)
 p=stageRoot/'src/main.ts';s=p.read_text()
 p.write_text(m.once(s,'const diagnostic=', '''
 (window as any).qaTiles=()=> (world as any).tiles.filter((t:any)=>t.status==='ready').map((t:any)=>t.id).sort();
 (window as any).qaWater=(mask:number,branch:boolean,phase:number)=>{
  (window as any).qaFoamPhase=phase;
  const q=(scene.getObjectByName("QA water only") as THREE.Mesh).material as THREE.ShaderMaterial;
  q.uniforms.qaWaterOnly.value=mask;q.uniforms.qaFoamVariant.value=branch?1:0;
  return (window as any).reviewCamera?.frame??0;
 };
 const diagnostic='''))
m.stage=stage
def capture(args,browser,url):
 reports={}
 for region,pose in v.items():
  c=browser.new_context(viewport={'width':620,'height':416},device_scale_factor=1);page=c.new_page();errors=[]
  page.set_default_timeout(125000)
  page.on('pageerror',lambda x:errors.append(str(x)));page.on('console',lambda x:errors.append(x.text)if x.type=='error'else None)
  page.goto(url+'/?diagnostics&qa='+quote(json.dumps(pose)),wait_until='domcontentloaded')
  page.wait_for_function('window.islandAirDiagnostics?.shoreFoamDetail===true')
  pre=m.settle(page,errors)
  fields=[]
  def px(phase,key,branch,diag):
   n=page.evaluate('([a,b,c])=>window.qaWater(a,b,c)',[diag,branch,phase])
   page.wait_for_function('n=>window.reviewCamera.frame>=n+2',arg=n)
   p=args.out/f'{region}-{phase}-{key}.png';page.screenshot(path=str(p),timeout=125000)
   return np.asarray(Image.open(p).convert('RGB'),dtype='int16')
  for phase in [12,26]:
   a,b=px(phase,'stock',False,0),px(phase,'standard',True,0)
   magenta,green=px(phase,'water-magenta',True,1),px(phase,'water-green',True,2)
   # Two sentinels recover even partially covered MSAA samples at oblique edges.
   wet=np.any(magenta!=green,axis=2)
   change=np.max(abs(a-b),axis=2)
   pix=change>2
   covered=wet.copy()
   covered[1:]|=wet[:-1];covered[:-1]|=wet[1:]
   covered[:,1:]|=wet[:,:-1];covered[:,:-1]|=wet[:,1:]
   outside=int((pix&~covered).sum());delta=int(pix.sum())
   fields.append({'phase':phase,'waterPixels':int(wet.sum()),'protectedPixels':int((~covered).sum()),'pixelsChangedAboveTwo':delta,
    'outsideWaterOrOnePxEdge':outside,'maximumOutsideChange':int(np.max(change[~covered]))})
   assert outside==0 and int(np.max(change[~covered]))==0,(region,fields[-1])
  assert not errors and sum(r['pixelsChangedAboveTwo'] for r in fields)>10,(region,fields,errors)
  reports[region]=dict(camera=[pre['x'],pre['eyeY'],pre['z']],draws=pre['drawCalls'],triangles=pre['triangles'],frames=fields,errors=errors)
  print(region,reports[region],flush=True)
  (args.out/'results.json').write_text(json.dumps(reports,indent=2)+'\n')
  c.close()
m.capture=capture
p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True);a=p.parse_args()
a.checkout=Path.cwd();a.deps=a.pose_baseline=None;a.void_probe=False
m.run(a)
