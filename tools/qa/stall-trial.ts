/** Engineering QA of the fictional clean survey aircraft, not operational guidance. */
import {pathToFileURL} from 'node:url';
import {aerodynamicPolar,airDensity} from '../../src/sim/aerodynamics.ts';
import {FIXED_STEP,neutral,step,SURVEY_AIRFRAME} from '../../src/sim/flight.ts';
import {easKnots,KNOTS_PER_MPS,reference,speedPilot,startTrial,surface,ticks} from './glide-trial.ts';

type Event = {
  timeS:number; heightM:number; keas:number; ktas:number; angleOfAttackDeg:number;
  pathDeg:number; loadFactor:number; liftCoefficient:number; approachRateKtPerS:number;
};
const deg=180/Math.PI;

/** Slow power-off deceleration using only pitch controls, then unstall and settle back into a glide. */
export function stallTrial(dt=FIXED_STEP) {
  const f=startTrial(78), u={...neutral}, trackSpeed=speedPilot(), recoverSpeed=speedPilot();
  const settleTicks=ticks(85,dt), historySize=ticks(1,dt);
  const history=new Float64Array(historySize).fill(78);
  let peak:Event|undefined, separation:Event|undefined, firstClearS:number|undefined;
  let orderedRecovery=false, stableCount=0, minimumKeas=Infinity;
  const budget=ticks(230,dt), stableTicks=ticks(5,dt);
  for(let i=0;i<budget;i++) {
    const phaseTime=Math.max(0,(i-settleTicks)*dt);
    const speed=easKnots(f);
    if(i===settleTicks && (Math.abs(speed-78)>.1 || Math.abs(f.bank)>.001 || f.stalled))
      throw new Error('Initial glide did not settle before deceleration');
    if (!separation) {
      const target=Math.max(44,78-.75*phaseTime);
      u.pitch=trackSpeed(speed-target,dt);
    } else {
      if (!f.stalled && speed>=76) orderedRecovery=true;
      u.pitch=orderedRecovery ? recoverSpeed(speed-78,dt) : -.35;
    }

    // The integrator evaluates lift at pre-step q, with alpha stored on the resulting step.
    const priorAltitude=f.y, priorTas=f.speed;
    step(f,u,surface,dt,reference);
    if(f.status!=='flying' || !Number.isFinite(f.y)) throw new Error('Trial lost airborne state');
    const newKeas=easKnots(f), index=i%historySize;
    const oneSecondAgo=history[index];
    history[index]=newKeas;
    if (i<settleTicks) {
      if(f.stalled) throw new Error('Stalled during initial stabilization');
      continue;
    }
    if(!separation) {
      const cl=aerodynamicPolar(f.alpha).cl;
      // Detect the peak actually reached on the slow entry, not the later UI stall flag.
      if(!peak || cl>peak.liftCoefficient || f.stalled) {
        const q=.5*airDensity(priorAltitude)*priorTas**2;
        const event:Event={
          timeS:f.time, heightM:f.y, keas:newKeas, ktas:f.speed*KNOTS_PER_MPS,
          angleOfAttackDeg:f.alpha*deg, pathDeg:f.gamma*deg, liftCoefficient:cl,
          loadFactor:q*SURVEY_AIRFRAME.areaM2*cl/(reference.massKg*SURVEY_AIRFRAME.gravity),
          approachRateKtPerS:oneSecondAgo-newKeas,
        };
        if(!peak || cl>peak.liftCoefficient) peak=event;
        if(f.stalled) separation=event;
      }
    }
    if(separation) {
      minimumKeas=Math.min(minimumKeas,newKeas);
      if(!f.stalled && firstClearS===undefined) firstClearS=f.time-separation.timeS;
      if(orderedRecovery && !f.stalled && Math.abs(newKeas-78)<.5 && f.vertical < -2.5 && f.vertical > -4.3)
        stableCount++;
      else stableCount=0;
      if(stableCount>=stableTicks && firstClearS!==undefined && peak) {
        return {
          conditions:{...reference,thrust:'zero',flaps:'clean',roll:0,yaw:0,initialHeightM:1450,
            targetApproachRateKtPerS:.75,settlingSeconds:85,fixedStepS:dt},
          maximumLiftCoefficient:peak, separationFlag:separation, elapsedBetweenEventsS:separation.timeS-peak.timeS,
          recovery:{firstClearS, minimumKeas, finalKeas:newKeas, finalSinkMps:-f.vertical,
            secondsToSettledGlide:f.time-separation.timeS, heightLostToSettledGlideM:separation.heightM-f.y,
            settledForS:stableCount*dt},
        };
      }
    }
  }
  throw new Error('Did not complete separation and return to a sustained glide');
}

if(process.argv[1] && pathToFileURL(process.argv[1]).href===import.meta.url)
  console.log(JSON.stringify(stallTrial(),null,2));
