import type {Quad} from './strict-shore-arc.ts';

/** Five observed one-zero-corner mixed cells in the shipped 2021 mask.
 * This is a render-only batch: no coast reclassification or 2020 elevation. */
export const ORBY_ZERO_CELLS:readonly (readonly [i:number,j:number,corners:Quad])[]=[
 [1838,1418,[-12,-19,0,10]],
 [1839,1418,[-19,-14,4,0]],
 [1843,1419,[0,-23,-10,4]],
 [1845,1420,[-14,-23,0,4]],
 [1846,1421,[0,-12,4,19]],
];
export const ORBY_COVER_SHA='46a4f4736a885576fa0529cd0f91bacdbfd47e3bfd719130ba3446c52c245863';
const ORBY_BOUNDS=[-64.47,45.94,-61.93,47.10] as const;
export function matchesOrbyTerrainBounds(bounds:readonly number[]){
 return bounds.length===ORBY_BOUNDS.length&&ORBY_BOUNDS.every((v,i)=>bounds[i]===v);
}
export function allowOrbyZeroArc(i:number,j:number,w:number,h:number,sha:string|undefined,q:Quad){
 return w===4096&&h===2720&&sha===ORBY_COVER_SHA&&ORBY_ZERO_CELLS.some(([x,z,c])=>x===i&&z===j&&c.every((v,k)=>q[k]===v));
}
