import {stockOceanApertureDepth} from './borden-ocean-depth.ts';
import * as T from 'three';
import {BORDEN_STOCK_DEPTH_PROGRAMS,BORDEN_STOCK_LINK_PREFIXES} from './borden-opaque-pins.ts';
import {hashBordenCoastShader} from './borden-bilinear-authority.ts';
import type {BordenCanopyResident} from './borden-canopy-resident.ts';

type M=T.Mesh<T.BufferGeometry,T.Material>;
type Producer={readonly geometry:T.BufferGeometry;readonly material:T.Material;
 readonly instance?:Readonly<{attribute:T.InstancedBufferAttribute;array:ArrayLike<number>;version:number;count:number;
  bbox:T.Sphere;stamp:readonly number[]}>;
 readonly before:T.Material['onBeforeCompile'];readonly key:T.Material['customProgramCacheKey']};
type PositionSeal={readonly attr:T.BufferAttribute;readonly array:Float32Array;version:number;readonly box:T.Box3};
type AirLink={readonly owner:T.Object3D;readonly parent:T.Object3D;readonly transform:readonly number[]};
type AirProducer={readonly geometry:T.BufferGeometry;readonly material:T.Material;
 readonly position:T.BufferAttribute;readonly words:ArrayLike<number>;readonly version:number;
 readonly chain:readonly AirLink[];readonly reach:number};
type Program={readonly vertex:string;readonly fragment:string;accepted:boolean};
type NativeProgram={readonly program:WebGLProgram;readonly vertexShader:WebGLShader;readonly fragmentShader:WebGLShader};
type NativeLink={readonly holder:NativeProgram;readonly definitions:string;readonly template:Program;valid:boolean};
type Draw={readonly geometry:T.BufferGeometry|null;readonly object:T.Object3D;readonly material:T.Material};
const exact=(q:number)=>Number.isFinite(q)&&Math.abs(q)<450_000;
const objectDefault=(o:T.Object3D)=>o.onBeforeRender===T.Object3D.prototype.onBeforeRender&&o.onAfterRender===T.Object3D.prototype.onAfterRender;
const knownMesh=(m:T.Material):boolean=>m.constructor===T.MeshBasicMaterial||m.constructor===T.MeshStandardMaterial||m.constructor===T.MeshPhysicalMaterial;
const custom=(m:T.Material):boolean=>m.onBeforeCompile!==T.Material.prototype.onBeforeCompile||m.customProgramCacheKey!==T.Material.prototype.customProgramCacheKey;
const mutatingUniforms=['projectionMatrix','viewMatrix','modelViewMatrix','modelMatrix','cameraPosition','isOrthographic','logDepthBufFC'] as const;
const unknownDefs=(m:T.ShaderMaterial)=>Object.entries(m.defines??{}).some(([x,v])=>v!==1||!['SOURCE_GRASS_NAP_METRIC','SURVEY_LIGHT'].includes(x));
const asShader=(m:T.Material):T.ShaderMaterial|undefined=>m instanceof T.ShaderMaterial?m:undefined;
const pairOf=(m:T.ShaderMaterial)=>m.vertexShader+'\0'+m.fragmentShader;
const coldMajor=320_000; // D24/log-depth headroom below the 350 km stock perspective far plane.

const includes=/^[ \t]*#include +<([\w\d./]+)>/gm;
/** Borden allows only audited r187 custom bodies without light placeholders
 * or unrolled loops. Compare their actual, include-expanded, linked suffix. */
function expandShaderBody(body:string,depth=0):string|undefined{
 if(depth>5||/#pragma\s+unroll_loop|\bNUM_[A-Z_]+\b/.test(body))return;
 let expanded=true;
 const value=body.replace(includes,(original,name:string)=>{
  const raw=(T.ShaderChunk as Readonly<Record<string,string>>)[name];
  const nested=typeof raw==='string'?expandShaderBody(raw,depth+1):undefined;
  if(nested===undefined){expanded=false;return original;}
  return nested;
 });
 return expanded?value:undefined;
}
function exactLinkedPrefix(full:string,body:string,defined:string){
 const exact=expandShaderBody(body);
 if(exact===undefined||!full.endsWith(exact))return;
 const prefix=full.slice(0,full.length-exact.length);
 // No current special shader bypasses true logarithmic depth or redefines
 // an input. Bind both reviewed optional producer knobs to their live link.
 if(!/^#define +USE_LOGARITHMIC_DEPTH_BUFFER(?:[ \t]|$)/m.test(prefix)||/^[ \t]*#undef[ \t]/m.test(prefix))return;
 const defs=[...prefix.matchAll(/^#define +(SOURCE_GRASS_NAP_METRIC|SURVEY_LIGHT) +([^\n]+)$/gm)]
  .map(x=>x[1]+'='+x[2].trim()).sort().join(';');
 return defs===defined?prefix:undefined;
}

export class BordenOpaqueScope{
 private readonly programs=new WeakMap<T.ShaderMaterial,Program>();
 private readonly sources=new Map<string,Program>();
 private readonly native=new WeakMap<NativeProgram,NativeLink>();
 private readonly prefixSeals=new Map<string,Promise<boolean>>();
 private readonly bridge=new WeakMap<T.Object3D,Producer>();
 private readonly air=new WeakMap<T.Object3D,AirProducer>();
 private aircraft?:T.Object3D;

 private readonly products=new WeakMap<T.Material,Omit<Producer,'geometry'>>();
 private readonly geometry=new WeakMap<T.BufferGeometry,PositionSeal>();
 private readonly mv=new T.Matrix4();
 private readonly bound=new T.Box3();
 constructor(private readonly renderer:T.WebGLRenderer,private readonly matchingRoad:(o:T.Object3D,m:T.Material)=>boolean){
 }
 registerBridge(g:T.Group){
  for(const o of g.children)if(o instanceof T.Mesh&&!Array.isArray(o.material)){
   const material=o.material as T.Material;
   const pose=o instanceof T.InstancedMesh?{attribute:o.instanceMatrix,array:o.instanceMatrix.array,version:o.instanceMatrix.version,count:o.count,
    bbox:o.boundingSphere,stamp:o.boundingSphere?[...o.boundingSphere.center,o.boundingSphere.radius]:[]}:undefined;
   if(pose&&!pose.bbox)continue;
   const instance=pose?{...pose,bbox:pose.bbox!}:undefined;
   this.bridge.set(o,{geometry:o.geometry,material,before:material.onBeforeCompile,key:material.customProgramCacheKey,instance});
  }
 }
 registerAircraft(root:T.Object3D){
  if(this.aircraft)return;
  this.aircraft=root;
  root.traverse(o=>{
   if(!(o instanceof T.Mesh)||Array.isArray(o.material)||!knownMesh(o.material)||custom(o.material))return;
   const g=o.geometry as T.BufferGeometry,p=g.getAttribute('position');
   if(!(p instanceof T.BufferAttribute)||!(p.array instanceof Float32Array)||p.itemSize!==3)return;
   const b=new T.Box3().setFromBufferAttribute(p);
   if(b.isEmpty()||![...b.min,...b.max].every(exact))return;
   const radial=(a:number,b:number)=>Math.max(Math.abs(a),Math.abs(b));
   let reach=Math.hypot(radial(b.min.x,b.max.x),radial(b.min.y,b.max.y),radial(b.min.z,b.max.z));
   const chain:AirLink[]=[];
   for(let item:T.Object3D|null=o;item!==root;item=item.parent){
    if(!item?.parent||chain.length>=8||!item.matrixAutoUpdate)return;
    const value=[...item.position,...item.scale];
    if(!value.every(Number.isFinite)||value.slice(3).some(k=>k<=0))return;
    reach=item.position.length()+Math.max(...item.scale)*reach;
    chain.push({owner:item,parent:item.parent,transform:value});
   }
   if(reach>8)return;
   this.air.set(o,{geometry:g,material:o.material as T.Material,position:p,words:p.array,version:p.version,chain,reach});
  });
 }
 private airDepth(o:T.Mesh,g:T.BufferGeometry,m:T.Material,c:T.PerspectiveCamera,pin:AirProducer){
  const root=this.aircraft,p=pin.position;
  if(!root||!root.matrixWorld.elements.every(exact)||!c.matrixWorldInverse.elements.every(exact)||
     pin.geometry!==g||pin.material!==m||g.getAttribute('position')!==p||p.version!==pin.version||p.array!==pin.words||
     pin.chain.some(({owner,parent,transform})=>!owner.matrixAutoUpdate||owner.parent!==parent||
      ![...owner.position,...owner.scale].every((v,i)=>v===transform[i])))return false;
  this.mv.multiplyMatrices(c.matrixWorldInverse,root.matrixWorld);
  const e=this.mv.elements;
  const depth=-e[14]+Math.hypot(e[2],e[6],e[10])*pin.reach;
  return Number.isFinite(depth)&&depth<coldMajor;
 }
 registerRoad(m:T.Material){
  this.products.set(m,{material:m,before:m.onBeforeCompile,key:m.customProgramCacheKey});
 }
 private shader(m:T.ShaderMaterial){
  if(m.glslVersion!==null||m.uniformsGroups.length||unknownDefs(m)||
     (m.precision!==null&&m.precision!=='highp')||mutatingUniforms.some(k=>k in m.uniforms))return false;
  const found=this.programs.get(m);
  if(found&&found.vertex===m.vertexShader&&found.fragment===m.fragmentShader)return found.accepted&&this.linked(m,found);
  const pair=pairOf(m),prev=this.sources.get(pair);
  if(prev){this.programs.set(m,prev);return prev.accepted&&this.linked(m,prev);}
  if(this.sources.size>=72)return false;
  const entry={vertex:m.vertexShader,fragment:m.fragmentShader,accepted:false};
  this.sources.set(pair,entry);this.programs.set(m,entry);
  void hashBordenCoastShader(pair).then(sha=>{entry.accepted=sha!==undefined&&BORDEN_STOCK_DEPTH_PROGRAMS.has(sha);});
  return false;
 }
 private linked(m:T.ShaderMaterial,template:Program){
  const gl=this.renderer.getContext() as WebGL2RenderingContext;
  const properties=this.renderer.properties.get(m) as {currentProgram?:NativeProgram;uniforms?:unknown};
  const holder=properties.currentProgram,
   definitions=Object.entries(m.defines??{}).map(([k,v])=>k+'='+v).sort().join(';');
  if(!holder||properties.uniforms!==m.uniforms||gl.isContextLost())return false;
  const current=this.native.get(holder);
  if(current)return current.definitions===definitions&&current.template===template&&current.valid;
  const v=gl.getShaderSource(holder.vertexShader),f=gl.getShaderSource(holder.fragmentShader);
  const x=typeof v==='string'?exactLinkedPrefix(v,template.vertex,definitions):undefined;
  const y=typeof f==='string'?exactLinkedPrefix(f,template.fragment,definitions):undefined;
  const entry:NativeLink={holder,definitions,template,valid:false};this.native.set(holder,entry);
  if(!x||!y)return false;
  const key=x+'\0'+y;
  let check=this.prefixSeals.get(key);
  if(!check){
   if(this.prefixSeals.size>=24)return false;
   check=Promise.all([hashBordenCoastShader(x),hashBordenCoastShader(y)]).then(([u,v])=>
    u!==undefined&&v!==undefined&&BORDEN_STOCK_LINK_PREFIXES.has(u+' '+v));
   this.prefixSeals.set(key,check);
  }
  void check.then(ok=>{entry.valid=ok;});
  return false;
 }
 private finiteDraw(o:M,g:T.BufferGeometry,c:T.PerspectiveCamera,inst:false|T.InstancedMesh){
  const p=g.getAttribute('position');
  if(!(p instanceof T.BufferAttribute)||!(p.array instanceof Float32Array)||p.itemSize!==3||p.normalized||!p.count||
     !o.matrixWorld.elements.every(exact)||!c.matrixWorldInverse.elements.every(exact))return false;
  this.mv.multiplyMatrices(c.matrixWorldInverse,o.matrixWorld);
  const k=this.mv.elements;
  if(inst){
   const pin=this.bridge.get(inst)?.instance,sphere=inst.boundingSphere;
   if(!pin||!sphere||sphere!==pin.bbox||pin.attribute!==inst.instanceMatrix||pin.array!==inst.instanceMatrix.array||
      pin.version!==inst.instanceMatrix.version||pin.count!==inst.count||
      ![...sphere.center,sphere.radius].every((v,i)=>v===pin.stamp[i])||
      !sphere.center.toArray().every(exact)||!Number.isFinite(sphere.radius)||sphere.radius<0)return false;
   const center=sphere.center;
   const furthest=-(k[2]*center.x+k[6]*center.y+k[10]*center.z+k[14])+sphere.radius*Math.hypot(k[2],k[6],k[10]);
   return Number.isFinite(furthest)&&furthest<coldMajor;
  }
  if(p.count>210_000)return false;
  let data=this.geometry.get(g);
  if(data&&(data.attr!==p||data.array!==p.array))return false;
  if(!data||data.version!==p.version){
   const next=this.bound.setFromBufferAttribute(p);
   if(next.isEmpty()||![...next.min,...next.max].every(exact))return false;
   if(data){data.box.union(next);data.version=p.version;}
   else {data={attr:p,array:p.array,version:p.version,box:next.clone()};this.geometry.set(g,data);}
  }
  // Check actual attribute extrema, not a possibly manual culling sphere.
  const {min,max}=data.box;
  const a=-k[2],b=-k[6],z=-k[10];
  const furthest=a*(a>0?max.x:min.x)+b*(b>0?max.y:min.y)+z*(z>0?max.z:min.z)-k[14];
  return Number.isFinite(furthest)&&furthest<coldMajor;
 }
 tracks(draw:Draw,camera:T.PerspectiveCamera,region:T.Box2,ocean:M,canopy:BordenCanopyResident){
  const {object:o,geometry:g,material:m}=draw;
  if(!(o instanceof T.Mesh)||!g||o.geometry!==g||
     (Array.isArray(o.material)?!o.material.includes(m):o.material!==m)||
     !m.visible||m.onBeforeRender!==T.Material.prototype.onBeforeRender||!objectDefault(o)||
     !m.depthWrite||!m.depthTest||m.transparent||m.stencilWrite||Boolean((m as T.MeshStandardMaterial).wireframe)||
     (m.depthFunc!==T.LessEqualDepth&&m.depthFunc!==T.LessDepth)||
     (m.polygonOffset&&(!Number.isFinite(m.polygonOffsetFactor)||!Number.isFinite(m.polygonOffsetUnits)||m.polygonOffsetFactor>0||m.polygonOffsetUnits>0))||
     o instanceof T.SkinnedMesh||o instanceof T.BatchedMesh||g.indirect!==null||Object.keys(g.morphAttributes).length)return false;
  const shader=asShader(m);
  if(shader){
   if(custom(m)||!this.shader(shader))return false;
   if(o===ocean)return stockOceanApertureDepth(camera,region,ocean.position.y)!==undefined;
   if(g instanceof T.InstancedBufferGeometry)return canopy.opaqueCrownDepth(o,g,m,camera);
  }else{
   if(!knownMesh(m)||Boolean((m as T.MeshStandardMaterial).displacementMap))return false;
   if(custom(m)){
    const cert=this.bridge.get(o),road=this.products.get(m);
    const pin=(cert?.geometry===g?cert:undefined)??(this.matchingRoad(o,m)?road:undefined);
    if(!pin||pin.material!==m||pin.before!==m.onBeforeCompile||pin.key!==m.customProgramCacheKey)return false;
   }
  }
  const aircraft=this.air.get(o);
  if(aircraft)return this.airDepth(o,g,m,camera,aircraft);
  if(!shader&&!this.bridge.has(o)&&!this.matchingRoad(o,m))return false;
  if(o instanceof T.InstancedMesh&&!this.bridge.has(o))return false;
  return this.finiteDraw(o as M,g,camera,o instanceof T.InstancedMesh?o:false);
 }
}
