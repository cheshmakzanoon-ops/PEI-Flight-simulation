import {verifyDecodedCover} from '../sim/cover-proof.ts';
import type {Cover} from '../sim/cover.ts';
import {GREEN_GABLES_BARN as S} from './green-gables-barn-spec.ts';

export function greenGablesBarnRequested(options:URLSearchParams){
 return !options.has('stockGreenGablesBarn')&&options.has('greenGablesBarnReview')&&!options.has('surveyRelief')&&
  !options.has('inlandRelief')&&!options.has('buildingShadows');
}
/** Normal near-only art, without rewriting a separately selected terrain/study. */
export function greenGablesBarnStandardRequested(q:URLSearchParams){
 return q.get('scenery')!=='detail'&&!['stockGreenGablesBarn','greenGablesBarnReview','surveyRelief','inlandRelief',
  'buildingShadows','seatedRoads','seatedForestShadows','woodlandView','orthophotoSeamStudy'].some(k=>q.has(k));
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

export function greenGablesBarnStandardGate(w:BarnGround,terrain:string|undefined,cover:Cover){
 if(terrain!==S.terrain||cover.sourceSha!==S.cover||!globalThis.crypto?.subtle)return;
 const seat=greenGablesBarnGate(w);
 let started=false,verified=false;
 return ()=>{
  if(!seat())return false;
  if(!started){
   started=true;
   void verifyDecodedCover(cover).then(r=>verified=greenGablesBarnAtlasMatches(terrain,cover.sourceSha,r));
  }
  return verified;
 };
}
