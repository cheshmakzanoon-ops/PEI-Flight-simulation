/** Original 3-7 World.patch N112 partition. Every position is covered:
 * 111×111 interior, then north/east/south/west. North/south own the corner slots. */
const n=112,side=n+1;
export const OLEARY_STOCK_EDGE_LEVELS=[8,56,112] as const;
export type OlearyStockEdgeLevel=(typeof OLEARY_STOCK_EDGE_LEVELS)[number];
export function olearyRimLevels(key:string):OlearyStockEdgeLevel[]|undefined{
 if(!/^112:(8|56|112),(8|56|112),(8|56|112),(8|56|112)$/.test(key))return;
 return key.slice(4).split(',').map(x=>Number(x) as OlearyStockEdgeLevel);
}
export function partitionOlearyNativeXYZ(v:Float32Array){
 if(v.length!==side*side*3)return;
 const inner=new Float32Array((n-1)*(n-1)*3),east=new Float32Array((n-1)*3),west=new Float32Array((n-1)*3);
 for(let y=1;y<n;y++){
  const row=y*side*3,e=row+n*3;
  for(let k=0;k<3;k++){west[(y-1)*3+k]=v[row+k];east[(y-1)*3+k]=v[e+k];}
  inner.set(v.subarray(row+3,e),(y-1)*(n-1)*3);
 }
 return {inner,rim:[v.subarray(0,side*3),east,v.subarray(n*side*3),west] as const};
}
