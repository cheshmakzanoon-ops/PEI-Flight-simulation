import {SEA_LEVEL_DENSITY} from './aerodynamics.ts';
import {PROPELLER} from './propeller-spec.ts';

const RATED_SHAFT_W=230*745.6998716;
const AREA=Math.PI*(PROPELLER.diameterM*.5)**2;
const FRICTION_FRACTION=.12;
const STATIC_LIMIT_N=3600;
const clamp01=(v:number)=>Math.max(0,Math.min(1,v));

/** Simplified non-turbo power lapse at ISA density. The rating is a shaft-power ceiling. */
export function availableShaftW(density:number,throttle:number){
  const sigma=clamp01(density/SEA_LEVEL_DENSITY);
  return RATED_SHAFT_W*clamp01((sigma-FRICTION_FRACTION)/(1-FRICTION_FRACTION))*clamp01(throttle);
}

/**
 * Low-order propulsive model, not a measured engine map. Solve actuator disk
 * P = 2 rho A * vi * (V + vi)^2 on its positive branch. Retain an empirical
 * static blade-load ceiling and a bounded allowance for non-ideal disk losses.
 */
export function poweredThrustN(tasMps:number,density:number,throttle:number):number {
  const shaft=availableShaftW(density,throttle);
  if(!(shaft>0) || !(density>0)) return 0;
  const v=Math.max(0,tasMps), a=clamp01((v-42)/25);
  const diskPower=shaft*(.78+.10*a*a*(3-2*a));
  const b=diskPower/(2*density*AREA);
  let vi=Math.min(Math.cbrt(b),v>0?b/(v*v):Infinity);
  for(let i=0;i<4;i++) {
    const total=v+vi;
    vi-=(vi*total*total-b)/(total*(v+3*vi));
  }
  const staticLimit=STATIC_LIMIT_N*(density/SEA_LEVEL_DENSITY)*Math.pow(clamp01(throttle),2/3);
  return Math.min(staticLimit,diskPower/(v+vi));
}
