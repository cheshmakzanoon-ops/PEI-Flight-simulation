import {emitMeasuredMassing, type MeasuredMassingSink} from './measured-massing.ts';
import {RUSTICO_NEIGHBOUR as R} from './rustico-neighbour.generated.ts';

type Wgs=readonly [number,number];
type Pt={x:number;z:number};
export const RUSTICO_MASSING_TILE=R.tile;
export function matchesRusticoMassing(atlas:string|undefined,chunk:string|undefined,id:string,ordinal:number,
 footprint:readonly Wgs[],height:number,minHeight:number|undefined,holes?:readonly (readonly Wgs[])[]){
 return atlas===R.atlas&&chunk===R.chunk&&id===R.tile&&ordinal===R.ordinal&&!holes?.length&&height===R.record.height&&minHeight===R.record.minHeight&&
  footprint.length===R.record.footprint.length&&R.record.footprint.every((q,i)=>q[0]===footprint[i][0]&&q[1]===footprint[i][1]);
}
export type RusticoMassingSink=MeasuredMassingSink;
export function emitRusticoMassing(ring:readonly Pt[],target:RusticoMassingSink){
 emitMeasuredMassing(ring,target,R.shape);
}
