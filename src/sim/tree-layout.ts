/** Canonical deterministic canopy grid used both in the offline clearance join
 * and at runtime. Changing the jitter, projection or pitch requires a rebake. */
export const TREE_PITCH=12, TREE_TILE_SIDE=16;
export function treeRandom(x:number,z:number,s=0){
  let n=Math.imul(x^s,2246822519)^Math.imul(z,3266489917);
  n=Math.imul(n^(n>>>15),2246822519);
  return ((n^(n>>>13))>>>0)/4294967296;
}
/** In the ordered clearance stream, a tile is a contiguous run of 256 cells.
 * 2,048 signed tiles per axis cover a 393 × 393 km square about our origin. */
export function treeTileStart(tx:number,tz:number){
  if(tx< -1024||tx>=1024||tz< -1024||tz>=1024)return -1;
  return ((tz+1024)*2048+(tx+1024))*256;
}
export function treeCellKey(i:number,j:number){
  const start=treeTileStart(Math.floor(i/TREE_TILE_SIDE),Math.floor(j/TREE_TILE_SIDE));
  return start<0?-1:start+(j&15)*TREE_TILE_SIDE+(i&15);
}
