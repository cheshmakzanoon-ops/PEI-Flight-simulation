/** Detached vertex equation. Never attaches a material/geometry or installs a live LOD. */
import {EAST_FOG_COMBINED_ROLES as R} from './east-fog-combined-surface.ts';
import {EAST_FOG_DATED_REAR_ROLES as DATED} from './east-fog-dated-rear-ensemble.ts';
import type {SolidTuckPlan} from './solid-lod-math.ts';
import type {FogShell} from './east-fog-gable-shell.ts';
const common='#include <common>';
const normal='#include <beginnormal_vertex>';
const vertex='#include <begin_vertex>\nvLocal=position;vClad=clad;';
const once=(a:string,k:string)=>a.indexOf(k)>=0&&a.indexOf(k)===a.lastIndexOf(k);
export function patchDetachedFogRetirement(v:string,plan:FogShell,cornice:SolidTuckPlan,vertexCount:8157|8949=8157){
 if((vertexCount!==8157&&vertexCount!==8949)||v.includes('eastFogSecondary')||![common,normal,vertex].every(x=>once(v,x))||
  plan.yaw!==1.89||plan.originXZ[0]!==17.05||plan.originXZ[1]!==-5.9||
  !cornice.ranges.every((x,i)=>x.first===402+i*360&&x.end===762+i*360&&x.body===i&&
   x.center.every(q=>Number.isFinite(q)&&Math.abs(q)<40))||
  cornice.ranges.length!==2||!Number.isFinite(cornice.finalScale)||cornice.finalScale<=.97||cornice.finalScale>=.99)return;
 const r=Math.cos(plan.yaw),s=Math.sin(plan.yaw),varS=R.cornice[0];
 const vec=(x:number,z:number)=>'vec2('+x.toFixed(13)+','+z.toFixed(13)+')';
 const sash='(gl_VertexID>='+R.sash2[0]+'&&gl_VertexID<'+varS+')';
 const dated=vertexCount===DATED.end?
  sash+'||(gl_VertexID>='+DATED.towerward[0]+'&&gl_VertexID<'+DATED.towerward[1]+')':sash;
 const [A,B]=cornice.ranges.map(q=>vec(q.center[0],q.center[2]));
 return v.replace(common,common+`
 uniform float eastFogSecondaryRange;
 `).replace(normal,normal+`
 float eastFogSecondaryInset=smoothstep(500.,640.,eastFogSecondaryRange);
 bool eastFogSecondaryTrim=gl_VertexID>=${varS}&&gl_VertexID<${R.end};
 float eastFogSecondaryScale=1.+(${cornice.finalScale.toFixed(15)}-1.)*eastFogSecondaryInset;
 // Inverse transpose for the uniform horizontal scale only. Translation
 // on the sash does not change a normal.
 if(eastFogSecondaryTrim&&eastFogSecondaryInset>0.)
  objectNormal=normalize(vec3(objectNormal.x,objectNormal.y*eastFogSecondaryScale,objectNormal.z));
 `).replace(vertex,vertex+`
 if(eastFogSecondaryInset>0.){
  if(eastFogSecondaryTrim){
   vec2 eastFogSecondaryPivot=gl_VertexID<${varS+360}?${A}:${B};
   transformed.xz=eastFogSecondaryPivot+(transformed.xz-eastFogSecondaryPivot)*eastFogSecondaryScale;
   vLocal=transformed;
  }else if(${vertexCount===8157?sash.slice(1,-1):dated}){
   transformed.xz+=.14*eastFogSecondaryInset*${vec(r,-s)};
   vLocal=transformed;
  }
 }
 `);
}
