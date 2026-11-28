/** Detached authored study of two documented apertures; not a surveyed
 * facade or complete window inventory. Does not replace scene geometry. */
import {detachedLocatedSashes,type Sash,type Wall} from './sash-study.ts';
import type {FogShell} from './east-fog-gable-shell.ts';
export const EAST_HIGH_REAR_STUDY=Object.freeze({
 face:'high-point-side rear (local -U)',
 authoredPlinthDatum:0,
 sourceWindowOrdinals:[2,3] as const,
 windows:Object.freeze([
  Object.freeze({ratio:.28,widthRatio:.087,lowRatio:.225,highRatio:.665}),
  Object.freeze({ratio:.715,widthRatio:.089,lowRatio:.225,highRatio:.665}),
 ] as const),
});
export function eastFogHighRearWall(plan:FogShell):Wall{
 const shape=plan.body[1],[u,u1,v0,v1]=shape.box;
 if(shape.id!=='high-point-side'||u!==-4.3||u1!==4.2||v0!==-3.92||v1!==8.65||
    plan.yaw!==1.89||plan.originXZ[0]!==17.05||plan.originXZ[1]!==-5.9||
    shape.ridgeU!==.3148365524853488||shape.ridgeY!==8.33823909759005||shape.pitch!==.843597814706237)
  throw new Error('unsupported East Point rear wall');
 const eave=shape.ridgeY-shape.pitch*Math.abs(shape.ridgeU-u);
 return {u,v0,v1,highEave:eave,anchor:plan.originXZ,yaw:plan.yaw};
}
export function eastFogAuthoredSashes(plan:FogShell){
 const wall=eastFogHighRearWall(plan),{v0,v1,highEave:eave}=wall,datum=EAST_HIGH_REAR_STUDY.authoredPlinthDatum;
 const locations=EAST_HIGH_REAR_STUDY.windows.map((q):Sash=>({
  along01:q.ratio,bottom:datum+q.lowRatio*(eave-datum),width:q.widthRatio*(v1-v0),
  height:(q.highRatio-q.lowRatio)*(eave-datum),panes:[3,2],historicalMeetingRail:true,
 }));
 return {...detachedLocatedSashes(wall,locations),wall,locations,
  sourceScope:'normalized photographic placement/range with authored datum and thickness; no photo pix or fixed current palette'};
}
