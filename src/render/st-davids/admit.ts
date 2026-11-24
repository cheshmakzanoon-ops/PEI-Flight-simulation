import type {Mesh} from 'three';
import {verifyDecodedCover} from '../../sim/cover-proof.ts';
import type {World} from '../world.ts';
import {ST_DAVIDS as S} from './source.generated.ts';

type Tile={id:string;bytes:number;offset:number;count:number;bounds:readonly number[]};
type Row={footprint:readonly (readonly [number,number])[];holes?:readonly unknown[];height:number;minHeight?:number};
const DRAW=[['position',3],['normal',3],['color',3],['uv',2],['topFlag',1],['facadeStyle',1]] as const;
/** Explicit geometry-and-shadow comparison. */
export function stDavidsRequested(options:URLSearchParams){
 return options.has('stDavidsChurchReview')&&options.has('buildingShadows')&&options.get('scenery')!=='detail'&&
  !['surveyRelief','inlandRelief','seatedRoads'].some(k=>options.has(k));
}
export function stDavidsStandardRequested(q:URLSearchParams){
 return q.get('scenery')!=='detail'&&!['stockStDavidsExterior','stDavidsChurchReview','buildingShadows','surveyRelief',
  'inlandRelief','seatedRoads','northBaywalkPreview','northBaywalkConcrete','spinnakersPreview'].some(k=>q.has(k));
}
export function stDavidsAtlasAllows(atlas:string|undefined,t:Tile){
 return !!globalThis.crypto?.subtle&&atlas===S.atlas&&t.id===S.tile&&t.count===S.count&&t.offset===S.offset&&t.bytes===S.size&&
  t.bounds.length===S.boundsWGS.length&&t.bounds.every((x,i)=>x===S.boundsWGS[i]);
}
export function stDavidsOwnerAllows(rows:readonly Row[]){
 const f=rows[S.ordinal];
 return rows.length===S.count&&!!f&&f.height===S.owner.height&&f.minHeight===S.owner.minHeight&&!f.holes?.length&&
  f.footprint.length===S.owner.footprint.length&&f.footprint.every((q,i)=>q[0]===S.owner.footprint[i][0]&&q[1]===S.owner.footprint[i][1]);
}
export async function stDavidsSha(b:ArrayBuffer|Uint8Array<ArrayBuffer>){
 const v=new Uint8Array(await crypto.subtle.digest('SHA-256',b));
 return Array.from(v,q=>q.toString(16).padStart(2,'0')).join('');
}
export async function stDavidsOwnerBytes(b:ArrayBuffer){
 try{return b.byteLength===S.size&&await stDavidsSha(b)===S.chunk;}catch{return false;}
}
/** Byte pin the actual emitted owner and every neighbor attribute. This is
 * computed once, off the normal load path, and fails closed on a different renderer roster. */
export async function stDavidsDrawAllows(owner:Mesh,range:readonly [number,number]){
 const g=owner.geometry;
 if(g.index||range[0]!==S.start||range[1]!==S.end||Object.keys(g.attributes).length!==DRAW.length||
    S.position.some((v,i)=>!(Math.abs(owner.position.getComponent(i)-v)<=.000001)))return false;
 const bytes=new Uint8Array(S.vertices*(12*4+1));
 let at=0;
 for(const [key,width] of DRAW){
  const a=g.getAttribute(key);
  if(!a||!('array' in a)||a.count!==S.vertices||a.itemSize!==width||a.normalized||!(key==='facadeStyle'?a.array instanceof Uint8Array:a.array instanceof Float32Array))return false;
  const part=new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength);
  bytes.set(part,at);at+=part.byteLength;
 }
 if(at!==bytes.length)return false;
 try{return await stDavidsSha(bytes)===S.drawAttributesSha;}catch{return false;}
}
export function stDavidsGround(world:Pick<World,'rollingCanopyOwner'|'visualGroundHeight'|'surface'|'cover'|'terrain'>,
 terrainSha:string|undefined,road:()=>string|undefined,certified=world.cover.sourceDecodedSha){
 if(terrainSha!==S.terrain||world.cover.sourceSha!==S.cover||certified!==S.coverDecoded)return;
 let then:NonNullable<ReturnType<World['rollingCanopyOwner']>>['geometry']|undefined,verified=false;
 return ()=>{
  if(road()!==S.road)return false;
  const lease=world.rollingCanopyOwner(S.boundsXZ);
  if(!lease||lease.key!==S.groundTile){then=undefined;verified=false;return false;}
  // All 3,322 numerical wall-perimeter qualifications are recorded offline;
  // these immutable extrema and distributed pairs certify the live lease.
  if(lease.geometry!==then){
   then=lease.geometry;
   verified=S.grade.every(([x,z,y,physical])=>{
    const h=world.visualGroundHeight(x,z),s=world.surface(x,z);
    return Math.abs(h-y)<.004&&h>S.foundationY+.24&&h<S.sidingY-.07&&s.land&&!s.runway&&
     Math.abs(s.height-physical)<.004&&world.cover.distance(world.terrain,x,z)>=S.minDry;
   });
  }
  return verified;
 };
}

export function standardStDavidsGround(world:Pick<World,'rollingCanopyOwner'|'visualGroundHeight'|'surface'|'cover'|'terrain'>,
 terrainSha:string|undefined,road:()=>string|undefined){
 if(terrainSha!==S.terrain||world.cover.sourceSha!==S.cover||!globalThis.crypto?.subtle)return;
 let checked=false,ground:(()=>boolean)|undefined;
 return ()=>{
  if(ground)return ground();
  if(checked||road()!==S.road||world.rollingCanopyOwner(S.boundsXZ)?.key!==S.groundTile)return false;
  checked=true;
  void verifyDecodedCover(world.cover).then(s=>{
   if(s===S.coverDecoded)ground=stDavidsGround(world,terrainSha,road,s);
  });
  return false;
 };
}
