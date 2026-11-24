import {ST_DAVIDS_ART as A} from './art.generated.ts';
import {ST_DAVIDS as S} from './source.generated.ts';
import {GEORGETOWN_GROUND_SUN as M} from './ground-sun.generated.ts';

/** Permit only the cast from this exact exterior, registration and sunny scene. */
export function georgetownSunMatches(terrain:string|undefined,sun:readonly number[]){
 const pose=[...S.originXZ,S.seatY,...S.basisXZ[0],...S.basisXZ[1]];
 return terrain===M.terrainSha&&M.terrainSha===S.terrain&&M.coverDecodedSha===S.coverDecoded&&
  M.artRawSha===A.rawSha&&M.pose.every((v,i)=>v===pose[i])&&
  sun.length===3&&M.sun.every((v,i)=>Math.abs(v-sun[i])<1e-9);
}
