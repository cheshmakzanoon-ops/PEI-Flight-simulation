#!/usr/bin/env python3
"""Replay one detached Cape Tryon curtain in a temporary copy of the real Three.js scene.

The QA draw and readbacks are never installed in the simulator. Use the
checked strip and pose packets to reproduce the documented comparison.
"""
import argparse, base64, hashlib, importlib.util, json
from pathlib import Path
from urllib.parse import quote
import numpy as np
from PIL import Image

p=argparse.ArgumentParser(description=__doc__)
for n in ('checkout','deps','out','poses','strip'):p.add_argument('--'+n,type=Path,required=True)
p.add_argument('--chromium',required=True)
p.add_argument('--views',default='headland-north,headland-grazing,headland-east,orby-protected,panmure-protected')
p.add_argument('--case',choices=('standard','live-rock','wet-veto','stock-rock','aa0-veto','stock-coast'),default='stock-rock')
p.set_defaults(void_probe=False)
a=p.parse_args()
packet_bytes=a.strip.read_bytes()
packet_sha=hashlib.sha256(packet_bytes).hexdigest()
packet=json.loads(packet_bytes)
anchor=None if isinstance(packet,list) else packet['anchor']
assert anchor is None or anchor==[-23443.888671875,0,-3876.2265625]
coords=packet if anchor is None else packet['position']
assert isinstance(coords,list) and 9<=len(coords)<=1800 and len(coords)%9==0 and all(type(v) in (int,float) and np.isfinite(v) for v in coords)
sp=importlib.util.spec_from_file_location('fixed',a.checkout/'tools/qa/fixed-scenery.py')
fx=importlib.util.module_from_spec(sp);sp.loader.exec_module(fx);stage0=fx.stage

def stage(repo,root,deps,unused):
 stage0(repo,root,deps,False)
 # The reusable Borden proof's 512 limit is a per-frame budget, not a
 # geometric assumption. This detached test uses the identical math on
 # up to 2048 actual canopy submissions, without touching the Borden file.
 shadow=root/'src/render/canopy-late-scope.ts'
 (shadow.parent/'tryon-detached-shadow-scope.ts').write_text(fx.once(shadow.read_text(), 'n>512||', 'n>2048||'))
 j=root/'src/render/world.ts'
 j.write_text(fx.once(j.read_text(),
  'if(skyDiagnostic>.5){gl_FragColor=vec4(1.,0.,1.,1.);return;}',
  'if(skyDiagnostic>.5){gl_FragColor=skyDiagnostic>1.5?vec4(0.,1.,0.,1.):vec4(1.,0.,1.,1.);return;}'))
 j=root/'src/main.ts';s=j.read_text()
 if a.case=='aa0-veto':s=fx.once(s,'antialias:true,alpha:false,logarithmicDepthBuffer:true','antialias:false,alpha:false,logarithmicDepthBuffer:true')
 probe=r'''
 (window as any).tryonVerticalProbe=async()=>{
   const vertices=__STRIP__,anchor=__ANCHOR__ as number[]|null;
   const pal=(world as any).sky.material.uniforms.skyDiagnostic,gl=renderer.getContext();
   const saved=pal.value,order=29000,code={value:0};
   // A single fixed instant: no flight update or reroute between the phases.
   // Mirror the world render scopes rather than drawing outside their leases.
   const render=()=>{let rim:undefined|(()=>void),borden:undefined|(()=>void);
     try{rim=world.beginRegularNorthRimDraw(camera);borden=world.beginBordenShoreArc(camera);
       renderer.render(scene,camera);return renderer.domElement.toDataURL();}
     finally{borden?.();rim?.();}
   };
   const capture=()=>{pal.value=0;const colour=render();
     const stats=[renderer.info.render.calls,renderer.info.render.triangles];
     pal.value=1;const first=render();pal.value=2;const second=render();pal.value=0;
     return {colour,first,second,stats};
   };
   const chord=[-23443.888671875,-0.14000000059604645,-3876.2265625,
      -23491.490234375,-0.14000000059604645,-3858.7607421875,
      -23443.888671875,4.71999979019165,-3876.2265625,
      -23443.888671875,4.71999979019165,-3876.2265625,
      -23491.490234375,-0.14000000059604645,-3858.7607421875,
      -23491.490234375,5.71999979019165,-3858.7607421875];
   const findOwner=(o:any,g:any)=>{
     const pos=g?.getAttribute('position'),uv=g?.getAttribute('uv');
     return o.name==='shore-to-sea surface'&&pos?.count===2730&&uv?.count===2730&&
       chord.every((x,j)=>pos.array[36+j]===x)&&uv.array.subarray(24,36).every((x:number)=>x===0)
       &&o.matrixWorld.equals(new THREE.Matrix4());
   };
   const cameraState={eye:camera.position.toArray(),projection:camera.projectionMatrix.elements.slice(),
     matrixWorld:camera.matrixWorld.elements.slice(),view:camera.matrixWorldInverse.elements.slice(),
     width:gl.drawingBufferWidth,height:gl.drawingBufferHeight,samples:gl.getParameter(gl.SAMPLES)};
   const before=capture(),diag=(window as any).islandAirDiagnostics;
   const list=renderer.renderLists.get(scene,0);
   const entry=({object,material,geometry}:any)=>({name:object.name||object.type,order:object.renderOrder,
    type:material.type,depth:material.depthTest,depthFunc:material.depthFunc,write:material.depthWrite,
    blend:material.blending,positionCount:geometry?.attributes.position?.count??null});
   const otherColour={depthlessOpaque:list.opaque.filter(({material})=>material.colorWrite&&!material.depthWrite).map(entry),
    transmissive:list.transmissive.filter(({material})=>material.colorWrite).map(entry),
    transparent:list.transparent.filter(({material})=>material.colorWrite).map(entry)};
   const owners=list.opaque.filter(({object,geometry})=>findOwner(object,geometry));
   const ground=(world as any).byId.get('12-10');
   const gd=list.opaque.find(({object})=>object===ground?.fine);
   const snapshot=(attr:any)=>new Uint8Array(attr.array.buffer,attr.array.byteOffset,attr.array.byteLength).slice();
   const groundReceipt=gd&&ground.lod===112&&ground.seams==='112:112,112,112,112'&&!ground.coarse.visible&&
       !ground.relief&&gd.geometry===ground.fine.geometry&&gd.material===ground.local&&gd.object.parent===scene&&
       gd.geometry?.index&&gd.geometry.attributes.uv&&gd.geometry.attributes.position?
       {matrix:gd.object.matrixWorld.elements.slice(),seams:ground.seams,
        bytes:[snapshot(gd.geometry.attributes.position),snapshot(gd.geometry.attributes.uv),snapshot(gd.geometry.index)]}:null;
   const stockReceipt=owners.length===1?snapshot(owners[0].geometry.attributes.position):null;
   const hex=async(a:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a)),x=>x.toString(16).padStart(2,'0')).join('');
   const wetVeto=new URLSearchParams(location.search).has('capeTryonWaterReview')||
      renderer.renderLists.get(scene,0).opaque.some(({object})=>object.name==='Cape Tryon signed-water depth-gap preview');
   let g:THREE.BufferGeometry|undefined,m:THREE.ShaderMaterial|undefined,mesh:THREE.Mesh|undefined,draws=0;
   const gpuStates:any[]=[];
   let reason=wetVeto?'wet-owner':(cameraState.samples!==4||gl.getParameter(gl.DEPTH_BITS)!==24||[gl.RED_BITS,gl.GREEN_BITS,gl.BLUE_BITS,gl.ALPHA_BITS].some(k=>gl.getParameter(k)!==8))?'sample-count':!diag?.tryonCoast?'stock-coast':
       owners.length!==1?'owner-count':!groundReceipt?'ground':!renderer.autoClear||!renderer.autoClearDepth||!renderer.sortObjects||
       renderer.getRenderTarget()!==null||renderer.getScissorTest()||renderer.xr.isPresenting||scene.overrideMaterial||renderer.capabilities.reversedDepthBuffer?'renderer':'candidate';
   let lateProof:any={ok:false,reason:'candidate not evaluated'};
   function proveLate(){
    const gl2=gl as WebGL2RenderingContext;
    const width=cameraState.width,height=cameraState.height;
    const M=camera.matrixWorldInverse.clone();
    if(anchor) M.multiply(new THREE.Matrix4().makeTranslation(anchor[0],anchor[1],anchor[2]));
    const footprint=makeVertexFootprint(camera.projectionMatrix.elements,M.elements,width,height);
    if(!footprint)return {ok:false,reason:'camera not admitted'};
    const box=new THREE.Box2();
    for(let i=0;i<vertices.length;i+=3){
     const b=footprint([vertices[i],vertices[i+1],vertices[i+2]]);
     if(!b)return {ok:false,reason:'aperture not completely projectable'};
     box.expandByPoint(new THREE.Vector2(2*(b.x[0]-2)/width-1,1-2*(b.y[1]+2)/height));
     box.expandByPoint(new THREE.Vector2(2*(b.x[1]+2)/width-1,1-2*(b.y[0]-2)/height));
    }
    if(list.opaque.some(({object,material})=>object!==(world as any).sky&&material.colorWrite&&(!material.depthTest||!material.depthWrite||material.depthFunc===THREE.AlwaysDepth))
       ||list.transmissive.some(({material})=>material.colorWrite))return {ok:false,reason:'foreign depthless opaque or transmission colour'};
    const entries=list.transparent.filter(({material})=>material.colorWrite);
    if(entries.length>1)return {ok:false,reason:'multiple transparent colour owners'};
    const item=entries[0];
    if(!item)return {ok:true,reason:'no later transparent colour'};
    const {object:o, geometry:g, material:m}=item;
    if(!(o instanceof THREE.Mesh)||!g)return {ok:false,reason:'foreign transparent colour'};
    const b=provenCanopyShadowBounds(o,g,m,camera,box,width,height);
    if(!b.ok)return b;
    if(b.n===0)return {...b,gpu:'no issued canopy instances'};
    // Draw once with the unmodified graph; defend the CPU projection with
    // the actual live words bound at WebGL's source attribute locations.
    let actual=0,read=false;let observed:any={};
    const oldAfter=o.onAfterRender;
    o.onAfterRender=function(...args:any[]){
     oldAfter.apply(this,args);actual++;
     const program=gl2.getParameter(gl2.CURRENT_PROGRAM);
     const same=(key:string|null,attr:any,count:number)=>{
      const loc=key!==null&&program?gl2.getAttribLocation(program,key):-1;
      if(key!==null&&(loc<0||!gl2.getVertexAttrib(loc,gl2.VERTEX_ATTRIB_ARRAY_ENABLED)||
          gl2.getVertexAttribOffset(loc,gl2.VERTEX_ATTRIB_ARRAY_POINTER)!==0||
          gl2.getVertexAttrib(loc,gl2.VERTEX_ATTRIB_ARRAY_SIZE)!==attr.itemSize||
          gl2.getVertexAttrib(loc,gl2.VERTEX_ATTRIB_ARRAY_STRIDE)!==attr.itemSize*attr.array.BYTES_PER_ELEMENT||
          gl2.getVertexAttrib(loc,gl2.VERTEX_ATTRIB_ARRAY_DIVISOR)!==(attr.isInstancedBufferAttribute?1:0)||
          gl2.getVertexAttrib(loc,gl2.VERTEX_ATTRIB_ARRAY_TYPE)!==gl2.FLOAT||
          gl2.getVertexAttrib(loc,gl2.VERTEX_ATTRIB_ARRAY_NORMALIZED)))return false;
      const v=key===null?gl2.getParameter(gl2.ELEMENT_ARRAY_BUFFER_BINDING):gl2.getVertexAttrib(loc,gl2.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING);
      if(!v||!gl2.isBuffer(v)||!(attr.array instanceof Float32Array||attr.array instanceof Uint16Array||attr.array instanceof Uint32Array))return false;
      const keep=gl2.getParameter(gl2.COPY_READ_BUFFER_BINDING);
      try{
       gl2.bindBuffer(gl2.COPY_READ_BUFFER,v);
       if(gl2.getBufferParameter(gl2.COPY_READ_BUFFER,gl2.BUFFER_SIZE)!==attr.array.byteLength)return false;
       const cpu=attr.array.subarray(0,count*attr.itemSize),gpu=new Uint8Array(cpu.byteLength);
       const bytes=new Uint8Array(cpu.buffer,cpu.byteOffset,cpu.byteLength);
       gl2.getBufferSubData(gl2.COPY_READ_BUFFER,0,gpu);
       return gpu.every((v,i)=>v===bytes[i]);
      }finally{gl2.bindBuffer(gl2.COPY_READ_BUFFER,keep);}
     };
     observed={position:same('position',g.attributes.position,4),index:same(null,g.index,6)};
     for(const k of ['stem','shape','hedgeGround'])observed[k]=same(k,g.attributes[k],b.n);
     read=Object.values(observed).every(Boolean);
    };
    try{pal.value=0;render();}finally{o.onAfterRender=oldAfter;}
    if(!read||actual!==1)return {ok:false,reason:'could not match actual resident canopy bounds',actual,n:b.n,read,observed};
    return {...b,gpu:'all issued input words match CPU',actual};
   }
   try{
    if(reason==='candidate'){
     lateProof=proveLate();
     if(!lateProof.ok)reason='later-colour';
    }
    if(reason==='candidate'){
     const original=owners[0].material;
     const fragmentAnchor='#include <colorspace_fragment>';
     const vertexAnchor='gl_Position=projectionMatrix*viewMatrix*w;';
     if(!(original instanceof THREE.ShaderMaterial)||original.fragmentShader.split(fragmentAnchor).length!==2||original.vertexShader.split(vertexAnchor).length!==2||
        original.transparent||original.side!==THREE.DoubleSide||!original.depthTest||!original.depthWrite)
      throw new Error('unexpected detached study material');
     m=new THREE.ShaderMaterial({
       uniforms:{...original.uniforms,qaCandidateCode:code},defines:{...original.defines},vertexShader:anchor?original.vertexShader.replace(vertexAnchor,'gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);'):original.vertexShader,
       fragmentShader:'uniform int qaCandidateCode;\n'+original.fragmentShader.replace(fragmentAnchor,fragmentAnchor+'\n gl_FragDepth = 1.;\n if (qaCandidateCode != 0) gl_FragColor = vec4(vec3(qaCandidateCode == 2 ? 1. : 0.),1.);'),
       side:original.side,depthTest:true,depthWrite:false,transparent:false,depthFunc:THREE.EqualDepth,
       vertexColors:original.vertexColors,toneMapped:original.toneMapped,fog:original.fog,lights:original.lights,
       clipping:original.clipping,glslVersion:original.glslVersion
     });
     g=new THREE.BufferGeometry();
     g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
     g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(vertices.length/3*2),2));
     g.computeBoundingSphere(); mesh=new THREE.Mesh(g,m);mesh.name='DETACHED Cape Tryon exact vertical extension';
     mesh.renderOrder=order;if(anchor)mesh.position.set(anchor[0],anchor[1],anchor[2]);scene.add(mesh);mesh.onAfterRender=(_r,_s,_c,geo,mat,group)=>{draws++;
      const last=renderer.renderLists.get(scene,0).opaque.at(-1);
      const vp=Array.from(gl.getParameter(gl.VIEWPORT)),range=Array.from(gl.getParameter(gl.DEPTH_RANGE));
      gpuStates.push({
      lateOwner:!!last&&last.object===mesh&&last.geometry===geo&&last.material===mat&&group===null,
      sameViewport:vp.every((n,i)=>n===[0,0,cameraState.width,cameraState.height][i]),
      depthRange:range.length===2&&range[0]===0&&range[1]===1,
      equal:gl.getParameter(gl.DEPTH_FUNC)===gl.EQUAL,depth:gl.isEnabled(gl.DEPTH_TEST),
      noWrite:!gl.getParameter(gl.DEPTH_WRITEMASK),noBlend:!gl.isEnabled(gl.BLEND),
      targetDefault:gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)===null,
      noStencil:!gl.isEnabled(gl.STENCIL_TEST),noScissor:!gl.isEnabled(gl.SCISSOR_TEST),
      noAlphaCoverage:!gl.isEnabled(gl.SAMPLE_ALPHA_TO_COVERAGE),noSampleCoverage:!gl.isEnabled(gl.SAMPLE_COVERAGE),
      clearDepthOne:gl.getParameter(gl.DEPTH_CLEAR_VALUE)===1,
      writesAllColours:Array.from(gl.getParameter(gl.COLOR_WRITEMASK)).every(Boolean)
     });};
    }
    const after=capture();
    const submitted=renderer.renderLists.get(scene,0).opaque;
    const lastOpaque=!!mesh&&submitted[submitted.length-1]?.object===mesh;
    let mask:undefined|{lo:string;hi:string};
    if(mesh&&m){
     pal.value=1;
     code.value=1;m.uniformsNeedUpdate=true;const lo=render();
     code.value=2;m.uniformsNeedUpdate=true;const hi=render();
     code.value=0;m.uniformsNeedUpdate=true;pal.value=0;mask={lo,hi};
    }
    if(mesh)mesh.visible=false;
    const rollback=capture();
    if(mesh)scene.remove(mesh);const err=gl.getError();
    const [stockHash,groundHashes]=await Promise.all([stockReceipt?hex(stockReceipt):null,groundReceipt?Promise.all(groundReceipt.bytes.map(hex)):null]);
    return {before,after,rollback,mask,otherColour,gpuStates,lateProof,camera:cameraState,reason,owners:owners.length,draws,lastOpaque,
      stockHash,groundHashes,groundMatrix:groundReceipt?.matrix??null,
      diag:{water:diag?.capeWetState,rock:diag?.tryonRockState,coast:diag?.tryonCoast},gl:err};
   }finally{pal.value=saved;if(mesh)scene.remove(mesh);g?.dispose();m?.dispose();}
 };'''
 s="import {provenCanopyShadowBounds} from './render/tryon-detached-shadow-scope.ts';\nimport {makeVertexFootprint} from './render/screen-sweep.ts';\n"+s
 j.write_text(fx.after_world_paint(s,probe.replace('__STRIP__',json.dumps(coords,separators=(',',':'))).replace('__ANCHOR__',json.dumps(anchor))))

def image(b):return np.asarray(Image.open(__import__('io').BytesIO(base64.b64decode(b.split(',',1)[1]))).convert('RGBA'),dtype=np.int16)
def projected_bounds(camera):
 xyz=np.asarray(coords).reshape((-1,3))+(np.array(anchor) if anchor is not None else 0)
 vp=np.asarray(camera['projection']).reshape((4,4),order='F') @ np.asarray(camera['view']).reshape((4,4),order='F')
 clip=(vp @ np.c_[xyz,np.ones(len(xyz))].T).T
 if not np.all(clip[:,3]>0):return None
 xy=clip[:,:2]/clip[:,3,None]
 xy=(xy*np.array([1,-1])+1)*np.array([camera['width'],camera['height']])*.5
 return (*np.floor(xy.min(axis=0)-1).astype(int),*np.ceil(xy.max(axis=0)+1).astype(int))

def capture(a,browser,url):
 out={};poses=json.loads(a.poses.read_text())
 options={'live-rock':'&capeTryonRockReview','wet-veto':'&capeTryonWaterReview','stock-rock':'&stockCapeTryonRock','stock-coast':'&stockOpenCoast'}.get(a.case,'')
 for name in a.views.split(','):
  page=browser.new_page(viewport={'width':860,'height':580});errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
  page.goto(url+'/?diagnostics'+options+'&qa='+quote(json.dumps(poses[name]['pose'])),wait_until='domcontentloaded')
  page.wait_for_function("window.reviewCamera?.frame>24 && window.islandAirDiagnostics?.roads && window.islandAirDiagnostics?.buildings && window.islandAirDiagnostics?.mainland && window.islandAirDiagnostics?.detail?.ready>0 && window.islandAirDiagnostics.detail.loading===0 && window.islandAirDiagnostics.tryonRockState!=='pending'",timeout=150000)
  if a.case=='live-rock' and name.startswith('headland-'):
   page.wait_for_function("window.islandAirDiagnostics?.tryonRockState==='live'",timeout=60000)
  q=page.evaluate('()=>window.tryonVerticalProbe()');d={}
  for phase in ('before','after','rollback'):
   d[phase]={k:image(q[phase][k]) for k in ('colour','first','second')}
  old=np.max(np.abs(d['before']['first'][:,:,:3]-d['before']['second'][:,:,:3]),axis=2)
  new=np.max(np.abs(d['after']['first'][:,:,:3]-d['after']['second'][:,:,:3]),axis=2)
  markers=np.zeros(old.shape,dtype=np.int16) if q['mask'] is None else np.max(np.abs(image(q['mask']['hi'])[:,:,:3]-image(q['mask']['lo'])[:,:,:3]),axis=2)
  # The default 4x RGBA8 resolve has five distinct occupancy levels.
  # Check both the exact sample census and absolute encoding residuals.
  old_samples=np.round(old*(4/255)).astype(np.int16)
  new_samples=np.round(new*(4/255)).astype(np.int16)
  candidate_samples=np.round(markers*(4/255)).astype(np.int16)
  bounds=projected_bounds(q['camera'])
  outside=np.ones(old.shape,dtype=bool)
  if bounds:
   x0,y0,x1,y1=bounds;outside[max(0,y0):max(0,y1),max(0,x0):max(0,x1)]=False
  aperture={'headland-north':(460,352,524,377),'headland-east':(198,293,293,298),'headland-grazing':(86,353,167,359)}.get(name)
  def inside(mask):
   if aperture is None:return 0
   ax,ay,bx,by=aperture
   return int(mask[ay:by+1,ax:bx+1].sum())
  rgba=d['before']['colour']!=d['after']['colour']; changed=rgba[:,:,:3].any(axis=2)
  raw_hash=lambda b:hashlib.sha256(np.array(b,dtype=np.uint8).tobytes()).hexdigest()
  row=out[name]=dict(packetSHA256=packet_sha,
    rawRGBA={phase:{k:raw_hash(v) for k,v in images.items()} for phase,images in d.items()},
    rawAmplitudes={'old':raw_hash(old),'new':raw_hash(new),'candidate':raw_hash(markers)},candidatePixels=int((markers>0).sum()),outsideProjection=int((outside&(markers>0)).sum()),
    changedWithoutCandidate=int((changed&(markers==0)).sum()),oldSamples=int(old_samples.sum()),newSamples=int(new_samples.sum()),
    candidateSamples=int(candidate_samples.sum()),
    maxRawConservationError=int(np.max(np.abs(old-new-markers))),
    maxRawCoverageError=float(np.max(np.abs(markers-candidate_samples*(255/4)))),
    maxExistingPaletteError=float(np.max(np.where(markers>0,np.maximum(
      np.abs(old-old_samples*(255/4)),np.abs(new-new_samples*(255/4))),0))),
    sampleErrors=int(np.count_nonzero(old_samples-new_samples-candidate_samples)),
    aperturePureRemoved=inside((old>=247)&(new<247)),apertureCandidatePixels=inside(markers>0),
    otherColour=q['otherColour'],lateProof=q['lateProof'],gpuStates=q['gpuStates'],stockHash=q['stockHash'],groundHashes=q['groundHashes'],groundMatrix=q['groundMatrix'],case=a.case,reason=q['reason'],owners=q['owners'],draws=q['draws'],lastOpaque=q['lastOpaque'],diag=q['diag'],gl=q['gl'],camera=q['camera'],
    rollback=all(np.array_equal(d['before'][k],d['rollback'][k]) for k in d['before']),
    rgbPixels=int(changed.sum()),occupiedRgb=int((changed&(old==0)).sum()),mixedRgb=int((changed&(old>0)&(old<247)).sum()),
    alpha=int(rgba[:,:,3].sum()),inventedSky=int(((old==0)&(new>0)).sum()),increasedSky=int((new>old+1).sum()),
    reducedSky=int((new<old).sum()),pureRemoved=int(((old>=247)&(new<247)).sum()),stats=[q[k]['stats'] for k in ('before','after','rollback')])
  for label,amp in (('base-sky',old),('after-sky',new),('candidate',markers)):
   Image.fromarray(np.asarray(amp,dtype=np.uint8)).save(a.out/f'{name}-{label}.png')
  for phase in ('before','after'):
   (a.out/f'{name}-{phase}.png').write_bytes(base64.b64decode(q[phase]['colour'].split(',',1)[1]))
  (a.out/'vertical-native.json').write_text(json.dumps(out,indent=2)+'\n')
  print(name,json.dumps({k:v for k,v in row.items() if k not in ('camera','otherColour','gpuStates','rawRGBA','rawAmplitudes')}),flush=True)
  assert not errors and not page.evaluate('window.islandAirDiagnostics.layerWarnings'),errors
  assert not row['gl'] and row['rollback'] and not row['occupiedRgb'] and not row['alpha'] and not row['inventedSky'] and not row['increasedSky'],row
  if row['draws']:
   assert row['lateProof']['ok'] and row['maxRawConservationError']<=2 and row['maxRawCoverageError']<=1 and row['maxExistingPaletteError']<=1,row
   assert len(row['gpuStates'])==row['draws'] and all(all(d.values()) for d in row['gpuStates']),row
   assert row['stats'][1][0]==row['stats'][0][0]+1 and row['stats'][1][1]==row['stats'][0][1]+len(coords)//9,row
   assert row['lastOpaque'] and row['stockHash']=='c1ac4eb2b236e5b35a514c05b6b35cc360bf3d2174c48b3b7d0ada14ebf28581',row
   assert row['groundHashes']==[
     'd8bd47c513d2d4797a004d5d488a5e591ff48f4d91f71a07532f7d9e4807234a',
     '9528113580bec53f9f64caae69f51aef5aa52aeb8bed78842dc87d8796353d5e',
     '33871cac1ee31a2c5e4cb22b35de67f6cf10e53758d3c0784b83790caee5fffa'],row
  assert not row['outsideProjection'] and not row['changedWithoutCandidate'] and not row['sampleErrors'],row
  if name in ('headland-north','headland-grazing') and a.case in ('standard','live-rock','stock-rock'):
   assert row['draws']==5 and row['aperturePureRemoved']=={'headland-north':185,'headland-grazing':405}[name],row
  if name=='headland-east':assert not row['apertureCandidatePixels'],row
  if name.endswith('-protected') or a.case in ('wet-veto','aa0-veto','stock-coast'):
   assert not row['rgbPixels'] and not row['reducedSky'],row
  page.close()
fx.stage=stage;fx.capture=capture;fx.run(a)
