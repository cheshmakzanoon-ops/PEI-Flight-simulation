import { project } from './geo.ts';

/** Canadian light-station positions (WGS84). Height of structure, not focal height. */
export const LIGHT_STATIONS = {
  east: {lon: -61.9718333333, lat: 46.4525277778, height: 19.5, name: 'East Point Light Station'},
  west: {lon: -64.3867500000, lat: 46.6203055556, height: 20.6248, name: 'West Point Light Station'}
} as const;

// Three outlines, and only these three, are replaced. These are the unclosed NRCan
// 2020 roof rings already present in world/buildings (q1333, q200), not property lines.
const outlines: [number, number][][] = [
  [[-61.971863,46.452559],[-61.971820,46.452568],[-61.971792,46.452555],[-61.971782,46.452523],[-61.971795,46.452511],[-61.971842,46.452506],[-61.971878,46.452533]],
  [[-61.971690,46.452607],[-61.971688,46.452602],[-61.971669,46.452604],[-61.971671,46.452611],[-61.971559,46.452636],[-61.971555,46.452627],[-61.971522,46.452635],[-61.971509,46.452601],[-61.971477,46.452607],[-61.971463,46.452577],[-61.971721,46.452521],[-61.971753,46.452596]],
  [[-64.386896,46.620543],[-64.386911,46.620561],[-64.386827,46.620592],[-64.386815,46.620577],[-64.386833,46.620570],[-64.386785,46.620509],[-64.386734,46.620528],[-64.386675,46.620454],[-64.386632,46.620470],[-64.386602,46.620437],[-64.386637,46.620422],[-64.386560,46.620339],[-64.386748,46.620271],[-64.386951,46.620521]]
];
const bounds = outlines.map(outline => {
  const ring = outline.map(([lon,lat])=>project(lon,lat));
  const xs = ring.map(p=>p.x), zs = ring.map(p=>p.z);
  return {ring, x0:Math.min(...xs),x1:Math.max(...xs),z0:Math.min(...zs),z1:Math.max(...zs)};
});

/** Exact fingerprint in shipped source precision. No neighborhood centroid deletion. */
export function replacesLightBuilding(ring: readonly (readonly [number,number])[]) {
  return outlines.some(r=>r.length===ring.length && r[0][0]===ring[0][0] && r[0][1]===ring[0][1]
    && r.every(([x,y],i)=>ring[i][0]===x && ring[i][1]===y));
}

/** Exclude only trees whose crown intersects a replacement building or the lighthouse
 * itself (the West NRCan outline merges the tower and inn and simplifies some corners).
 * Keep the rest of the woodland intact. Called when generating a vegetation tile. */
const towerCenters = Object.values(LIGHT_STATIONS).map(s=>project(s.lon,s.lat));
export function insideLighthouseYard(x:number,z:number,crownRadius=0) {
  for(const t of towerCenters) {
    if(Math.abs(x-t.x)<4.7+crownRadius && Math.abs(z-t.z)<4.7+crownRadius
       && (x-t.x)**2+(z-t.z)**2<(4.7+crownRadius)**2)return true;
  }
  for(const b of bounds){
    if(x<b.x0-crownRadius || x>b.x1+crownRadius || z<b.z0-crownRadius || z>b.z1+crownRadius)continue;
    let inside=false;
    for(let i=0,j=b.ring.length-1;i<b.ring.length;j=i++){
      const a=b.ring[j],c=b.ring[i],dx=c.x-a.x,dz=c.z-a.z;
      if((a.z>z)!==(c.z>z) && x<(c.x-a.x)*(z-a.z)/(c.z-a.z)+a.x)inside=!inside;
      if(crownRadius>0) {
        const k=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));
        if((x-a.x-k*dx)**2+(z-a.z-k*dz)**2<crownRadius**2)return true;
      }
    }
    if(inside)return true;
  }
  return false;
}
