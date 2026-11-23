/** Deterministic engineering trial of the game's integrator, not flight training. */
import {pathToFileURL} from 'node:url';
import {equivalentAirspeed} from '../../src/sim/aerodynamics.ts';
import {FIXED_STEP, flightConditions, neutral, spawn, step, setEngineOut, SURVEY_AIRFRAME, type Flight} from '../../src/sim/flight.ts';
import {clamp} from '../../src/sim/geo.ts';

export const KNOTS_PER_MPS=3600/1852;
export const reference=flightConditions(1406); // no wind, constant loading
const ground={height:0,land:true,runway:false};
export const surface=()=>ground;

export const easKnots=(f:Flight)=>equivalentAirspeed(f.speed,f.y)*KNOTS_PER_MPS;
export function startTrial(initialKeas:number):Flight {
  const f=spawn({id:'qa',name:'QA',region:'',lon:-63.2,lat:46.5,heading:0,height:1450,note:''},surface);
  // Initial conditions only. Every later sample must be produced by step().
  f.speed=initialKeas/(KNOTS_PER_MPS*equivalentAirspeed(1,f.y));
  f.throttle=0;
  return f;
}

/** Test pilot: commands only the public pitch input to track equivalent speed. */
export function speedPilot() {
  let integral=0;
  return (errorKt:number,dt:number)=>{
    integral=clamp(integral+errorKt*.013*dt,-.8,.8);
    return clamp(.071*errorKt+integral,-1,1);
  };
}

export function ticks(seconds:number,dt:number) {
  const n=Math.round(seconds/dt);
  if (!(dt>0 && dt<=.05) || !Number.isFinite(n) || Math.abs(n*dt-seconds)>1e-7)
    throw new RangeError('Trial windows must contain an integer number of valid physics steps');
  return n;
}

/** Mean speed alone can conceal phugoid oscillations. Report full speed and sink spreads. */
export function glideTrial(targetKeas:number, dt=FIXED_STEP, engineOut=false) {
  const f=startTrial(targetKeas), pilot=speedPilot(), u={...neutral};
  setEngineOut(f,engineOut);
  const advance=()=>{
    u.pitch=pilot(easKnots(f)-targetKeas,dt);
    step(f,u,surface,dt,reference);
    if(f.stalled || f.status!=='flying' || !Number.isFinite(f.y)) throw new Error('Unstable glide');
  };
  const settle=ticks(85,dt);
  for(let i=0;i<settle;i++) advance();
  const begin={...f}, count=ticks(45,dt);
  let sumEas=0, sumTas=0, minEas=Infinity, maxEas=-Infinity, minSink=Infinity, maxSink=-Infinity;
  for(let i=0;i<count;i++) {
    advance(); const eas=easKnots(f), sink=-f.vertical;
    sumEas+=eas; sumTas+=f.speed*KNOTS_PER_MPS;
    minEas=Math.min(minEas,eas); maxEas=Math.max(maxEas,eas);
    minSink=Math.min(minSink,sink); maxSink=Math.max(maxSink,sink);
  }
  const east=f.x-begin.x, north=begin.z-f.z, distance=Math.hypot(east,north);
  const heightLoss=begin.y-f.y, seconds=count*dt;
  // At fixed EAS, TAS decreases slightly while descending through denser air.
  // Publish the actual kinematic range ratio AND the energy-normalised diagnostic.
  const deltaKineticHeight=(f.speed*f.speed-begin.speed*begin.speed)/(2*SURVEY_AIRFRAME.gravity);
  return {
    targetKeas, averageKeas:sumEas/count, averageKtas:sumTas/count,
    easSpreadKt:maxEas-minEas, sinkSpreadMps:maxSink-minSink,
    meanGroundSpeedKt:distance/seconds*KNOTS_PER_MPS, trackTrueDeg:Math.atan2(east,north)*180/Math.PI,
    startHeightM:begin.y, endHeightM:f.y, horizontalM:distance, heightLostM:heightLoss,
    seconds, sinkMps:heightLoss/seconds, rangeRatio:distance/heightLoss,
    deltaKineticHeightM:deltaKineticHeight, energyRangeRatio:distance/(heightLoss-deltaKineticHeight),
  };
}

export function glideSweep(engineOut=false) {
  const trials=Array.from({length:18},(_,i)=>glideTrial(66+2*i,FIXED_STEP,engineOut));
  const best=trials.reduce((a,b)=>b.rangeRatio>a.rangeRatio?b:a);
  return {conditions:{...reference, flaps:'clean', thrust:'zero', windmillingDrag:engineOut?'enabled':'disabled (normal idle)',
    atmosphere:'ISA', startHeightM:1450, headingTrueDeg:0, settlingSeconds:85, fixedStepS:FIXED_STEP},
    best, trials};
}

if(process.argv[1] && pathToFileURL(process.argv[1]).href===import.meta.url)
  console.log(JSON.stringify(glideSweep(process.argv.includes('--engine-out')),null,2));
