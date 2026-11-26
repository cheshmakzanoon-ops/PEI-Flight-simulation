/** Same source roof, original broad warm-neutral membrane tone. No survey height,
 *  baked imagery, seam spacing, ducts or adjacent façades. */
const PIN=Object.freeze({
 atlas:"538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557",
 tile:"q20213",wire:"288874f91b78271c99fc53fc1776cc540b0a6445f7486701d551dff01452c8b0",
 rowSha:"ada7ed24d6d4636f5b0433ba1034ed36ff4b14fb0bfb37d5f7827f68b8ea7f41",ordinal:26,
 size:24668,offset:3427851,rows:542,
 bounds:[-64.232158, 46.70122, -64.15301, 46.737527],height:5.37,minHeight:3.29,
 ring:[[-64.229698,46.703669],[-64.229587,46.703391],[-64.229702,46.703369],[-64.229721,46.703419],[-64.229764,46.703412],[-64.229756,46.703389],[-64.229778,46.703386],[-64.229767,46.703354],[-64.229941,46.703326],[-64.229963,46.703383],[-64.230164,46.703345],[-64.230251,46.703565]],
});
type T={id:string;offset:number;bytes:number;count:number;bounds:readonly number[]};
type Row={footprint:readonly (readonly number[])[];height:number;minHeight?:number;holes?:unknown};
export const OLEARY_ACCESS_ROOF_TILE=PIN.tile;
export const OLEARY_ACCESS_ROOF_COLOR=0x89847b;
export function olearyAccessRoofTile(atlas:string|undefined,tile:T){
 return atlas===PIN.atlas&&tile.id===PIN.tile&&tile.offset===PIN.offset&&tile.bytes===PIN.size&&tile.count===PIN.rows&&
  tile.bounds.length===PIN.bounds.length&&PIN.bounds.every((value,i)=>tile.bounds[i]===value);
}
export function olearyAccessRoofOrdinal(atlas:string|undefined,tile:T,wire:string|undefined,rows:readonly Row[]){
 if(!olearyAccessRoofTile(atlas,tile)||wire!==PIN.wire||rows.length!==PIN.rows)return;
 const r=rows[PIN.ordinal];
 if(!r||r.height!==PIN.height||r.minHeight!==PIN.minHeight||r.holes!==undefined||r.footprint.length!==PIN.ring.length||
  !PIN.ring.every(([x,y],k)=>r.footprint[k]?.length===2&&r.footprint[k][0]===x&&r.footprint[k][1]===y))return;
 return PIN.ordinal;
}
