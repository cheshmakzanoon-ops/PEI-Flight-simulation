import * as T from 'three';
import {prepareRailRoofFinish} from '../../tools/art/summerside-station/roof-finish/rail-roof-finish.ts';
import {RAIL_SHINGLE_ROUTE} from '../app/rail-shingle-option.ts';
import {project,RAD} from '../sim/geo.ts';
import {SUMMERSIDE_STATION as RAIL} from './summerside-station/source.generated.ts';
import type {OlearyLink,OlearyProgramProof} from './oleary-railway/program-gate.ts';

export type RailRoofOwner=Readonly<{group:T.Group;current:()=>boolean}>;
export type RailShingleFrame=Readonly<{route:string;selected:boolean;mode:string;view:number;flight:object;
 x:number;z:number;heading:number;time:number;status:string}>;
type Direct=T.WebGLRenderer['renderBufferDirect'];
type Roof=T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
const launch=project(-63.7813,46.3849);
const exactFinishStages=[
 'eff5d3c55f0d416f3ec8b3d90ad060847e17145f37b52d0d23ebd959a6a282ec',
 '466815388122181d229e9df8090fca090aae7cf3eb24d185eb757ba1d114d01b',
] as const;
const layers=['position','normal','uv','color'] as const;
const materialKeys=['side','shadowSide','transparent','opacity','alphaToCoverage','alphaHash','alphaTest',
 'depthTest','depthWrite','depthFunc','colorWrite','blending','premultipliedAlpha','polygonOffset','wireframe',
 'stencilWrite','vertexColors','flatShading','toneMapped','dithering','metalness','roughness','envMapIntensity',
 'map','normalMap','bumpMap','roughnessMap','metalnessMap','alphaMap','aoMap','envMap',
 'clippingPlanes','onBeforeCompile','customProgramCacheKey'] as const;
const eq=<V>(a:ArrayLike<V>,b:ArrayLike<V>)=>a.length===b.length&&Array.prototype.every.call(a,(q:V,i:number)=>q===b[i]);
const digest=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),
 v=>v.toString(16).padStart(2,'0')).join('');
const selected=(f:RailShingleFrame)=>f.route===RAIL_SHINGLE_ROUTE&&f.selected;
const atLaunch=(f:RailShingleFrame)=>selected(f)&&f.mode==='dispatch'&&f.status==='flying'&&f.time===0&&
 f.x===launch.x&&f.z===launch.z&&f.heading===314*RAD;

function makeDetached(q:RailRoofOwner){
 const matches=q.group.children.filter(v=>v.name==='roof');
 if(matches.length!==1||!(matches[0] instanceof T.Mesh)||!(matches[0].material instanceof T.MeshStandardMaterial))return;
 const roof=matches[0] as Roof,stock=roof.material,geo=roof.geometry,map=stock.map;
 if(!(map instanceof T.DataTexture)||stock.customProgramCacheKey()!=='summ-rail-base'||
    stock.wireframe||stock.transparent||stock.stencilWrite||stock.polygonOffset||stock.clippingPlanes!==null||
    stock.premultipliedAlpha||roof.onBeforeRender!==T.Object3D.prototype.onBeforeRender||
    roof.onAfterRender!==T.Object3D.prototype.onAfterRender||roof.castShadow||roof.receiveShadow)return;
 const snapshot=materialKeys.map(k=>stock[k]);
 const c=stock.color.toArray(),version=stock.version,texVersion=map.version,source=map.source,
  sourceVersion=source.version,image=map.image,data=image.data,index=geo.index,attrs=layers.map(k=>geo.getAttribute(k));
 if(!index||index.count!==804||!attrs.every(x=>x instanceof T.BufferAttribute))return;
 const arrays=[...attrs,index].map(a=>a.array);
 const versions=[...attrs,index].map(a=>a.version);
 const root=q.group.clone(true),probe=root.children.find(z=>z.name==='roof') as Roof|undefined;
 if(root.parent||root.children.length!==10||!probe||probe===roof||probe.geometry!==geo||probe.material!==stock)return;
 const finish=stock.clone();
 finish.defines={...stock.defines};finish.onBeforeCompile=stock.onBeforeCompile;finish.customProgramCacheKey=stock.customProgramCacheKey;
 probe.material=finish;
 const compile=new T.Group();compile.add(new T.Mesh(geo,finish));
 let closed=false;
 const current=()=>!closed&&q.current()&&roof.visible&&roof.parent===q.group&&roof.material===stock&&roof.geometry===geo&&
  geo.index===index&&geo.groups.length===0&&geo.drawRange.start===0&&geo.drawRange.count===Infinity&&
  layers.every((name,i)=>geo.getAttribute(name)===attrs[i])&&
  [...attrs,index].every((a,i)=>a.version===versions[i]&&a.array===arrays[i])&&
  !roof.castShadow&&!roof.receiveShadow&&roof.onBeforeRender===T.Object3D.prototype.onBeforeRender&&
  roof.onAfterRender===T.Object3D.prototype.onAfterRender&&stock.version===version&&eq(stock.color.toArray(),c)&&
  materialKeys.every((k,i)=>stock[k]===snapshot[i])&&
  stock.map===map&&finish.map===map&&map.version===texVersion&&map.source===source&&source.version===sourceVersion&&
  map.image===image&&image.data===data&&probe.material===finish&&probe.geometry===geo&&probe.parent===root&&
  root.parent===null&&compile.parent===null;
 const close=()=>{if(!closed){closed=true;finish.dispose();}};
 return {root,roof,stock,geo,finish,compile,current,close};
}
type Detached=NonNullable<ReturnType<typeof makeDetached>>;
type Lease=NonNullable<Awaited<ReturnType<typeof prepareRailRoofFinish>>>;
type RendererProfile=Readonly<{width:number;height:number;scale:number;light:T.Texture;lightSource:T.Texture['source'];lightRevision:number}>;
type Armed={part:Detached;lease:Lease;linked:OlearyProgramProof;raster:RendererProfile};

export class RailShinglePreview {
 private phase:'waiting'|'ready'|'active'|'held'='waiting';
 private reason='';
 private ticket:AbortController|undefined;
 private armed:Armed|undefined;
 private flight:object|undefined;
 private damaged=false;
 private submitted=0;
 private retired=false;
 private readonly raw:Direct;
 private readonly gl:WebGL2RenderingContext;
 private readonly size=new T.Vector2();
 private readonly currentSize=new T.Vector4();
 private readonly r:T.WebGLRenderer;
 private readonly scene:T.Scene;
 private readonly camera:T.PerspectiveCamera;
 private readonly read:()=>RailRoofOwner|undefined;
 private readonly linked:OlearyLink;
 private readonly frame:()=>RailShingleFrame;
 constructor(r:T.WebGLRenderer,scene:T.Scene,camera:T.PerspectiveCamera,
  read:()=>RailRoofOwner|undefined,linked:OlearyLink,frame:()=>RailShingleFrame){
  this.r=r;this.scene=scene;this.camera=camera;this.read=read;this.linked=linked;this.frame=frame;
  this.raw=r.renderBufferDirect;
  this.gl=r.getContext() as WebGL2RenderingContext;
 }
 get state(){return {phase:this.phase,reason:this.reason,submitted:this.submitted};}
 get dispatchPhase(){return this.phase==='ready'&&!this.safe(this.armed)?'held':this.phase;}
 private clear(phase:'waiting'|'held',reason=''){
  this.ticket?.abort();this.ticket=undefined;
  const old=this.armed;this.armed=undefined;
  if(old){old.lease.release();old.part.close();}
  this.phase=phase;this.reason=reason;this.flight=undefined;this.submitted=0;
 }
 reset(){if(!this.retired)this.clear('waiting');}
 dispose(){this.retired=true;this.clear('held','renderer disposed');}
 private profile():RendererProfile|undefined{
  try{
   const {r,scene:s,camera:c,gl:g}=this;
   const a=g.getContextAttributes(),p=r.getDrawingBufferSize(this.size),v=r.getCurrentViewport(this.currentSize),
    light=s.environment, angle=s.environmentRotation, d=r.getPixelRatio();
   if(r.getContext()!==g||g.isContextLost()||!r.capabilities.isWebGL2||!r.capabilities.logarithmicDepthBuffer||
    r.capabilities.reversedDepthBuffer||r.getRenderTarget()!==null||r.xr.isPresenting||r.xr.enabled||
    a?.antialias!==true||a.depth!==true||g.getParameter(g.SAMPLES)!==4||
    g.getParameter(g.DEPTH_BITS)!==24||g.getParameter(g.DRAW_FRAMEBUFFER_BINDING)!==null||
    g.getParameter(g.READ_FRAMEBUFFER_BINDING)!==null||r.getScissorTest()||g.isEnabled(g.SCISSOR_TEST)||
    g.isEnabled(g.SAMPLE_COVERAGE)||!eq(g.getParameter(g.VIEWPORT),[0,0,p.x,p.y])||v.x!==0||v.y!==0||v.z!==p.x||v.w!==p.y||
    p.x!==g.drawingBufferWidth||p.y!==g.drawingBufferHeight||p.x<800||p.x>4096||p.y<480||p.y>2160||
    d<=0||d>1.5||!r.sortObjects||!r.autoClear||!r.autoClearColor||!r.autoClearDepth||
    r.shadowMap.enabled||r.localClippingEnabled||r.clippingPlanes.length||r.outputColorSpace!==T.SRGBColorSpace||
    r.toneMapping!==T.ACESFilmicToneMapping||r.toneMappingExposure!==1||s.overrideMaterial||s.fog||
    !light||light.mapping!==T.EquirectangularReflectionMapping||s.environmentIntensity!==.77||
    angle.x!==0||angle.y!==-.512*Math.PI*2||angle.z!==0||angle.order!=='XYZ'||
    c.constructor!==T.PerspectiveCamera||c.parent!==null||c.layers.mask!==1||c.reversedDepth||c.fov!==53||
    c.zoom!==1||c.near!==.08||c.far!==350000||c.view!==null||c.filmOffset!==0||
    !c.projectionMatrix.elements.every(Number.isFinite)||!c.matrixWorld.elements.every(Number.isFinite))return;
   return {width:p.x,height:p.y,scale:d,light,lightSource:light.source,lightRevision:light.version};
  }catch{return;}
 }
 private rasterStill(before:RendererProfile){
  const after=this.profile();
  return !!after&&after.width===before.width&&after.height===before.height&&after.scale===before.scale&&
   after.light===before.light&&after.lightSource===before.lightSource&&after.lightRevision===before.lightRevision;
 }
 private safe(q:Armed|undefined){
  try{return !!q&&q.part.current()&&this.rasterStill(q.raster)&&q.linked();}
  catch{return false;}
 }
 private async exactProgram(material:T.Material){
  const g=this.gl,p=(this.r.properties.get(material) as {currentProgram?:{program?:WebGLProgram}}).currentProgram?.program;
  if(!p||!g.isProgram(p)||!g.getUniformLocation(p,'railFinishGain')||!g.getUniformLocation(p,'map')||
    !g.getUniformLocation(p,'dfgLUT'))return false;
  const shaders=g.getAttachedShaders(p);
  if(shaders?.length!==2)return false;
  const text=[g.VERTEX_SHADER,g.FRAGMENT_SHADER].map(kind=>{
   const z=shaders.find(x=>g.getShaderParameter(x,g.SHADER_TYPE)===kind);return z&&g.getShaderSource(z);
  });
  return text.every(s=>typeof s==='string'&&s.length>0)&&
   eq(await Promise.all(text.map(s=>digest(s!))),exactFinishStages);
 }
 private inspect(f:RailShingleFrame){
  if(this.retired||this.phase!=='waiting'||this.ticket||!atLaunch(f)||this.r.renderBufferDirect!==this.raw)return;
  const owner=this.read(),raster=this.profile();
  if(!owner||!raster)return;
  const part=makeDetached(owner);
  if(!part){this.clear('held','ordinary roof source refused');return;}
  const job=this.ticket=new AbortController();
  const valid=()=>this.ticket===job&&!job.signal.aborted&&!this.retired&&atLaunch(this.frame())&&
   this.r.renderBufferDirect===this.raw&&part.current()&&this.rasterStill(raster);
  void(async()=>{
   let lease:Lease|undefined,saved=false,reason='signed roof asset';
   try{
    lease=await prepareRailRoofFinish(part.root);
    if(!lease||!valid())return;
    reason='linked r187 roof finish';
    const linked=await this.linked(part.compile,job.signal);
    if(!linked||!valid()||!await this.exactProgram(part.finish)||!valid()||!linked())return;
    this.armed={lease,part,linked,raster};saved=true;this.phase='ready';
   }catch{/* Keep the already authored station. */}
   finally{
    if(!saved){lease?.release();part.close();}
    if(this.ticket===job){this.ticket=undefined;if(!saved)this.clear('held',reason);}
   }
  })();
 }
 begin(f:RailShingleFrame,trusted:boolean){
  if(this.retired)return;
  if(!trusted||this.phase!=='ready'||!atLaunch(f)||this.r.renderBufferDirect!==this.raw||!this.safe(this.armed)){
   this.clear('held','Begin before valid ready Dispatch');return;
  }
  this.flight=f.flight;this.phase='active';
 }
 render(f:RailShingleFrame,draw:()=>void){
  this.submitted=0;
  if(f.mode==='dispatch'){
   draw();
   try{this.inspect(f);}catch{this.clear('held','ordinary roof preparation refused');}
   return;
  }
  if(this.phase!=='active'){draw();return;}
  const q=this.armed;
  const {r,scene:s,camera:c,raw}=this;
  if(!q||this.flight!==f.flight||!selected(f)||f.status!=='flying'||!this.safe(q)){
   this.clear('held','ordinary roof owner or renderer changed');draw();return;
  }
  const distance=Math.hypot(c.position.x-RAIL.originXZ[0],c.position.z-RAIL.originXZ[1]);
  // Derivative minification is not a stock fallback. Outside this explicit
  // roof coverage lease we make no alternate submission at all.
  if((f.mode!=='flight'&&f.mode!=='paused')||f.view!==0||distance>=450||c.position.y>=230){
   draw();return;
  }
  if(r.renderBufferDirect!==raw||!q.lease.set(true)){
   this.clear('held','ordinary roof handoff refused');draw();return;
  }
  let drew=false,open=true;
  this.damaged=false;
  const {part}=q;
  const shim:Direct=(...a)=>{
   if(!open||this.damaged||a[4]!==part.roof)return raw.call(r,...a);
   if(drew||a[0]!==c||a[1]!==s||a[2]!==part.geo||a[3]!==part.stock||a[5]!==null||
    !part.current()||!q.linked()){
    this.damaged=true;return raw.call(r,...a);
   }
   Reflect.apply(raw,r,[c,s,part.geo,part.finish,part.roof,a[5]]);drew=true;
   if(!q.linked())this.damaged=true;
  };
  r.renderBufferDirect=shim;
  try{draw();}
  finally{open=false;q.lease.set(false);if(r.renderBufferDirect===shim)r.renderBufferDirect=raw;}
  if(this.damaged){this.clear('held','unexpected sorted roof submission');if(drew)draw();}
  else this.submitted=drew?1:0;
 }
}
