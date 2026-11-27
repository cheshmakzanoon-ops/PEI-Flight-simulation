import type {Terrain} from '../../sim/terrain.ts';
import type {Cover} from '../../sim/cover.ts';
import {verifyDecodedCover} from '../../sim/cover-proof.ts';
import {loadBoundedGrade} from '../../sim/bounded-grade.ts';
import {INDIAN_RIVER_GRADE} from '../../sim/indian-river-grade.generated.ts';
import {churchLandSource} from './indian-river-guard.ts';
import {loadChurchGroundSun} from './church-ground-sun.ts';
import {CHURCH_SUN_MASK} from './church-sun.generated.ts';

type Context={terrain:Terrain;terrainSHA?:string;cover:Cover;roadsSHA?:string;accept:()=>boolean;signal:AbortSignal};

/** Scope the two already published local buffers to the selected Dispatch
 * seat. This function does not start roads/buildings downloads, submit art,
 * change collision or establish an activation lease. */
export async function loadStandardIndianRiverSource(base:string,o:Context,get:typeof fetch=fetch){
 const okay=()=>!o.signal.aborted&&o.accept();
 if(!okay()||CHURCH_SUN_MASK.gradeSha!==INDIAN_RIVER_GRADE.sha256||!churchLandSource(o.terrainSHA,o.cover.sourceSha,
   INDIAN_RIVER_GRADE.coverDecodedSha256,o.roadsSHA))return;
 const fetchInSeat:typeof fetch=(url,init)=>{
  if(!okay())return Promise.reject(new DOMException('Indian River Dispatch changed','AbortError'));
  return get(url,{...init,signal:init?.signal?AbortSignal.any([o.signal,init.signal]):o.signal});
 };
 try{
  const coverProof=await verifyDecodedCover(o.cover);
  if(!okay()||!churchLandSource(o.terrainSHA,o.cover.sourceSha,coverProof,o.roadsSHA))return;
  const [build,sun]=await Promise.all([loadBoundedGrade(INDIAN_RIVER_GRADE,base,fetchInSeat,4000),
   loadChurchGroundSun(CHURCH_SUN_MASK,base,fetchInSeat,4000)]);
  if(!sun)return;
  let kept=false;
  try{
   if(!okay()||!build)return;
   const grade=build(o.terrain,(x,z)=>o.terrain.atlasElevation(x,z));
   kept=true;return {grade,sun};
  }finally{if(!kept)sun.uniforms.churchSunMask.value.dispose();}
 }catch{return;}
}
