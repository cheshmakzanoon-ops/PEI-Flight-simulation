import {INDIAN_RIVER_SOURCE as S} from './indian-river-source.generated.ts';
import {churchOwnerBytes,churchOwnerSource} from './indian-river-guard.ts';

export const INDIAN_RIVER_LIVE={
 indexBytes:56569,indexSha:'fcc2bb4d890eafd08ac41136a3bff7bebeafe2f9c25a066fdcf756ed39badce0',
 bounds:[-63.676006,46.447388,-63.596531,46.483741],rows:364,
} as const;
type Tile=Readonly<{id:string;offset:number;bytes:number;count:number;bounds:readonly number[]}>;
type Rows=Parameters<typeof churchOwnerSource>[2];

/** This filter is cheap enough for the ordinary streamer. It authorizes no
 * alternate draw; the exact already-read index and body are proven separately. */
export function indianRiverResidentTile(atlas:string|undefined,tile:Tile){
 return atlas===S.atlas&&tile.id===S.tile&&tile.offset===S.offset&&tile.bytes===S.size&&tile.count===INDIAN_RIVER_LIVE.rows&&
  tile.bounds.length===4&&tile.bounds.every((v,i)=>v===INDIAN_RIVER_LIVE.bounds[i]);
}
export async function verifyIndianRiverResident(index:ArrayBuffer,body:ArrayBuffer,atlas:string|undefined,tile:Tile,rows:Rows){
 if(index.byteLength!==INDIAN_RIVER_LIVE.indexBytes||body.byteLength!==S.size||!globalThis.crypto?.subtle||
   !indianRiverResidentTile(atlas,tile)||rows.length!==INDIAN_RIVER_LIVE.rows||!churchOwnerSource(atlas,tile,rows))return false;
 try{
  const [indexSHA,bodyExact]=await Promise.all([crypto.subtle.digest('SHA-256',index),churchOwnerBytes(body)]);
  return bodyExact&&Array.from(new Uint8Array(indexSHA),v=>v.toString(16).padStart(2,'0')).join('')===INDIAN_RIVER_LIVE.indexSha;
 }catch{return false;}
}
