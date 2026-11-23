/** Game-only reference-mass climb tests. No real piloting instructions or certification inference. */
import {pathToFileURL} from 'node:url';
import {equivalentAirspeed} from '../../src/sim/aerodynamics.ts';
import {FIXED_STEP,neutral,step} from '../../src/sim/flight.ts';
import {easKnots,KNOTS_PER_MPS,reference,speedPilot,startTrial,surface,ticks} from './glide-trial.ts';

const M_PER_FT=.3048;
export const climbCases=[
  {altFt:2000, kias:79, bookFpm:835}, {altFt:4000,kias:78,bookFpm:750},
  {altFt:6000,kias:77,bookFpm:660}, {altFt:8000,kias:75,bookFpm:565},
  {altFt:10000,kias:74,bookFpm:470},
] as const;
// Separate speed regime, not used to choose the climb loss factor.
export const normalClimbChecks=[
  {altFt:2000,kias:90,bookFpm:625},{altFt:8000,kias:90,bookFpm:455},
] as const;

/**
 * Each independent clean/calm flight starts 500 m below a pressure-altitude
 * gate in ISA. Measure time between interpolated crossings of the 50 m band,
 * rather than reporting one frame's vertical speed. Pitch is the only servo.
 */
export function climbTrial(config:{altFt:number;kias:number;bookFpm:number},dt=FIXED_STEP){
  const {altFt,kias,bookFpm}=config;
  // POH Fig 5-1 gives 73/82/90 KCAS at 70/80/90 KIAS, under a different power
  // condition; at low Mach KEAS≈KCAS. No claim of exact instrument calibration.
  if(kias<70||kias>90)throw new RangeError("Speed is outside this trial's reference calibration interval");
  const targetKeas=kias<=80?73+(kias-70)*.9:82+(kias-80)*.8, height=altFt*M_PER_FT, low=height-25, high=height+25;
  const f=startTrial(targetKeas), pilot=speedPilot(), u={...neutral};
  f.throttle=1; f.y=height-500;
  f.speed=targetKeas/(KNOTS_PER_MPS*equivalentAirspeed(1,f.y));
  let enter:number|undefined, exit:number|undefined,minKeas=Infinity,maxKeas=-Infinity,sumKeas=0,samples=0;
  const budget=ticks(600,dt);
  for(let i=0;i<budget;i++){
    const beforeY=f.y, time=f.time;
    u.pitch=pilot(easKnots(f)-targetKeas,dt);
    step(f,u,surface,dt,reference);
    if(f.status!=='flying'||f.stalled) throw new Error('Clean climb not sustained');
    if(f.y>beforeY) {
      const crossing=(bound:number)=>time+dt*(bound-beforeY)/(f.y-beforeY);
      if(enter===undefined&&beforeY<=low&&f.y>=low)enter=crossing(low);
      if(enter!==undefined&&beforeY<=high&&f.y>=high)exit=crossing(high);
    }
    if(enter!==undefined){
      const v=easKnots(f);minKeas=Math.min(minKeas,v);maxKeas=Math.max(maxKeas,v);sumKeas+=v;samples++;
    }
    if(enter!==undefined&&exit!==undefined) {
      const fpm=(high-low)/(exit-enter)*60/M_PER_FT;
      return {altFt,bookKias:kias,bookFpm,targetKeas,meanKeas:sumKeas/samples,
        easSpreadKt:maxKeas-minKeas,leadInS:enter,measurementS:exit-enter,
        measuredFpm:fpm,relativeDifference:(fpm-bookFpm)/bookFpm};
    }
  }
  throw new Error('Climb did not traverse the measurement band');
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)
  console.log(JSON.stringify({massKg:reference.massKg,wind:'calm',atmosphere:'ISA',dt:FIXED_STEP,
    trials:climbCases.map(c=>climbTrial(c)),normalClimbChecks:normalClimbChecks.map(c=>climbTrial(c))},null,2));
