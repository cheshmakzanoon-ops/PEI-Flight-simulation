import {project} from '../sim/geo.ts';

type Window = readonly [longitude: number, latitude: number, full: number, outer: number];

/** Inspected virtual maritime view envelopes, not a classification of every
 * negative atlas sample. Freshwater may share the inherited negative lake code. */
export const OPEN_WATER_WINDOWS = [
 [-63.7496421,46.1984107,1050,2200], // Northumberland Strait at the crossing
 [-64.146,46.3968,850,1900],       // off Cape Egmont
 [-63.50608,46.546,840,1850],      // north of Cape Tryon
 [-62.451,46.140,900,2000],         // seaward of Panmure Head
] as const satisfies readonly Window[];

const windows=OPEN_WATER_WINDOWS.map(([lon,lat,inner,outer])=>({...project(lon,lat),inner,outer}));
const smooth=(a:number,b:number,x:number)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
export function openWaterRippleEnvelope(x:number,z:number){
 let w=0;
 for(const o of windows)w=Math.max(w,1-smooth(o.inner**2,o.outer**2,(x-o.x)**2+(z-o.z)**2));
 return w;
}
const f=(x:number)=>x.toFixed(8);
export const openWaterRippleGLSL=`
 float offshoreRippleEnvelope(vec2 xy){
  float coverage=0.;
  ${windows.map(({x,z,inner,outer})=>`{
   vec2 d=xy-vec2(${f(x)},${f(z)});
   coverage=max(coverage,1.-smoothstep(${f(inner**2)},${f(outer**2)},dot(d,d)));
  }`).join('\n')}
  return coverage;
 }
`;
