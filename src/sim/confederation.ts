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
