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

/** Five witnessed under-coverage cells on the east face of Panmure Head.
 * Only its exact pinned mixed cells are eligible; surrounding data is unchanged. */
export const PANMURE_SHORE_CELLS:readonly (readonly [i:number,j:number,corners:Quad])[]=[
 [3230,2237,[-12,-20,-4,10]], [3230,2238,[10,-4,0,23]], [3231,2239,[0,-19,-12,10]],
 [3231,2242,[10,-12,-19,0]], [3230,2243,[19,0,-10,12]],
];
export function allowPanmureOpenArc(i:number,j:number,w:number,h:number,sha:string|undefined,q:Quad){
 return w===4096&&h===2720&&sha===ORBY_COVER_SHA&&PANMURE_SHORE_CELLS.some(([x,z,c])=>x===i&&z===j&&c.every((v,k)=>q[k]===v));
}
