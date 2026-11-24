import {SOURCE as S} from './source.ts';

interface Tile {
 readonly id:string; readonly offset:number; readonly bytes:number; readonly count:number;
 readonly bounds:readonly number[];
}
interface Row {
 readonly footprint:readonly (readonly number[])[]; readonly holes?:readonly unknown[];
 readonly height:number; readonly minHeight?:number;
}

// Authenticate the packed tile and the exact unmodified owner row.
export function crockettAtlasCandidate(atlas:string|undefined,t:Tile){
 const e=S.tile;
 return atlas===S.atlas&&!!globalThis.crypto?.subtle&&t.id===e.id&&t.offset===e.offset&&
  t.bytes===e.bytes&&t.count===e.count&&t.bounds.length===4&&t.bounds.every((x,i)=>x===e.bounds[i]);
}
export function crockettExactRow(rows:readonly Row[]){
 if(rows.length!==S.tile.count)return false;
 const f=rows[S.ordinal],source=S.row;
 if(!f||f.height!==source.height||f.minHeight!==source.minHeight||f.holes?.length||!Array.isArray(f.footprint)||f.footprint.length!==source.footprint.length)return false;
 return source.footprint.every(([x,y],i)=>Array.isArray(f.footprint[i])&&f.footprint[i].length===2&&f.footprint[i][0]===x&&f.footprint[i][1]===y);
}
export async function crockettExactWire(bytes:Uint8Array<ArrayBuffer>){
 if(!globalThis.crypto?.subtle||bytes.byteLength!==S.tile.bytes)return false;
 try{
  const h=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
  let s='';for(const b of h)s+=b.toString(16).padStart(2,'0');
  return s===S.tile.sha256;
 }catch{return false;}
}
