/** Offline-only construction of fixed mesh snapshots for the q418 study.
 * No Object3D/Renderer hook, raw attribute update or live allocation entry. */
import * as T from 'three';
import type {FogShell} from './east-fog-gable-shell.ts';
import type {studyEastFogCornice} from './east-fog-cornice-study.ts';

export const DISTANCE=Object.freeze({trimFull:500,trimHidden:640,middleOut:750,middleIn:690,farOut:8500,farIn:7990});
export const FIXED_PROOF_LOD_METRES=Object.freeze([438,500,534,560,580,594,600,605,610,619,639.999,640,689.95,690.05,749.95,750.05]);
export const TRIM_BASE=402, TRIM_COUNT=20*36, TRIM_TOTAL=TRIM_BASE+TRIM_COUNT;
const INSET=.015, PACK=.000002;
const need=(ok:unknown,why:string)=>{if(!ok)throw new Error('solid LOD '+why);};
type Solid=ReturnType<typeof studyEastFogCornice>;
type V=readonly [x:number,y:number,z:number];
type Range=Readonly<{first:number;end:number;body:0|1;center:V}>;
export function trimWeight(d:number){
 if(!Number.isFinite(d)||d<0)return 0;
 const q=Math.min(1,Math.max(0,(d-DISTANCE.trimFull)/(DISTANCE.trimHidden-DISTANCE.trimFull)));
 return 1-q*q*(3-2*q);
}
export function solidTuckPlan(plan:FogShell,art:Solid){
 const p=art.geometry.getAttribute('position'),N=art.geometry.getAttribute('normal');
 need(art.base===TRIM_BASE&&p.count===TRIM_TOTAL&&N.count===p.count&&art.prisms.length===20,'source counts');
 need(plan.body.length===2&&art.prisms.every((q,i)=>q.first===TRIM_BASE+i*36&&q.end===q.first+36&&q.body===plan.body[i<10?0:1].id),'role spans');
 const [x0,z0]=plan.originXZ,s=Math.sin(plan.yaw),c=Math.cos(plan.yaw);
 const ranges=plan.body.map((b,i):Range=>{
  const [,,lo,hi]=b.box,u=b.ridgeU,v=(lo+hi)/2;
  return Object.freeze({first:TRIM_BASE+i*360,end:TRIM_BASE+(i+1)*360,body:i as 0|1,center:[x0+c*u+s*v,0,z0-s*u+c*v]as V});
 });
 const limits=ranges.flatMap(q=>{
  const b=plan.body[q.body],[u0,u1,v0,v1]=b.box,u=b.ridgeU,v=(v0+v1)/2;
  let we=0,ea=0,so=0,no=0;
  for(let i=q.first;i<q.end;i++){
   const x=p.getX(i)-x0,z=p.getZ(i)-z0;
   const du=c*x-s*z-u,dv=s*x+c*z-v;
   we=Math.max(we,-du);ea=Math.max(ea,du);so=Math.max(so,-dv);no=Math.max(no,dv);
  }
  const num=[u-u0,u1-u,v-v0,v1-v].map(d=>d-INSET-PACK),den=[we,ea,so,no];
  need(Math.min(...num)>0&&Math.min(...den)>0,'analytic horizontal bounds');
  return num.map((d,i)=>d/den[i]);
 });
 const finalScale=Math.min(...limits);
 need(Number.isFinite(finalScale)&&finalScale>.97&&finalScale<.99,'tuck scale not on the surveyed near form');
 return Object.freeze({ranges:Object.freeze(ranges),limits:Object.freeze(limits),finalScale,terminalInset:INSET,reserve:PACK,
  positionDisplacementMax:Math.max(...ranges.flatMap(q=>Array.from({length:q.end-q.first},(_,j)=>{
   const i=q.first+j;return (1-finalScale)*Math.hypot(q.center[0]-p.getX(i),q.center[2]-p.getZ(i));
  })))});
}
export type SolidTuckPlan=ReturnType<typeof solidTuckPlan>;
export function stageScale(S:SolidTuckPlan,d:number){
 if(!Number.isFinite(d)||d<0)return;
 const w=trimWeight(d);
 return w===1?1:w===0?S.finalScale:S.finalScale+(1-S.finalScale)*w;
}
/** Caller owns the one-time detached snapshot. Prisms stay closed and the
 * identical per-body map preserves packed shared joints at every weight.
 * Y, all color/clad and the original four-stream prefix stay untouched.
 * Uniform XZ scale needs the inverse-transpose normal, not a shade fade. */
export function buildFixedSolidSnapshot(art:Solid,S:SolidTuckPlan,scale:number){
 need(scale>=S.finalScale&&scale<=1,'scale outside proof');
 const g=art.geometry.clone(),p=g.getAttribute('position'),n=g.getAttribute('normal');
 if(scale!==1){
  const q=new T.Vector3();
  for(const slot of S.ranges){
   const [X,,Z]=slot.center;
   for(let i=slot.first;i<slot.end;i++){
    p.setXYZ(i,X+(p.getX(i)-X)*scale,p.getY(i),Z+(p.getZ(i)-Z)*scale);
    q.set(n.getX(i),n.getY(i)*scale,n.getZ(i)).normalize();
    n.setXYZ(i,q.x,q.y,q.z);
   }
  }
  g.computeBoundingBox();g.computeBoundingSphere();
 }
 return g;
}
