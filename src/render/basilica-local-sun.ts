import * as T from 'three';
import {BASILICA_CAST as L} from './basilica-cast-source.ts';
import {DEPTH_VERTEX} from './basilica-cast-glsl.ts';
import {castMaterial,type CastRole,type SunUniforms} from './basilica-cast-material.ts';
import type {World} from './world.ts';
import type {Roads} from './roads.ts';
import type {Sidewalks} from './sidewalks.ts';

type Target={mesh:T.Mesh,base:T.Material};
type Lease=Target&{variant:T.Material,role:CastRole,version:number,hook:T.Material['onBeforeCompile'],key:string,vert?:string,frag?:string};
type Opaque=T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
type Donor={mesh:Opaque,geo:T.BufferGeometry,pos:T.BufferAttribute,ver:number,array:ArrayBufferLike,mat:T.MeshStandardMaterial,side:T.Side,
  shader:T.MeshStandardMaterial['onBeforeCompile'],key:string,role:string};
const origin=new T.Vector3(...L.origin),sun=new T.Vector3(...L.directions[2]),id4=new T.Matrix4();
const close=(a:number,b:number)=>Math.abs(a-b)<1e-7;
function validForm(g:T.Group,scene:T.Scene){
 return g.parent===scene&&g.visible&&g.userData.basilicaAppearance==='qualitative exterior'&&g.children.length===L.roster.length&&
    g.position.distanceToSquared(origin)<1e-12&&close(g.rotation.y,L.yaw)&&g.rotation.x===0&&g.rotation.z===0&&
    g.scale.x===1&&g.scale.y===1&&g.scale.z===1&&scene.matrix.equals(id4)&&scene.position.lengthSq()===0&&scene.quaternion.x===0&&scene.quaternion.y===0&&
    scene.quaternion.z===0&&scene.quaternion.w===1&&scene.scale.x===1&&scene.scale.y===1&&scene.scale.z===1;
}
function certDonor(m:Opaque,d:Donor){
 return m===d.mesh&&m.visible&&m.geometry===d.geo&&m.matrix.equals(id4)&&m.position.lengthSq()===0&&m.quaternion.x===0&&m.quaternion.y===0&&m.quaternion.z===0&&m.quaternion.w===1&&
  m.scale.x===1&&m.scale.y===1&&m.scale.z===1&&m.geometry.getAttribute('position')===d.pos&&
  d.pos.version===d.ver&&d.pos.array.buffer===d.array&&!m.geometry.index&&m.geometry.drawRange.start===0&&
  m.geometry.drawRange.count>=d.pos.count&&m.material===d.mat&&d.mat.side===d.side&&d.mat.opacity===1&&!d.mat.wireframe&&!d.mat.alphaHash&&d.mat.onBeforeCompile===d.shader&&
  d.mat.customProgramCacheKey()===d.key&&!d.mat.transparent&&!d.mat.alphaTest&&!d.mat.alphaMap&&!d.mat.displacementMap&&d.mat.visible;
}
async function donors(g:T.Group,scene:T.Scene){
 if(!validForm(g,scene)||!globalThis.crypto?.subtle)return;
 const out:Donor[]=[];
 for(let i=0;i<L.roster.length;i++){
  const row=L.roster[i],m=g.children[i] as Opaque,geo=m.geometry,pos=geo?.getAttribute('position') as T.BufferAttribute|undefined,mat=m.material;
  if(!m.isMesh||!pos||!(pos.array instanceof Float32Array)||!(pos.array.buffer instanceof ArrayBuffer)||pos.itemSize!==3||pos.count!==row.count||
    m.name!=='Basilica exterior · '+row.surface||!mat?.isMeshStandardMaterial||mat.name!=='basilica-exterior:'+row.surface)return;
  const d={mesh:m,geo,pos,ver:pos.version,array:pos.array.buffer,mat,side:mat.side,shader:mat.onBeforeCompile,key:mat.customProgramCacheKey(),role:row.surface};
  if(!certDonor(m,d))return;
  const digest=await crypto.subtle.digest('SHA-256',new Uint8Array(pos.array.buffer,pos.array.byteOffset,pos.array.byteLength));
  if([...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')!==row.positions)return;out.push(d);
 }
 return validForm(g,scene)&&out.every(d=>certDonor(d.mesh,d))?out:undefined;
}
const smooth=(v:number)=>{const a=Math.min(1,Math.max(0,v));return a*a*(3-2*a);};
export class BasilicaLocalSun{
 private readonly r:T.WebGLRenderer;private readonly scene:T.Scene;private readonly w:World;private readonly g:T.Group;
 private readonly getRoad:()=>Roads|undefined;private readonly getWalk:()=>Sidewalks|undefined;
 private land?:Lease;private road?:Lease;private walk?:Lease;
 private readonly a=new T.Vector3();private readonly b=new T.Vector3();private verifiedSun=false;private foreignLight=false;
 // The camera's ordinary PBR road shader sums direct lights. Never apply the church
 // shadow to a flashlight or fill contributed by another nested or root scene light.
 private readonly visitLight=(o:T.Object3D)=>{
  const l=o as T.Light&{isAmbientLight?:boolean;isHemisphereLight?:boolean;isLightProbe?:boolean};
  if(!l.isLight||l.intensity===0||l.isAmbientLight||l.isHemisphereLight||l.isLightProbe)return;
  if(l===this.w.basilicaDaylight&&l.intensity>0){this.verifiedSun=true;return;}
  this.foreignLight=true;
 };
 private soleDirectSun(){
  this.verifiedSun=this.foreignLight=false;this.scene.traverseVisible(this.visitLight);
  const l=this.w.basilicaDaylight;
  return this.verifiedSun&&!this.foreignLight&&l.getWorldPosition(this.a).sub(l.target.getWorldPosition(this.b)).normalize().distanceToSquared(sun)<1e-10;
 }
 private phase:'cold'|'certifying'|'ready'|'failed'='cold';private source?:Donor[];
 private leases=new Map<T.Mesh,Lease>();private variants=new Map<T.Material,Map<CastRole,T.Material>>();
 private rt?:T.WebGLRenderTarget;private depthMat?:T.RawShaderMaterial;private u?:SunUniforms;
 private yardLive=false;private admissions=0;private depthDraws=0;private farSeconds=0;private why='';private resourceEpoch=0;
 constructor(r:T.WebGLRenderer,scene:T.Scene,w:World,g:T.Group,road:()=>Roads|undefined,walk:()=>Sidewalks|undefined){
  this.r=r;this.scene=scene;this.w=w;this.g=g;this.getRoad=road;this.getWalk=walk;
 }
 get state(){return {phase:this.phase,yard:this.yardLive,leases:this.leases.size,sourceChecks:this.admissions,
  isolatedDepthDraws:this.depthDraws,sourceTriangles:this.rt?30931:0,target:this.rt?'1024x1024 D16 + R8':null,
  gain:this.u?.bsLive.value??0,error:this.why||null};}
 private unbind(){
  if(this.u)this.u.bsLive.value=0;
  for(const x of this.leases.values())if(x.mesh.material===x.variant)x.mesh.material=x.base;
  this.leases.clear();this.land=this.road=this.walk=undefined;this.yardLive=false;
 }
 private dropResources(){
  this.unbind();for(const v of this.variants.values())for(const m of v.values())m.dispose();this.variants.clear();
  this.rt?.dispose();this.depthMat?.dispose();this.rt=undefined;this.depthMat=undefined;this.u=undefined;
 }
 private fail(reason:string){this.resourceEpoch++;this.phase='failed';this.why=reason;this.dropResources();}
 private paintOnce(){
  const r=this.r,gl=r.getContext(),scene=new T.Scene(),eye=new T.Camera();
  if(!this.source||r.getRenderTarget()||r.xr.isPresenting||this.scene.overrideMaterial)return false;
  const tex=new T.DepthTexture(L.size,L.size,T.UnsignedShortType);
  tex.name='Basilica frontage · local opaque sun D16';tex.magFilter=tex.minFilter=T.NearestFilter;tex.generateMipmaps=false;
  const rt=new T.WebGLRenderTarget(L.size,L.size,{type:T.UnsignedByteType,format:T.RedFormat,depthBuffer:true,
   depthTexture:tex,stencilBuffer:false,samples:0,generateMipmaps:false,minFilter:T.NearestFilter,magFilter:T.NearestFilter});
  rt.texture.name='Basilica frontage · private R8 output';
  const dm=new T.RawShaderMaterial({name:'Basilica unchanged source daylight',glslVersion:T.GLSL3,vertexShader:DEPTH_VERTEX,
   fragmentShader:'precision highp float;out vec4 color;void main(){color=vec4(0.);}',side:T.DoubleSide,
   forceSinglePass:true,depthTest:true,depthWrite:true,depthFunc:T.LessEqualDepth,colorWrite:false,blending:T.NoBlending,toneMapped:false});
  this.rt=rt;this.depthMat=dm;
  for(const row of this.source){const cast=new T.Mesh(row.geo,dm);cast.frustumCulled=false;cast.matrixAutoUpdate=false;scene.add(cast);}
  const before=r.getRenderTarget(),layer=r.getActiveCubeFace(),mip=r.getActiveMipmapLevel(),ac=r.autoClear;
  try{
   // Private target's own viewport defaults to full size and no scissor.
   r.autoClear=false;r.setRenderTarget(rt);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('unsupported isolated depth framebuffer');
   r.clear(false,true,false);r.render(scene,eye);this.depthDraws+=this.source.length;
  }finally{r.autoClear=ac;r.setRenderTarget(before,layer,mip);}
  this.u={bsSourceDepth:{value:tex},bsLive:{value:0}};return true;
 }
 private variant(src:T.Material,role:CastRole){
  let list=this.variants.get(src);if(!list){list=new Map();this.variants.set(src,list);}
  let m=list.get(role);if(!m){
   m=castMaterial(src,role,this.u!);
   if(role==='road'){
    // Preflight the installed Three.js PBR source, after the road donor's own callback,
    // before any of the three materials is mounted. Never throw later on the live frame.
    try{const probe={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
      m.onBeforeCompile(probe as T.WebGLProgramParametersWithUniforms,this.r);
    }catch(e){m.dispose();throw e;}
   }
   list.set(role,m);
  }return m;
 }
 private receiver(t:Target,role:CastRole,old:Lease|undefined){
  const {mesh,base}=t;
  if(old?.mesh===mesh&&old.base===base){
   if(mesh.material!==base&&mesh.material!==old.variant)throw Error('foreign '+role+' receiver');
   const sh=base as T.ShaderMaterial;
   if(old.version!==base.version||old.hook!==base.onBeforeCompile||old.key!==base.customProgramCacheKey()||
    (sh.isShaderMaterial&&(old.vert!==sh.vertexShader||old.frag!==sh.fragmentShader)))
      throw Error('original '+role+' material changed');
   return old;
  }
  if(mesh.material!==base)throw Error('foreign '+role+' receiver');
  const sh=base as T.ShaderMaterial;
  return {mesh,base,role,variant:this.variant(base,role),version:base.version,hook:base.onBeforeCompile,
   key:base.customProgramCacheKey(),vert:sh.isShaderMaterial?sh.vertexShader:undefined,frag:sh.isShaderMaterial?sh.fragmentShader:undefined};
 }
 update(eye:T.Vector3,dt:number){
  if(this.phase==='failed')return;
  const target=this.r.getRenderTarget();
  if(!validForm(this.g,this.scene)){this.fail('original landmark no longer owns its home');return;}
  if(target||this.r.xr.isPresenting||this.scene.overrideMaterial){if(this.rt)this.dropResources();return;}
  const dist=eye.distanceTo(origin),gain=(1-smooth((dist-280)/210))*(1-smooth((eye.y-origin.y-175)/105));
  if(!Number.isFinite(gain)||gain<=0){
   if(this.yardLive){this.unbind();for(const ms of this.variants.values())for(const m of ms.values())m.dispose();this.variants.clear();}
   this.farSeconds+=Math.max(0,Math.min(dt,.2));
   if(this.farSeconds>3&&this.rt)this.dropResources();return;
  }
  this.farSeconds=0;
  const gl=this.r.getContext();if(gl.isContextLost()||this.w.sun.distanceToSquared(sun)>1e-12||
    this.r.capabilities.maxTextures<16||this.r.capabilities.maxTextureSize<1024){this.dropResources();return;}
  if(!this.soleDirectSun()){if(this.rt)this.dropResources();return;}
  const floor=this.w.basilicaSunGround(this.land?.variant);
  const road=this.getRoad()?.basilicaSunRoad(this.road?.variant),walk=this.getWalk()?.basilicaSunWalk(this.walk?.variant);
  if(!floor||!road||!walk){if(this.rt)this.dropResources();return;}
  if(this.phase==='cold'){this.phase='certifying';this.admissions++;const e=this.resourceEpoch;
    void donors(this.g,this.scene).then(q=>{if(e!==this.resourceEpoch)return;if(!q){this.fail('source mesh did not authenticate');return;}
      this.source=q;this.phase='ready';},()=>{if(e===this.resourceEpoch)this.fail('unavailable source hash');});return;}
  if(!this.source)return;
  const S=this.source;if(S.some((d,i)=>!certDonor(this.g.children[i] as Opaque,d))){
   this.fail('caster or material ownership changed');return;
  }
  try{
   if(!this.u&&!this.paintOnce())return;if(!this.u)return;
   const a=this.receiver(floor,'land',this.land),b=this.receiver(road,'road',this.road),c=this.receiver(walk,'walk',this.walk);
   if(a!==this.land||b!==this.road||c!==this.walk){
    // Read/verify the complete triple first. No partial shadow, not even for one frame.
    this.unbind();this.land=a;this.road=b;this.walk=c;
    this.leases.set(a.mesh,a);this.leases.set(b.mesh,b);this.leases.set(c.mesh,c);
   }
   if(a.mesh.material!==a.variant)a.mesh.material=a.variant;
   if(b.mesh.material!==b.variant)b.mesh.material=b.variant;
   if(c.mesh.material!==c.variant)c.mesh.material=c.variant;
   this.u.bsLive.value=gain;this.yardLive=true;
  }catch(reason){this.fail(String(reason));}
 }
 dispose(){this.resourceEpoch++;this.dropResources();this.phase='failed';this.why='disposed';}
}
