/** Detached #1 of the three documented period openings, not a current survey.
 * The established #2/#3 art and all live/assembly roles stay untouched. */
import type {FogShell} from './east-fog-gable-shell.ts';
import {eastFogHighRearWall,EAST_HIGH_REAR_STUDY} from './east-fog-authored-sashes.ts';
import {detachedWindowPrimitive,type Sash} from './sash-study.ts';

export const EAST_TOWERWARD_REFERENCE=Object.freeze({
 sourceWindowOrdinal:1, referenceCentre2009:.1319,referenceCentre2023:.1217,
 centre:.127,widthFraction:.0855,bottomFraction:.224,topFraction:.663,
});
export function eastFogTowerwardSash(plan:FogShell){
 const wall=eastFogHighRearWall(plan),length=wall.v1-wall.v0,r=EAST_TOWERWARD_REFERENCE;
 const datum=EAST_HIGH_REAR_STUDY.authoredPlinthDatum,height=wall.highEave-datum;
 const first:Sash={along01:r.centre,width:r.widthFraction*length,bottom:datum+height*r.bottomFraction,
  height:height*(r.topFraction-r.bottomFraction),panes:[3,2],historicalMeetingRail:true};
 const firstExisting=EAST_HIGH_REAR_STUDY.windows[0];
 const clearGap=(firstExisting.ratio-first.along01)*length-(firstExisting.widthRatio*length+first.width)*.5;
 if(clearGap<.6||wall.v1<wall.v0)throw Error('unsupported towerward sash spacing');
 return {...detachedWindowPrimitive(wall,first),wall,clearGap,location:first,
  scope:'detached historic towerward opening on the one rear high wall; no cutout or game route'};
}
