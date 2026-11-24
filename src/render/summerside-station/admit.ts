import {verifyDecodedCover} from '../../sim/cover-proof.ts';
import {SUMMERSIDE_STATION as S} from './source.generated.ts';
import type {World} from '../world.ts';

type Tile={id:string;bytes:number;offset:number;count:number;bounds:readonly number[];};
type Row={footprint:readonly (readonly [number,number])[];holes?:readonly unknown[];height:number;minHeight?:number;};
export function railRequested(q:URLSearchParams){
 // Both views in this study use the same, independently optional light system.
 return q.has('summersideStationReview')&&q.has('buildingShadows')&&q.get('scenery')!=='detail'&&
  !['surveyRelief','inlandRelief','northBaywalkPreview','spinnakersPreview','seatedRoads'].some(f=>q.has(f));
}
export function railStandardRequested(q:URLSearchParams){
 return q.get('scenery')!=='detail'&&!['stockStationExterior','summersideStationReview','buildingShadows','surveyRelief',
  'inlandRelief','northBaywalkPreview','northBaywalkConcrete','spinnakersPreview','seatedRoads'].some(k=>q.has(k));
}
export function railAtlasAllows(atlas:string|undefined,t:Tile){
 return !!globalThis.crypto?.subtle&&atlas===S.atlas&&t.id===S.tile&&t.count===S.count&&t.bytes===S.size&&t.offset===S.offset&&
  t.bounds.length===S.boundsWGS.length&&t.bounds.every((v,i)=>v===S.boundsWGS[i]);
}
export function railOwnerAllows(rows:readonly Row[]){
 const f=rows[S.ordinal];
 return rows.length===S.count&&!!f&&f.height===S.owner.height&&f.minHeight===S.owner.minHeight&&!f.holes?.length&&
  f.footprint.length===S.owner.footprint.length&&f.footprint.every((v,i)=>v[0]===S.owner.footprint[i][0]&&v[1]===S.owner.footprint[i][1]);
}
export const sha=async(b:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
export async function railOwnerChunk(gzip:ArrayBuffer){
 try{return gzip.byteLength===S.size&&await sha(gzip)===S.chunk;}catch{return false;}
}
export function railGround(world:Pick<World,'rollingCanopyOwner'|'visualGroundHeight'|'surface'|'cover'|'terrain'>,
 terrainSha:string|undefined,road:()=>string|undefined,certified: string|undefined=world.cover.sourceDecodedSha){
 if(terrainSha!==S.terrain||world.cover.sourceSha!==S.cover||certified!==S.coverDecoded)return;
 let was:NonNullable<ReturnType<World['rollingCanopyOwner']>>['geometry']|undefined,verified=false;
 return ()=>{
  if(road()!==S.road)return false;
  // This names the existing exact-grade owner check; it neither inserts a
  // relief patch nor changes any grade/physics or attachment source.
  const lease=world.rollingCanopyOwner(S.boundsXZ);
  if(!lease||lease.key!==S.groundTile){was=undefined;verified=false;return false;}
  if(lease.geometry!==was){
   was=lease.geometry;
   verified=S.grade.every(([x,z,y,contact])=>{
    const h=world.visualGroundHeight(x,z),surface=world.surface(x,z);
    return Math.abs(h-y)<.006&&h-S.foundationY>=.035&&surface.land&&!surface.runway&&Math.abs(surface.height-contact)<.006&&
     world.cover.distance(world.terrain,x,z)>=S.minDry;
   });
  }
  return verified;
 };
}


export function standardRailGround(world:Pick<World,'rollingCanopyOwner'|'visualGroundHeight'|'surface'|'cover'|'terrain'>,
 terrainSha:string|undefined,road:()=>string|undefined){
 if(terrainSha!==S.terrain||world.cover.sourceSha!==S.cover||!globalThis.crypto?.subtle)return;
 let checked=false,ground:(()=>boolean)|undefined;
 return ()=>{
  if(ground)return ground();
  if(checked||road()!==S.road||world.rollingCanopyOwner(S.boundsXZ)?.key!==S.groundTile)return false;
  checked=true;
  void verifyDecodedCover(world.cover).then(s=>{
   if(s===S.coverDecoded)ground=railGround(world,terrainSha,road,s);
  });
  return false;
 };
}
