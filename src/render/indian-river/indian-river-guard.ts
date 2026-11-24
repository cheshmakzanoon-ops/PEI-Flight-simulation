import {INDIAN_RIVER_SOURCE as S} from './indian-river-source.generated.ts';
type CandidateTile=Readonly<{id:string;offset:number;bytes:number}>;
type AtlasRow=Readonly<{footprint?:readonly (readonly [number,number])[];height?:number;minHeight?:number;holes?:readonly unknown[]}>;
export function churchLandSource(terrain?:string,cover?:string,coverRaw?:string,road?:string){
 return terrain===S.terrain&&cover===S.cover&&coverRaw===S.coverRaw&&road===S.road;
}
export function churchOwnerSource(atlas:string|undefined,tile:CandidateTile,rows:readonly AtlasRow[]){
 if(atlas!==S.atlas||tile.id!==S.tile||tile.offset!==S.offset||tile.bytes!==S.size)return false;
 const f=rows[S.ordinal],ring=f?.footprint;
 return !!f&&f.height===S.height&&f.minHeight===S.minHeight&&!f.holes?.length&&
  ring?.length===S.footprint.length&&ring.every((p,i)=>p[0]===S.footprint[i][0]&&p[1]===S.footprint[i][1]);
}
export async function churchOwnerBytes(part:ArrayBuffer){
 if(part.byteLength!==S.size||!globalThis.crypto?.subtle)return false;
 try{
   const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',part));
   return Array.from(digest,v=>v.toString(16).padStart(2,'0')).join('')===S.chunk;
 }catch{return false;}
}
