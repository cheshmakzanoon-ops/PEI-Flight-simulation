/** Detached Standard-only handoff for the already published 2020 freshwater
 * core. The old explicit World constructor path and every source bit stay put. */
import * as T from 'three';
import {BowleyPond} from '../sim/bowley-pond.ts';
import {CAVENDISH_WATER_CORE as CORE} from '../sim/cavendish-water-core.generated.ts';
import type {Terrain} from '../sim/terrain.ts';
import {BowleyWaterMesh,bowleyClipGLSL,bowleyUniforms} from './bowley-pond.ts';
import type {OlearyLink} from './oleary-railway/program-gate.ts';

const OWNER='13-11',PARENT=112,STOCK_RANGE=PARENT*PARENT*6,STOCK_POINTS=(PARENT+1)**2;
const main='void main(){',landCut='if(coast<0.)discard;';
type OpaqueItem={groupOrder:number;renderOrder:number;material:{id:number};materialVariant:number;z:number;id:number};
type OpaqueSort=(a:OpaqueItem,b:OpaqueItem)=>number;
/** Exact r187 opaque order. Only the replacement for the verified original
 * terrain is aliased; the new water and rim retain their own real IDs. */
export function cavendishOpaqueOrder(stock:number,lease:number):OpaqueSort{
 return (a,b)=>{
  if(a.groupOrder!==b.groupOrder)return a.groupOrder-b.groupOrder;
  if(a.renderOrder!==b.renderOrder)return a.renderOrder-b.renderOrder;
  const x=a.material.id===lease?stock:a.material.id,y=b.material.id===lease?stock:b.material.id;
  if(x!==y)return x-y;
  if(a.materialVariant!==b.materialVariant)return a.materialVariant-b.materialVariant;
  if(a.z!==b.z)return a.z-b.z;
  return a.id-b.id;
 };
}

const digest=(a:Uint8Array<ArrayBuffer>)=>crypto.subtle.digest('SHA-256',a).then(b=>
 Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join(''));
export type CavendishOwner=Readonly<{id:string;mesh:T.Mesh<T.BufferGeometry,T.ShaderMaterial>;stock:T.ShaderMaterial}>;
type Shared=Record<string,T.IUniform>;
type Target={
 renderer:T.WebGLRenderer;scene:T.Scene;camera:T.PerspectiveCamera;terrain:Terrain;
 source:BowleyPond;owner:()=>CavendishOwner|undefined;permit:()=>boolean;link:OlearyLink;signal:AbortSignal;
 /** Original Bowley material constructors, including current regional air. */
 materials:(shared:Shared)=>readonly [T.ShaderMaterial,T.ShaderMaterial];
 /** Seats use current original visible terrain. Proved receivers have ordinary geometry. */
 signature:(b:BowleyPond['bounds'])=>string;height:(x:number,z:number)=>number;
 current:(q:BowleyWaterMesh)=>boolean;
 install:(q:BowleyWaterMesh)=>boolean;remove:(q:BowleyWaterMesh)=>void;
};
export type CavendishWaterSeat=Readonly<{
 ready:()=>boolean;commit:()=>boolean;maintain:()=>boolean;
 beginDraw:()=>undefined|(()=>void);dispose:()=>void;
 state:()=>{draws:number;contact:boolean;radius:boolean};
}>;
function nativeMaterial(m:T.ShaderMaterial){
 return m.visible&&m.opacity===1&&m.depthTest&&m.depthWrite&&m.depthFunc===T.LessEqualDepth&&m.colorWrite&&
  !m.transparent&&!m.alphaTest&&!m.alphaHash&&!m.alphaToCoverage&&!m.lights&&!m.stencilWrite&&!m.wireframe&&!m.polygonOffset&&
  !m.clipping&&!m.clippingPlanes?.length&&!m.uniformsGroups.length&&
  m.onBeforeCompile===T.ShaderMaterial.prototype.onBeforeCompile&&m.customProgramCacheKey===T.ShaderMaterial.prototype.customProgramCacheKey;
}
function borrowed(stock:T.ShaderMaterial,shared:Shared){
 if(!nativeMaterial(stock)||stock.side!==T.FrontSide||stock.glslVersion===T.GLSL3||
    Object.keys(shared).some(k=>k in stock.uniforms)||stock.fragmentShader.includes('bowleyRasterDistance')||
    stock.fragmentShader.split(main).length!==2||stock.fragmentShader.split(landCut).length!==2)return;
 // ShaderMaterial.copy normally clones the textures' sources. Inherit its
 // other immutable render inputs, but borrow these exact Uniform wrappers.
 const template=Object.create(stock,{uniforms:{value:{}}}) as T.ShaderMaterial;
 const out=new T.ShaderMaterial().copy(template);
 out.uniforms={...stock.uniforms,...shared};
 out.fragmentShader=stock.fragmentShader.replace(main,bowleyClipGLSL+'\n'+main)
  .replace(landCut,landCut+'\n if(bowleyDistance(p.xz)<0.&&bowleyRasterDistance()<0.)discard;');
 return out;
}
const attrib=(a:T.BufferAttribute)=>({a,array:a.array,version:a.version,size:a.itemSize,count:a.count,normalized:a.normalized});
function sameAttrib(p:ReturnType<typeof attrib>,a:unknown,version=true){
 return a instanceof T.BufferAttribute&&a===p.a&&a.array===p.array&&a.itemSize===p.size&&a.count===p.count&&
  a.normalized===p.normalized&&(!version||a.version===p.version);
}
export async function prepareCavendishWaterSeat(o:Target):Promise<CavendishWaterSeat|undefined>{
 let cleanup:(()=>void)|undefined;
 try{
  const first=o.owner(),g=first?.mesh.geometry,m=first?.stock,scene=o.scene;
  const p=g?.getAttribute('position'),u=g?.getAttribute('uv'),i=g?.index;
  const viewport=new T.Vector4(),buffer=new T.Vector2(),r=o.renderer,camera=o.camera;
  const alignedFrame=()=>{
   // Do not sample contact under an unprepared back buffer, malformed
   // camera, scissor or alternate output. Called during Dispatch and
   // at commit/maintain *before* the real fixed-step sampler.
   if(T.REVISION!=='187'||!r.sortObjects||r.getScissorTest()||r.getRenderTarget()!==null||
      typeof r.setOpaqueSort!=='function'||!camera.isPerspectiveCamera||camera.layers.mask!==1||
      camera.reversedDepth||!camera.matrixWorld.elements.every(Number.isFinite)||
      !camera.projectionMatrixInverse.elements.every(Number.isFinite))return false;
   const vp=r.getCurrentViewport(viewport),b=r.getDrawingBufferSize(buffer);
   return vp.x===0&&vp.y===0&&Number.isFinite(b.x+b.y)&&b.x>0&&b.y>0&&vp.z===b.x&&vp.w===b.y;
  };
  if(!first||first.id!==OWNER||!m||!g||!p||!u||!i||!(p instanceof T.BufferAttribute)||!(u instanceof T.BufferAttribute)||
     !nativeMaterial(m)||p.itemSize!==3||u.itemSize!==2||i.itemSize!==1||p.count!==STOCK_POINTS||u.count!==STOCK_POINTS||
     !(p.array instanceof Float32Array)||!(u.array instanceof Float32Array)||!(i.array instanceof Uint16Array)||
     p.normalized||u.normalized||i.normalized||i.count!==STOCK_RANGE||
     o.signal.aborted||o.source.spec!==CORE||!o.permit()||!alignedFrame()||!globalThis.crypto?.subtle)return;
  // The packet input isn't owned by this lease. Re-attest the private copy
  // before allocating GPU state, so an external mutation can't desync impact.
  const bytes=o.source.bytes.slice();
  if(await digest(bytes)!==CORE.sha256||o.signal.aborted||!o.permit()||!alignedFrame())return;
  const pond=new BowleyPond(CORE,bytes);
  const datum=bowleyUniforms(pond),data=datum.bowleyMask.value as T.DataTexture;
  const sourceVersion=data.source.version,textureVersion=data.version;
  const own:T.Material[]=[];let owner:BowleyWaterMesh|undefined;
  let closed=false,live=false,drawing=false,sortInstalled=false,reads=0,land:T.ShaderMaterial|undefined;
  const originalParent=first.mesh.parent,stockUniforms=m.uniforms,stockVersion=m.version,
   stockFragment=m.fragmentShader,stockVertex=m.vertexShader,stockDefines=JSON.stringify(m.defines??{}),
   mv=first.mesh.position.clone(),mq=first.mesh.quaternion.clone(),ms=first.mesh.scale.clone(),
   P=attrib(p),U=attrib(u),I=attrib(i);
  const shared:Shared={...datum,bowleyInverseProjection:{value:new T.Matrix4()},
   bowleyEyeToWorld:{value:new T.Matrix4()},bowleyViewport:{value:new T.Vector4(0,0,1,1)}};
  const restore=()=>{
   if(first.mesh.material===land)first.mesh.material=m;
   try{if(owner?.surface.parent===scene)scene.remove(owner.surface);}
   finally{
    try{if(owner?.rim.parent===scene)scene.remove(owner.rim);}
    finally{drawing=false;if(sortInstalled){sortInstalled=false;r.setOpaqueSort(null);}}
   }
  };
  cleanup=()=>{
   if(closed)return;
   closed=true;
   try{restore();}finally{
    try{if(owner&&o.current(owner))o.remove(owner);}
    finally{
     try{owner?.surface.geometry.dispose();}
     finally{try{owner?.rim.geometry.dispose();}finally{try{for(const q of own)q.dispose();}finally{data.dispose();}}}
    }
   }
  };
  const detached=borrowed(m,shared);if(!detached)return;land=detached;own.push(land);
  // Do not mutate Three's immutable object IDs, uniforms, renderer gl
  // bindings or an object on the previously hosted stock list.
  const stockID:unknown=Object.getOwnPropertyDescriptor(m,'id')?.value;
  const leasedID:unknown=Object.getOwnPropertyDescriptor(land,'id')?.value;
  if(typeof stockID!=='number'||typeof leasedID!=='number'||stockID===leasedID||
     !Number.isSafeInteger(stockID)||!Number.isSafeInteger(leasedID))return;
  const order=cavendishOpaqueOrder(stockID,leasedID) as Parameters<T.WebGLRenderer['setOpaqueSort']>[0];
  const extras=o.materials(shared);
  own.push(...extras);
  if(new Set(own).size!==3||extras.some(q=>!nativeMaterial(q)||q.side!==T.DoubleSide))return;
  const mesh=owner=new BowleyWaterMesh(pond,o.terrain,...extras);
  // Link exactly the eventual shader objects. No production parent or
  // stock owner receives any pointer, uniform or buffer edit in Dispatch.
  const group=new T.Group(),duplicate=new T.Mesh(g,land);
  group.add(duplicate,mesh.surface,mesh.rim);
  group.visible=false;
  const materialPin=[land,...extras].map(q=>({q,v:q.vertexShader,f:q.fragmentShader,u:q.uniforms,
   keys:Object.entries(q.uniforms),defines:JSON.stringify(q.defines??{}),version:q.version,
   side:q.side,tone:q.toneMapped}));
  const stockKeys=Object.entries(stockUniforms);
  const pinned=()=>{
   const now=o.owner(),msh=first.mesh;
   return !o.signal.aborted&&!drawing&&!closed&&o.permit()&&alignedFrame()&&now?.id===OWNER&&now.mesh===msh&&now.stock===m&&
    msh.geometry===g&&msh.parent===originalParent&&originalParent===scene&&msh.visible&&msh.material===m&&
    msh.matrixAutoUpdate&&msh.matrixWorldAutoUpdate&&msh.layers.mask===1&&msh.position.equals(mv)&&msh.quaternion.equals(mq)&&msh.scale.equals(ms)&&
    g.groups.length===0&&Object.keys(g.morphAttributes).length===0&&g.drawRange.start===0&&g.drawRange.count===Infinity&&
    // The normal route really re-sews a distant outside rim. The current
    // World owner callback verifies the unchanged lake collar, so only the
    // original position version is allowed to advance within the same array.
    sameAttrib(P,g.getAttribute('position'),false)&&sameAttrib(U,g.getAttribute('uv'))&&sameAttrib(I,g.index)&&
    nativeMaterial(m)&&m.side===T.FrontSide&&m.version===stockVersion&&m.uniforms===stockUniforms&&
    m.vertexShader===stockVertex&&m.fragmentShader===stockFragment&&JSON.stringify(m.defines??{})===stockDefines&&
    Object.keys(stockUniforms).length===stockKeys.length&&stockKeys.every(([k,v])=>m.uniforms[k]===v&&land?.uniforms[k]===v)&&
    materialPin.every(a=>nativeMaterial(a.q)&&a.q.version===a.version&&a.q.side===a.side&&a.q.toneMapped===a.tone&&
     a.q.vertexShader===a.v&&a.q.fragmentShader===a.f&&a.q.uniforms===a.u&&Object.keys(a.u).length===a.keys.length&&
     JSON.stringify(a.q.defines??{})===a.defines&&a.keys.every(([k,v])=>a.u[k]===v))&&
    data.source.version===sourceVersion&&data.version===textureVersion&&data.image.data===bytes&&data.image.width===CORE.width&&data.image.height===CORE.height;
  };
  if(!pinned())return;
  // Even the first link sees a real, seated rim candidate. It is detached.
  mesh.update(o.camera.position.x,o.camera.position.z,o.signature,o.height);
  const linked=await o.link(group,o.signal);
  if(!linked||!pinned()||!linked())return;
  group.remove(duplicate,mesh.surface,mesh.rim);
  const valid=()=>{
   try{return pinned()&&linked()&&!mesh.surface.parent&&!mesh.rim.parent&&mesh.surface.material===extras[0]&&
    mesh.rim.material===extras[1]&&mesh.surface.visible&&mesh.surface.layers.mask===1&&mesh.rim.layers.mask===1;}
   catch{return false;}
  };
  if(!valid())return;
  const ready=()=>!live&&!o.current(mesh)&&valid();
  const maintain=()=>live&&o.current(mesh)&&valid();
  const done=cleanup;
  cleanup=undefined;
  return {
   ready,
   commit(){if(!ready()||!o.install(mesh))return false;live=true;return maintain();},
   maintain,
   beginDraw(){
    if(!maintain())return;
    // maintain() already admitted this exact full-size live viewport. No
    // separate late-only viewport branch from the pre-physics decision.
    (shared.bowleyViewport.value as T.Vector4).copy(viewport);
    (shared.bowleyInverseProjection.value as T.Matrix4).copy(o.camera.projectionMatrixInverse);
    (shared.bowleyEyeToWorld.value as T.Matrix4).copy(o.camera.matrixWorld);
    mesh.update(o.camera.position.x,o.camera.position.z,o.signature,o.height);
    if(!maintain())return;
    drawing=true;
    try{
     sortInstalled=true;r.setOpaqueSort(order);
     first.mesh.material=detached;scene.add(mesh.surface,mesh.rim);reads++;return restore;
    }
    catch{restore();return;}
   },
   state:()=>({draws:reads,contact:o.current(mesh),radius:mesh.rim.visible}),
   dispose:done,
  };
 }catch{return;}
 finally{cleanup?.();}
}
