import * as T from 'three';
import {prepareQuartermasterGuardV3,type QuartermasterStockResident,type QuartermasterGuardWitness} from './roof-owner.ts';
import {patchQuartermasterSeawardRoofProgram} from './program.ts';
import {QUARTERMASTER_SEAWARD as P} from './seaward-roof-pins.ts';
import type {OlearyLink,OlearyProgramProof} from '../oleary-railway/program-gate.ts';

export const SEAWARD_ROUTE='harbour-low';
export const SEAWARD_STOCK='stockQuartermasterSeawardRoof';
export function standardSeawardRoof(q:URLSearchParams){
 const profile=q.getAll('scenery');
 return !q.has(SEAWARD_STOCK)&&q.getAll('departure').length<=1&&q.getAll('diagnostics').length<=1&&
   profile.length<=1&&profile.every(x=>x===''||x==='standard')&&
   [...q.keys()].every(k=>k==='scenery'||k==='departure'||k==='diagnostics');
}
export type SeawardFrame=Readonly<{route:string;selected:boolean;mode:string;view:number;flight:object;
 x:number;y:number;z:number;heading:number;status:string;peers:boolean}>;
type Observe=()=>QuartermasterStockResident|undefined;
type Phase='inactive'|'waiting'|'ready'|'held'|'active';
type Prepared={resident:QuartermasterStockResident;guard:QuartermasterGuardWitness;material:T.ShaderMaterial;
 stock:T.ShaderMaterial;geometry:T.BufferGeometry;program:OlearyProgramProof;targetBounds:readonly [number,number,number,number]};
type Direct=T.WebGLRenderer['renderBufferDirect'];
const signedSpawn=[-63.1338,46.2190] as const;
const common=(q:SeawardFrame)=>q.route===SEAWARD_ROUTE&&q.selected&&q.view===0&&q.status==='flying'&&q.peers;
const closeBound=(b:readonly number[],p:T.Vector3)=>Math.hypot(Math.max(b[0]-p.x,0,p.x-b[2]),Math.max(0,Math.abs(p.y-Math.fround(P.geometry.y))-.02),Math.max(b[1]-p.z,0,p.z-b[3]));
export class SeawardRoofLease {
 private observe?:Observe;
 private phase:Phase='inactive';
 private prepared?:Prepared;
 private current?:object;
 private sourceTried?:QuartermasterStockResident;
 private epoch=0;
 private controller?:AbortController;
 private retired=false;
 private submitted=false;
 private readonly raw:Direct;
 private readonly gl:WebGL2RenderingContext;
 private readonly physical=new T.Vector2();
 private readonly logical=new T.Vector2();
 private readonly viewport=new T.Vector4();
 private readonly renderer:T.WebGLRenderer;
 private readonly scene:T.Scene;
 private readonly camera:T.PerspectiveCamera;
 private readonly verifyCover:()=>Promise<boolean>;
 private readonly linked:OlearyLink;
 private readonly exactLaunch:(frame:SeawardFrame,lon:number,lat:number)=>boolean;
 private readonly frameNow:()=>SeawardFrame;
 constructor(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.PerspectiveCamera,verifyCover:()=>Promise<boolean>,
  linked:OlearyLink,exactLaunch:(frame:SeawardFrame,lon:number,lat:number)=>boolean,frameNow:()=>SeawardFrame){
  this.renderer=renderer;this.scene=scene;this.camera=camera;this.verifyCover=verifyCover;
  this.linked=linked;this.exactLaunch=exactLaunch;this.frameNow=frameNow;
  this.raw=renderer.renderBufferDirect;this.gl=renderer.getContext() as WebGL2RenderingContext;
 }
 setObserver(receive:Observe){if(!this.observe)this.observe=receive;}
 get state(){return {phase:this.phase,submitted:this.submitted};}
 reset(){
  this.submitted=false;this.epoch++;this.controller?.abort();this.controller=undefined;this.current=undefined;this.sourceTried=undefined;
  const p=this.prepared;this.prepared=undefined;p?.guard.release();p?.material.dispose();this.phase='inactive';
 }
 dispose(){this.retired=true;this.reset();}
 private raster(){try{return this.rasterOpen();}catch{return false;}}
 private rasterOpen(){
  const r=this.renderer,g=this.gl,s=this.scene,c=this.camera,a=g.getContextAttributes(),d=r.getDrawingBufferSize(this.physical),l=r.getSize(this.logical);
  if(T.REVISION!=='187'||r.getContext()!==g||g.isContextLost()||r.getRenderTarget()!==null||
    !r.capabilities.isWebGL2||!r.capabilities.logarithmicDepthBuffer||r.capabilities.reversedDepthBuffer||
    !a?.alpha||!a.depth||!a.antialias||g.getParameter(g.SAMPLES)!==4||g.getParameter(g.DEPTH_BITS)!==24||g.getParameter(g.ALPHA_BITS)!==8||
    !Number.isInteger(d.x)||!Number.isInteger(d.y)||d.x<640||d.y<360||
    g.drawingBufferWidth!==d.x||g.drawingBufferHeight!==d.y||
    g.getParameter(g.DRAW_FRAMEBUFFER_BINDING)!==null||g.getParameter(g.READ_FRAMEBUFFER_BINDING)!==null||
    r.getScissorTest()||g.isEnabled(g.SCISSOR_TEST)||r.xr.enabled||r.xr.isPresenting||
    !r.autoClear||!r.autoClearColor||!r.autoClearDepth||!r.autoClearStencil||!r.info.autoReset||!r.sortObjects||r.shadowMap.enabled||
    r.toneMapping!==T.ACESFilmicToneMapping||r.toneMappingExposure!==1||r.outputColorSpace!==T.SRGBColorSpace||
    r.clippingPlanes.length||r.localClippingEnabled||s.overrideMaterial!==null||s.fog||!this.stockSceneCallbacks()||
    c.constructor!==T.PerspectiveCamera||c.parent!==null||c.layers.mask!==1||c.reversedDepth||c.fov!==53||c.zoom!==1||
    c.near!==.08||c.far!==350000||c.aspect!==l.x/l.y||c.view!==null||c.filmOffset!==0||!this.finiteCamera())return false;
  const p=g.getParameter(g.VIEWPORT) as Int32Array;
  return p?.length===4&&p[0]===0&&p[1]===0&&p[2]===d.x&&p[3]===d.y;
 }
 private stockSceneCallbacks(){
  const s=this.scene,p=T.Object3D.prototype;
  return s.onBeforeRender===p.onBeforeRender&&s.onAfterRender===p.onAfterRender;
 }
 private finiteCamera(){
  const c=this.camera,p=c.position;
  return Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z)&&c.projectionMatrix.elements.every(Number.isFinite)&&
   c.matrixWorld.elements.every(Number.isFinite)&&c.matrixWorldInverse.elements.every(Number.isFinite);
 }
 private drawRaster(){
  try{
   const r=this.renderer,d=r.getDrawingBufferSize(this.physical),p=r.getCurrentViewport(this.viewport);
   return r.getRenderTarget()===null&&!r.getScissorTest()&&this.stockSceneCallbacks()&&this.finiteCamera()&&
    p.x===0&&p.y===0&&p.z===d.x&&p.w===d.y;
  }catch{return false;}
 }
 private ready(p:Prepared){try{return this.observe?.()===p.resident&&p.guard.intact()&&p.program();}catch{return false;}}
 private inspect(q:SeawardFrame){
  const r=this.renderer;
  if(this.retired||q.mode!=='dispatch'||!common(q)||this.current||this.controller||!this.observe||
   !this.exactLaunch(q,...signedSpawn)||r.renderBufferDirect!==this.raw)return;
  let orig:QuartermasterStockResident|undefined;try{orig=this.observe();}catch{return;}
  if(!orig||orig===this.sourceTried||!this.raster())return;
  const old=this.prepared;this.prepared=undefined;
  old?.guard.release();old?.material.dispose();
  const token=++this.epoch,ac=this.controller=new AbortController();this.sourceTried=orig;this.phase='waiting';
  const custody=()=>!this.retired&&!ac.signal.aborted&&this.epoch===token&&this.observe?.()===orig;
  const preparing=()=>{
   if(!custody()||this.current||r.renderBufferDirect!==this.raw||!this.raster())return false;
   const now=this.frameNow();
   return now.mode==='dispatch'&&common(now)&&this.exactLaunch(now,...signedSpawn);
  };
  void(async()=>{
   let guard:QuartermasterGuardWitness|undefined,m:T.ShaderMaterial|undefined;
   try{
    if(!await this.verifyCover()||!preparing())return;
    guard=await prepareQuartermasterGuardV3(()=>custody()?orig:undefined,this.scene);
    // The same resident reader must remain usable after the asynchronous
    // preparation token is retired on a successfully admitted Begin.
    if(!guard||!preparing()||!guard.intact()||!(orig.mesh.material instanceof T.ShaderMaterial))return;
    const stock=orig.mesh.material,geometry=orig.mesh.geometry;
    const pos=geometry.getAttribute('position'),[first,last]=P.geometry.targetSpan;
    let lowX=Infinity,lowZ=Infinity,highX=-Infinity,highZ=-Infinity;
    for(let i=first;i<last;i++){
     const x=Math.fround(pos.getX(i)+guard.origin.f32[0]),z=Math.fround(pos.getZ(i)+guard.origin.f32[2]);
     lowX=Math.min(lowX,x);highX=Math.max(highX,x);lowZ=Math.min(lowZ,z);highZ=Math.max(highZ,z);
    }
    if(!Number.isFinite(lowX+lowZ+highX+highZ)||!(lowX<highX&&lowZ<highZ))return;
    // Conservative whole-role lower bound, padded beyond Float32 vertex rounding.
    const targetBounds=[lowX-.02,lowZ-.02,highX+.02,highZ+.02] as const;
    const patch=patchQuartermasterSeawardRoofProgram(stock.vertexShader,stock.fragmentShader);
    if(!patch)return;
    m=new T.ShaderMaterial().copy(Object.create(stock,{uniforms:{value:{}}}));
    m.uniforms={...stock.uniforms,qmSeawardOptics:{value:1}};
    Object.assign(m,patch);
    const group=new T.Group();group.add(new T.Mesh(geometry,m));
    const program=await this.linked(group,ac.signal);
    if(!program||!preparing()||!guard.intact()||!program())return;
    this.prepared={resident:orig,guard,stock,geometry,material:m,program,targetBounds};guard=undefined;m=undefined;this.phase='ready';
   }catch{/* Existing tile remains visible. */}
   finally{
    guard?.release();m?.dispose();
    if(this.epoch===token&&this.controller===ac){this.controller=undefined;if(this.phase==='waiting')this.phase='held';}
   }
  })();
 }
 begin(q:SeawardFrame,fromDispatch:boolean){
  const p=this.prepared;
  if(this.retired||!fromDispatch||q.mode!=='dispatch'||!common(q)||!p||
    !this.exactLaunch(q,...signedSpawn)||this.renderer.renderBufferDirect!==this.raw||!this.raster()||!this.ready(p)){
   this.reset();this.phase='held';return;
  }
  this.current=q.flight;this.phase='active';
 }
 render(q:SeawardFrame,stockFrame:()=>void){
  this.submitted=false;
  if(this.retired){stockFrame();return;}
  if(q.mode==='dispatch'){
   if(this.current)this.reset();
   if(q.route!==SEAWARD_ROUTE||!q.selected){if(this.phase!=='inactive')this.reset();stockFrame();return;}
   // Capture the original matrix after its public renderer has updated it.
   stockFrame();this.inspect(q);return;
  }
  const p=this.prepared,r=this.renderer,raw=this.raw;
  if(!this.current){
   if(p||this.controller)this.reset();
   stockFrame();return;
  }
  if(!p||q.flight!==this.current){this.reset();stockFrame();return;}
  if(q.route!==SEAWARD_ROUTE||!q.selected||!q.peers||q.status!=='flying'||!this.ready(p)){
   this.reset();this.phase='held';stockFrame();return;
  }
  if(q.view!==0||!(q.mode==='flight'||q.mode==='paused')||
    closeBound(p.targetBounds,this.camera.position)>P.art.maxRange||
    r.renderBufferDirect!==raw||!this.raster()){stockFrame();return;}
  let used=false,open=true;
  const shim:Direct=(...args)=>{
   const [camera,scene,geometry,material,owner,group]=args;
   if(open&&r.renderBufferDirect===shim&&this.prepared===p&&this.current===q.flight&&!used&&owner===p.resident.mesh&&geometry===p.geometry&&material===p.stock&&
      group===null&&camera===this.camera&&scene===this.scene&&this.drawRaster()&&this.ready(p)){
    used=true;
    raw.call(r,camera,scene,geometry,p.material,owner,group);
    this.submitted=true;return;
   }
   return raw.call(r,...args);
  };
  r.renderBufferDirect=shim;
  try{stockFrame();}
  finally{open=false;if(r.renderBufferDirect===shim)r.renderBufferDirect=raw;}
 }
}
