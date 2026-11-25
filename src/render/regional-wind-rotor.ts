import * as T from 'three';
import {WIND_PROFILE} from './regional-wind-geometry.ts';
import {STATIC_WIND_TILES} from './regional-wind-light.generated.ts';
import {declaredUnits,type RegionalStaticLight} from './regional-wind-light.ts';
import type {RegionalWind,StaticWindReceiver} from './regional-wind.ts';
import type {WindFarmId,WindObserver} from './regional-wind-stream.ts';
import type {World} from './world.ts';
import {ROTOR_INDEX,ROTOR_LIMIT,ROTOR_PINS,ROTOR_REACH,RECEIVER_DECL,SUN,casterVertex,rotorLayout,type RotorLayout} from './regional-wind-rotor-field.ts';
type Uniforms=Record<string,T.IUniform>;
type Source=T.InstancedMesh<T.BufferGeometry,T.Material>;
type Lease={m:T.ShaderMaterial;prior:string;next:string};
const FIXED_HOOK=/^\s*#ifdef PEI_MOVING_ROTOR_RECEIVER\s+regionalCut=max\(regionalCut,windRotorDirect\(p,d,max\(length\(terrainDx\.xz\),length\(terrainDy\.xz\)\)\)\);\s*#endif/gm;
const OWN_SYMBOL=/\b(?:PEI_MOVING_ROTOR_RECEIVER|regionalRotorDepth|rotorRight|rotorUp|rotorSun|rotorLocalRect|rotorCellRect|rotorDepthParams|rotorOrigins|rotorCount|windRotorDirect|rotorDepthTap)\b/;
const DATA_UNIFORMS=['regionalRotorDepth','rotorRight','rotorUp','rotorSun','rotorLocalRect','rotorCellRect','rotorDepthParams','rotorOrigins','rotorCount'] as const;
type Phase='cold'|'authenticating'|'ready'|'unavailable';
const IDENTITY=new T.Matrix4(),mainPoint='void main(){';
const digest=async(a:ArrayBufferView)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(a.buffer,a.byteOffset,a.byteLength).slice().buffer)),b=>b.toString(16).padStart(2,'0')).join('');
function source(c:RegionalWind){const b=c.root.children;return {move:b[1] as Source,mast:b[0] as Source};}
export function canDrawRotor(r:T.WebGLRenderer){const c=r.capabilities;return c.isWebGL2&&!c.reversedDepthBuffer&&c.maxTextures>=16&&c.maxFragmentUniforms>=224&&c.maxTextureSize>=2048;}
interface DrawInputs{scene:T.Scene;cam:T.Camera;mat:T.RawShaderMaterial;batch:Source;seed:T.InstancedBufferAttribute;rt:T.WebGLRenderTarget;layout:RotorLayout;donor:Source;attr:T.BufferAttribute;sourceIndex:T.BufferAttribute;posVersion:number;indexVersion:number;sourcePositionArray:ArrayBufferView;sourceIndexArray:ArrayBufferView;links:boolean;seedVersion:number}
export class RegionalRotorLight{
 private readonly id:WindFarmId;private readonly r:T.WebGLRenderer;private readonly world:World;private readonly art:RegionalWind;private readonly base:RegionalStaticLight;
 private phase:Phase='cold';private dead=false;private draw?:DrawInputs;private epoch=-1;private eyeX=Infinity;private eyeY=Infinity;private eyeZ=Infinity;
 private u:Uniforms={};private own=new Map<T.ShaderMaterial,Lease>();private readonly retiredOwners=new WeakSet<T.ShaderMaterial>();private n=0;private frameKey=0;private lastFrameKey=-1;private lastClock=NaN;private slotIds:string[]=[];
 private cacheVersion=-1;private submits=0;private m=new T.Matrix4();private g=new T.Matrix4();private lastIssue='';
 constructor(id:WindFarmId,r:T.WebGLRenderer,w:World,a:RegionalWind,b:RegionalStaticLight){this.id=id;this.r=r;this.world=w;this.art=a;this.base=b;}
 get state(){return {phase:this.phase,activeTiles:this.own.size,nearRotors:this.u.rotorCount?.value??0,sourceSlots:this.n,offscreenPasses:this.submits,submittedTriangles:(this.u.rotorCount?.value??0)*1520,textureSize:this.draw?[this.draw.layout.ax,this.draw.layout.ay]:[],lastPhase:Number.isFinite(this.lastClock)?this.lastClock:null,reason:this.lastIssue};}
 private prepare(){
  if(this.phase!=='cold')return;this.phase='authenticating';const {move}=source(this.art);
  void(async()=>{try{
   if(!move?.isInstancedMesh)throw Error('original moving donor missing');
   const g=move.geometry,a=g.getAttribute('position'),index=g.index;
   if(!(a instanceof T.BufferAttribute)||!index||index.count!==4560||await digest(a.array)!==ROTOR_PINS[this.id]||await digest(index.array)!==ROTOR_INDEX)throw Error('original moving mesh rejected');
   const layout=rotorLayout(this.id,a,this.r.capabilities.maxTextureSize);if(!layout)throw Error('insufficient atlas');
   if(this.dead)return;
   const lim=ROTOR_LIMIT[this.id],camera=new T.Camera(),scene=new T.Scene(),geo=new T.BufferGeometry();
   // Independent buffers, copied byte-for-byte. Disposing this pass must never
   // deallocate the original rotor geometry's renderer-owned shared VBO.
   geo.setAttribute('position',a.clone());geo.setIndex(index.clone());const seed=new T.InstancedBufferAttribute(new Float32Array(lim),1).setUsage(T.DynamicDrawUsage);geo.setAttribute('windSeed',seed);
   const {x,y,sun,cols3}=layout,sa=cols3[0].dot(sun);
   const tex=new T.DepthTexture(layout.ax,layout.ay,T.UnsignedShortType);
   tex.name=this.id+' · finite moving rotor D16';tex.compareFunction=T.LessEqualCompare;tex.magFilter=T.LinearFilter;tex.minFilter=T.LinearFilter;tex.generateMipmaps=false;
   const rt=new T.WebGLRenderTarget(layout.ax,layout.ay,{format:T.RedFormat,type:T.UnsignedByteType,depthBuffer:true,depthTexture:tex,stencilBuffer:false,samples:0,generateMipmaps:false,minFilter:T.NearestFilter,magFilter:T.NearestFilter});
   rt.texture.name=this.id+' · unused R8 framebuffer attachment';rt.scissorTest=true;
   this.u={rotorRight:{value:x},rotorUp:{value:y},rotorSun:{value:sun},rotorDepthParams:{value:new T.Vector4(layout.hiD,1/(layout.hiD-layout.loD),x.dot(cols3[0])/sa,y.dot(cols3[0])/sa)},rotorCellRect:{value:new T.Vector4(1/layout.cols,1/layout.rows,layout.cols,0)},rotorLocalRect:{value:new T.Vector4(layout.lowU,layout.lowV,1/(layout.w*.15),1/(layout.h*.15))},rotorOrigins:{value:Array.from({length:10},()=>new T.Vector4())},rotorCount:{value:0},regionalRotorDepth:{value:tex},windClock:{value:0}};
   const mat=new T.RawShaderMaterial({name:'Actual three-blade local light depth',glslVersion:T.GLSL3,uniforms:this.u,vertexShader:casterVertex(this.id),fragmentShader:'precision highp float;out vec4 color;void main(){color=vec4(0.);}',side:T.DoubleSide,forceSinglePass:true,depthTest:true,depthWrite:true,depthFunc:T.LessEqualDepth,colorWrite:false,blending:T.NoBlending,toneMapped:false});
   const batch=new T.InstancedMesh(geo,mat,lim);batch.frustumCulled=false;batch.count=0;batch.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(batch);
   this.draw={scene,cam:camera,mat,batch,seed,rt,layout,donor:move,attr:a,sourceIndex:index,posVersion:a.version,indexVersion:index.version,sourcePositionArray:a.array,sourceIndexArray:index.array,links:false,seedVersion:-1};this.phase='ready';this.eyeX=Infinity;
  }catch(e){if(!this.dead)this.fail(String(e));}})();
 }
 private release(l:Lease,external=false){
  const {m}=l,s=m.fragmentShader,ours=RECEIVER_DECL+'\n';
  // Another feature may have altered our GLSL, may now refer to its exports,
  // or may have replaced a uniform. Never tear declarations out from under
  // that program. Detach ONLY our still-owned handles and explicitly neutralize
  // intensity+depth for this material, rather than zeroing other tiles' casters.
  let keep=false;
  if(s===l.next)m.fragmentShader=l.prior;
  else if(s.includes(ours)){
   const rest=s.replace(ours,'');
   keep=OWN_SYMBOL.test(rest.replace(FIXED_HOOK,''));
   if(!keep)m.fragmentShader=rest;
  }else keep=OWN_SYMBOL.test(s.replace(FIXED_HOOK,''));
  if(s!==m.fragmentShader)m.needsUpdate=true;
  for(const k of DATA_UNIFORMS)if(m.uniforms[k]===this.u[k]){
   if(!keep){delete m.uniforms[k];continue;}
   const v=this.u[k].value;
   m.uniforms[k]={value:k==='regionalRotorDepth'?null:k==='rotorCount'?0:
    Array.isArray(v)?v.map((q:T.Vector4)=>q.clone()):(v as T.Vector3|T.Vector4).clone()};
  }
  if(keep||external)this.retiredOwners.add(m);
  this.own.delete(m);
 }
 private readonly prelinked=new Set<string>();
 private bind(m:T.ShaderMaterial){
  if(this.own.has(m))return true;
  if(this.retiredOwners.has(m))return false;
  const prior=m.fragmentShader;
  if(!this.base.ownsMaterial(m)||!prior.includes('#ifdef PEI_MOVING_ROTOR_RECEIVER')||prior.includes(RECEIVER_DECL)||prior.split(mainPoint).length!==2||declaredUnits(prior)+1>this.r.capabilities.maxTextures)return false;
  const keys=DATA_UNIFORMS;
  if(keys.some(k=>k in m.uniforms))return false;
  const next=prior.replace(mainPoint,RECEIVER_DECL+'\n'+mainPoint);
  for(const k of keys)m.uniforms[k]=this.u[k];
  m.fragmentShader=next;m.needsUpdate=true;const lease={m,prior,next};this.own.set(m,lease);
  const cache=next+'|'+Object.entries(m.defines??{}).sort().join('~');
  if(!this.prelinked.has(cache)){
   // A driver veto cannot turn a good geographic tile black. Probe the same
   // material on the ordinary target before allowing its first main-scene draw.
   if(this.r.getRenderTarget()!==null||this.r.xr.enabled){this.release(lease);return false;}
   const scene=new T.Scene(),g=new T.BufferGeometry(),probe=new T.Mesh(g,m);
   try{
    scene.add(probe);this.r.compile(scene,new T.Camera(),this.art.root.parent as T.Scene);
    const gprog=(this.r.properties.get(m) as {currentProgram?:{program?:WebGLProgram}}).currentProgram?.program,gl=this.r.getContext();
    if(!gprog||!gl.getProgramParameter(gprog,gl.LINK_STATUS))throw Error('receiver program rejected');
    this.prelinked.add(cache);
   }catch(e){this.release(lease);throw e;}finally{g.dispose();}
  }return true;
 }
 private fail(s:string){this.lastIssue=s;this.phase='unavailable';this.clear();this.releaseDraw();}
 private releaseDraw(){const d=this.draw;if(!d)return;d.batch.removeFromParent();d.batch.dispose();d.batch.geometry.dispose();d.mat.dispose();d.rt.dispose();this.draw=undefined;}
 clear(){if(this.u.rotorCount)this.u.rotorCount.value=0;for(const l of [...this.own.values()])this.release(l);this.n=0;this.eyeX=Infinity;this.lastFrameKey=-1;}
 dispose(){this.dead=true;this.clear();this.releaseDraw();}
 private sync(eye:WindObserver){
  const d=this.draw!;const {move,mast}=source(this.art),f=WIND_PROFILE[this.id],range=ROTOR_REACH[this.id];
  if(move!==d.donor||move.geometry.attributes.position!==d.attr||move.count!==mast.count||!move.matrixWorld.equals(IDENTITY)||!this.art.root.matrixWorld.equals(IDENTITY))throw Error('caster identity changed');
  const seeds=move.geometry.getAttribute('regionalPhase');if(!(seeds instanceof T.InstancedBufferAttribute)||seeds.count<move.count)throw Error('caster phases changed');
  const material=new Set<T.ShaderMaterial>(),ids:string[]=[];
  for(let i=0;i<move.count;i++){
   move.getMatrixAt(i,this.m);mast.getMatrixAt(i,this.g);
   const e=this.m.elements,h=this.g.elements;const horiz=Math.max(0,Math.hypot(eye.x-h[12],eye.z-h[14])-range-2),vert=Math.max(0,Math.abs(eye.y-h[13])-25);
   if(horiz*horiz+vert*vert>=(570+8)**2)continue;
   const surfaces=this.world.regionalWindLightReceivers(h[12],h[14],104).filter(s=>STATIC_WIND_TILES.has(s.id)&&this.base.ownsMaterial(s.m));if(!surfaces.length)continue;
   if(ids.length>=ROTOR_LIMIT[this.id])throw Error('caster capacity exceeded');
   const {cols3}=d.layout;
   for(let j=0;j<3;j++)if(Math.abs(e[4*j]-cols3[j].x)>2e-6||Math.abs(e[4*j+1]-cols3[j].y)>2e-6||Math.abs(e[4*j+2]-cols3[j].z)>2e-6)throw Error('shaft registration changed');
   const site=this.art.sites.findIndex(s=>Math.hypot(s.x-h[12],s.z-h[14])<.025),seed=seeds.getX(i);
   if(site<0||Math.abs(e[13]-h[13]-f.hub)>.002||Math.hypot(e[12]-h[12]-Math.cos(-2.62)*f.noseX,e[14]-h[14]+Math.sin(-2.62)*f.noseX)>.025||seed!==Math.fround(site*Math.PI*(3-Math.sqrt(5))))throw Error('hub/phase registration changed');
   const at=ids.length;ids.push(this.art.sites[site].id);d.batch.setMatrixAt(at,this.m);d.seed.setX(at,seed);this.u.rotorOrigins.value[at].set(e[12],e[13],e[14],1);
   for(const s of surfaces)material.add(s.m);
  }
  this.n=ids.length;this.slotIds=ids;d.batch.count=ids.length;d.batch.instanceMatrix.needsUpdate=true;d.seed.needsUpdate=true;
  for(const l of [...this.own.values()])if(!material.has(l.m)||!l.m.fragmentShader.includes(RECEIVER_DECL))this.release(l);
  if(this.n)for(const m of material)this.bind(m);
  this.eyeX=eye.x;this.eyeY=eye.y;this.eyeZ=eye.z;this.epoch=this.world.visualGroundEpoch;this.cacheVersion=move.instanceMatrix.version;d.seedVersion=seeds.version;this.frameKey++;
 }
 private paint(clock:number){
  const {r}=this,d=this.draw!;const gl=r.getContext() as WebGL2RenderingContext;
  if(r.xr.enabled||r.getRenderTarget()!==null||gl.isContextLost()){this.u.rotorCount.value=0;this.lastFrameKey=-1;return;}
  // Set viewport/scissor on this private framebuffer only. The ordinary target,
  // any custom default viewport, scissor and rendering options are never edited.
  const ac=r.autoClear,target=r.getRenderTarget(),face=r.getActiveCubeFace(),mip=r.getActiveMipmapLevel();
  this.u.rotorCount.value=0;this.u.windClock.value=clock;
  const a=d.layout,rows=Math.ceil(this.n/a.cols);d.rt.scissor.set(0,0,Math.min(this.n,a.cols)*a.w,rows*a.h);
  try{
   r.setRenderTarget(d.rt);
   if(!d.links){
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('incomplete depth target');
    r.compile(d.scene,d.cam);
    const program=(r.properties.get(d.mat) as {currentProgram?:{program?:WebGLProgram}}).currentProgram?.program;
    if(!program||!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('depth link rejected');
    d.links=true;
   }
   r.autoClear=false;r.clear(false,true,false);r.render(d.scene,d.cam);this.submits++;
  }finally{r.autoClear=ac;r.setRenderTarget(target,face,mip);}
  this.lastClock=clock;this.lastFrameKey=this.frameKey;this.u.rotorCount.value=this.n;
 }
 update(eye:WindObserver){
  if(this.dead||this.phase==='unavailable')return;
  if(this.r.xr.enabled||this.r.getRenderTarget()!==null||this.r.getContext().isContextLost()){
   if(this.u.rotorCount)this.u.rotorCount.value=0;this.lastFrameKey=-1;return;
  }
  const ready=this.base.hasMountedStatic()&&this.art.root.visible&&SUN.distanceToSquared(this.world.sun)<1e-14;
  if(!ready){if(this.own.size||this.n)this.clear();return;}
  if(this.phase==='cold')this.prepare();
  const d=this.draw;if(!d||this.phase!=='ready')return;
  try{
   const {move}=source(this.art),clock=this.art.lightClock(),ver=(move.geometry.getAttribute('regionalPhase') as T.InstancedBufferAttribute).version;
   const g=move.geometry,range=g.drawRange;
   if(move!==d.donor||g.attributes.position!==d.attr||g.index!==d.sourceIndex||d.attr.array!==d.sourcePositionArray||d.attr.version!==d.posVersion||d.sourceIndex.array!==d.sourceIndexArray||d.sourceIndex.version!==d.indexVersion||range.start!==0||range.count<4560||!move.matrixWorld.equals(IDENTITY))throw Error('source caster changed after authentication');
   if(!move.visible||!move.material.visible){this.clear();return;}
   for(const [m,l] of this.own)if(m.fragmentShader!==l.next||DATA_UNIFORMS.some(k=>m.uniforms[k]!==this.u[k])){
    this.release(l,true);this.eyeX=Infinity;this.lastFrameKey=-1;
   }
   if(!Number.isFinite(clock)||clock<0||clock>=600){this.clear();return;}
   if(this.epoch!==this.world.visualGroundEpoch||this.cacheVersion!==move.instanceMatrix.version||d.seedVersion!==ver||Math.hypot(eye.x-this.eyeX,eye.y-this.eyeY,eye.z-this.eyeZ)>=8||[...this.own.keys()].some(m=>!this.base.ownsMaterial(m)))this.sync(eye);
   if(this.n&&this.own.size&&(clock!==this.lastClock||this.frameKey!==this.lastFrameKey||this.u.rotorCount.value===0))this.paint(clock);
   else if(!this.n||!this.own.size)this.u.rotorCount.value=0;
  }catch(e){this.fail(String(e));}
 }
}
export function withRotorReceiver(id:WindFarmId,r:T.WebGLRenderer,world:World,caster:RegionalWind,base:RegionalStaticLight):StaticWindReceiver{
 if(!canDrawRotor(r))return base;
 const moving=new RegionalRotorLight(id,r,world,caster,base);base.attachMoving(moving);return base;
}
