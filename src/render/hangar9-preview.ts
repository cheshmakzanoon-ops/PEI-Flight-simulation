import {BufferAttribute,Group,Mesh,REVISION,ShaderMaterial,Vector4,type BufferGeometry,type PerspectiveCamera,type Scene,type WebGLRenderer} from 'three';
import type {OlearyLink,OlearyProgramProof} from './oleary-railway/program-gate.ts';
import {HANGAR9_STOCK as P} from './hangar9-stock-pins.generated.ts';
import {H9_NW_SCOPE as B,makeH9NwCladdingStudy} from '../../tools/art/hangar9-nw-finish/hangar9-nw-cladding.ts';

type Art=NonNullable<Awaited<ReturnType<typeof makeH9NwCladdingStudy>>>;
type Subject=Readonly<{mesh:Mesh<BufferGeometry,ShaderMaterial>;wire:ArrayBuffer;current:()=>boolean}>;
export type Hangar9Reader=()=>Subject|undefined;
type Staged=Readonly<{geometry:BufferGeometry;stock:ShaderMaterial;mesh:Subject['mesh'];intact:()=>boolean;art:Art;linked:OlearyProgramProof}>;
const equal=(a:readonly number[],b:readonly number[])=>a.length===b.length&&a.every((x,i)=>x===b[i]);
const sha=async (a:Uint8Array<ArrayBuffer>)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a)),x=>x.toString(16).padStart(2,'0')).join('');
const bytes=(a:BufferAttribute)=>new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength).slice();
const layout=Object.entries(P.attrLayout) as [keyof typeof P.attrLayout,(typeof P.attrLayout)[keyof typeof P.attrLayout]][];

/** Uses the normal route with a reversible borrowed material in one after-sort draw.
 * No new scene actors, geometry or per-frame byte validation. */
export class Hangar9Preview {
 private subject?:Staged;
 private read:Hangar9Reader=()=>undefined;
 private peers=()=>true;
 private pending?:AbortController;
 private refused=false;
 private allowedThisFlight=false;
 private activeDraw=false;
 private readonly viewport=new Vector4();
 private readonly r:WebGLRenderer;
 private readonly scene:Scene;
 private readonly camera:PerspectiveCamera;
 private readonly link:OlearyLink;
 constructor(r:WebGLRenderer,scene:Scene,camera:PerspectiveCamera,link:OlearyLink){
  this.r=r;this.scene=scene;this.camera=camera;this.link=link;
 }
 invalidate(){this.reset();this.refused=true;}
 setReader(read:Hangar9Reader,peers=()=>true){this.read=read;this.peers=peers;}
 get phase(){return this.subject?.intact()&&this.subject.linked()?'ready':this.refused?'stock':'waiting';}
 get active(){return this.activeDraw;}
 canPrepare(){
  const gl=this.r.getContext() as WebGL2RenderingContext;
  return !gl.isContextLost()&&!this.r.xr.isPresenting&&this.r.getRenderTarget()===null&&!this.scene.overrideMaterial&&!this.r.getScissorTest()&&
   gl.getParameter(gl.SAMPLES)===4&&gl.getParameter(gl.ALPHA_BITS)===8&&gl.getParameter(gl.DEPTH_BITS)===24;
 }
 private reset(){
  this.pending?.abort();this.pending=undefined;
  this.subject?.art.dispose();this.subject=undefined;
  this.allowedThisFlight=false;this.activeDraw=false;this.refused=false;
 }
 dispatch(wanted:boolean){
  if(!wanted){this.reset();return;}
  this.allowedThisFlight=false;
  if(this.subject&&(!this.subject.intact()||!this.subject.linked())){this.reset();this.refused=true;}
  if(this.pending||this.subject||this.refused)return;
  const original=this.read();
  if(!original)return;
  if(!this.peers()){this.refused=true;return;}
  const signal=new AbortController();this.pending=signal;
  void this.prepare(original,signal.signal).then(s=>{
   if(this.pending!==signal||signal.signal.aborted){s?.art.dispose();return;}
   this.pending=undefined;
   this.subject=s;this.refused=!s;
  }).catch(()=>{if(this.pending===signal){this.pending=undefined;this.refused=true;}});
 }
 start(authorized:boolean){
  this.pending?.abort();this.pending=undefined;
  this.allowedThisFlight=authorized&&this.phase==='ready';
 }
 private async prepare(orig:Subject,signal:AbortSignal):Promise<Staged|undefined>{
  const {mesh,wire}=orig,geometry=mesh.geometry,stock=mesh.material,version=stock.version,before=mesh.onBeforeRender,after=mesh.onAfterRender;
  const vertex=stock.vertexShader,fragment=stock.fragmentShader,uniforms=stock.uniforms,defines=stock.defines;
  const u=Object.entries(uniforms),defs=Object.entries(defines),refs=()=>Object.keys(uniforms).length===u.length&&Object.keys(defines).length===defs.length&&
   u.every(([key,value])=>uniforms[key]===value)&&defs.every(([key,value])=>defines[key]===value);
  const state=()=>[stock.side,stock.vertexColors,stock.visible,stock.depthTest,stock.depthWrite,stock.depthFunc,stock.blending,
   stock.colorWrite,stock.wireframe,stock.alphaToCoverage,stock.alphaTest,stock.transparent,stock.opacity,stock.polygonOffset,
   stock.polygonOffsetFactor,stock.polygonOffsetUnits,stock.stencilWrite,stock.toneMapped,stock.glslVersion,
   stock.onBeforeCompile,stock.customProgramCacheKey,stock.uniformsGroups.length,stock.clippingPlanes] as const;
  const initial=state(),sameState=()=>state().every((v,i)=>v===initial[i]);
  const origin=mesh.position.toArray();
  const pin=[P.native,P.alternate].find(s=>equal(origin,s.origin));
  if(REVISION!=='187'||!pin||geometry.index||geometry.groups.length||Object.keys(geometry.attributes).length!==layout.length||
     !globalThis.crypto?.subtle||!(stock instanceof ShaderMaterial)||wire.byteLength!==15510)return;
  const entries=layout.map(([name,state])=>{const a=geometry.getAttribute(name);return {name,state,a,array:a?.array,bytes:a?.array.byteLength};});
  const aligned=()=>mesh.matrixAutoUpdate&&equal(mesh.position.toArray(),origin)&&equal(mesh.quaternion.toArray(),[0,0,0,1])&&equal(mesh.scale.toArray(),[1,1,1]);
  const schema=()=>entries.every(({name,state,a,array,bytes})=>geometry.attributes[name]===a&&a instanceof BufferAttribute&&a.array===array&&a.array.byteLength===bytes&&
   a.version===state.version&&a.count===state.count&&a.itemSize===state.size&&a.normalized===state.normalized&&a.array.constructor.name===state.type);
  const intact=()=>this.peers()&&orig.current()&&mesh.parent===this.scene&&mesh.visible&&mesh.geometry===geometry&&mesh.material===stock&&aligned()&&
   mesh.onBeforeRender===before&&mesh.onAfterRender===after&&stock.version===version&&stock.vertexShader===vertex&&stock.fragmentShader===fragment&&stock.uniforms===uniforms&&stock.defines===defines&&refs()&&sameState()&&
   !geometry.index&&!geometry.groups.length&&Object.keys(geometry.attributes).length===layout.length&&
   geometry.drawRange.start===0&&geometry.drawRange.count===Infinity&&schema();
  if(!intact()||signal.aborted||await sha(new Uint8Array(wire).slice())!==B.wireSource)return;
  const signatures=await Promise.all(entries.map(async ({name,a})=>[name,await sha(bytes(a as BufferAttribute))] as const));
  if(signal.aborted||!intact()||signatures.some(([name,hash])=>hash!==(name==='uv'?pin.uv:P.attributes[name])))return;
  const art=await makeH9NwCladdingStudy(stock);
  if(!art)return;
  let keep=false;
  try{
   if(!intact()||signal.aborted)return;
   const holder=new Group();holder.add(new Mesh(geometry,art.material));
   const linked=await this.link(holder,signal);
   if(!linked||!linked()||!intact()||signal.aborted)return;
   keep=true;return {geometry,stock,mesh,intact,art,linked};
  }finally{
   // Only the finalized subject retains this borrowed material.
   if(!keep)art.dispose();
  }
 }
 render(eligible:boolean,draw:()=>void){
  this.activeDraw=false;
  const q=this.subject,p=this.camera.position,gl=this.r.getContext() as WebGL2RenderingContext;
  const revoke=(s:Staged)=>{
   if(this.subject!==s)return;
   this.subject=undefined;this.refused=true;this.allowedThisFlight=false;s.art.dispose();
  };
  if(this.allowedThisFlight&&q&&(!q.intact()||!q.linked())){revoke(q);draw();return;}
  // Apply from the user's authorized runway Begin, not a mid-flight distance
  // threshold that would visibly swap a legible building. Streaming owns expiry.
  const viewValid=()=>this.camera.isPerspectiveCamera&&this.camera.fov===53&&this.camera.zoom===1&&
   [p.x,p.y,p.z].every(Number.isFinite);
  const raster=()=>{
   const v=this.r.getViewport(this.viewport),d=this.r.getPixelRatio();
   const a=gl.getParameter(gl.VIEWPORT) as Int32Array;
   return Number.isFinite(d)&&d>0&&this.camera.layers.mask===1&&this.camera.projectionMatrix.elements.every(Number.isFinite)&&
    this.camera.matrixWorldInverse.elements.every(Number.isFinite)&&v.x===0&&v.y===0&&a[0]===0&&a[1]===0&&
    a[2]===gl.drawingBufferWidth&&a[3]===gl.drawingBufferHeight&&v.z*d>=a[2]&&v.w*d>=a[3]&&
    gl.getParameter(gl.SAMPLES)===4&&gl.getParameter(gl.ALPHA_BITS)===8&&gl.getParameter(gl.DEPTH_BITS)===24&&
    !gl.isEnabled(gl.SAMPLE_COVERAGE)&&!gl.isEnabled(gl.SCISSOR_TEST);
  };
  if(!eligible||!this.allowedThisFlight||!q||!viewValid()||!q.intact()||!q.linked()||this.scene.overrideMaterial||
     this.r.xr.isPresenting||this.r.getRenderTarget()!==null||this.r.getScissorTest()||gl.isContextLost()||!raster()){draw();return;}
  const expected=[1,0,0,0,0,1,0,0,0,0,1,0,q.mesh.position.x,q.mesh.position.y,q.mesh.position.z,1];
  const old=this.r.renderBufferDirect;
  q.art.setGain(1);
  this.r.renderBufferDirect=(...a)=>{
   if(!this.activeDraw&&a[0]===this.camera&&a[1]===this.scene&&a[2]===q.geometry&&a[3]===q.stock&&a[4]===q.mesh&&a[5]===null&&q.intact()&&q.linked()&&viewValid()&&raster()&&equal(q.mesh.matrixWorld.elements,expected)){
    old.call(this.r,a[0],a[1],a[2],q.art.material,a[4],a[5]);this.activeDraw=true;
   }else old.call(this.r,...a);
  };
  try{draw();}finally{
   this.r.renderBufferDirect=old;q.art.setGain(0);
   if(!q.intact()||!q.linked())revoke(q);
  }
 }
}
