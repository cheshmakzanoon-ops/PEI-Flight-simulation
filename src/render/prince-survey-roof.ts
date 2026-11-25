import {PRINCE_SURVEY_ROOF as R} from './prince-survey-roof.generated.ts';
import {emitMeasuredMassing,type MeasuredMassingSink} from './measured-massing.ts';
type Pair=readonly [number,number];
type Pt={x:number;z:number};
export const PRINCE_ROOF_TILE=R.tile;
/** Read only the normally streamed owner. A changed tile/index can still render stock. */
export function princeRoofOwner(atlas:string|undefined,tile:{id:string;offset:number;bytes:number;count:number}){
 return atlas===R.atlas&&tile.id===R.tile&&tile.offset===1073076&&tile.bytes===15510&&tile.count===315;
}
export function matchesPrinceSurveyRoof(atlas:string|undefined,chunk:string|undefined,id:string,ordinal:number,
 footprint:readonly Pair[],height:number,minHeight:number|undefined,holes:readonly (readonly Pair[])[]|undefined,base:number){
 return atlas===R.atlas&&chunk===R.chunk&&id===R.tile&&ordinal===R.ordinal&&
  !holes?.length&&height===R.record.height&&minHeight===R.record.minHeight&&Number.isFinite(base)&&
  Math.abs(base-R.base)<.025&&footprint.length===R.record.footprint.length&&
  R.record.footprint.every((q,i)=>q[0]===footprint[i][0]&&q[1]===footprint[i][1]);
}
export function emitPrinceSurveyRoof(ring:readonly Pt[],dst:MeasuredMassingSink){
 emitMeasuredMassing(ring,dst,R.shape);
}
/** At an added eave cut, interpolate the original stock segment's two terrain feet
 * rather than sampling a subtly different terrain profile under the unmodified footprint. */
export function princeFoot(ring:readonly Pt[],p:Pt,ground:(x:number,z:number)=>number){
 let foot=NaN,nearest=Infinity;
 for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length],dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz;
  if(den<1e-12)continue;
  const k=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/den));
  const d=(p.x-a.x-k*dx)**2+(p.z-a.z-k*dz)**2;
  if(d<nearest){const y=ground(a.x,a.z);foot=y+(ground(b.x,b.z)-y)*k-.6;nearest=d;}
 }
 return foot;
}
