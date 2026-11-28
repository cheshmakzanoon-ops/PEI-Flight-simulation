/** Detached authoring packet; never attached to the game or its optical guards. */
import * as T from 'three';
import {combineEastFogAuthoredSurface,EAST_FOG_COMBINED_ROLES} from './east-fog-combined-surface.ts';
import {eastFogTowerwardSash} from './east-fog-towerward-sash.ts';
import type {FogShell} from './east-fog-gable-shell.ts';
export const EAST_FOG_DATED_REAR_ROLES=Object.freeze({
 ...EAST_FOG_COMBINED_ROLES,towerward:Object.freeze([8157,8949] as const),end:8949,
});
const schema=[['position',3],['normal',3],['color',3],['clad',1]] as const;
/** Append the documented towerward sash to the already qualified two-sash
 * packet. Preserve its old tower, bulk, exhibit, two sashes and trim bytes.
 * Native ownership and original stock culling bounds are separate work. */
export function buildEastFogDatedRearEnsemble(corrected:T.BufferGeometry,plan:FogShell){
 const base=combineEastFogAuthoredSurface(corrected,plan);
 let from:T.BufferGeometry|undefined,out:T.BufferGeometry|undefined;
 try{
  const q=eastFogTowerwardSash(plan);from=q.geometry;
  out=new T.BufferGeometry();
  for(const [k,item] of schema){
   const a=base.geometry.getAttribute(k),b=from.getAttribute(k);
   if(!(a.array instanceof Float32Array)||!(b.array instanceof Float32Array)||a.count!==8157||b.count!==792||
    a.itemSize!==item||b.itemSize!==item)throw Error('unsupported authored rear surface');
   const words=new Float32Array(8949*item);
   words.set(a.array);words.set(b.array,a.array.length);out.setAttribute(k,new T.BufferAttribute(words,item));
  }
  out.computeBoundingBox();out.computeBoundingSphere();
  const geometry=out;out=undefined;
  return {geometry,roles:EAST_FOG_DATED_REAR_ROLES,scope:'documented rear high-wall three-sash ensemble only; no whole station claim'};
 }finally{out?.dispose();from?.dispose();base.geometry.dispose();}
}
