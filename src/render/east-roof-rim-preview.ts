import * as T from 'three';
import {EAST_RIM_ROUTE} from '../app/east-roof-rim-option.ts';
import {eastRoofRimWire as q} from './east-roof-rim-wire.generated.ts';

export type EastRimOwner = Readonly<{
 wire:ArrayBuffer;mesh:T.Mesh<T.BufferGeometry,T.ShaderMaterial>;current:()=>boolean
}>;
export type EastRimFrame = Readonly<{
 route:string;selected:boolean;mode:string;view:number;flight:object;time:number;status:string
}>;
type Direct=T.WebGLRenderer['renderBufferDirect'];
const names=['position','uv','color','topFlag','normal','facadeStyle'] as const;
const same=<V>(a:ArrayLike<V>,b:ArrayLike<V>)=>a.length===b.length&&Array.prototype.every.call(a,(v:V,i:number)=>v===b[i]);
const bytes=(a:ArrayBufferView)=>new Uint8Array(a.buffer,a.byteOffset,a.byteLength);
const hash=async(a:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a.slice().buffer)),
 x=>x.toString(16).padStart(2,'0')).join('');
const exactShape=(g:T.BufferGeometry)=>!g.index&&!g.groups.length&&g.drawRange.start===0&&g.drawRange.count===Infinity&&
 names.every(k=>g.getAttribute(k) instanceof T.BufferAttribute)&&Object.keys(g.attributes).length===names.length&&
 !Object.keys(g.morphAttributes).length;
const readyRoute=(f:EastRimFrame)=>f.route===EAST_RIM_ROUTE&&f.selected&&f.mode==='dispatch'&&f.time===0&&f.status==='flying';

async function prepare(src:EastRimOwner){
 if(!globalThis.crypto?.subtle||!src.current())return;
 const {mesh,wire}=src,g=mesh.geometry,mat=mesh.material;
 const table=names.map(k=>g.getAttribute(k)) as T.BufferAttribute[];
 const versions=table.map(a=>a.version),arrays=table.map(a=>a.array);
 const matrix=mesh.matrixWorld.elements.slice(),shader=[mat.vertexShader,mat.fragmentShader] as const;
 const valid=()=>src.current()&&mesh.geometry===g&&mesh.material===mat&&same(mesh.position.toArray(),q.owner)&&
  same(matrix,mesh.matrixWorld.elements)&&mesh.visible&&!mesh.castShadow&&!mesh.receiveShadow&&
  mesh.layers.mask===1&&!mat.transparent&&mat.depthTest&&mat.depthWrite&&mat.colorWrite&&
  mat.vertexShader===shader[0]&&mat.fragmentShader===shader[1]&&exactShape(g)&&
  table.every((a,i)=>a===g.getAttribute(names[i])&&a.version===versions[i]&&a.array===arrays[i]);
 if(!valid()||await hash(new Uint8Array(wire))!==q.sourceWire||!valid())return;
 const candidate=new T.BufferGeometry();
 try{
  for(let i=0;i<names.length;i++){
   const k=names[i],prior=table[i],spec=q.lane[k],Ctor=k==='facadeStyle'?Uint8Array:Float32Array;
   if(!(prior.array instanceof Ctor)||prior.normalized||prior.itemSize!==spec.size||prior.count!==q.sourceVertices||
      await hash(bytes(prior.array))!==spec.pin||!valid())throw Error('old geometry '+k);
   const unit=Ctor.BYTES_PER_ELEMENT,srcBytes=bytes(prior.array),
    low=q.oldRows[0]*unit*spec.size,high=q.oldRows[1]*unit*spec.size;
   const insertion=Uint8Array.from(atob(spec.inserted),c=>c.charCodeAt(0));
   const next=new Uint8Array(q.nextVertices*unit*spec.size);
   next.set(srcBytes.subarray(0,low));next.set(insertion,low);next.set(srcBytes.subarray(high),low+insertion.length);
   if(await hash(next)!==spec.newProof||!valid())throw Error('new geometry '+k);
   candidate.setAttribute(k,new T.BufferAttribute(new Ctor(next.buffer),spec.size));
  }
  candidate.computeBoundingSphere();
  if(!valid()||!candidate.boundingSphere||!Number.isFinite(candidate.boundingSphere.radius))throw Error('expired geometry');
  return {mesh,g,mat,candidate,valid,dispose:()=>candidate.dispose()};
 }catch{candidate.dispose();return;}
}

type Built=NonNullable<Awaited<ReturnType<typeof prepare>>>;
type Surface=Readonly<{w:number;h:number;ratio:number}>;
export class EastRimPreview{
 private phase:'waiting'|'ready'|'active'|'held'='waiting';
 private reason='';
 private flight:object|undefined;
 private build:Built|undefined;
 private receipt:Surface|undefined;
 private epoch=0;
 private pending=false;
 private retired=false;
 private submitted=false;
 private readonly gl:WebGL2RenderingContext;
 private readonly raw:Direct;
 private readonly view=new T.Vector4();
 private readonly size=new T.Vector2();
 private readonly r:T.WebGLRenderer;
 private readonly scene:T.Scene;
 private readonly cam:T.PerspectiveCamera;
 private readonly read:()=>EastRimOwner|undefined;
 private readonly now:()=>EastRimFrame;
 private readonly authority:()=>boolean;
 constructor(r:T.WebGLRenderer,scene:T.Scene,cam:T.PerspectiveCamera,read:()=>EastRimOwner|undefined,
  now:()=>EastRimFrame,authority:()=>boolean){
  this.r=r;this.scene=scene;this.cam=cam;this.read=read;this.now=now;this.authority=authority;
  this.gl=r.getContext() as WebGL2RenderingContext;this.raw=r.renderBufferDirect;
 }
 get state(){return {phase:this.phase,reason:this.reason,submitted:this.submitted};}
 get dispatchPhase(){return this.phase==='ready'&&!this.safe()?'held':this.phase;}
 private clear(phase:'waiting'|'held',reason=''){
  this.epoch++;this.pending=false;this.flight=undefined;this.submitted=false;this.phase=phase;this.reason=reason;
  this.build?.dispose();this.build=undefined;this.receipt=undefined;
 }
 reset(){if(!this.retired)this.clear('waiting');}
 dispose(){this.retired=true;this.clear('held','renderer retired');}
 private surface():Surface|undefined{
  try{
   const {r,gl:g,cam:c}=this,s=r.getDrawingBufferSize(this.size),v=r.getCurrentViewport(this.view),k=r.getPixelRatio();
   if(!this.authority()||r.getContext()!==g||g.isContextLost()||r.xr.isPresenting||r.getRenderTarget()!==null||
    r.getScissorTest()||g.isEnabled(g.SCISSOR_TEST)||g.isEnabled(g.SAMPLE_COVERAGE)||r.shadowMap.enabled||
    r.localClippingEnabled||r.clippingPlanes.length||!r.autoClear||!r.autoClearColor||!r.autoClearDepth||!r.sortObjects||
    !r.capabilities.isWebGL2||!r.capabilities.logarithmicDepthBuffer||g.getParameter(g.SAMPLES)!==4||
    g.getParameter(g.DEPTH_BITS)!==24||g.getParameter(g.ALPHA_BITS)!==8||g.getParameter(g.DRAW_FRAMEBUFFER_BINDING)!==null||
    g.getParameter(g.READ_FRAMEBUFFER_BINDING)!==null||
    s.x!==g.drawingBufferWidth||s.y!==g.drawingBufferHeight||s.x<800||s.x>4096||s.y<480||s.y>2160||
    v.x!==0||v.y!==0||v.z!==s.x||v.w!==s.y||!same(g.getParameter(g.VIEWPORT),[0,0,s.x,s.y])||k<=0||k>1.5||
    this.scene.overrideMaterial!==null||c.fov!==53||c.zoom!==1||c.layers.mask!==1||c.near!==.08||c.far!==350000||
    !c.matrixWorld.elements.every(Number.isFinite)||!c.projectionMatrix.elements.every(Number.isFinite))return;
   return {w:s.x,h:s.y,ratio:k};
  }catch{return;}
 }
 private sameSurface(v:Surface){
  const a=this.surface();return !!a&&a.w===v.w&&a.h===v.h&&a.ratio===v.ratio;
 }
 private safe(){
  try{return !!this.build&&!!this.receipt&&this.build.valid()&&this.sameSurface(this.receipt);}
  catch{return false;}
 }
 private warm(b:Built){
  const r=this.r,g=this.gl,target=new T.WebGLRenderTarget(1,1),scene=new T.Scene(),cam=new T.PerspectiveCamera(45,1,.1,20);
  const material=new T.MeshBasicMaterial({colorWrite:false,depthTest:false,depthWrite:false});
  const proxy=new T.Mesh(b.candidate,material);
  proxy.frustumCulled=false;scene.add(proxy);
  const viewport=r.getViewport(new T.Vector4()),scissor=r.getScissor(new T.Vector4());
  try{r.setRenderTarget(target);r.render(scene,cam);}
  finally{r.setRenderTarget(null);r.setViewport(viewport);r.setScissor(scissor);material.dispose();target.dispose();}
  return !g.isContextLost()&&b.valid();
 }
 private inspect(f:EastRimFrame){
  if(this.retired||this.phase!=='waiting'||this.pending||!readyRoute(f)||this.r.renderBufferDirect!==this.raw)return;
  const desired=this.read(),surface=this.surface();
  if(!desired||!surface)return;
  const id=++this.epoch;this.pending=true;
  const valid=()=>id===this.epoch&&!this.retired&&readyRoute(this.now())&&
   this.r.renderBufferDirect===this.raw&&this.sameSurface(surface);
  void(async()=>{
   let b:Built|undefined,kept=false;
   try{
    b=await prepare(desired);
    if(!b||!valid()||!this.warm(b)||!valid())return;
    this.build=b;this.receipt=surface;this.phase='ready';kept=true;
   }catch{/* Stock stays installed if anything cannot be prepared. */}
   finally{
    if(!kept)b?.dispose();
    if(id===this.epoch){this.pending=false;if(!kept)this.clear('held','verified roof owner or upload unavailable');}
   }
  })();
 }
 begin(f:EastRimFrame,trust:boolean){
  if(this.retired)return;
  if(!trust||this.phase!=='ready'||!readyRoute(f)||!this.safe()){
   this.clear('held','Begin before valid ready Dispatch');return;
  }
  this.phase='active';this.flight=f.flight;
 }
 draw(f:EastRimFrame,draw:()=>void){
  this.submitted=false;
  if(f.mode==='dispatch'){
   draw();try{this.inspect(f);}catch{this.clear('held','verified roof owner unavailable');}return;
  }
  if(this.phase!=='active'){draw();return;}
  if(f.flight!==this.flight||f.route!==EAST_RIM_ROUTE||!f.selected||f.status!=='flying'||!this.safe()){
   this.clear('held','verified roof owner or frame changed');draw();return;
  }
  if((f.mode!=='flight'&&f.mode!=='paused')||f.view!==0){draw();return;}
  const {r,scene,cam,raw}=this,b=this.build!;
  if(r.renderBufferDirect!==raw){this.clear('held','unexpected draw wrapper');draw();return;}
  let used=false,bad=false,open=true;
  const shim:Direct=(...a)=>{
   if(a[4]!==b.mesh||bad||!open)return raw.call(r,...a);
   if(used||a[0]!==cam||a[1]!==scene||a[2]!==b.g||a[3]!==b.mat||a[5]!==null||!b.valid()){
    bad=true;return raw.call(r,...a);
   }
   Reflect.apply(raw,r,[a[0],a[1],b.candidate,b.mat,b.mesh,a[5]]);used=true;
  };
  r.renderBufferDirect=shim;
  try{draw();}
  finally{open=false;if(r.renderBufferDirect===shim)r.renderBufferDirect=raw;}
  if(bad){this.clear('held','unexpected actual sorted roof tuple');if(used)draw();}
  else this.submitted=used;
 }
}
