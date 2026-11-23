import { project, clamp } from './geo.ts';

/**
 * Statistics Canada National Road Network, PEI 22_1 / NB 15_0, OGL-Canada.
 * Centreline geometry selected by STRUNAMEEN=Confederation Bridge from both
 * regional GeoPackages and joined at their shared maritime boundary endpoint.
 * The elevation profile is a render approximation, not engineering survey data.
 */
const COORDS = [
  [-63.8152993, 46.163458],
  [-63.814855, 46.163819],
  [-63.8147682, 46.1638895],
  [-63.8143382, 46.1642395],
  [-63.8141817, 46.1643604],
  [-63.8132458, 46.1651102],
  [-63.8113835, 46.1665826],
  [-63.8096347, 46.1679529],
  [-63.8043954, 46.1719859],
  [-63.7995511, 46.17562],
  [-63.7937945, 46.1798181],
  [-63.7883692, 46.1836897],
  [-63.7820959, 46.1881248],
  [-63.7765403, 46.1920687],
  [-63.7704885, 46.1964335],
  [-63.7647227, 46.2006467],
  [-63.7596325, 46.2043669],
  [-63.7549281, 46.2077995],
  [-63.7537698, 46.2087011],
  [-63.7522988, 46.2098771],
  [-63.7508004, 46.2110938],
  [-63.7494043, 46.2122417],
  [-63.7481536, 46.2132855],
  [-63.7469725, 46.2142813],
  [-63.7457661, 46.2153102],
  [-63.7445526, 46.2163603],
  [-63.7429414, 46.2177723],
  [-63.7411585, 46.2193529],
  [-63.7382895, 46.2218935],
  [-63.7364032, 46.2235673],
  [-63.7268978, 46.2319904],
  [-63.7217181, 46.2365835],
  [-63.7181161, 46.2397755],
  [-63.7166906, 46.2410376],
  [-63.714092, 46.2433398],
  [-63.7139678, 46.2434482],
  [-63.7130897, 46.2442273],
  [-63.7117724, 46.245396],
  [-63.7100321, 46.2469446],
  [-63.7091865, 46.2476975],
  [-63.7068025, 46.249827],
  [-63.7064474, 46.2501456],
  [-63.7052046, 46.251256],
] as const;
const POINTS = COORDS.map(([lon,lat])=>project(lon,lat));
const distances = [0];
for(let i=1;i<POINTS.length;i++) {
  const a=POINTS[i-1],b=POINTS[i];
  distances.push(distances[i-1]+Math.hypot(b.x-a.x,b.z-a.z));
}
export const BRIDGE_LENGTH = distances.at(-1)!;
const channel=project(-63.7521722,46.2099778);
function closest(x:number,z:number) {
  let nearest=Infinity, along=0;
  for(let i=1;i<POINTS.length;i++) {
    const a=POINTS[i-1],b=POINTS[i],vx=b.x-a.x,vz=b.z-a.z;
    const t=clamp(((x-a.x)*vx+(z-a.z)*vz)/(vx*vx+vz*vz),0,1);
    const r=(x-a.x-t*vx)**2+(z-a.z-t*vz)**2;
    if(r<nearest){nearest=r;along=distances[i-1]+t*(distances[i]-distances[i-1]);}
  }
  return {distance:Math.sqrt(nearest),along};
}
export const NAV_SPAN=closest(channel.x,channel.z).along;
const ease=(t:number)=>{t=clamp(t,0,1);return t*t*(3-2*t);};
export function bridgeAt(s:number) {
  const d=clamp(s,0,BRIDGE_LENGTH);
  let i=1;
  while(i<distances.length-1 && distances[i]<d) i++;
  const a=POINTS[i-1],b=POINTS[i],len=distances[i]-distances[i-1];
  const f=(d-distances[i-1])/len,dx=(b.x-a.x)/len,dz=(b.z-a.z)/len;
  const start=ease(d/740),end=ease((BRIDGE_LENGTH-d)/630);
  return {x:a.x+f*(b.x-a.x),y:9+31*start*end+20*Math.exp(-((d-NAV_SPAN)**2)/(2*560**2)),z:a.z+f*(b.z-a.z),dx,dz};
}
export function isConfederationBridge(x:number,z:number) {
  if(x < POINTS[0].x-50 || x > POINTS.at(-1)!.x+50) return false;
  if(z > POINTS[0].z+50 || z < POINTS.at(-1)!.z-50) return false;
  return closest(x,z).distance < 22;
}

// Transport Canada TP 13681 §§3 and 7. The remaining main supports are
// interpolated, or stepped by the nominal 250 m to the first PEI main support.
const dms = (d:number,m:number,s:number) => d+m/60+s/3600;
const controls = [
  [44,-dms(63,48,9.02),dms(46,10,24.23)], [43,-dms(63,48,1.09),dms(46,10,30.16)],
  [42,-dms(63,47,53.11),dms(46,10,36.07)], [22,-dms(63,45,11.62),dms(46,12,32.85)],
  [21,-dms(63,45,4.02),dms(46,12,38.99)], [5,-dms(63,43,8.16),dms(46,14,20.54)],
  [4,-dms(63,43,0.96),dms(46,14,26.92)], [3,-dms(63,42,53.76),dms(46,14,33.29)],
] as const;
const mainStations=controls.map(([id,lon,lat])=>{
  const p=project(lon,lat);return {id,s:closest(p.x,p.z).along};
});

export interface BridgeSupport {
  readonly id: string;
  readonly section: 'main'|'approach';
  readonly station: number;
}
const mainSupports=Array.from({length:44},(_,index):BridgeSupport=>{
  const n=44-index;
  const i=mainStations.findIndex(p=>p.id<=n);
  const b=mainStations[i], a=mainStations[i-1];
  const station=!b?mainStations.at(-1)!.s+(3-n)*250:
    !a||b.id===n?b.s:a.s+(b.s-a.s)*(a.id-n)/(a.id-b.id);
  return {id:'P'+n, section:'main', station};
});
const first=mainSupports[0].station,last=mainSupports.at(-1)!.station;
// Public sources give 165–170 m transitions and 93 m typical end spans.
// Exact approach support surveys are not available. Keep the 14/7 published
// split, and distribute the approximate approach stations within the modeled ends.
const WEST_TRANSITION=first-168, EAST_TRANSITION=last+168;
export const BRIDGE_SUPPORTS: readonly BridgeSupport[] = [
  ...Array.from({length:14},(_,i):BridgeSupport=>({id:'W'+(i+1),section:'approach',station:WEST_TRANSITION-(13-i)*93})),
  ...mainSupports,
  ...Array.from({length:7},(_,i):BridgeSupport=>({id:'E'+(7-i),section:'approach',station:EAST_TRANSITION+i*(BRIDGE_LENGTH-8-EAST_TRANSITION)/6})),
];

/** Visual girder underside; not a deck survey or a marine clearance model. */
export function bridgeGirderDepth(s:number) {
  if(s<=WEST_TRANSITION||s>=EAST_TRANSITION) return 3.3;
  if(s<first) return 3.3+10.7*ease((s-WEST_TRANSITION)/(first-WEST_TRANSITION));
  if(s>last) return 3.3+10.7*ease((EAST_TRANSITION-s)/(EAST_TRANSITION-last));
  let lo=0,hi=mainSupports.length-1;
  while(hi-lo>1) {
    const mid=(lo+hi)>>1;
    if(mainSupports[mid].station<=s)lo=mid;else hi=mid;
  }
  const a=mainSupports[lo].station,b=mainSupports[hi].station;
  const distanceToPier=Math.min(s-a,b-s);
  // The 55/60 m center sections are much shallower than the pier shoulders.
  const shoulder=Math.max(0,1-distanceToPier/((b-a)/2-28.75));
  return 4.5+9.5*shoulder**2;
}
