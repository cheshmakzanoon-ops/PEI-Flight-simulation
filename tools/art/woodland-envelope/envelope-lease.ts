/** Private comparison adapter. No scene mount, loader, stock writes or URL mode. */
import * as T from 'three';
import {SEALED} from './envelope-seal.generated.ts';
import {envelopeVertex} from './envelopes.ts';
import {branchedCrown} from '../../../src/render/woodland-volume-geometry.ts';
import {opaqueCoverageBlend} from '../../../src/render/opaque-coverage-alpha.ts';
import {branchVertex,branchFragment} from './original-program.ts';

export const COVER='e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9';
export type Route=typeof SEALED[number]['route'];
type Source=typeof SEALED[number];
type Branch=T.Mesh<T.InstancedBufferGeometry,T.ShaderMaterial>;
type SceneOwner=T.Mesh<T.BufferGeometry,T.ShaderMaterial>;
type Words=readonly number[];
const CAP=82000;
const MAX_STYLE=105;
const keys=['position','normal','uv','branchDetail','treeStem','treeShape','treeSpin'] as const;
const markedFragment='uniform float peiBranchTone;\n'+branchFragment.replace('#include <colorspace_fragment>',
 '#include <colorspace_fragment>\n if(peiBranchTone>=0.)gl_FragColor.rgb=vec3(peiBranchTone);\n');
const glslGain='uniform float peiEnvelopeGain;\n'+envelopeVertex.replace('delta=treeEnvelope.y,trim=treeEnvelope.z',
 'delta=treeEnvelope.y*peiEnvelopeGain,trim=treeEnvelope.z*peiEnvelopeGain');
if(glslGain.split('treeEnvelope.y*peiEnvelopeGain').length!==2)throw Error('bound envelope source disappeared');
const key=(x:number,z:number)=>x+':'+z;
const raw=(v:ArrayBufferView)=>new Uint8Array(v.buffer,v.byteOffset,v.byteLength);
const same=(x:ArrayLike<unknown>,y:ArrayLike<unknown>)=>x.length===y.length&&Array.prototype.every.call(x,(v,i)=>Object.is(v,y[i]));
const bytesEqual=(x:Uint8Array,y:Uint8Array)=>x.length===y.length&&x.every((v,i)=>v===y[i]);
const f32=(n:number)=>Number.isFinite(n)&&Math.fround(n)===n;
const hash=async(a:Uint8Array<ArrayBuffer>)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a)),x=>x.toString(16).padStart(2,'0')).join('');
const caps=new WeakMap<object,{p:Source,rows:Map<string,readonly number[]>}>();
export type VerifiedEnvelope=Readonly<{route:Route,owner:string,crown:string,height:string}>;
/** Caller supplies bytes from its already authorised resident/QA data task.
 * It's not a new download, bookmark, source replacement or permission. */
export async function prepareEnvelopeSource(route:Route,crown:Uint8Array,height:Uint8Array):Promise<VerifiedEnvelope|undefined>{
 const p=SEALED.find(n=>n.route===route);
 if(!p||!globalThis.crypto?.subtle||crown.byteLength!==104976||height.byteLength!==104976)return;
 const table=Uint8Array.from(atob(p.styleRows),x=>x.charCodeAt(0));
 const [a,b,c]=await Promise.all([hash(Uint8Array.from(crown)),hash(Uint8Array.from(height)),hash(table)]);
 if(a!==p.sourceCrownSha||b!==p.sourceHeightSha||c!==p.stylesSha256||table.length!==p.candidates*40)return;
 const d=new DataView(table.buffer),rows=new Map<string,readonly number[]>();
 for(let u=0;u<table.length;u+=40){
  const w=Object.freeze(Array.from({length:10},(_,k)=>d.getFloat32(u+k*4,true)));
  const k=key(w[0],w[2]);
  if(rows.has(k)||!w.every(f32)||w[3]<2.6||w[3]>30||w[4]<=0||w[4]>35.4||
    !Number.isInteger(w[5])||w[5]<0||w[5]>3||w[6]<.78999||w[6]>1.24001||
    w[7]<=0||w[7]>=.88||Math.abs(w[8])>.14||Math.abs(w[8]*w[3])>2.4||w[9]<0||w[9]>.126)return;
  rows.set(k,w);
 }
 const o=Object.freeze({route,owner:p.owner,crown:p.sourceCrownSha,height:p.sourceHeightSha});
 caps.set(o,{p,rows});return o;
}

/** Existing base supplies its own real normal scene and renderer attestation.
 * Values here are not a substitute for direct actual WebGL/role tests. */
export type LiveBoundary=Readonly<{
 phase:'dispatch'|'flight';route:string;flight:object;heightPlan:object;source:VerifiedEnvelope;
 signedBase:boolean;defaultStandard:boolean;view:'Chase'|'Cockpit'|'Wide';stockChoice:boolean;
 trustedIntactHost:boolean;nativeViewport:boolean;raster:readonly [samples:number,alphaBits:number,depthBits:number];
 residentCover:string;originalCrown:SceneOwner;originalShade:SceneOwner;scene:T.Scene;
 regionId:string;regionalState:'ready-and-cleared'|'proved-disjoint';regionalProof:object;
 protectedWords:Uint8Array;otherProtectedOwners:readonly T.Object3D[];
}>;
function works(x:LiveBoundary,p:Source,source:VerifiedEnvelope){
 return T.REVISION==='187'&&x.route===p.route&&x.source===source&&x.signedBase&&x.defaultStandard&&!x.stockChoice&&
  x.view==='Chase'&&x.trustedIntactHost&&x.nativeViewport&&same(x.raster,[4,8,24])&&x.residentCover===COVER&&
  x.regionId===p.region&&(p.mandatoryPeerWordBytes?
   x.regionalState==='ready-and-cleared'&&x.protectedWords.byteLength===p.mandatoryPeerWordBytes:
   x.regionalState==='proved-disjoint'&&x.protectedWords.byteLength>0)&&
  x.originalCrown!==x.originalShade&&x.originalCrown.parent===x.scene&&x.originalShade.parent===x.scene&&
  x.originalCrown.geometry===x.originalShade.geometry&&!!x.originalCrown.material.uniforms.canopy?.value?.isTexture&&
  !x.originalShade.material.depthWrite&&x.originalShade.material.transparent&&x.otherProtectedOwners.length>0;
}
function textureMarks(mat:T.ShaderMaterial){
 return Object.values(mat.uniforms).flatMap(u=>{
  const t=u.value as T.Texture;
  return t?.isTexture?[t,t.version,t.source,t.source.version,t.image,t.flipY,t.colorSpace,t.minFilter,t.magFilter,t.wrapS,t.wrapT]:[];
 });
}
function geometryMarks(g:T.BufferGeometry){
 return [g,g.index,g.index?.array,g.index?.version,g.drawRange.start,g.drawRange.count,(g as T.InstancedBufferGeometry).instanceCount,
  ...Object.entries(g.attributes).flatMap(([k,x])=>[k,x,x.array,(x as T.BufferAttribute).version])];
}
function peers(xs:readonly T.Object3D[]){
 return xs.flatMap(x=>{
  const s:unknown[]=[x,x.parent,x.visible,x.renderOrder,x.layers.mask,x.onBeforeRender,x.onAfterRender];
  if(x instanceof T.Mesh){
   s.push(...geometryMarks(x.geometry));
   const m:T.Material|T.Material[]=x.material;
   for(const p of Array.isArray(m)?m:[m]){
    s.push(p,p.version,p.visible,p.depthTest,p.depthWrite,p.transparent,p.side,p.alphaToCoverage,p.colorWrite,p.onBeforeCompile,p.customProgramCacheKey);
    if(p instanceof T.ShaderMaterial)s.push(p.uniforms,...Object.values(p.uniforms),...textureMarks(p));
   }
  }
  return s;
 });
}
function worth(m:SceneOwner){
 const a=m.material;
 return [m,...geometryMarks(m.geometry),m.visible,m.parent,m.onBeforeRender,m.onAfterRender,a,a.version,a.vertexShader,a.fragmentShader,
   a.transparent,a.depthWrite,a.depthTest,a.colorWrite,a.side,a.alphaToCoverage,a.uniforms,...Object.values(a.uniforms),...textureMarks(a)];
}
function captureWorld(x:LiveBoundary){
 return {scene:x.scene,flight:x.flight,heightPlan:x.heightPlan,regionalProof:x.regionalProof,
  words:Uint8Array.from(x.protectedWords),peer:peers(x.otherProtectedOwners),crown:worth(x.originalCrown),shade:worth(x.originalShade)};
}

type Data=NonNullable<ReturnType<typeof caps.get>>;
type Armed={source:VerifiedEnvelope, data:Data, initial:ReturnType<typeof captureWorld>, read:()=>LiveBoundary};
const armed=new WeakMap<object,Armed>();
export type ArmedEnvelope=Readonly<{route:Route}>;
/** One true Begin per Dispatch instance. Missing/late/early data doesn't
 * change the original branch art later. Host creates new latch on actual reset. */
export function createBeginLatch(){
 let consumed=false,stopped=false,grant:ArmedEnvelope|undefined;
 return {
  begin(read:()=>LiveBoundary,source?:VerifiedEnvelope){
   if(consumed||stopped)return;consumed=true;
   if(!source)return;
   const data=caps.get(source);
   if(!data)return;
   let w:LiveBoundary;try{w=read();}catch{return;}
   if(w.phase!=='dispatch'||!works(w,data.p,source))return;
   grant=Object.freeze({route:source.route});
   armed.set(grant,{read,source,data,initial:captureWorld(w)});
   return grant;
  },
  leave(){stopped=true;if(grant)armed.delete(grant);}
 };
}

type BufferStamp={attr:T.BufferAttribute,ref:ArrayBufferView,bytes:Uint8Array,version:number};
const copy=(attr:T.BufferAttribute):BufferStamp=>({attr,ref:attr.array,version:attr.version,bytes:Uint8Array.from(raw(attr.array))});
const intact=(a:BufferStamp,b:unknown)=>a.attr===b&&a.ref===a.attr.array&&a.version===a.attr.version&&bytesEqual(a.bytes,raw(a.attr.array));
function attr(g:T.InstancedBufferGeometry,n:string,sz:number,instanced:boolean){
 const a=g.getAttribute(n);
 if(!(a instanceof T.BufferAttribute)||!(a.array instanceof Float32Array)||a.itemSize!==sz||a.normalized||
  ((a as T.InstancedBufferAttribute).isInstancedBufferAttribute===true)!==instanced)return;
 if(instanced&&(a as T.InstancedBufferAttribute).meshPerAttribute!==1)return;
 return a;
}
const alphaState=(m:T.ShaderMaterial)=>Object.keys(opaqueCoverageBlend).every(k=>
 m[k as keyof typeof opaqueCoverageBlend]===opaqueCoverageBlend[k as keyof typeof opaqueCoverageBlend]);
const materialValues=(m:T.ShaderMaterial)=>[m.alphaToCoverage,m.depthWrite,m.depthTest,m.colorWrite,m.depthFunc,m.side,m.toneMapped,m.transparent,
 m.wireframe,m.stencilWrite,m.polygonOffset,m.alphaHash,m.alphaTest,m.lights,m.clipping,m.fog,m.onBeforeCompile,m.customProgramCacheKey,
 Object.keys(m.defines).length,...Object.values(m.uniforms.volumeFade.value.toArray())];
function templateExact(g:T.InstancedBufferGeometry,v:number){
 const p=branchedCrown(v);
 try{
  return ['position','normal','uv','branchDetail'].every(k=>bytesEqual(raw(p.getAttribute(k).array),raw(g.getAttribute(k).array)))&&
   bytesEqual(raw(p.index!.array),raw(g.index!.array));
 }finally{p.dispose();}
}
function unplaced(x:Branch){
 return x.position.x===0&&x.position.y===0&&x.position.z===0&&x.scale.x===1&&x.scale.y===1&&x.scale.z===1&&
  x.quaternion.x===0&&x.quaternion.y===0&&x.quaternion.z===0&&x.quaternion.w===1&&x.layers.mask===1&&!x.frustumCulled&&!x.castShadow&&!x.receiveShadow;
}
function plainM(m:T.ShaderMaterial){
 return m.constructor===T.ShaderMaterial&&m.vertexShader===branchVertex&&
  (m.fragmentShader===branchFragment||m.fragmentShader===markedFragment)&&m.version===0&&m.depthTest&&m.depthWrite&&m.colorWrite&&
  alphaState(m)&&m.toneMapped&&m.depthFunc===T.LessEqualDepth&&m.alphaToCoverage&&m.side===T.DoubleSide&&!m.transparent&&!m.wireframe&&!m.alphaHash&&m.alphaTest===0&&
  !m.polygonOffset&&!m.stencilWrite&&!m.lights&&!m.clipping&&!m.fog&&Object.keys(m.defines).length===0&&
  m.onBeforeCompile===T.Material.prototype.onBeforeCompile&&m.customProgramCacheKey===T.Material.prototype.customProgramCacheKey&&
  !!m.uniforms.volumeFade?.value?.isVector3&&!m.uniforms.peiEnvelopeGain&&textureMarks(m).length===0;
}
/** Fresh, already-owned art before first upload is a host requirement.
 * Reject scene/protected aliases before writing. Only detached art storage
 * receives an attribute and vertex patch; textures and old attrs are read. */
export function bindFreshEnvelope(grant:ArmedEnvelope,groups:readonly Branch[],marker?:T.ShaderMaterial){
 const token=armed.get(grant);
 if(!token||!groups.length||groups.length>4||new Set(groups).size!==groups.length)return;
 const materials=[...new Set(groups.map(x=>x.material).concat(marker?[marker]:[]))];
 if(!materials.length||!materials.every(plainM))return;
 let mode:LiveBoundary;try{mode=token.read();}catch{return;}
 if(!works(mode,token.data.p,token.source)||mode.phase!=='flight'||mode.flight!==token.initial.flight||
  mode.heightPlan!==token.initial.heightPlan||mode.scene!==token.initial.scene||mode.regionalProof!==token.initial.regionalProof)return;
 // Refuse accidentally shared geometry or materials before any pointer is
 // edited, including an optional marker borrowed from a protected subtree.
 const incoming=new Set<T.BufferGeometry>(groups.map(x=>x.geometry));
 if(incoming.size!==groups.length)return;
 let alias=false;
 const inspect=(x:T.Object3D)=>{
  if(!(x instanceof T.Mesh))return;
  const mm=x.material as T.Material|T.Material[];
  const listed=Array.isArray(mm)?mm:[mm];
  if(incoming.has(x.geometry)||listed.some(p=>materials.some(o=>o===p)))alias=true;
 };
 mode.scene.traverse(inspect);
 for(const owner of [mode.originalCrown,mode.originalShade,...mode.otherProtectedOwners])owner.traverse(inspect);
 if(alias)return;
 const frameBaseline=captureWorld(mode);
 const occupied=new Set<string>(),pending:{m:Branch;style:T.InstancedBufferAttribute}[]=[];
 let n=0,triangles=0;
 for(const m of groups){
  const g=m.geometry;
  if(m.parent!==null||!unplaced(m)||!g.isInstancedBufferGeometry||!g.index||!(g.index.array instanceof Uint16Array)||
    g.groups.length||g.drawRange.start!==0||g.drawRange.count!==Infinity||Object.keys(g.morphAttributes).length||
    !Number.isSafeInteger(g.instanceCount)||g.instanceCount<1||!same(Object.keys(g.attributes).sort(),[...keys].sort()))return;
  const A=attr(g,'treeStem',3,true),B=attr(g,'treeShape',4,true),T0=attr(g,'treeSpin',2,true);
  if(!A||!B||!T0||A.count!==g.instanceCount||B.count!==A.count||T0.count!==A.count||
    !attr(g,'position',3,false)||!attr(g,'normal',3,false)||!attr(g,'uv',2,false)||!attr(g,'branchDetail',2,false))return;
  const variant=B.getZ(0);
  if(!Number.isInteger(variant)||variant<0||variant>3||!templateExact(g,variant))return;
  triangles+=g.index.count/3*g.instanceCount;
  const style=new Float32Array(A.count*3);
  for(let i=0;i<A.count;i++){
   const x=A.getX(i),y=A.getY(i),z=A.getZ(i),k=key(x,z);
   if(occupied.has(k))return;occupied.add(k);
   const expected=token.data.rows.get(k),H=B.getX(i),W=B.getY(i),v=B.getZ(i),l=B.getW(i);
   if(![x,y,z,H,W,v,l].every(f32)||v!==variant)return;
   const turn=((Math.imul(Math.floor(x*5),0x45d9f3b)^Math.imul(Math.floor(z*5),0x119de1f3))>>>0)*(2*Math.PI/4294967296);
   if(T0.getX(i)!==Math.fround(Math.cos(turn))||T0.getY(i)!==Math.fround(Math.sin(turn)))return;
   if(!expected)continue; // same original branch, exact zero effect
   if(!same([x,y,z,H,W,v,l],expected.slice(0,7)))return;
   if(n>=MAX_STYLE)return;
   style.set(expected.slice(7),i*3);n++;
  }
  pending.push({m,style:new T.InstancedBufferAttribute(style,3,false)});
 }
 if(!n||!Number.isSafeInteger(triangles)||triangles>CAP)return;
 const gain={value:0};
 for(const {m,style} of pending)m.geometry.setAttribute('treeEnvelope',style);
 for(const p of materials){
  p.vertexShader=glslGain;
  p.uniforms={...p.uniforms,peiEnvelopeGain:gain};
 }
 const snapshots=groups.map(x=>{
  const g=x.geometry;
  return {x,g,index:copy(g.index!),attrs:Object.fromEntries(Object.entries(g.attributes).map(([k,v])=>[k,copy(v as T.BufferAttribute)])),n:g.instanceCount,
   callbacks:[x.onBeforeRender,x.onAfterRender],order:x.renderOrder};
 });
 const shaders=materials.map(p=>({p,fragment:p.fragmentShader,uniforms:p.uniforms,refs:Object.values(p.uniforms),version:p.version,values:materialValues(p)}));
 let busy=false,refusal='',retired=false;
 const world=()=>{
  if(armed.get(grant)!==token)return false;
  const z=token.read(),w=frameBaseline;
  return z.phase==='flight'&&works(z,token.data.p,token.source)&&z.flight===w.flight&&z.heightPlan===w.heightPlan&&
   z.scene===w.scene&&z.regionalProof===w.regionalProof&&bytesEqual(z.protectedWords,w.words)&&same(peers(z.otherProtectedOwners),w.peer)&&
   same(worth(z.originalCrown),w.crown)&&same(worth(z.originalShade),w.shade);
 };
 const branch=()=>snapshots.every(q=>q.x.parent===token.initial.scene&&q.x.visible&&unplaced(q.x)&&q.x.geometry===q.g&&q.g.instanceCount===q.n&&
  q.x.renderOrder===q.order&&same([q.x.onBeforeRender,q.x.onAfterRender],q.callbacks)&&materials.includes(q.x.material)&&
  Object.keys(q.g.attributes).length===keys.length+1&&intact(q.index,q.g.index)&&
  Object.entries(q.attrs).every(([k,w])=>intact(w,q.g.getAttribute(k))))&&
  shaders.every(({p,fragment,uniforms,refs,version,values})=>alphaState(p)&&same(materialValues(p),values)&&p.vertexShader===glslGain&&p.fragmentShader===fragment&&p.version===version&&
   uniforms===p.uniforms&&same(Object.values(p.uniforms),refs)&&p.uniforms.peiEnvelopeGain===gain);
 const stable=()=>{try{return world()&&branch();}catch{return false;}};
 return {
  log:()=>({styled:n,triangles,draws:groups.length,gain:gain.value,refusal,retired}),
  close(){if(busy)throw Error('envelope close requires an idle render');gain.value=0;retired=true;},
  /** Call once around the full synchronous renderer.render/owned capture.
   * Separate unpatched source comparison in QA proves zero-gain neutral. */
  draw<TOut>(setting:'shape'|'off',run:()=>TOut):TOut{
   if(busy)throw Error('envelope comparison is already drawing');
   if(gain.value!==0){gain.value=0;retired=true;refusal='foreign gain open';}
   const on=setting==='shape'&&!retired&&stable();
   if(setting==='shape'&&!on&&!refusal)refusal='world, source, or owner custody';
   busy=true;
   try{
    gain.value=Number(on);
    const out=run();
    if(out&&typeof (out as {then?:unknown}).then==='function')throw Error('envelope requires a synchronous render');
    return out;
   }finally{
    gain.value=0;busy=false;
    if(on&&!stable()){retired=true;refusal='post-render custody';}
   }
  }
 };
}
