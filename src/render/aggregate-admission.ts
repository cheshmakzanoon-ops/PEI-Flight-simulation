import {Triangle,Vector3,MathUtils,type BufferGeometry} from 'three';
import {GRAVEL_KIND} from './aggregate.ts';

export const GRAVEL_PRELOAD_AGL=155;
export const GRAVEL_REQUEST_RANGE=470;
export const GRAVEL_DRAW_AGL=220;
export const GRAVEL_DRAW_RANGE=485;

export type GravelSeatGuard=(x:number,y:number,z:number)=>boolean;
export type GravelEye=Readonly<{x:number;y:number;z:number}>;

/** Closest point on currently submitted *positive registered* road triangles.
 * Mesh generators use tile-local XZ plus their owner translation. Only the
 * two inherited packed formats can enter, and no position/attribute is edited.
 * The optional seated road uses the same per-vertex displacement as its GLSL. */
export function nearestRegisteredGravel(
 g:BufferGeometry,originX:number,originZ:number,eye:GravelEye,limit2:number,
 seatGain=0,onDryFloor?:GravelSeatGuard,
){
 if(g.index||!(limit2>0)||!Number.isFinite(limit2))return Infinity;
 const p=g.getAttribute('position'),s=g.getAttribute('roadSurface');
 if(!p||p.itemSize!==3||!s||s.itemSize!==2||s.count!==p.count||p.count%3)return Infinity;
 const pos=p.array,marker=s.array,wanted=marker instanceof Int8Array&&s.normalized?GRAVEL_KIND:
  marker instanceof Float32Array&&!s.normalized?Math.fround(GRAVEL_KIND/127):undefined;
 if(wanted===undefined||!(pos instanceof Float32Array))return Infinity;
 const rawSeat=seatGain>0?g.getAttribute('roadSeatDelta'):undefined;
 const seat=rawSeat?.itemSize===1&&rawSeat.count===p.count?rawSeat.array:undefined;
 const localEye=new Vector3(eye.x-originX,eye.y,eye.z-originZ);
 const tri=new Triangle(),point=new Vector3();
 let best=limit2,found=false;
 const vertex=(dst:Vector3,j:number)=>{
  const k=j*3,x=pos[k],z=pos[k+2];
  const shift=seat?seat[j]*seatGain*(1-MathUtils.smoothstep(Math.hypot(x-localEye.x,z-localEye.z),350,900)):0;
  dst.set(x,pos[k+1]+shift,z);
 };
 for(let j=0;j<p.count;j+=3){
  if(marker[j*2+1]!==wanted||marker[j*2+3]!==wanted||marker[j*2+5]!==wanted)continue;
  const k=j*3,ax=pos[k],az=pos[k+2],bx=pos[k+3],bz=pos[k+5],cx=pos[k+6],cz=pos[k+8];
  const dx=Math.max(Math.min(ax,bx,cx)-localEye.x,localEye.x-Math.max(ax,bx,cx),0);
  const dz=Math.max(Math.min(az,bz,cz)-localEye.z,localEye.z-Math.max(az,bz,cz),0);
  if(dx*dx+dz*dz>=best)continue;
  vertex(tri.a,j);vertex(tri.b,j+1);vertex(tri.c,j+2);
  tri.closestPointToPoint(localEye,point);
  const dist=point.distanceToSquared(localEye);
  // Conservative with existing half-buried ribbons: if this closest point
  // is not an exposed dry receiver, it is not a request witness.
  if(dist<best&&(!onDryFloor||onDryFloor(point.x+originX,point.y,point.z+originZ))){
   best=dist;found=true;
  }
 }
 return found?best:Infinity;
}
