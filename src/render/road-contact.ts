import {MONTAGUE_GROUND_ID} from '../sim/montague-bridge.ts';
import {splitWalkCap} from './sidewalks.ts';
import {RUNWAYS} from '../sim/places.ts';
import {facet,GROUND_LIFT,SURVEY_LOD,WORLD_COLS,WORLD_ROWS} from '../sim/coastal-terrain.ts';
import type {Terrain} from '../sim/terrain.ts';
import type {World} from './world.ts';

export const ROAD_CONTACT_LIFT=.062;
type RoadVertex={x:number;z:number;u:number;v:number}; // u: signed edge code; v: inherited road elevation
type Grid={x0:number;z0:number;dx:number;dz:number};
export type RoadSeat={wearingLift:number;floor:(x:number,z:number)=>number;weight:(x:number,z:number)=>number};
const unit=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(a:number)=>{const u=unit(a);return u*u*(3-2*u);};
const twice=(a:RoadVertex,b:RoadVertex,c:RoadVertex)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);

/** Split each original ribbon triangle on all three inherited terrain facet
 * families. The original diagonal, coverage, vertex-color edge and world phase
 * remain represented. New vertices store exact old Y and one signed seat delta. */
export function seatRibbon(triangle:readonly [RoadVertex,RoadVertex,RoadVertex],g:Grid,seat:RoadSeat,
 emit:(p:RoadVertex,delta:number)=>void){
 for(const face of splitWalkCap([...triangle],g))for(let i=1;i+1<face.length;i++){
  const cells=[face[0],face[i],face[i+1]];
  if(Math.abs(twice(cells[0],cells[1],cells[2]))<1e-9)continue;
  for(const p of cells){
   const w=seat.weight(p.x,p.z);
   const y=w?(seat.floor(p.x,p.z)+seat.wearingLift-p.v)*w:0;
   emit(p,Number.isFinite(y)?y:0);
  }
 }
}

interface Rect{left:number;right:number;top:number;bottom:number;}
function arc(r:Rect,x:number,z:number){
 return Math.hypot(Math.max(0,r.left-x,x-r.right),Math.max(0,r.top-z,z-r.bottom));
}
/** Stable regular near lattice. The shader fades to zero by 900 m of
 * camera XZ, where the renderer necessarily uses unsnapped n112 on both
 * sides of any seam. Baked variants need no rebuild on distant LOD churn. */
export function regularRoadGround(t:Terrain){
 const w=(t.right-t.left)/WORLD_COLS,d=(t.bottom-t.top)/WORLD_ROWS,n=SURVEY_LOD;
 const xAxis=Float32Array.from({length:n+1},(_,i)=>i*(w/n)-w/2);
 const zAxis=Float32Array.from({length:n+1},(_,i)=>i*(d/n)-d/2);
 const rows=new Map<number,Float32Array>(),step=n+1;
 return (x:number,z:number)=>{
  const a=(x-t.left)/w,b=(z-t.top)/d;
  if(a<0||b<0||a>=WORLD_COLS||b>=WORLD_ROWS)return t.atlasElevation(x,z)+GROUND_LIFT;
  const i=Math.floor(a),j=Math.floor(b),key=j*WORLD_COLS+i;
  let r=rows.get(key);
  if(!r){
   r=new Float32Array(step*step);r.fill(NaN);
   if(rows.size>=12)rows.delete(rows.keys().next().value!);
   rows.set(key,r);
  }
  const cx=t.left+w*i+w/2,cz=t.top+d*j+d/2,rx=x-cx,rz=z-cz;
  const cell=(axis:Float32Array,local:number,q:number)=>{
   let k=Math.min(n-1,Math.max(0,Math.floor(q*n)));
   if(local<axis[k]&&k>0)k--;
   if(local>axis[k+1]&&k<n-1)k++;
   return k;
  };
  const ix=cell(xAxis,rx,a-i),iz=cell(zAxis,rz,b-j);
  const tx=unit((rx-xAxis[ix])/(xAxis[ix+1]-xAxis[ix])),tz=unit((rz-zAxis[iz])/(zAxis[iz+1]-zAxis[iz]));
  const q=r;
  const at=(i:number,j:number)=>{
   const s=j*step+i,v=q[s];
   if(Number.isFinite(v))return v;
   return q[s]=Math.fround(t.atlasElevation(cx+xAxis[i],cz+zAxis[j])+GROUND_LIFT);
  };
  return facet(tx,tz,at(ix,iz),at(ix+1,iz),at(ix,iz+1),at(ix+1,iz+1));
 };
}
export function roadContactAt(w:World){
 const {terrain:t,cover}=w,dx=(t.right-t.left)/WORLD_COLS,dz=(t.bottom-t.top)/WORLD_ROWS;
 // Existing surveyed inserts keep their already reviewed separate grades.
 // Distance to a conservative whole tile protects their shoulders as well.
 const blocked:Rect[]=t.surveyGrids.map(a=>{
  const g=a.spec;
  if(g.id===MONTAGUE_GROUND_ID){
   // Only the actual registered insert and the neighbouring sewn faces
   // need guarding here; the rest of the ordinary road tile still seats.
   const x=a.stepX*g.sub,z=a.stepZ*g.sub;
   return {left:a.x0-x,right:a.x1+x,top:a.z0-z,bottom:a.z1+z};
  }
  return {left:t.left+dx*g.tileX,right:t.left+dx*(g.tileX+1),top:t.top+dz*g.tileZ,bottom:t.top+dz*(g.tileZ+1)};
 });
 // Extra room keeps interpolated ramps away from the painted runway strips.
 for(const r of RUNWAYS){
  const pad=r.width+18;
  blocked.push({left:Math.min(r.p.x,r.q.x)-pad,right:Math.max(r.p.x,r.q.x)+pad,
    top:Math.min(r.p.z,r.q.z)-pad,bottom:Math.max(r.p.z,r.q.z)+pad});
 }
 const weight=(x:number,z:number)=>{
  const land=smooth((cover.distance(t,x,z)-45)/65);
  if(!land)return 0;
  let f=land;
  for(const r of blocked){f=Math.min(f,smooth(arc(r,x,z)/105));if(!f)return 0;}
  return f;
 };
 return {wearingLift:ROAD_CONTACT_LIFT,floor:regularRoadGround(t),weight};
}
