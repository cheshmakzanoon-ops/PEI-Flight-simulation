#!/usr/bin/env python3
"""Replay the current combined Cape Tryon opt-in and physical renderer fallbacks."""
import argparse,base64,importlib.util,io,json
from pathlib import Path
from urllib.parse import quote
import numpy as np
from PIL import Image
p=argparse.ArgumentParser()
for k in ('checkout','deps','out','poses'):p.add_argument('--'+k,required=True,type=Path)
p.add_argument('--chromium',required=True);p.add_argument('--views',default='headland-north,headland-grazing,headland-east')
p.add_argument('--case',choices=('live','stock','wet','unrequested','stock-coast','depth-only','aa0'),default='live')
p.set_defaults(void_probe=False);a=p.parse_args()
sp=importlib.util.spec_from_file_location('fixed',a.checkout/'tools/qa/fixed-scenery.py')
fx=importlib.util.module_from_spec(sp);sp.loader.exec_module(fx);stage0=fx.stage
def stage(repo,root,deps,unused):
 stage0(repo,root,deps,False)
 j=root/'src/render/world.ts'
 j.write_text(fx.once(j.read_text(),
  'if(skyDiagnostic>.5){gl_FragColor=vec4(1.,0.,1.,1.);return;}',
  'if(skyDiagnostic>.5){gl_FragColor=skyDiagnostic>1.5?vec4(0.,1.,0.,1.):vec4(1.,0.,1.,1.);return;}'))
 # Only this disposable fixture allows the added sky diagnostic palette
 # at admission. Reverse its exact one-line source edit before hashing.
 seat=root/'src/render/cape-tryon-sky-seat.ts'
 code=seat.read_text()
 stage_pair="abi.map((text,i)=>textDigest(i===1?text.replace('if(skyDiagnostic>.5){gl_FragColor=skyDiagnostic>1.5?vec4(0.,1.,0.,1.):vec4(1.,0.,1.,1.);return;}','if(skyDiagnostic>.5){gl_FragColor=vec4(1.,0.,1.,1.);return;}'):text))"
 seat.write_text(fx.once(code,"[...this.skyAbi,...this.shoreAbi].map(textDigest)",stage_pair.replace("abi.map","[...this.skyAbi,...this.shoreAbi].map")))
 j=root/'src/main.ts';main=j.read_text()
 if a.case=='aa0':main=fx.once(main,'antialias:true,alpha:false,logarithmicDepthBuffer:true',
   'antialias:false,alpha:false,logarithmicDepthBuffer:true')
 j.write_text(fx.after_world_paint(main,'''
  (window as any).probeLiveSeat=()=>{
   const pal=(world as any).sky.material.uniforms.skyDiagnostic,gl=renderer.getContext();
   const depthBlock=__DEPTH_ONLY__?new THREE.Mesh(new THREE.PlaneGeometry(1,1),
    new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:true,depthTest:true})):null;
   if(depthBlock){depthBlock.name='QA known depth-only outer colour veto';depthBlock.frustumCulled=false;scene.add(depthBlock);}
   const old=pal.value,r=(add:boolean)=>{
    const end=add?world.capeTryonSkySeat?.begin(camera):undefined;
    try{
     renderer.render(scene,camera);
     const list=renderer.renderLists.get(scene,0).opaque;
     return {img:renderer.domElement.toDataURL(),stats:[renderer.info.render.calls,renderer.info.render.triangles],
      prefix:list.slice(0,2).map(e=>e.object.name),status:world.capeTryonSkySeat?.state??'stock'};
    }finally{end?.();}
   };
   const take=(add:boolean)=>[0,1,2].map(n=>{pal.value=n;return r(add);});
   try{return {before:take(false),after:take(true),rollback:take(false),err:gl.getError(),samples:gl.getParameter(gl.SAMPLES)};}
   finally{pal.value=old;if(depthBlock){scene.remove(depthBlock);depthBlock.geometry.dispose();depthBlock.material.dispose();}}
  };'''.replace('__DEPTH_ONLY__','true' if a.case=='depth-only' else 'false')))
def img(d):return np.asarray(Image.open(io.BytesIO(base64.b64decode(d.split(',',1)[1]))).convert('RGBA'),dtype=np.int16)
def capture(a,browser,url):
 out={};ps=json.loads(a.poses.read_text())
 q={'live':'&capeTryonSkySeatReview&capeTryonRockReview','stock':'&capeTryonSkySeatReview&stockCapeTryonRock',
  'depth-only':'&capeTryonSkySeatReview&capeTryonRockReview','aa0':'&capeTryonSkySeatReview&capeTryonRockReview',
  'wet':'&capeTryonSkySeatReview&capeTryonWaterReview','stock-coast':'&capeTryonSkySeatReview&stockOpenCoast','unrequested':'&capeTryonRockReview'}[a.case]
 for name in a.views.split(','):
  page=browser.new_page(viewport={'width':860,'height':580});errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
  page.goto(url+'/?diagnostics'+q+'&qa='+quote(json.dumps(ps[name]['pose'])),wait_until='domcontentloaded')
  page.wait_for_function("window.reviewCamera?.frame>24 && window.islandAirDiagnostics?.roads && window.islandAirDiagnostics?.buildings && window.islandAirDiagnostics?.mainland && window.islandAirDiagnostics?.detail?.ready>0 && window.islandAirDiagnostics.detail.loading===0",timeout=120000)
  d=page.evaluate('window.islandAirDiagnostics')
  print(name,'initial',d.get('capeTryonSkySeat'),d.get('tryonRockState'),flush=True)
  if a.case in ('live','stock','depth-only') and name.startswith('headland-'):
   wait="window.islandAirDiagnostics?.capeTryonSkySeat==='mounted'"
   if a.case in ('live','depth-only'):wait+="&&window.islandAirDiagnostics?.tryonRockState==='live'"
   try:page.wait_for_function(wait,timeout=30000)
   except Exception:
    diag=page.evaluate('window.islandAirDiagnostics')
    print('seat not ready',diag.get('capeTryonSkySeat'),diag.get('tryonRockState'),errors,flush=True)
  d=page.evaluate('()=>window.probeLiveSeat()')
  before,after,rolled=[[img(x['img']) for x in d[k]] for k in ('before','after','rollback')]
  old=np.max(np.abs(before[1][:,:,:3]-before[2][:,:,:3]),axis=2)
  new=np.max(np.abs(after[1][:,:,:3]-after[2][:,:,:3]),axis=2)
  changes=(before[0][:,:,:3]!=after[0][:,:,:3]).any(axis=2)
  row=out[name]={'case':a.case,'state':d['after'][0]['status'],'rgbChanged':int(changes.sum()),
   'occupiedChanged':int((changes&(old==0)).sum()),'alphaChanged':int((before[0][:,:,3]!=after[0][:,:,3]).sum()),
   'removedPure':int(((old>=247)&(new<247)).sum()),'increasedSky':int((new>old+1).sum()),'samples':d['samples'],
   'prefix':d['after'][0]['prefix'],'stats':[d[k][0]['stats'] for k in ('before','after','rollback')],
   'rollback':all(np.array_equal(x,y) for x,y in zip(before,rolled)),'errors':errors,'gl':d['err']}
  print(name,row,flush=True);(a.out/'live-native.json').write_text(json.dumps(out,indent=2)+'\n')
  assert not errors and not row['gl'] and not row['occupiedChanged'] and not row['alphaChanged'] and not row['increasedSky'] and row['rollback'],row
  if a.case in ('live','stock') and name.startswith('headland-'):
   assert row['state']=='mounted' and row['stats'][1][0]==row['stats'][0][0]+1 and row['stats'][1][1]==row['stats'][0][1]+55,row
   assert row['removedPure']=={'headland-north':231,'headland-grazing':405,'headland-east':259}[name],row
  else:
   assert not row['rgbChanged'] and row['stats'][0]==row['stats'][1],row
   if a.case=='depth-only':assert row['state']=='stock-render' and len(row['prefix'])==2 and row['prefix'][-1]=='Cape Tryon vertical sky-seat preview',row
   if a.case=='aa0':assert row['samples']==0,row
  for phase in ('before','after'):(a.out/f'{name}-{phase}.png').write_bytes(base64.b64decode(d[phase][0]['img'].split(',',1)[1]))
  page.close()
fx.stage=stage;fx.capture=capture;fx.run(a)
