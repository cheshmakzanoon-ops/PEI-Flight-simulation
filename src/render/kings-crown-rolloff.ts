import type {BufferAttribute} from 'three';
import {GROUND_LIFT,SURVEY_LOD,type CoastalGrid} from '../sim/coastal-terrain.ts';

export const KINGS_CROWN_FULL_M=4500,KINGS_CROWN_ZERO_M=5200;
/** Both ends lie strictly inside the original N112 owner range. */
export function kingsCrownBlendForDistance(distance:number){
 if(!Number.isFinite(distance)||distance>=KINGS_CROWN_ZERO_M)return 0;
 if(distance<=KINGS_CROWN_FULL_M)return 1;
 const t=(KINGS_CROWN_ZERO_M-distance)/(KINGS_CROWN_ZERO_M-KINGS_CROWN_FULL_M);
 return t*t*(3-2*t);
}

/** One retained position buffer: blend the real, raycastable fine surface
 * during approach. Neither the original N112 object nor any coarser object
 * is re-tessellated or augmented. The rest of the tile never receives writes. */
export class KingsCrownMorph {
 readonly strength={value:1};
 private readonly positions:BufferAttribute;
 private readonly moved:Uint16Array;
 private readonly parent:Float32Array;
 private readonly measured:Float32Array;
 constructor(positions:BufferAttribute,grid:CoastalGrid){
  const start=(SURVEY_LOD+1)**2, count=grid.nx*grid.nz;
  if(!grid.relativeSamples||positions.count!==start+count||positions.itemSize!==3||positions.count>65535)
   throw Error('Crown taper requires the original indexed N112 grid');
  this.positions=positions;
  const moved:number[]=[],parent:number[]=[],measured:number[]=[];
  for(let k=0;k<count;k++){
   if(!grid.relativeSamples[k])continue;
   const x=grid.x0+(k%grid.nx)*grid.stepX,z=grid.z0+Math.floor(k/grid.nx)*grid.stepZ;
   moved.push(start+k);parent.push(grid.parentHeight(x,z)+GROUND_LIFT);measured.push(positions.getY(start+k));
  }
  if(!moved.length)throw Error('Crown has no moved support');
  this.moved=Uint16Array.from(moved);this.parent=Float32Array.from(parent);this.measured=Float32Array.from(measured);
 }
 get movedCount(){return this.moved.length;}
 set(gain:number){
  if(gain===this.strength.value)return;
  const p=this.positions,inds=this.moved,a=this.parent,b=this.measured;
  for(let j=0;j<inds.length;j++)p.setY(inds[j],gain===1?b[j]:a[j]+(b[j]-a[j])*gain);
  p.addUpdateRange(inds[0]*3,(inds[inds.length-1]-inds[0]+1)*3);
  p.needsUpdate=true;this.strength.value=gain;
 }
}
