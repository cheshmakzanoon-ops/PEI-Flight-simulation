export const STONE_ROLES=['wall','trim','roofSide','roofCrown'] as const;
export type StoneRole=(typeof STONE_ROLES)[number];
export type TextureSize=256|512;
export type Tile={role:StoneRole;size:TextureSize;maps:Uint8Array<ArrayBuffer>;norm:Uint8Array<ArrayBuffer>;repeat:[number,number]};
export type RecipeReply={kind:'souris-masonry-v1';entries:Tile[]}|{kind:'bad-request'|'recipe-failed'};
const METRES:Record<StoneRole,readonly [number,number]>={wall:[3.68,2.52],trim:[1.70,1.54],roofSide:[2.58,1.62],roofCrown:[3.20,3.0]};
export function validateMasonry(raw:unknown,size:TextureSize):ReadonlyMap<StoneRole,Tile>|undefined{
 if(typeof raw!=='object'||!raw||!('kind'in raw)||raw.kind!=='souris-masonry-v1'||!('entries'in raw)||
    !Array.isArray(raw.entries)||raw.entries.length!==STONE_ROLES.length)return;
 const good=new Map<StoneRole,Tile>(),buffers=new Set<ArrayBuffer>();
 const bytes=size*size*4;
 for(const tile of raw.entries){
  if(!tile||!STONE_ROLES.includes(tile.role)||good.has(tile.role)||tile.size!==size||
   !(tile.maps instanceof Uint8Array)||!(tile.norm instanceof Uint8Array)||tile.maps.buffer===tile.norm.buffer||
   !(tile.maps.buffer instanceof ArrayBuffer)||!(tile.norm.buffer instanceof ArrayBuffer)||
   tile.maps.byteOffset!==0||tile.norm.byteOffset!==0||tile.maps.buffer.byteLength!==bytes||tile.norm.buffer.byteLength!==bytes||
   tile.maps.byteLength!==bytes||tile.norm.byteLength!==bytes||!Array.isArray(tile.repeat)||
   tile.repeat.length!==2||tile.repeat[0]!==1/METRES[tile.role as StoneRole][0]||tile.repeat[1]!==1/METRES[tile.role as StoneRole][1]||
   buffers.has(tile.maps.buffer)||buffers.has(tile.norm.buffer))return;
  buffers.add(tile.maps.buffer);buffers.add(tile.norm.buffer);
  good.set(tile.role,tile);
 }
 return good;
}
