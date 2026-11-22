import { clamp } from './geo.ts';

// ISA troposphere; geopotential metres, kelvin, pascals and SI mass density.
export const SEA_LEVEL_DENSITY = 101325 / (287.05287 * 288.15);
export function airDensity(altitudeM: number): number {
  const h = clamp(altitudeM, -500, 11_000);
  const theta = 1 - 0.0065 * h / 288.15;
  return SEA_LEVEL_DENSITY * theta ** (9.80665 / (287.05287 * 0.0065) - 1);
}

/** Equivalent airspeed, a low-Mach indicated-air-speed approximation without instrument error. */
export function equivalentAirspeed(trueAirspeed: number, altitudeM: number): number {
  return trueAirspeed * Math.sqrt(airDensity(altitudeM) / SEA_LEVEL_DENSITY);
}

export const POSITIVE_CRITICAL_ALPHA = 0.289;
export const NEGATIVE_CRITICAL_ALPHA = -0.257;
const FADE_WIDTH = 0.032;

function smoothstep(lo: number, hi: number, x: number): number {
  const t = clamp((x - lo) / (hi - lo), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Low-order polar for the fictional survey airframe; not a fit to a real POH. */
export function aerodynamicPolar(alpha: number): {cl: number; cd: number; separated: boolean} {
  const angle = clamp(alpha, -Math.PI / 2, Math.PI / 2);
  const limit = angle >= 0 ? POSITIVE_CRITICAL_ALPHA : -NEGATIVE_CRITICAL_ALPHA;
  const magnitude = Math.abs(angle);
  const blend = smoothstep(limit - FADE_WIDTH, limit + FADE_WIDTH, magnitude);
  const attached = clamp(0.24 + 4.6 * angle, -0.95, 1.50);
  // Blend continuously to a separated, approximately flat-plate response.
  const separatedLift = 1.1 * Math.sin(2 * angle);
  const separatedDrag = 0.055 + 1.8 * Math.sin(angle) ** 2;
  const cl = attached + (separatedLift - attached) * blend;
  const attachedDrag = 0.033 + 0.05 * attached * attached;
  return {cl, cd: attachedDrag + (separatedDrag - attachedDrag) * blend, separated: magnitude > limit};
}
