/** Compose the already-authored East Point surfaces in one detached stream.
 * The normal renderer does not import this. No owner admission, collision,
 * scene, draw, material, floor, shadow, or world API is changed. */
import * as T from 'three';
import type {FogShell} from './east-fog-gable-shell.ts';
import {studyEastFogCornice} from './east-fog-cornice-study.ts';
import {eastFogAuthoredSashes} from './east-fog-authored-sashes.ts';
const layout=Object.freeze([
 ['position',3],['normal',3],['color',3],['clad',1],
] as const);
const book=(a:number,b:number)=>Object.freeze([a,b] as const);
export const EAST_FOG_COMBINED_ROLES=Object.freeze({
 originals:book(0,5853),envelope:book(5055,5457),protectedExhibit:book(5457,5853),
 sash2:book(5853,6645),sash3:book(6645,7437),cornice:book(7437,8157),end:8157,
});
const R=EAST_FOG_COMBINED_ROLES;
const check=(q:unknown,why:string)=>{if(!q)throw Error(why);};
function get(g:T.BufferGeometry,k:string,item:number,count:number){
 const a=g.getAttribute(k);
 check(a instanceof T.BufferAttribute&&!(a instanceof T.InstancedBufferAttribute)&&a.array instanceof Float32Array&&
  !a.normalized&&a.itemSize===item&&a.count===count&&a.array.length===count*item&&a.array.every(Number.isFinite),
  'unexpected East surface ABI '+k);
 return a.array as Float32Array;
}
function words(a:Float32Array){return new Uint32Array(a.buffer,a.byteOffset,a.length);}
const same=(a:Float32Array,b:Float32Array)=>{const q=words(b);return a.length===q.length&&words(a).every((x,i)=>x===q[i]);};
/** Keep all original corrected vertices in place. Append the opaque
 * sash vertices then authored trim only, so it remains one geometry with
 * exactly the same peer, host, and material selection boundaries. The
 * caller must separately qualify the entire original q1333 draw and
 * exact terrain/renderer before offering it as playable geometry. */
export function combineEastFogAuthoredSurface(corrected:T.BufferGeometry,plan:FogShell){
 check(!(corrected instanceof T.InstancedBufferGeometry)&&!Object.keys(corrected.morphAttributes).length&&
  !corrected.morphTargetsRelative&&!corrected.index&&corrected.drawRange.start===0&&corrected.drawRange.count===Infinity&&
  corrected.groups.length===0&&Object.keys(corrected.attributes).length===layout.length,'unexpected corrected East opaque draw');
 const cornice=studyEastFogCornice(plan);
 let sash:T.BufferGeometry|undefined,result:T.BufferGeometry|undefined;
 try{
  const windowSet=eastFogAuthoredSashes(plan);sash=windowSet.geometry;
  check(windowSet.apertures===2&&cornice.base===402&&cornice.prisms.length===20,'unexpected authored detail set');
  result=new T.BufferGeometry();
  for(const [k,item] of layout){
   const before=get(corrected,k,item,R.originals[1]),body=get(cornice.bulk,k,item,402);
   check(same(before.subarray(R.envelope[0]*item,R.envelope[1]*item),body),'corrected East envelope differs');
   const fullCornice=get(cornice.geometry,k,item,1122);
   check(same(fullCornice.subarray(0,cornice.base*item),body),'cornice touched the certified envelope');
   const windows=get(sash,k,item,1584),out=new Float32Array(R.end*item);
   out.set(before);out.set(windows,R.sash2[0]*item);
   out.set(fullCornice.subarray(cornice.base*item),R.cornice[0]*item);
   result.setAttribute(k,new T.BufferAttribute(out,item));
  }
  result.computeBoundingBox();result.computeBoundingSphere();
  const detached=result;result=undefined;
  return {geometry:detached,roles:R,scope:'detached combined surface; requires separate owner, render and visual tests'};
 }finally{result?.dispose();sash?.dispose();cornice.geometry.dispose();cornice.bulk.dispose();}
}
