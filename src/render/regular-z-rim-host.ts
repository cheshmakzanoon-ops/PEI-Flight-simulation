import * as THREE from 'three';
import type {Cover} from '../sim/cover.ts';
import type {Terrain} from '../sim/terrain.ts';
import {verifyDecodedCover} from '../sim/cover-proof.ts';
import {CANOPY_FENCE} from './canopy-fence.generated.ts';
import {standardLandAtlasMatches} from './meadow-standard.ts';
import {acquireRegularNorthRimClip,patchRegularNorthRimVertex,
 RIM_UNIFORM,STOCK_TERRAIN_VERTEX,type StockTile} from './regular-z-rim-clip-v2.ts';

import {regularNorthRimSampleProfile,type RegularNorthRimSampleProfile} from './regular-z-rim-raster-profile.ts';

const PAIRS=[['20-16','20-17'],['20-18','20-19']] as const;

type GroundTile={
 id:string;lod:number;seams?:string;relief?:unknown;coarse:THREE.Mesh;fine?:THREE.Mesh;local:THREE.ShaderMaterial;
};
type Lock=NonNullable<ReturnType<typeof acquireRegularNorthRimClip>>;
type MaterialLock={
 mat:THREE.ShaderMaterial;fragment:string;defines:THREE.ShaderMaterial['defines'];uniforms:THREE.ShaderMaterial['uniforms'];
 materialHook:THREE.ShaderMaterial['onBeforeRender'];cacheKey:THREE.ShaderMaterial['customProgramCacheKey'];
 compileHook:THREE.ShaderMaterial['onBeforeCompile']; settings:readonly unknown[]; defineEntries:readonly unknown[];version:number;
};
type Pair={
 north:GroundTile;south:GroundTile;oldNorth:MaterialLock;oldSouth:MaterialLock;candidateVertex:string;
 scalar:{value:number};lease?:Lock;rejected?:readonly unknown[];bound:boolean;
 /** Do not stamp repeatedly on stable unknown geometry or take over foreign materials. */
 poisoned:boolean;
};
const hookKeys=[THREE.Object3D.prototype.onBeforeRender,THREE.Object3D.prototype.onAfterRender] as const;
const own=(o:object,k:string)=>Object.prototype.hasOwnProperty.call(o,k);
const same=(a:readonly unknown[],b?:readonly unknown[])=>!!b&&a.length===b.length&&a.every((x,k)=>x===b[k]);
const settings=(m:THREE.ShaderMaterial)=>[
 m.depthTest,m.depthWrite,m.depthFunc,m.colorWrite,m.side,m.transparent,m.blending,m.alphaTest,m.alphaToCoverage,
 m.stencilWrite,m.polygonOffset,m.polygonOffsetFactor,m.polygonOffsetUnits,m.wireframe,m.glslVersion,m.precision,
 m.forceSinglePass,m.clipping,m.clipShadows,m.clipIntersection,m.clippingPlanes,m.opacity,m.alphaHash,m.premultipliedAlpha,
 m.blendEquation,m.blendSrc,m.blendDst,m.blendEquationAlpha,m.blendSrcAlpha,m.blendDstAlpha,m.dithering,
 m.vertexColors,m.fog,m.lights,m.toneMapped,
];
const lock=(mat:THREE.ShaderMaterial):MaterialLock=>({mat,fragment:mat.fragmentShader,defines:mat.defines,uniforms:mat.uniforms,
 materialHook:mat.onBeforeRender,cacheKey:mat.customProgramCacheKey,compileHook:mat.onBeforeCompile,settings:settings(mat),defineEntries:Object.entries(mat.defines??{}).flat(),version:mat.version});
const exactMaterial=(t:GroundTile,l:MaterialLock,source:string)=>t.local===l.mat&&t.local.vertexShader===source&&
 t.local.fragmentShader===l.fragment&&t.local.defines===l.defines&&t.local.uniforms===l.uniforms&&
 t.local.onBeforeRender===l.materialHook&&t.local.customProgramCacheKey===l.cacheKey&&t.local.onBeforeCompile===l.compileHook&&
 t.local.version===l.version&&same(settings(t.local),l.settings)&&same(Object.entries(t.local.defines??{}).flat(),l.defineEntries);
const optLayout=(t:GroundTile)=>!!t.fine&&t.lod===112&&!t.relief&&!t.coarse.visible&&t.fine.visible&&t.fine.layers.mask===1;
const candidates=(t:GroundTile)=>[t.fine,t.fine?.geometry,t.seams,
 t.fine?.geometry.index,t.fine?.geometry.index?.version,
 ...t.fine?.matrixWorld.elements??[],t.fine?.layers.mask,t.fine?.geometry.drawRange.start,t.fine?.geometry.drawRange.count,
 ...['position','uv','normal'].flatMap(name=>{
  const a=t.fine?.geometry.getAttribute(name) as THREE.BufferAttribute|undefined;
  return [a,a?.array,a?.version];
 })];

/** Render-only. A Cover checksum is requested once from the existing cached
 * proof on first local N112 pair. World load and late/remote fallback stay
 * literal stock. No extra asset, tile visit, render or physics path. */
export class RegularNorthRimDraw {
 private readonly pairs:Pair[]=[];
 private readonly gl:ReturnType<THREE.WebGLRenderer['getContext']>;
 private sampleProfile?:RegularNorthRimSampleProfile;
 private profileCaps?:THREE.WebGLRenderer['capabilities'];
 private phase:'cold'|'checking'|'verified'|'stock';
 private active=false;
 private previous:string[]=[];
 constructor(private readonly scene:THREE.Scene,private readonly renderer:THREE.WebGLRenderer,
   private readonly terrain:Terrain,private readonly cover:Cover,private readonly terrainSha:string,
   getTile:(id:string)=>GroundTile|undefined,private readonly protectedGrade:(id:string)=>boolean){
  this.gl=renderer.getContext();
  const knownMeta=standardLandAtlasMatches(terrain,terrainSha,cover)&&'createVertexArray' in this.gl;
  this.phase=knownMeta&&(!cover.sourceDecodedSha||cover.sourceDecodedSha===CANOPY_FENCE.pins.coverDecoded)?'cold':'stock';
  if(this.phase==='stock')return;
  for(const [n,s] of PAIRS){
   const north=getTile(n),south=getTile(s);
   if(!north||!south||north.local.vertexShader!==STOCK_TERRAIN_VERTEX||north.local===south.local||
      own(north.local.uniforms,RIM_UNIFORM)||own(south.local.uniforms,RIM_UNIFORM))continue;
   const candidateVertex=patchRegularNorthRimVertex(south.local.vertexShader,s,terrain,terrainSha);
   if(!candidateVertex)continue;
   const oldNorth=lock(north.local),oldSouth=lock(south.local);
   if(![oldNorth,oldSouth].every(r=>r.mat.isShaderMaterial&&r.mat.depthTest&&r.mat.depthWrite&&
     r.mat.depthFunc===THREE.LessEqualDepth&&r.mat.colorWrite&&r.mat.side===THREE.FrontSide&&!r.mat.transparent&&
     !r.mat.alphaTest&&!r.mat.alphaToCoverage&&!r.mat.stencilWrite&&!r.mat.polygonOffset&&!r.mat.wireframe&&
     r.materialHook===THREE.Material.prototype.onBeforeRender&&r.cacheKey===THREE.Material.prototype.customProgramCacheKey&&
     r.compileHook===THREE.Material.prototype.onBeforeCompile))continue;
   this.pairs.push({north,south,oldNorth,oldSouth,candidateVertex,scalar:{value:0},bound:false,poisoned:false});
  }
 }
 diagnostics(){return {source:this.phase,drawnFine:this.previous.slice()};}
 private normalCanvas(r:THREE.WebGLRenderer=this.renderer,scene:THREE.Scene=this.scene){
  return r===this.renderer&&scene===this.scene&&r.getContext()===this.gl&&!this.gl.isContextLost()&&
    !scene.overrideMaterial&&!r.getRenderTarget()&&!r.xr.isPresenting&&r.autoClear&&r.autoClearDepth&&r.sortObjects&&
    r.capabilities.logarithmicDepthBuffer&&!r.capabilities.reversedDepthBuffer;
 }
 private coarseOK(p:Pair){
  return !p.poisoned&&optLayout(p.north)&&optLayout(p.south)&&
    !this.protectedGrade(p.north.id)&&!this.protectedGrade(p.south.id);
 }
 private stillExact(p:Pair){
  // Compile only via the construction-owned material and preserve all
  // existing wrappers, program flags, material identity and literal fragment.
  return exactMaterial(p.north,p.oldNorth,STOCK_TERRAIN_VERTEX)&&
   exactMaterial(p.south,p.oldSouth,p.bound?p.candidateVertex:STOCK_TERRAIN_VERTEX)&&
   (p.bound?p.oldSouth.uniforms[RIM_UNIFORM]===p.scalar:!own(p.oldSouth.uniforms,RIM_UNIFORM));
 }
 private neutral(p:Pair){
  // Mark the shared stock wrapper on the actual ShaderMaterial. Coarse,
  // support draws and other render paths must never inherit a positive gain.
  if(p.scalar.value!==0){p.scalar.value=0;p.oldSouth.mat.uniformsNeedUpdate=true;}
 }
 private unbind(p:Pair){
  this.neutral(p);
  if(!p.bound)return;
  const m=p.oldSouth.mat;
  if(m.uniforms===p.oldSouth.uniforms&&m.uniforms[RIM_UNIFORM]===p.scalar)delete m.uniforms[RIM_UNIFORM];
  if(m.vertexShader===p.candidateVertex){
   const ours=m.version===p.oldSouth.version;
   m.vertexShader=STOCK_TERRAIN_VERTEX;m.needsUpdate=true;
   if(ours)p.oldSouth.version=m.version;else p.poisoned=true;
  }
  p.bound=false;
 }
 private acquire(p:Pair):Lock|undefined{
  if(!this.coarseOK(p)||!this.stillExact(p)){this.unbind(p);p.lease=undefined;p.rejected=undefined;return;}
  // Only the two stock pairs and only on the local near path. No scene
  // traversal; prepare their original pure translations before first paint.
  const a=p.north.fine!,b=p.south.fine!;
  a.updateWorldMatrix(false,false);b.updateWorldMatrix(false,false);
  if(a.onBeforeRender!==hookKeys[0]||a.onAfterRender!==hookKeys[1]||
     b.onBeforeRender!==hookKeys[0]||b.onAfterRender!==hookKeys[1]){
   this.unbind(p);p.lease=undefined;p.rejected=undefined;return;
  }
  if(p.lease?.value())return p.lease;
  const key=[...candidates(p.north),...candidates(p.south)];
  if(same(key,p.rejected)){this.unbind(p);return;}
  const next=acquireRegularNorthRimClip(this.terrain,this.terrainSha,this.scene,
    p.north as unknown as StockTile,p.south as unknown as StockTile);
  p.lease=next;
  if(!next){p.rejected=key;this.unbind(p);}
  else p.rejected=undefined;
  return next;
 }
 private bind(p:Pair){
  if(!this.stillExact(p)){this.unbind(p);p.poisoned=true;return false;}
  if(!p.bound){
   const m=p.oldSouth.mat;
   // Retain the actual original material.id and all other object pointers.
   m.uniforms[RIM_UNIFORM]=p.scalar;m.vertexShader=p.candidateVertex;m.needsUpdate=true;
   p.oldSouth.version=m.version;p.bound=true;
  }
  return true;
 }
 begin(camera:THREE.PerspectiveCamera):undefined|(()=>void){
  if(this.active||!this.pairs.length)return;
  this.previous=[];
  if(!this.normalCanvas()||!(camera instanceof THREE.PerspectiveCamera)||camera.layers.mask!==1){
   if(this.gl.isContextLost()){this.sampleProfile=undefined;this.profileCaps=undefined;}
   for(const p of this.pairs)this.unbind(p);
   return;
  }
  if(!this.pairs.some(p=>this.coarseOK(p))){
   for(const p of this.pairs)this.unbind(p);
   return;
  }
  // Inspect the real default framebuffer once, on the qualified local path.
  // This is never a query per draw/frame; loss restarts the raster preflight.
  const caps=this.renderer.capabilities;
  if(this.sampleProfile===undefined||this.profileCaps!==caps){
   // r187 recreates capabilities even if both restore events occurred between
   // RAFs and getContext() still returns the same WebGL object.
   this.profileCaps=caps;
   // Three r187 deliberately asks WebGL for alpha:true also when the
   // ordinary renderer constructor's *clear* alpha option is false.
   this.sampleProfile=regularNorthRimSampleProfile(
    this.gl.getContextAttributes(),()=>this.gl.getParameter(this.gl.SAMPLES));
  }
  if(this.sampleProfile==='unsupported'){
   for(const p of this.pairs)this.unbind(p);
   return;
  }
  if(this.phase==='cold'){
   this.phase='checking';
   const bytes=this.cover.bytes,buffer=bytes.buffer;
   void verifyDecodedCover(this.cover).then(sha=>{
    this.phase=sha===CANOPY_FENCE.pins.coverDecoded&&this.cover.bytes===bytes&&bytes.buffer===buffer?'verified':'stock';
   },()=>{this.phase='stock';});
  }
  if(this.phase!=='verified')return;
  // Scene identity is immutable in the ordinary path. Refresh only the root
  // matrix and eligible owner matrices, never all scene descendants.
  this.scene.updateWorldMatrix(false,false);
  const done:(()=>void)[]=[];
  this.active=true;let closed=false;
  const close=()=>{
   if(closed)return;closed=true;
   try{for(let i=done.length-1;i>=0;i--)done[i]();}
   finally{this.active=false;}
  };
  try{
   for(const p of this.pairs){
    this.neutral(p);
    const proof=this.acquire(p);
    const m=p.oldSouth.mat;
    if(!proof||!this.bind(p))continue;
    const object=p.south.fine!;
    const priorBefore=object.onBeforeRender,priorAfter=object.onAfterRender;
    const before:THREE.Object3D['onBeforeRender']=(r,sc,cameraArg,g,mat,group)=>{
     this.neutral(p);
     if(!this.active||!p.bound||!this.normalCanvas(r,sc)||r.capabilities!==caps||cameraArg!==camera||g!==object.geometry||
        mat!==m||group!=null||object!==p.south.fine||camera.layers.mask!==1||
        object.onBeforeRender!==before||object.onAfterRender!==after||!this.coarseOK(p)||!this.stillExact(p)){
      // This callback precedes setProgram. If a foreign wrapper replaced our
      // scalar, zeroing the original wrapper alone cannot guarantee a stock
      // draw; restore the actual owned vertex source without taking the new
      // wrapper or a foreign material.
      this.unbind(p);return;
     }
     const z=proof.value();
     if(z>0){p.scalar.value=z;m.uniformsNeedUpdate=true;}else this.unbind(p);
    };
    const after:THREE.Object3D['onAfterRender']=(r,sc,cameraArg,g,mat,group)=>{
     if(p.scalar.value>0&&p.bound&&this.active&&this.normalCanvas(r,sc)&&r.capabilities===caps&&cameraArg===camera&&g===object.geometry&&
        mat===m&&group==null&&camera.layers.mask===1&&this.coarseOK(p)&&this.stillExact(p)&&proof.value()===p.scalar.value)
      this.previous.push(p.south.id);
     this.neutral(p);
    };
    done.push(()=>{
     this.neutral(p);
     if(object.onBeforeRender===before)object.onBeforeRender=priorBefore;
     if(object.onAfterRender===after)object.onAfterRender=priorAfter;
    });
    object.onBeforeRender=before;object.onAfterRender=after;
   }
  }catch{
   close();
   for(const p of this.pairs){this.unbind(p);p.lease=undefined;}
   return;
  }
  if(!done.length){close();return;}
  return close;
 }
}
