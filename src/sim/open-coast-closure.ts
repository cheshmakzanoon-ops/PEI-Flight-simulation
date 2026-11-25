import {ORBY_COVER_SHA} from './orby-shore-closure.ts';
import type {Quad} from './strict-shore-arc.ts';

/** Separate exposed Prince and Kings standard repairs for two witnessed sky
 * leaks. Their non-zero-corner certified curves are under the old broad
 * preview's one-size threshold, but visible on direct low shore views. */
export const SHORT_OPEN_COAST_CELLS:readonly (readonly [i:number,j:number,corners:Quad])[]=[
 [781,410,[4,-14,-10,12]],
 [2722,1550,[-14,-10,12,4]],
];
export function allowShortOpenArc(i:number,j:number,w:number,h:number,sha:string|undefined,q:Quad){
 return w===4096&&h===2720&&sha===ORBY_COVER_SHA&&SHORT_OPEN_COAST_CELLS.some(([x,z,c])=>x===i&&z===j&&c.every((v,k)=>q[k]===v));
}
