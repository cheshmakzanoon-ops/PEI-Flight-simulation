import type {Cover} from '../sim/cover.ts';
import type {ShoreSegment} from '../sim/shoreline.ts';
import {OCEAN_Y,type Terrain} from '../sim/terrain.ts';

type XY={x:number;z:number};
export type ReviewBounds=readonly [number,number,number,number];
export function montagueShoreReview(cover:Cover,terrain:Terrain){
 const cells=cover.montague?.plan.contourReviewCells;if(!cells?.length)return;
 const dx=(terrain.right-terrain.left)/cover.width,dz=(terrain.bottom-terrain.top)/cover.height;
 const allowed=new Set(cells.map(([i,j])=>j*cover.width+i));
 const bounds=[
  terrain.left+(Math.min(...cells.map(p=>p[0]))+.5)*dx,
  terrain.top+(Math.min(...cells.map(p=>p[1]))+.5)*dz,
  terrain.left+(Math.max(...cells.map(p=>p[0]))+1.5)*dx,
  terrain.top+(Math.max(...cells.map(p=>p[1]))+1.5)*dz,
 ] as const;
 const includes=({ax,az,bx,bz}:ShoreSegment)=>{
  const i=Math.floor(((ax+bx)*.5-terrain.left)/dx-.5);
  const j=Math.floor(((az+bz)*.5-terrain.top)/dz-.5);
  return allowed.has(j*cover.width+i);
 };
 return {bounds,includes};
}
/** Close a visibility hole, without changing the signed X/Z contour or
 * either depth source. The actual active terrain (including mixed LOD
 * seams) bounds the top. Only the five known review cells use this path. */
export function seatedMontagueCurtain(segments:readonly ShoreSegment[],renderedGround:(x:number,z:number)=>number){
 type Row=XY&{bottom:number;top:number};
 const p:number[]=[];
 function at(x:number,z:number):Row{
  const h=renderedGround(x,z);
  return {x,z,top:Math.max(h,OCEAN_Y)+.095,bottom:Math.min(h,OCEAN_Y)-.095};
 }
 for(const e of segments){
  const dx=e.bx-e.ax,dz=e.bz-e.az,n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.42));
  let a=at(e.ax,e.az);
  for(let k=1;k<=n;k++){
   const u=k/n,b=at(e.ax+u*dx,e.az+u*dz);
   p.push(a.x,a.bottom,a.z,b.x,b.bottom,b.z,a.x,a.top,a.z,
    a.x,a.top,a.z,b.x,b.bottom,b.z,b.x,b.top,b.z);
   a=b;
  }
 }
 return Float32Array.from(p);
}
