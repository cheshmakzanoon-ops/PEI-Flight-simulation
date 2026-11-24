/** Exact ordered source chunk for the Summerside downtown roof cohort. */
export const DOWNTOWN_ATLAS = "538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557";
export const DOWNTOWN_TILES = {
 "q032001": {
  "id": "q032001",
  "offset": 710787,
  "bounds": [
   -63.795427,
   46.375219,
   -63.755559,
   46.393345
  ],
  "count": 399,
  "bytes": 20163,
  "sha256": "b88c120e29513f42f5ad6e272981c21627b38634de29e5f9b3939a57a06fbe67"
 }
} as const;

type TileManifest={readonly id:string;readonly offset:number;readonly bytes:number;readonly count:number;readonly bounds:readonly number[]};
type DowntownOwner=typeof DOWNTOWN_TILES[keyof typeof DOWNTOWN_TILES];
/** Don't accept a partial manifest match or use a claim of current art as provenance. */
export function downtownTilePin(atlas:string|undefined,tile:TileManifest):DowntownOwner|undefined {
 if(atlas!==DOWNTOWN_ATLAS||!globalThis.crypto?.subtle)return;
 const e=(DOWNTOWN_TILES as Record<string,DowntownOwner|undefined>)[tile.id];
 if(e&&tile.id===e.id&&tile.offset===e.offset&&tile.bytes===e.bytes&&tile.count===e.count&&tile.bounds.length===4&&
  tile.bounds.every((v,i)=>v===e.bounds[i]))return e;
}

export async function downtownWireAllows(pin:DowntownOwner,wire:ArrayBuffer){
 if(wire.byteLength!==pin.bytes||!globalThis.crypto?.subtle)return false;
 try{
  const q=await crypto.subtle.digest('SHA-256',wire);
  return Array.from(new Uint8Array(q),v=>v.toString(16).padStart(2,'0')).join('')===pin.sha256;
 }catch{return false;}
}

/** The other profiles keep their exact legacy cast, terrain and art owners.
 * In particular the isolated station model pins its entire tile's vertex count. */
export function downtownSceneryCompatible(q:URLSearchParams){
 if(q.get('scenery')==='detail')return false;
 return !['summersideStationReview','buildingShadows','spinnakersPreview','northBaywalkPreview',
   'northBaywalkConcrete','surveyRelief','inlandRelief'].some(k=>q.has(k));
}
