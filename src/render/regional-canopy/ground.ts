import type {Terrain} from '../../sim/terrain.ts';
import type {Cover} from '../../sim/cover.ts';
import {canopyEnvelope,REGIONAL_SOURCE} from './spec.ts';
/** Guard the already installed base; no optional atlas load or modified DEM. */
export function regionalBase(terrain:Terrain,cover:Cover,terrainSha:string|undefined){
 const {width,height,bounds}=terrain.spec;
 return !!globalThis.crypto?.subtle&&terrainSha===REGIONAL_SOURCE.terrain&&cover.sourceSha===REGIONAL_SOURCE.cover&&
  width===4096&&height===2720&&cover.width===width&&cover.height===height&&
  bounds.length===4&&[-64.47,45.94,-61.93,47.10].every((v,i)=>bounds[i]===v);
}
export function regionalLayers(road:string|undefined,structures:string|undefined,walk:string|undefined,parking:string|undefined){
 const p=REGIONAL_SOURCE;return road===p.road&&structures===p.structures&&walk===p.sidewalk&&parking===p.parking;
}
/** Cover uses the same sample cells as stocked woodland .sample(); Cover's coast
 * field remains untouched. Every cell square touched by even the maximum grazing
 * plane radius, plus 1.5m, must be forest and native land. */
export function regionalForestSeat(terrain:Terrain,cover:Cover,x:number,z:number,h:number,w:number){
 const d=canopyEnvelope(h,w),[u,v]=terrain.uv(x-d,z-d),[s,t]=terrain.uv(x+d,z+d);
 const c0=Math.floor(u*cover.width),r0=Math.floor(v*cover.height),c1=Math.floor(s*cover.width),r1=Math.floor(t*cover.height);
 if(c0<0||r0<0||c1>=cover.width||r1>=cover.height||c1-c0>3||r1-r0>3)return false;
 for(let j=r0;j<=r1;j++)for(let i=c0;i<=c1;i++){
  const a=j*cover.width+i;
  if(cover.bytes[a*2]!==10||cover.bytes[a*2+1]<194||terrain.samples[a]===-32768)return false;
 }
 // Bound the separate center-bilinear coast role as well, not only the nearest class.
 return cover.distance(terrain,x-d,z-d)>=125&&cover.distance(terrain,x+d,z-d)>=125&&
  cover.distance(terrain,x-d,z+d)>=125&&cover.distance(terrain,x+d,z+d)>=125&&cover.distance(terrain,x,z)>=125;
}
