import { clamp } from '../sim/geo.ts';

export interface Dial {
  title: string; unit: string; min: number; max: number; major: number; minor: number; arc: number; cyclic?: boolean;
  display?: (value: number) => string;
}

export const DIALS: readonly Dial[] = [
  {title:'AIRSPEED',unit:'KNOTS',min:0,max:180,major:30,minor:5,arc:Math.PI*1.5},
  {title:'ALTITUDE',unit:'FEET × 100',min:0,max:1000,major:100,minor:20,arc:Math.PI*2,cyclic:true,display:v=>String(v/100)},
  {title:'POWER',unit:'PERCENT',min:0,max:100,major:20,minor:5,arc:Math.PI*1.5},
  {title:'VERT SPEED',unit:'FT/MIN × 1000',min:-2000,max:2000,major:1000,minor:200,arc:Math.PI*1.5,display:v=>String(v/1000)},
];

/** Angle clockwise from the 12 o'clock mark, shared by dial ticks and pointer. */
export function dialAngle(dial: Dial, value: number): number {
  const f=(value-dial.min)/(dial.max-dial.min);
  return (dial.cyclic ? f-Math.floor(f) : clamp(f,0,1)-.5)*dial.arc;
}
