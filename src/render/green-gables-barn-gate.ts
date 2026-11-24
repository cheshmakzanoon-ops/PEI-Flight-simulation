import {GREEN_GABLES_BARN as S} from './green-gables-barn-spec.ts';

export function greenGablesBarnRequested(options:URLSearchParams){
 return options.has('greenGablesBarnReview')&&!options.has('surveyRelief')&&
  !options.has('inlandRelief')&&!options.has('buildingShadows');
}
export function greenGablesBarnAtlasMatches(terrain?:string,cover?:string,decoded?:string){
 return terrain===S.terrain&&cover===S.cover&&decoded===S.coverDecoded;
}
interface BarnGround {
 readonly visualGroundEpoch:number;
 visualGroundSignature(b:readonly [number,number,number,number]):string;
 visualGroundHeight(x:number,z:number):number;
 surface(x:number,z:number):{land:boolean};
}
/** The model's skirt fits the regular N112 triangles, not the texture or
 * the separate flight ground sampler. Never fit it to a coarser patch. */
export function greenGablesBarnGate(w:BarnGround){
 let prior=-1,fits=false;
 return ()=>{
  const epoch=w.visualGroundEpoch;
  if(epoch===prior)return fits;
  prior=epoch;
  const signature=w.visualGroundSignature(S.boundsXZ);
  fits=/^112\/112:(?:8|56|112),(?:8|56|112),(?:8|56|112),(?:8|56|112);$/.test(signature)&&
   S.gradeProbes.every(([x,z,y])=>Math.abs(w.visualGroundHeight(x,z)-y)<.008&&w.surface(x,z).land);
  return fits;
 };
}
