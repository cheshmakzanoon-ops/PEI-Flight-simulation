import {PROPELLER} from './propeller-spec.ts';
/**
 * Passive propeller approximation for an explicit engine-failure scenario ONLY.
 * The 79-in disk is the reference 182T NAV III's published diameter. Advance
 * ratio, backdrive torque and low-speed engagement are simulator assumptions,
 * not measured prop data. See docs/qa/ENGINE-OUT.md for calibration and limits.
 */
const DIAMETER_M = PROPELLER.diameterM;
const DISK_AREA_M2 = Math.PI * DIAMETER_M ** 2 / 4;
const ADVANCE_RATIO = .90;
const EFFECTIVE_BACKDRIVE_TORQUE_NM = 130;
const MAX_OMEGA = 2400 * Math.PI / 30;
const MAX_AIR_POWER_FRACTION = .42;

/** Quasi-steady rotation; no fuel power, feathering system, spool inertia or restart dynamics. */
export function windmillOmegaRadS(tasMps:number):number {
  const t=Math.max(0,Math.min(1,(tasMps-3)/12));
  return Math.min(MAX_OMEGA, 2*Math.PI*Math.max(tasMps,0)/(ADVANCE_RATIO*DIAMETER_M))*t*t*(3-2*t);
}

/** Resistive force (N). Power removed is always <= 42% of the moving air's q*A*V. */
export function windmillDragN(tasMps:number, dynamicPressurePa:number):number {
  if(tasMps<=0 || dynamicPressurePa<=0) return 0;
  const lossWatts=EFFECTIVE_BACKDRIVE_TORQUE_NM*windmillOmegaRadS(tasMps);
  return Math.min(lossWatts/tasMps, MAX_AIR_POWER_FRACTION*DISK_AREA_M2*dynamicPressurePa);
}
