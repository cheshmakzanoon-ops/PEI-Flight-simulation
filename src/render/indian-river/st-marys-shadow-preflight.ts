/** Only for the original four Indian River shade roles. Construction/linking
 * do not attach anything to the scene or change original stock draw state. */
import * as T from 'three';
import {ST_MARYS_SLOT_ATTRIBUTE as SLOT,ST_MARYS_RECEIVER_VERTEX as RECEIVER,
 patchStMarysStockSuppression,borrowStMarysShadowMaterial,buildStMarysReceivers,type StMarysShadowGround} from './st-marys-shadows.ts';
import {mappedHedgeShadowsAvoidGrade} from './st-marys-hedge-guard.ts';

export type StMarysStockRoster=Readonly<{
 stock:T.Mesh;stems:Float32Array;shapes:Float32Array;original:number;revision:number;total:number;
}>;
type Input={
 renderer:T.WebGLRenderer;camera:T.Camera;scene:T.Scene;
 source:StMarysShadowGround;
 /** Existing original forest roster, including the appended hedge rows. */
 roster:()=>StMarysStockRoster|undefined;
 /** Exact local terrain/site/owner and proposed hedge clearance must still hold. */
 permit:()=>boolean;
 signal:AbortSignal;
};
type LiveStock=T.Mesh<T.InstancedBufferGeometry,T.ShaderMaterial>;
type BufferWithVersion=T.BufferAttribute|T.InterleavedBufferAttribute;
type Variant=T.Mesh<T.BufferGeometry,T.ShaderMaterial>;
type ProgramProof=()=>boolean;
const expectedShadow='29ae01f807c7eac7b8070984733bf742353525ae74de0bfdacedde270c8e7f8d';
const gradeKey='st-marys-2020-grade-study', capacity=45000;
const recipe={position:3,uv:2,stem:3,shape:4,hedgeGround:4} as const;
const attrKeys=Object.keys(recipe) as (keyof typeof recipe)[];
const allowedUniform=['canopy','canopySun'];
const restQuad={position:[-.5,.5,0,.5,.5,0,-.5,-.5,0,.5,-.5,0],uv:[0,1,1,1,0,0,1,0],index:[0,2,1,2,3,1]};
const exactArray=(a:ArrayLike<number>,b:ArrayLike<number>)=>a.length===b.length&&Array.prototype.every.call(b,(v,i)=>a[i]===v);
const words=(k:Record<string,unknown>,terms:readonly string[])=>Object.keys(k).every(x=>terms.includes(x));
const safe=(f:()=>boolean)=>{try{return f()===true;}catch{return false;}};
const plain=(g:T.BufferGeometry)=>!g.groups.length&&!Object.keys(g.morphAttributes).length&&
  g.drawRange.start===0&&g.drawRange.count===Infinity;
const thumb=(a:BufferWithVersion)=>({a,raw:a.array,item:a.itemSize,count:a.count,norm:a.normalized,
 version:a instanceof T.InterleavedBufferAttribute?a.data.version:a.version,
 usage:a instanceof T.InterleavedBufferAttribute?a.data.usage:a.usage,
 div:a instanceof T.InstancedBufferAttribute?a.meshPerAttribute:0});
const binding=(p:ReturnType<typeof thumb>,a:BufferWithVersion|undefined)=>!!a&&p.a===a&&p.raw===a.array&&
 p.item===a.itemSize&&p.count===a.count&&p.norm===a.normalized&&
 p.div===(a instanceof T.InstancedBufferAttribute?a.meshPerAttribute:0)&&
 p.usage===(a instanceof T.InterleavedBufferAttribute?a.data.usage:a.usage);
const version=(a:BufferWithVersion)=>a instanceof T.InterleavedBufferAttribute?a.data.version:a.version;
const same=(p:ReturnType<typeof thumb>,a:BufferWithVersion|undefined)=>!!a&&binding(p,a)&&p.version===version(a);
const pose=(m:T.Object3D)=>m.matrixAutoUpdate&&m.matrixWorldAutoUpdate&&m.quaternion.x===0&&m.quaternion.y===0&&
 m.quaternion.z===0&&m.quaternion.w===1&&m.scale.x===1&&m.scale.y===1&&m.scale.z===1&&m.layers.mask===1;
const originalRaster=(m:T.ShaderMaterial)=>m.transparent&&m.side===T.DoubleSide&&m.forceSinglePass&&
 m.visible&&m.opacity===1&&m.colorWrite&&m.depthTest&&!m.depthWrite&&m.depthFunc===T.LessEqualDepth&&
 m.blending===T.NormalBlending&&m.polygonOffset&&m.polygonOffsetFactor===-1&&m.polygonOffsetUnits===-2&&
 !m.alphaTest&&!m.alphaToCoverage&&!m.wireframe&&!m.stencilWrite&&!m.clipping&&!m.fog&&!m.lights&&!m.premultipliedAlpha&&
 !m.clippingPlanes?.length&&!Object.keys(m.defines??{}).length&&m.glslVersion===null&&
 m.onBeforeCompile===T.ShaderMaterial.prototype.onBeforeCompile&&
 m.customProgramCacheKey===T.ShaderMaterial.prototype.customProgramCacheKey;
const isStock=(m:T.Mesh):m is LiveStock=>m.geometry instanceof T.InstancedBufferGeometry&&m.material instanceof T.ShaderMaterial;
const pause=()=>new Promise<void>(resolve=>setTimeout(resolve,16));
type Program={program:WebGLProgram;isReady:()=>boolean};

/** r187 compile traverses invisible groups for materials. These transparent,
 * DoubleSide ShaderMaterials are stock forceSinglePass, so exactly two
 * programs; the generic opaque art linker rejects them. Never render here. */
async function linkPair(o:Input,group:T.Group,mats:readonly [T.ShaderMaterial,T.ShaderMaterial],still:()=>boolean):Promise<ProgramProof|undefined>{
 const {renderer:r,camera,scene,signal}=o,gl=r.getContext(),attrs=gl.getContextAttributes();
 if(T.REVISION!=='187'||signal.aborted||group.parent||group.visible||group.children.length!==2||
    !attrs?.alpha||!attrs.depth||!attrs.antialias||gl.getParameter(gl.SAMPLES)!==4||
    !r.capabilities.isWebGL2||!r.capabilities.logarithmicDepthBuffer||r.capabilities.reversedDepthBuffer)return;
 const {fog,environment}=scene,output=r.outputColorSpace,tone=r.toneMapping,shadow=r.shadowMap.enabled;
 const samePipe=()=>!signal.aborted&&r.getContext()===gl&&!gl.isContextLost()&&r.getRenderTarget()===null&&
  !scene.overrideMaterial&&scene.fog===fog&&scene.environment===environment&&camera.layers.mask===1&&
  !r.xr.isPresenting&&r.outputColorSpace===output&&r.toneMapping===tone&&r.shadowMap.enabled===shadow&&
  !r.localClippingEnabled&&!r.clippingPlanes.length&&r.capabilities.isWebGL2&&
  r.capabilities.logarithmicDepthBuffer&&!r.capabilities.reversedDepthBuffer;
 if(!samePipe()||!still()||!mats.every(originalRaster))return;
 const compiled=r.compile(group,camera,scene);
 if(compiled.size!==2||!mats.every(m=>compiled.has(m)))return;
 const handle=(m:T.Material)=>(r.properties.get(m) as {currentProgram?:Program}).currentProgram;
 const programs=mats.map(handle);
 if(programs.some(q=>!q?.program||typeof q.isReady!=='function')||programs[0]===programs[1])return;
 const pinned=()=>samePipe()&&mats.every((m,i)=>originalRaster(m)&&handle(m)===programs[i]);
 const deadline=performance.now()+3200;
 for(let i=0;i<201&&performance.now()<deadline;i++){
  if(!pinned()||!still()||group.parent||group.visible)return;
  if(!programs.every(q=>q!.isReady())){await pause();continue;}
  if(!programs.every(q=>gl.isProgram(q!.program)&&gl.getProgramParameter(q!.program,gl.LINK_STATUS)===true))return;
  return ()=>safe(pinned);
 }
}

export type StMarysPreparedShadowPair=Readonly<{
 stock:LiveStock;
 stockGeometry:T.InstancedBufferGeometry;
 stockMaterial:T.ShaderMaterial;
 suppression:T.Mesh<T.InstancedBufferGeometry,T.ShaderMaterial>;
 receiver:Variant;
 mask:T.InstancedBufferAttribute;
 slots:readonly number[];
 triangleCount:number;
 source:StMarysShadowGround;
 forestRevision:number;
 /** Only before the owner's actual transaction; this intentionally fails
  * once the stock scene or its current generation has been exchanged. */
 unmountedStill:()=>boolean;
 /** Before physics and with the original shade material/geometry still
  * submitted. A refused re-seat terminally invalidates this flight pair. */
 refresh:()=>boolean;
 /** Exact prepared GL key, no arbitrary new program guarantee. */
 programsStill:()=>boolean;
 /** Caller must restore its actual stock owner before releasing this pair. */
 dispose:()=>void;
}>;

export async function prepareStMarysShadowPreflight(o:Input){
 let cancel:undefined|(()=>void);
 try{
  const {scene,signal,source}=o,first=o.roster();
  if(signal.aborted||!safe(o.permit)||!first||!isStock(first.stock)||source.gradeId!==gradeKey||
     source.mesh.userData.localGrade!==gradeKey||source.mesh.userData.subdiv!==112)return;
  const stock=first.stock,g=stock.geometry,m=stock.material,
    p=source.mesh,pg=p.geometry,pos=pg.getAttribute('position'),ix=pg.index;
  if(!plain(g)||!plain(pg)||!pos||!ix||pos.itemSize!==3||g.index?.count!==6||
    Object.keys(g.attributes).length!==attrKeys.length||g.getAttribute(SLOT)||
    !Number.isSafeInteger(first.revision)||first.revision<0||
    !Number.isInteger(first.original)||first.original<4||first.total<first.original||first.total>capacity||
    !Number.isInteger(first.total)||first.total!==g.instanceCount||stock.position.lengthSq()!==0||
    stock.frustumCulled||stock.castShadow||stock.receiveShadow||p.position.y!==0)return;
  const entries=attrKeys.map(key=>{
   const a=g.getAttribute(key);
   if(!(a instanceof T.BufferAttribute)||a.itemSize!==recipe[key]||a.normalized||!(a.array instanceof Float32Array)||
      (key==='position'||key==='uv'?a.count!==4:!(a instanceof T.InstancedBufferAttribute)||a.meshPerAttribute!==1||a.count!==capacity))throw Error('Non-stock shade vertex inputs');
   return [key,thumb(a)] as const;
  });
  const h=g.getAttribute('hedgeGround') as T.InstancedBufferAttribute, pPos=thumb(pos),pIndex=thumb(ix),sIndex=thumb(g.index!);
  const mUniforms=m.uniforms,mGroups=m.uniformsGroups,canopy=mUniforms.canopy,texture=canopy?.value,
       matV=m.vertexShader,matF=m.fragmentShader,matEpoch=m.version,stockOrder=stock.renderOrder,
       place=p.position.clone(),bounds=[...source.bounds],siteFn=source.inChangedSupport;
  if(mGroups.length||!words(mUniforms,allowedUniform)||!(texture instanceof T.Texture)||!texture.source.data||
    !originalRaster(m)||first.stems!==g.getAttribute('stem').array||first.shapes!==g.getAttribute('shape').array)return;
  const texSrc=texture.source,texData=texSrc.data,texVer=texture.version,texSrcVer=texSrc.version;
  const exactPlane=()=>g.index!.array instanceof Uint16Array&&!g.index!.normalized&&g.index!.itemSize===1&&
   exactArray(g.index!.array,restQuad.index)&&exactArray(g.getAttribute('position').array,restQuad.position)&&
   exactArray(g.getAttribute('uv').array,restQuad.uv);
  const stockNow=():StMarysStockRoster|undefined=>{
   try{
    const now=o.roster();
    if(signal.aborted||!o.permit()||!now||now.stock!==stock||now.stems!==first.stems||now.shapes!==first.shapes||
     !Number.isSafeInteger(now.revision)||now.revision<0||!Number.isInteger(now.original)||now.original<4||
     !Number.isInteger(now.total)||now.total<now.original||now.total>capacity||g.instanceCount!==now.total||
     stock.parent!==scene||!stock.visible||!pose(stock)||stock.position.lengthSq()!==0||stock.renderOrder!==stockOrder||
     stock.frustumCulled||stock.castShadow||stock.receiveShadow||stock.geometry!==g||stock.material!==m||
     !plain(g)||g.getAttribute(SLOT)||Object.keys(g.attributes).length!==entries.length||!same(sIndex,g.index??undefined)||!exactPlane()||
     !entries.every(([k,stamp])=>(k==='position'||k==='uv'?same:binding)(stamp,g.getAttribute(k)))||
     m.uniforms!==mUniforms||m.uniformsGroups!==mGroups||mGroups.length||!words(mUniforms,allowedUniform)||
     mUniforms.canopy!==canopy||canopy.value!==texture||texture.source!==texSrc||texSrc.data!==texData||
     texture.version!==texVer||texSrc.version!==texSrcVer||m.version!==matEpoch||m.vertexShader!==matV||m.fragmentShader!==matF||!originalRaster(m)||
     source.gradeId!==gradeKey||p.userData.localGrade!==gradeKey||p.userData.subdiv!==112||!pose(p)||!p.position.equals(place)||
     source.bounds.length!==4||!source.bounds.every((x,i)=>x===bounds[i])||source.inChangedSupport!==siteFn||
     p.geometry!==pg||!plain(pg)||!binding(pPos,pg.getAttribute('position'))||!same(pIndex,pg.index??undefined))return;
    return now;
   }catch{return;}
  };
  // Root/World owns the immutable regular grade. The same stored position
  // resource may gain a new exact outer rim through the admitted owner.
  // Never re-seat onto a different tile, ground position binding or index.
  const freeze=(r:StMarysStockRoster)=>({original:r.original,total:r.total,rev:r.revision,
   versions:entries.map(([,p])=>version(p.a)),groundVersion:version(pos)});
  type Epoch=ReturnType<typeof freeze>;
  const matches=(r:StMarysStockRoster,e:Epoch)=>r.original===e.original&&r.total===e.total&&r.revision===e.rev&&
   entries.every(([,p],i)=>version(p.a)===e.versions[i])&&version(pos)===e.groundVersion;
  const matchesStock=(e:Epoch)=>{const now=stockNow();return !!now&&matches(now,e);};
  const firstEpoch=freeze(first);
  if(!matchesStock(firstEpoch)||!globalThis.crypto?.subtle)return;
  const exact=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(matV+'\0'+matF));
  if(Array.from(new Uint8Array(exact),v=>v.toString(16).padStart(2,'0')).join('')!==expectedShadow||!matchesStock(firstEpoch))return;
  const patch=patchStMarysStockSuppression(m);
  if(!patch)return;
  const fitsSlots=(a:readonly number[],r:StMarysStockRoster)=>a.length===4&&new Set(a).size===4&&a.every(i=>i>=0&&i<r.original&&
   h.getX(i)===0&&h.getY(i)===0&&h.getZ(i)===0&&h.getW(i)===0);
  const make=(r:StMarysStockRoster)=>{
   if(!mappedHedgeShadowsAvoidGrade(source.bounds,r.stems,r.shapes,r.original,r.total))return;
   const q=buildStMarysReceivers(source,gradeKey,r.stems,r.shapes,r.original,r.total);if(!q)return;
   const slots=Object.freeze([...q.slots]);
   if(!fitsSlots(slots,r)){q.geometry.dispose();return;}
   const samples=slots.map(i=>[...r.stems.subarray(i*3,i*3+3),...r.shapes.subarray(i*4,i*4+4)]);
   const attrs=Object.entries(q.geometry.attributes).map(([k,v])=>[k,thumb(v)] as const);
   return {
    ...q,slots,
    sameFour:()=>slots.every((i,j)=>h.getX(i)===0&&h.getY(i)===0&&h.getZ(i)===0&&h.getW(i)===0&&
     samples[j].every((v,k)=>v===(k<3?r.stems[i*3+k]:r.shapes[i*4+k-3]))),
    exactGeometry:()=>!q.geometry.index&&plain(q.geometry)&&Object.keys(q.geometry.attributes).length===attrs.length&&
     attrs.every(([k,v])=>same(v,q.geometry.getAttribute(k)))
   };
  };
  const firstDraft=make(first);
  if(!firstDraft)return;
  let draft=firstDraft,state=firstEpoch;
  cancel=()=>draft.geometry.dispose();
  const mask=new T.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(T.DynamicDrawUsage);
  for(const i of draft.slots)mask.setX(i,1);
  const borrowed=borrowStMarysShadowMaterial(m);
  borrowed.vertexShader=patch.vertexShader;borrowed.fragmentShader=patch.fragmentShader;
  const received=borrowStMarysShadowMaterial(m);received.vertexShader=RECEIVER;
  const wrapper=new T.InstancedBufferGeometry();
  wrapper.instanceCount=g.instanceCount;
  wrapper.boundingBox=g.boundingBox;wrapper.boundingSphere=g.boundingSphere;
  for(const [k,stamp] of entries)wrapper.setAttribute(k,stamp.a);
  wrapper.setAttribute(SLOT,mask);wrapper.setIndex(g.index);
  const suppress=new T.Mesh(wrapper,borrowed),receiver=new T.Mesh(draft.geometry,received);
  suppress.renderOrder=receiver.renderOrder=stockOrder;
  suppress.frustumCulled=receiver.frustumCulled=false;
  receiver.position.copy(place);
  suppress.name='Indian River stock shade suppression preflight';
  receiver.name='St Mary’s four re-seated canonical woodland receivers';
  const group=new T.Group();group.name='Indian River detached shade programs';group.visible=false;group.add(suppress,receiver);
  let maskPin=thumb(mask);
  const maskExact=()=>{ // Only at exact ownership hand-off or rare roster change, not every frame.
   for(let i=0;i<capacity;i++)if(mask.array[i]!==Number(draft.slots.includes(i)))return false;
   return true;
  };
  let dead=false,taken=false,held=false;
  const destroy=()=>{if(dead)return;dead=true;
   suppress.removeFromParent();receiver.removeFromParent();
   // Three WebGLGeometries disposes *attached* inputs of a buffer.
   // Keep original canopy vertex/index resources owned by the live renderer.
   for(const [k] of entries)wrapper.deleteAttribute(k);
   wrapper.setIndex(null);wrapper.dispose();
   draft.geometry.dispose();borrowed.dispose();received.dispose();
  };
  cancel=destroy;
  const programsExact=()=>!dead&&!held&&suppress.material===borrowed&&receiver.material===received&&
   borrowed.vertexShader===patch.vertexShader&&borrowed.fragmentShader===patch.fragmentShader&&
   received.vertexShader===RECEIVER&&received.fragmentShader===matF&&borrowed.uniforms===mUniforms&&received.uniforms===mUniforms&&
   mUniforms.canopy===canopy&&canopy.value===texture&&texture.source===texSrc&&texSrc.data===texData&&
   texture.version===texVer&&texSrc.version===texSrcVer;
  const ownedStill=()=>suppress.geometry===wrapper&&receiver.geometry===draft.geometry&&suppress.visible&&receiver.visible&&
   pose(suppress)&&pose(receiver)&&suppress.position.lengthSq()===0&&!suppress.frustumCulled&&!receiver.frustumCulled&&
   suppress.renderOrder===stockOrder&&receiver.renderOrder===stockOrder&&receiver.position.equals(place)&&
   wrapper.index===g.index&&wrapper.instanceCount===state.total&&plain(wrapper)&&same(maskPin,wrapper.getAttribute(SLOT))&&
   Object.keys(wrapper.attributes).length===entries.length+1&&draft.exactGeometry()&&
   entries.every(([k,stamp])=>binding(stamp,wrapper.getAttribute(k)));
  const shaderStill=()=>programsExact()&&matchesStock(state)&&draft.sameFour()&&ownedStill();
  const stillDetached=()=>shaderStill()&&group.parent===null&&!group.visible&&suppress.parent===group&&receiver.parent===group;
  const link=await linkPair(o,group,[borrowed,received],stillDetached);
  if(!link||!stillDetached()||!link())return;
  const intact=()=>!taken&&stillDetached()&&link();
  const programsStill=()=>safe(programsExact)&&link();
  const hold=()=>{held=true;return false;};
  const refresh=()=>{
   if(!taken||!programsStill()||!ownedStill())return hold();
   const now=stockNow();
   if(!now||now.revision<state.rev)return hold();
   if(matches(now,state))return draft.sameFour()||hold();
   const next=freeze(now);
   // A roster that claims unchanged revision cannot drift in count or in
   // any original GPU instance stream. Only an independently intact rim
   // on the same ground mesh may require a same-roster refresh.
   if(now.revision===state.rev&&(next.original!==state.original||next.total!==state.total||
      next.versions.some((v,i)=>v!==state.versions[i])||!draft.sameFour()))return hold();
   if(!maskExact())return hold();
   let candidate:ReturnType<typeof make>;
   try{
    candidate=make(now);
    if(!candidate||!matchesStock(next)||!programsStill()||!ownedStill()||!candidate.sameFour())return hold();
    // Both prepared shader/material IDs and the one index-borrowing wrapper
    // survive. Only the four true original exclusion slots may move. Keep
    // pending dirty ranges from an earlier transit frame until real upload.
    for(const i of draft.slots)if(!candidate.slots.includes(i)){mask.setX(i,0);mask.addUpdateRange(i,1);}
    for(const i of candidate.slots)if(!draft.slots.includes(i)){mask.setX(i,1);mask.addUpdateRange(i,1);}
    if(mask.updateRanges.length)mask.needsUpdate=true;
    const retired=draft.geometry;
    draft=candidate;candidate=undefined;state=next;
    maskPin=thumb(mask);wrapper.instanceCount=next.total;receiver.geometry=draft.geometry;
    retired.dispose(); // The prior real receiver owned every input. Never dispose source/skin inputs.
    return true;
   }catch{return hold();}
   finally{candidate?.geometry.dispose();}
  };
  const result:StMarysPreparedShadowPair={
   stock,stockGeometry:g,stockMaterial:m,suppression:suppress,receiver,mask,
   get slots(){return draft.slots;},get triangleCount(){return draft.triangleCount;},source,
   get forestRevision(){return state.rev;},
   unmountedStill:()=>shaderStill()&&link(),refresh,programsStill,dispose:destroy
  };
  cancel=undefined;
  return {
   intact,
   /** Nothing is published/attached. The caller explicitly takes ownership
    * of the same objects used to link; never recreate or clone their programs. */
   take(){if(!intact()||!maskExact())return;taken=true;suppress.removeFromParent();receiver.removeFromParent();return result;},
   dispose(){if(!taken)destroy();}
  };
 }catch{return;}
 finally{cancel?.();}
}
