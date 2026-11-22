/** Static lift/drag baseline for the fictional aircraft. Not a piloting tool.
 * From repository root: node --experimental-strip-types tools/qa/airframe-baseline.mjs
 */
import { aerodynamicPolar, SEA_LEVEL_DENSITY } from '../../src/sim/aerodynamics.ts';
import { SURVEY_AIRFRAME } from '../../src/sim/flight.ts';

let peakCl=0, angleAtPeak=0, bestLiftToDrag=0;
for(let i=0;i<=15000;i++){
  const alpha=i/10000, {cl,cd}=aerodynamicPolar(alpha);
  if(cl>peakCl){peakCl=cl;angleAtPeak=alpha;}
  bestLiftToDrag=Math.max(bestLiftToDrag,cl/cd);
}
const equivalentStallKt=massKg=>
   1.9438444924 * Math.sqrt(2*massKg*SURVEY_AIRFRAME.gravity/(SEA_LEVEL_DENSITY*SURVEY_AIRFRAME.areaM2*peakCl));
const snapshot={
 title:'Static baseline for the fictional survey aircraft, not an aircraft certification',
 assumptions:{level:true,loadFactor:1,clean:true,standardSeaLevel:true},
 areaM2:SURVEY_AIRFRAME.areaM2,peakCl,angleAtPeakDegrees:angleAtPeak*180/Math.PI,bestLiftToDrag,
 default:{massKg:SURVEY_AIRFRAME.massKg,idealStallKt:equivalentStallKt(SURVEY_AIRFRAME.massKg)},
 comparison:{massKg:1406,idealStallKt:equivalentStallKt(1406),referenceCleanIdleKCAS:54,
   source:'https://www.atsb.gov.au/investigations/ao-2025-028'}
};
console.log(JSON.stringify(snapshot,null,2));
