/** Read-only stock-owner witness: no renderer, material factory or draw. */
import * as T from 'three';
import {METRES_PER_LAT,METRES_PER_LON,ORIGIN,project} from '../../sim/geo.ts';
import {QUARTERMASTER_SEAWARD as P} from './seaward-roof-pins.ts';

const signedBounds=Object.freeze([-63.13089,46.229976,-63.120532,46.234775] as const);
const packedOrigin=Object.freeze([5702.6162109375,0,29749.4296875] as const);
const expectedIndexBytes=56569,totalPackBytes=3844984;
const identity=Object.freeze([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
const calibrationNode=[76762.59317717304,111161.08375388647] as const;
// Independently recorded stock-only browser basis receipt 89324230… .
// Neither admitted basis dictates the live mesh center: project() does.
const calibrationChromium=[76762.59317717305,111161.08375388647] as const;
type Bounds=readonly [number,number,number,number];
type XYZ=readonly [number,number,number];
type Bytes=ArrayBuffer|Uint8Array<ArrayBuffer>;
type Origin=Readonly<{basis:'archived-node'|'observed-chromium';f64:XYZ;f32:XYZ;
 local:readonly number[];packedLocal:readonly number[];worldEnclosure:readonly [number,number,number,number]}>;
export type QuartermasterStockResident=Readonly<{mesh:T.Mesh;index:ArrayBuffer;wire:ArrayBuffer;rows:number;atlas:string}>;
const equal=(a:ArrayLike<number>,b:ArrayLike<number>)=>
 a.length===b.length&&Array.prototype.every.call(a,(v:number,i:number)=>Object.is(v,b[i]));
const translate=(x:XYZ)=>Object.freeze([1,0,0,0,0,1,0,0,0,0,1,0,...x,1]);
const rounded=(x:XYZ):XYZ=>Object.freeze(x.map(Math.fround) as [number,number,number]);
const hasSameEngineDatum=()=>ORIGIN.lon===-63.2&&ORIGIN.lat===46.5;
const sha=async(a:Bytes)=>{
 const data=await globalThis.crypto.subtle.digest('SHA-256',a);
 return [...new Uint8Array(data)].map(n=>n.toString(16).padStart(2,'0')).join('');
};
const encoded=(p:string)=>new TextEncoder().encode(p);

type DeclaredTile={id:string;offset:number;bytes:number;count:number;sha256:string;bounds:Bounds};
function getDeclaredSource(index:ArrayBuffer):Bounds|undefined{
 if(index.byteLength!==expectedIndexBytes)return;
 try{
  const meta=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(index)) as
   {file:string;sha256:string;bytes:number;tiles:DeclaredTile[]};
  if(meta.file!=='tiles.pack'||meta.bytes!==totalPackBytes||meta.sha256!==P.source.atlas||!Array.isArray(meta.tiles))return;
  const exact=meta.tiles.filter(q=>q.id===P.source.tile);
  if(exact.length!==1)return;
  const t=exact[0];
  if(t.offset!==P.source.offset||t.bytes!==P.source.wireBytes||t.count!==P.source.count||
     t.sha256!==P.source.wire||!Array.isArray(t.bounds)||!equal(t.bounds,signedBounds))return;
  return Object.freeze([...t.bounds] as [number,number,number,number]);
 }catch{return;}
}

/** Exact local arithmetic from Buildings constructor + generate. The live
 * engine chooses its own single calibration, never based on mesh values. */
export function deriveSignedQuartermasterTransform(bounds:Bounds):Origin|undefined{
 if(!hasSameEngineDatum()||!equal(bounds,signedBounds))return;
 const inEngine=[METRES_PER_LON,METRES_PER_LAT];
 const basis=equal(inEngine,calibrationNode)?'archived-node':
  equal(inEngine,calibrationChromium)?'observed-chromium':undefined;
 if(!basis)return;
 const [west,south,east,north]=bounds,a=project(west,north),b=project(east,south);
 // Same W,N -> E,S order, then average emitted by Buildings.generate.
 // Do not use project((west+east)/2,(north+south)/2) (different rounding).
 const f64=Object.freeze([(a.x+b.x)/2,0,(a.z+b.z)/2] as const),f32=rounded(f64);
 if(!Number.isFinite(a.x+a.z+b.x+b.z)||!(a.x<b.x&&a.z<b.z)||!equal(f32,packedOrigin))return;
 return Object.freeze({basis,f64,f32,local:translate(f64),packedLocal:translate(f32),
  worldEnclosure:Object.freeze([a.x,a.z,b.x,b.z] as const)});
}

function rootWorld(scene:T.Scene){
 return scene.constructor===T.Scene&&scene.parent===null&&scene.matrixAutoUpdate&&scene.matrixWorldAutoUpdate&&
  scene.layers.mask===1&&scene.renderOrder===0&&scene.overrideMaterial===null&&!scene.fog&&
  equal(scene.position.toArray(),[0,0,0])&&equal(scene.quaternion.toArray(),[0,0,0,1])&&
  equal(scene.scale.toArray(),[1,1,1])&&equal(scene.matrix.elements,identity)&&equal(scene.matrixWorld.elements,identity);
}

function transformRefs(o:T.Object3D){
 const {position,quaternion,scale,matrix,matrixWorld}=o,local=matrix.elements,world=matrixWorld.elements;
 return ()=>o.position===position&&o.quaternion===quaternion&&o.scale===scale&&o.matrix===matrix&&
  o.matrixWorld===matrixWorld&&matrix.elements===local&&matrixWorld.elements===world;
}

function exactPlacement(mesh:T.Mesh,scene:T.Scene,origin:Origin){
 return hasSameEngineDatum()&&rootWorld(scene)&&mesh.parent===scene&&mesh.constructor===T.Mesh&&
  mesh.visible&&mesh.frustumCulled&&!mesh.castShadow&&!mesh.receiveShadow&&
  mesh.children.length===0&&mesh.matrixAutoUpdate&&mesh.matrixWorldAutoUpdate&&mesh.layers.mask===1&&mesh.renderOrder===0&&
  equal(mesh.position.toArray(),origin.f64)&&equal(mesh.quaternion.toArray(),[0,0,0,1])&&equal(mesh.scale.toArray(),[1,1,1])&&
  equal(mesh.matrix.elements,origin.local)&&equal(mesh.matrixWorld.elements,origin.local)&&
  equal(mesh.matrix.elements.map(Math.fround),origin.packedLocal)&&equal(mesh.matrixWorld.elements.map(Math.fround),origin.packedLocal)&&
  mesh.onBeforeRender===T.Object3D.prototype.onBeforeRender&&mesh.onAfterRender===T.Object3D.prototype.onAfterRender;
}

function exactStockMaterial(m:T.ShaderMaterial,s:T.Scene){
 return m.onBeforeRender===T.Material.prototype.onBeforeRender&&m.onBeforeCompile===T.Material.prototype.onBeforeCompile&&
  m.customProgramCacheKey===T.Material.prototype.customProgramCacheKey&&
  m.visible&&m.vertexColors&&m.depthWrite&&m.depthTest&&m.depthFunc===T.LessEqualDepth&&m.colorWrite&&m.toneMapped&&
  !m.transparent&&m.opacity===1&&m.side===T.DoubleSide&&!m.wireframe&&m.blending===T.NormalBlending&&
  !m.fog&&!m.lights&&!m.clipping&&!m.alphaToCoverage&&!m.alphaTest&&!m.alphaHash&&!m.dithering&&!m.premultipliedAlpha&&
  m.precision===null&&!m.stencilWrite&&!m.polygonOffset&&
  m.version===P.material.version&&!m.clippingPlanes?.length&&m.uniformsGroups.length===0&&m.glslVersion===null&&
  Object.keys(m.defines).length===0&&Object.keys(m.uniforms).length===1&&m.uniforms.victoriaSky?.value===s.environment&&
  !!s.environment?.isTexture;
}

type Key=keyof typeof P.attrs;
const keys=Object.keys(P.attrs) as Key[];
const topology=(g:T.BufferGeometry)=>g.index===null&&g.indirect===null&&g.indirectOffset===0&&g.groups.length===0&&g.drawRange.start===0&&
 g.drawRange.count===Infinity&&Object.keys(g.morphAttributes).length===0&&Object.keys(g.attributes).length===keys.length;
type Attribute=Readonly<{k:Key;a:T.BufferAttribute;ary:T.BufferAttribute['array'];version:number;data:Uint8Array<ArrayBuffer>}>;
function bindAttrs(g:T.BufferGeometry):Attribute[]|undefined{
 const result:Attribute[]=[];
 for(const k of keys){
  const a=g.getAttribute(k),d=P.attrs[k],c=d.type==='Float32Array'?Float32Array:Uint8Array;
  if(!(a instanceof T.BufferAttribute)||a.array.constructor!==c||!(a.array.buffer instanceof ArrayBuffer)||
     a.itemSize!==d.itemSize||a.normalized!==d.normalized||a.count!==P.geometry.total||a.array.byteLength!==d.bytes||
     a.usage!==T.StaticDrawUsage||a.gpuType!==T.FloatType)
   return;
  result.push({k,a,ary:a.array,version:a.version,data:new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength)});
 }
 return result;
}
const stillAttrs=(g:T.BufferGeometry,attrs:Attribute[])=>attrs.every(({k,a,ary,version,data})=>{
 const p=P.attrs[k];
 return g.getAttribute(k)===a&&a.array===ary&&a.version===version&&a.count===P.geometry.total&&
  a.itemSize===p.itemSize&&a.normalized===p.normalized&&a.array.byteLength===p.bytes&&
  a.usage===T.StaticDrawUsage&&a.gpuType===T.FloatType&&
  a.array.buffer===data.buffer&&a.array.byteOffset===data.byteOffset;
});
function contained(g:T.BufferGeometry,origin:Origin){
 const [a,b]=P.geometry.targetSpan,[r0,r1]=P.geometry.ownerSpan,[xmin,zmin,xmax,zmax]=origin.worldEnclosure;
 if(!Number.isInteger(a)||!Number.isInteger(b)||a<r0||b>r1||a%3||b%3||b-a!==90||r1>P.geometry.total)return false;
 const pos=g.getAttribute('position'),norm=g.getAttribute('normal'),top=g.getAttribute('topFlag'),style=g.getAttribute('facadeStyle');
 for(let i=a;i<b;i++){
  const x=pos.getX(i)+origin.f64[0],z=pos.getZ(i)+origin.f64[2];
  if(!(xmin<x&&x<xmax&&zmin<z&&z<zmax)||pos.getY(i)!==Math.fround(P.geometry.y)||
     norm.getX(i)!==0||norm.getY(i)!==1||norm.getZ(i)!==0||top.getX(i)!==1||style.getX(i)!==2)return false;
 }
 return true;
}

export type QuartermasterGuardWitness=Readonly<{
 origin:Origin;whole:string;wire:string;span:readonly [number,number];
 /** Cheap construction-custody stamp; not an in-place byte check. */
 intact:()=>boolean;
 /** Rehashes exact old declaration, wire, shaders and both attribute scopes
  * before a future independent native run; not a per-frame dispatch. */
 auditBytes:()=>Promise<boolean>;
 release:()=>void;
}>;

/** This consumes only the existing passive resident observer. It returns
 * metadata + checks, not a material, Mesh, setter or mount capability. */
export async function prepareQuartermasterGuardV3(receive:()=>QuartermasterStockResident|undefined,scene:T.Scene):
 Promise<QuartermasterGuardWitness|undefined>{
 if(!globalThis.crypto?.subtle)return;
 let releaseOnError:(()=>void)|undefined;
 try{
  const q=receive();if(!q)return;
  const {mesh,index,wire,rows,atlas}=q;
  if(atlas!==P.source.atlas||rows!==P.source.count||wire.byteLength!==P.source.wireBytes||
     !(mesh.material instanceof T.ShaderMaterial))return;
  const bounds=getDeclaredSource(index);if(!bounds)return;
  const origin=deriveSignedQuartermasterTransform(bounds);
  if(!origin||!exactPlacement(mesh,scene,origin))return;
  const m=mesh.material,g=mesh.geometry,vs=m.vertexShader,fs=m.fragmentShader;
  const uniforms=m.uniforms,sky=uniforms.victoriaSky,s=scene.environment;
  if(!s||!exactStockMaterial(m,scene)||!topology(g)||!contained(g,origin))return;
  const attrs=bindAttrs(g);if(!attrs)return;
  const skySource=s.source,image=s.image,skyVersion=s.version,imageVersion=skySource.version;
  const sphere=g.boundingSphere,sphereWords=sphere&&[...sphere.center.toArray(),sphere.radius];
  const sceneTransform=transformRefs(scene),meshTransform=transformRefs(mesh);
  let lost=false,disposed=false;
  const lostOwner=()=>{lost=true;};
  const live=()=>!lost&&!disposed&&receive()===q&&q.mesh===mesh&&q.index===index&&q.wire===wire&&q.atlas===atlas&&q.rows===rows&&
   mesh.material===m&&mesh.geometry===g&&sceneTransform()&&meshTransform()&&exactPlacement(mesh,scene,origin)&&exactStockMaterial(m,scene)&&
   m.uniforms===uniforms&&uniforms.victoriaSky===sky&&sky.value===s&&s===scene.environment&&s.source===skySource&&
   s.image===image&&s.version===skyVersion&&skySource.version===imageVersion&&m.vertexShader===vs&&m.fragmentShader===fs&&
   g.boundingSphere===sphere&&(!sphere||(!!sphereWords&&equal([...sphere.center.toArray(),sphere.radius],sphereWords)))&&
   topology(g)&&stillAttrs(g,attrs);
  const auditBytes=async()=>{
   if(!live())return false;
   try{
    const [raw,gzip,vertex,frag,...a]=await Promise.all([sha(index),sha(wire),sha(encoded(vs)),sha(encoded(fs)),
     ...attrs.flatMap(({a,k,data})=>{const [l,h]=P.geometry.targetSpan,i=a.itemSize*a.array.BYTES_PER_ELEMENT;
      return [sha(data),sha(data.subarray(l*i,h*i))];}),
    ]);
    return live()&&raw===P.source.index&&gzip===P.source.wire&&vertex===P.material.vertex&&frag===P.material.fragment&&
     attrs.every(({k},i)=>a[2*i]===P.attrs[k].sha256&&a[2*i+1]===P.attrs[k].selectedSha256)&&contained(g,origin);
   }catch{return false;}
  };
  const release=()=>{
   if(disposed)return;disposed=true;
   g.removeEventListener('dispose',lostOwner);m.removeEventListener('dispose',lostOwner);
  };
  releaseOnError=release;
  g.addEventListener('dispose',lostOwner);m.addEventListener('dispose',lostOwner);
  if(!await auditBytes()){release();return;}
  releaseOnError=undefined;
  return Object.freeze({origin,whole:P.source.index,wire:P.source.wire,
    span:Object.freeze([...P.geometry.targetSpan] as [number,number]),intact:live,auditBytes,release});
 }catch{releaseOnError?.();return;}
}
