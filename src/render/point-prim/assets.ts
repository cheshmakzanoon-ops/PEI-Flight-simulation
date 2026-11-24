import type {BufferAttribute,Group,Mesh,MeshStandardMaterial} from 'three';
import {loadBoundedGrade,type BoundedGrade} from '../../sim/bounded-grade.ts';
import {boundedPackedBody} from '../../sim/packed-bytes.ts';
import type {Terrain} from '../../sim/terrain.ts';
import {POINT_PRIM,pointPrimDigest} from './admit.ts';
import {POINT_PRIM_GRADE} from './stamp.ts';

export const POINT_PRIM_DEADLINE_MS=1500;
export async function pointPrimDeadline<T>(job:Promise<T>,ms=POINT_PRIM_DEADLINE_MS):Promise<T|undefined>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  return await Promise.race([job,new Promise<undefined>(done=>{timer=setTimeout(()=>done(undefined),ms);})]);
 }catch{return;}
 finally{if(timer!==undefined)clearTimeout(timer);}
}

/** Do not accept a directly served decoded substitute. Only exact gzip wire
 * bytes, or the exact verified inflated bytes when HTTP declares gzip and the
 * browser has transparently decoded that same transport. */
export function loadPointPrimGrade(base:string,get:typeof fetch=fetch,ms=POINT_PRIM_DEADLINE_MS){
 const s=POINT_PRIM_GRADE;
 return loadBoundedGrade(s,base,async(input,init)=>{
  const r=await get(input,init),length=r.headers.get('content-length'),enc=r.headers.get('content-encoding')?.toLowerCase()??'identity';
  const reject=()=>{
   void r.body?.cancel().catch(()=>{});
   return new Response(null,{status:400});
  };
  if(r.status!==200||r.redirected||!r.body||init?.signal?.aborted||
   (enc!=='identity'&&enc!=='gzip')||(length!==null&&length!==String(s.wireBytes)))return reject();
  const limit=enc==='gzip'?s.decodedBytes:s.wireBytes;
  const bytes=await boundedPackedBody(r.body,limit);
  if(bytes.byteLength!==limit||init?.signal?.aborted)return new Response(null,{status:400});
  return new Response(bytes);
 },ms);
}
const palette=[
 ['foundation',290,'a09c89',.96,0],['shingle',1100,'e7e4db',.88,0],['reveal',124,'c8c4b1',.83,0],
 ['redShade',336,'7a2d27',.62,.14],['sash',68,'344448',.42,.05],['metal',248,'373e3c',.56,.43],
 ['red',882,'a83b31',.53,.21],['ivory',536,'e4e4d9',.79,0],['deck',24,'958474',.81,.02],
 ['lantern',20,'80928e',.31,.22]
] as const;
const signedGeometry='63ebcb07ca8e01c6267938b1071730ed1b5a69348d8c848c1ab0b3ebb54fb455';
export async function pointPrimArtMatches(group:Group){
 try{
  if(!group.isGroup||group.children.length!==palette.length)return false;
  const enc=new TextEncoder(),parts:Uint8Array[]=[];
  for(const [i,[name,tri,color,rough,metal]] of palette.entries()){
   const o=group.children[i] as Mesh;
   const g=o.geometry,m=o.material as MeshStandardMaterial;
   if(!o.isMesh||!o.visible||o.name!==name||o.children.length||g.index||g.groups.length||
     g.drawRange.start!==0||g.drawRange.count!==Infinity||Object.keys(g.attributes).length!==4||
     !m.isMeshStandardMaterial||m.side!==0||!m.colorWrite||!m.depthTest||!m.depthWrite||m.transparent||m.opacity!==1||m.alphaTest!==0||
     m.map||m.normalMap||m.roughnessMap||m.metalnessMap||
     m.color.getHexString()!==color||m.roughness!==rough||m.metalness!==metal||!m.vertexColors||
     g.getAttribute('position').count!==tri*3||o.position.lengthSq()!==0||o.rotation.x||o.rotation.y||o.rotation.z||
     o.scale.x!==1||o.scale.y!==1||o.scale.z!==1)return false;
   parts.push(enc.encode(name));
   for(const [attr,size] of [['position',3],['normal',3],['uv',2],['color',3]] as const){
    const field=g.getAttribute(attr) as BufferAttribute|undefined;
    if(!field||field.itemSize!==size||field.count!==tri*3||field.normalized)return false;
    const a=field.array;
    if(!(a instanceof Float32Array)||!(a.buffer instanceof ArrayBuffer))return false;
    parts.push(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));
   }
  }
  const n=parts.reduce((a,p)=>a+p.length,0);
  if(n>500000)return false;
  const bytes=new Uint8Array(n);let offset=0;
  for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  return await pointPrimDigest(bytes)===signedGeometry;
 }catch{return false;}
}
export function disposePointPrim(group:Group){
 for(const o of group.children as Mesh[]){
  o.geometry.dispose();const m=o.material;
  if(Array.isArray(m))for(const item of m)item.dispose();else m.dispose();
 }
 group.removeFromParent();
}
export type PointPrimAssets={grade:BoundedGrade;group:Group};
export async function preparePointPrimAssets(terrain:Terrain,base:string,
 loadArt:()=>Promise<{buildPointPrim:(detail:'flight',textured:false)=>Group}>=()=>import('./art.ts'),
 get:typeof fetch=fetch,ms=POINT_PRIM_DEADLINE_MS):Promise<PointPrimAssets|undefined>{
 let group:Group|undefined;
 try{
  const [make,art]=await Promise.all([loadPointPrimGrade(base,get,ms),pointPrimDeadline(loadArt(),ms)]);
  if(!make||!art)return;
  const grade=make(terrain,(x,z)=>terrain.atlasElevation(x,z));
  group=art.buildPointPrim('flight',false);
  if(!await pointPrimDeadline(pointPrimArtMatches(group),ms)){disposePointPrim(group);return;}
  group.visible=false;
  group.matrixAutoUpdate=false;group.matrix.set(...POINT_PRIM.worldMatrix);group.updateMatrixWorld(true);
  return {grade,group};
 }catch{if(group)disposePointPrim(group);return;}
}
