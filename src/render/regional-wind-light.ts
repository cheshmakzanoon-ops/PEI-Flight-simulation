import * as T from 'three';
import {boundedPackedBody} from '../sim/packed-bytes.ts';
import {STATIC_SKIN,STATIC_WIND_TILES} from './regional-wind-light.generated.ts';
import type {WindFarmId,WindObserver} from './regional-wind-stream.ts';
import type {RegionalWind} from './regional-wind.ts';
import type {World} from './world.ts';
const max=10,radius=690,refreshDistance=8;
const light=new T.Vector3(-.60,.74,-.31).normalize();
const marker='col*=.90+.31*light;', globalMark='void main(){';
const declarations=`
uniform sampler2D regionalStaticDepth;
uniform vec4 regionalStaticBox;
uniform vec4 regionalStaticMasts[10];
uniform int regionalStaticCount;
float windStaticDirect(vec3 p,float dist,float pixel){
 if(dist>=570.||regionalStaticCount==0)return 0.;
 for(int wi=0;wi<10;wi++){
  if(wi>=regionalStaticCount)break;
  vec3 dp=p-regionalStaticMasts[wi].xyz;
  if(dot(dp.xz,dp.xz)>10816.)continue;
  vec2 q=dp.xz+dp.y*(vec2(.60,.31)/.74);
  const vec2 forward=vec2(.8884259069,.4590200519);
  vec2 st=vec2(dot(q,forward),dot(q,vec2(-forward.y,forward.x)));
  vec2 uv=(st-regionalStaticBox.xy)*regionalStaticBox.zw;
  if(any(lessThan(uv,vec2(0.)))||any(greaterThanEqual(uv,vec2(1.))))continue;
  // No mip-dependent sample in a divergent loop: this immutable metrical
  // field is linearly sampled at its single original resolution.
  vec3 raw=textureLod(regionalStaticDepth,uv,0.).rgb;
  float sd=2.70*raw.r-1.35;
  float top=(raw.g+256.*raw.b)*2.55-2.;
  float high=top-dp.y;
  float w=clamp(max(.065,.00465*max(0.,high)/.7386347873)+.50*min(pixel,.7),.065,1.1);
  return smoothstep(-w,w,sd)*smoothstep(0.,.06,high)*(1.-smoothstep(370.,570.,dist));
 }
 return 0.;
}
`;
const insertion=`float regionalCut=windStaticDirect(p,d,max(length(terrainDx.xz),length(terrainDy.xz)));
 #ifdef PEI_MOVING_ROTOR_RECEIVER
 regionalCut=max(regionalCut,windRotorDirect(p,d,max(length(terrainDx.xz),length(terrainDy.xz))));
 #endif
 if(regionalCut>0.)col*=.90+.31*light*(1.-.96*regionalCut);
 else ${marker}`;
function sha(b:ArrayBuffer){return crypto.subtle.digest('SHA-256',b).then(q=>Array.from(new Uint8Array(q),n=>n.toString(16).padStart(2,'0')).join(''));}
function buffer(a:ArrayBufferView){return new Uint8Array(a.buffer,a.byteOffset,a.byteLength).slice().buffer;}
export async function loadStaticData(id:WindFarmId,base:string,fetcher:typeof fetch=fetch){
 const entry=STATIC_SKIN[id],[w,h]=entry.size,n=w*h,m=3*n+8;
 try{
  const r=await fetcher(base+'regional-wind-light/v1/'+id+'.wrg.gz');if(!r.ok||!r.body)return;
  // Some static hosts deliver a .gz as application/gzip, others auto-unzip
  // using Content-Encoding. Both representations are bounded and independently signed.
  let raw=await boundedPackedBody(r.body,m);let u=new Uint8Array(raw);
  if(u[0]===31&&u[1]===139){
   if(u.length!==entry.sizeWire||await sha(raw)!==entry.wire)return;
   raw=await boundedPackedBody(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip')),m);u=new Uint8Array(raw);
  }
  const dv=new DataView(raw);
  if(u.length!==m||await sha(raw)!==entry.raw||dv.getUint32(0)!==0x57524731||dv.getUint16(4,true)!==w||dv.getUint16(6,true)!==h)return;
  const rgba=new Uint8Array(n*4);for(let j=0;j<h;j++){
   let r=0,g=0,b=0;
   for(let i=0;i<w;i++){const z=j*w+i;r=(r+u[8+z])&255;g=(g+u[8+n+z])&255;b=(b+u[8+2*n+z])&255;
    rgba[4*z]=r;rgba[4*z+1]=g;rgba[4*z+2]=b;rgba[4*z+3]=255;}
  }
  if(await sha(rgba.buffer)!==entry.decoded)return;
  return rgba;
 }catch{return;}
}
export function declaredUnits(src:string){
 const rg=/\buniform\s+(?:(?:lowp|mediump|highp)\s+)?(?:[iu]?sampler[\w]+)\s+([^;]+);/g;
 let n=0;for(const a of src.matchAll(rg))for(const b of a[1].split(',')){
  const v=b.trim().match(/^[\w]+(?:\s*\[\s*(\d+)\s*\])?$/);if(!v)return Infinity;n+=v[1]?Number(v[1]):1;
 }return n;
}
type Lease={m:T.ShaderMaterial;prior:string;next:string};
export type StaticLightContext={world:World;base:string;maxTextures:number;maxUniforms:number;rotorScope?:boolean};
export class RegionalStaticLight{
 private tex?:T.DataTexture;private retired=false;private phase:'cold'|'loading'|'ready'|'unavailable'='cold';
 private readonly streams:{[key:string]:T.IUniform};
 private readonly own=new Map<T.ShaderMaterial,Lease>();
 private lastX=Infinity;private lastY=Infinity; private lastZ=Infinity;private age=-1;
 private moving?:{update(e:WindObserver):void;clear():void;dispose():void;readonly state:unknown};
 attachMoving(a:NonNullable<RegionalStaticLight['moving']>){this.moving=a;}
 hasMountedStatic(){return this.phase==='ready'&&this.own.size>0;}
 private readonly id:WindFarmId;private readonly ctx:StaticLightContext;private readonly caster:RegionalWind;
 constructor(id:WindFarmId,ctx:StaticLightContext,caster:RegionalWind){
  this.id=id;this.ctx=ctx;this.caster=caster;
  const s=STATIC_SKIN[id];
  this.streams={regionalStaticDepth:{value:null},regionalStaticBox:{value:new T.Vector4(s.s[0],s.s[1],8/s.size[0],8/s.size[1])},regionalStaticMasts:{value:Array.from({length:max},()=>new T.Vector4())},regionalStaticCount:{value:0}};
 }
 ownsMaterial(m:T.ShaderMaterial){return this.phase==='ready'&&this.own.has(m)&&m.uniforms.regionalStaticDepth===this.streams.regionalStaticDepth;}
 get state(){return {phase:this.phase,activeTiles:this.own.size,nearCasters:this.streams.regionalStaticCount.value as number,...(this.moving?{moving:this.moving.state}:{})};}
 private ready(){
  if(this.phase!=='cold')return;
  this.phase='loading';
  void(async()=>{
   try{
    const shape=this.caster.root.children[0] as T.InstancedMesh,owner=STATIC_SKIN[this.id];
    const g=shape.geometry,attr=g?.getAttribute('position'),raw=g?.index;
    if(!shape.isInstancedMesh||!attr||!raw||await sha(buffer(attr.array))!==owner.pos||await sha(buffer(raw.array))!==owner.index)throw Error('Unknown static caster');
    const pixels=await loadStaticData(this.id,this.ctx.base);if(!pixels)throw Error('Unknown static field');
    if(this.retired)return;
    const tex=new T.DataTexture(pixels,owner.size[0],owner.size[1],T.RGBAFormat,T.UnsignedByteType);
    tex.name=this.id+' · measured projected static sunlight';tex.minFilter=T.LinearFilter;tex.magFilter=T.LinearFilter;
    tex.flipY=false;tex.generateMipmaps=false;tex.needsUpdate=true;this.tex=tex;
    this.streams.regionalStaticDepth.value=tex;this.phase='ready';this.lastX=Infinity;
   }catch{if(!this.retired)this.phase='unavailable';}
  })();
 }
 private admissible(m:T.ShaderMaterial){
  const prior=m.fragmentShader;
  return this.own.has(m)||(prior.split(marker).length===2&&prior.split(globalMark).length===2&&!prior.includes('regionalStatic')&&
   declaredUnits(prior)+1<=this.ctx.maxTextures&&!Object.keys(this.streams).some(k=>k in m.uniforms));
 }
 private bind(m:T.ShaderMaterial){
  if(this.own.has(m))return true;
  const prior=m.fragmentShader;
  if(!this.admissible(m))return false;
  const next=prior.replace(globalMark,declarations+'\n'+globalMark).replace(marker,insertion);
  Object.assign(m.uniforms,this.streams);m.fragmentShader=next;m.needsUpdate=true;this.own.set(m,{m,prior,next});return true;
 }
 private release(v:Lease){
  let source=v.m.fragmentShader;
  if(source===v.next)source=v.prior;
  else if(source.includes(declarations+'\n')&&source.includes(insertion))source=source.replace(declarations+'\n','').replace(insertion,marker);
  if(v.m.fragmentShader!==source){v.m.fragmentShader=source;v.m.needsUpdate=true;}
  if(!source.includes('regionalStatic')){
   for(const k of Object.keys(this.streams))if(v.m.uniforms[k]===this.streams[k])delete v.m.uniforms[k];
  }else{
   // A different program took ownership after installation. Do not overwrite
   // its shader or delete a still-declared uniform. Retire only our live data.
   if(v.m.uniforms.regionalStaticCount===this.streams.regionalStaticCount)v.m.uniforms.regionalStaticCount={value:0};
   if(v.m.uniforms.regionalStaticDepth===this.streams.regionalStaticDepth)v.m.uniforms.regionalStaticDepth={value:null};
  }
  this.own.delete(v.m);
 }
 clear(){this.moving?.clear();this.streams.regionalStaticCount.value=0;for(const v of this.own.values())this.release(v);this.lastX=Infinity;}
 update(eye:WindObserver){this.updateStatic(eye);this.moving?.update(eye);}
 private updateStatic(eye:WindObserver){
  if(this.retired||this.phase==='unavailable')return;
  const {world}=this.ctx;
  if(!this.caster.root.visible||light.distanceToSquared(world.sun)>1e-14){this.clear();return;}
  const epoch=world.visualGroundEpoch;
  if(this.age===epoch&&Math.hypot(eye.x-this.lastX,eye.y-this.lastY,eye.z-this.lastZ)<refreshDistance)return;
  this.lastX=eye.x;this.lastY=eye.y;this.lastZ=eye.z;this.age=epoch;
  const near=this.caster.root.children[0] as T.InstancedMesh,mat=new T.Matrix4();
  const q:T.Vector3[]=[],materials=new Set<T.ShaderMaterial>();let prefetch=false,bad=false;
  for(let i=0;i<near.count;i++){
   near.getMatrixAt(i,mat);const e=mat.elements;
   if(Math.abs(e[0]-Math.cos(-2.62))>1e-5||Math.abs(e[2]+Math.sin(-2.62))>1e-5||Math.abs(e[5]-1)>1e-5){bad=true;break;}
   const x=e[12],y=e[13],z=e[14],horiz=Math.hypot(x-eye.x,z-eye.z);
   if(horiz>=995||Math.abs(y-eye.y)>=755)continue;
   const eligible=world.regionalWindLightReceivers(x,z,104).filter(t=>STATIC_WIND_TILES.has(t.id)&&this.admissible(t.m));
   if(!eligible.length)continue;
   prefetch=true;
   if(horiz>(this.ctx.rotorScope?({'west-cape':731,'east-point-i':738,hermanville:765}[this.id]):radius)||Math.abs(y-eye.y)>605)continue;
   q.push(new T.Vector3(x,y,z));if(q.length>max){bad=true;break;}
   for(const t of eligible)materials.add(t.m);
  }
  if(bad){this.clear();this.phase='unavailable';return;}
  if(prefetch&&this.phase==='cold')this.ready();
  if(this.phase!=='ready'||!this.tex||!q.length){if(this.own.size)this.clear();return;}
  for(const l of this.own.values())if(!materials.has(l.m))this.release(l);
  for(const m of materials)this.bind(m);
  this.streams.regionalStaticCount.value=this.own.size?q.length:0;
  for(let i=0;i<q.length;i++)(this.streams.regionalStaticMasts.value as T.Vector4[])[i].set(q[i].x,q[i].y,q[i].z,1);
 }
 dispose(){this.moving?.dispose();this.moving=undefined;this.retired=true;this.clear();this.tex?.dispose();this.tex=undefined;}
}
export function staticWindLight(id:WindFarmId,ctx:StaticLightContext,caster:RegionalWind){
 if(ctx.maxTextures<16||ctx.maxUniforms<224||light.distanceToSquared(ctx.world.sun)>1e-14)return;
 return new RegionalStaticLight(id,ctx,caster);
}
