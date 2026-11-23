import {clamp,project} from './geo.ts';
import {MONTAGUE_DECK as spec} from './montague-bridge.generated.ts';
import {MONTAGUE_FOUNDATION as foundation} from './montague-foundation.generated.ts';

export type BridgePoint={x:number;z:number};
type Row={points:readonly BridgePoint[];flags:number};
const hash='72528a1b26b68ee345e5047f30f2c9b49a3c18edeaccaf3e759ead296d3276c1';
// Exact simplified/quantized runtime rows. The replacement uses the eight
// individually pinned NRN source vertices, not this three-vertex chord.
const oldRows=[
 [15171,27,[[-62.64825,46.16413],[-62.64797,46.16393],[-62.64766,46.16378]]],
 [15316,11,[[-62.64856,46.16448],[-62.64825,46.16413]]],
 [15263,11,[[-62.64766,46.16378],[-62.64736,46.16369]]],
] as const;
export const MONTAGUE_CUTS=oldRows.map(([id])=>id);
export const MONTAGUE_GROUND_ID=foundation.ground.id;
function packed(lon:number,lat:number){
 return project(Math.round((lon+65)*1e5)/1e5-65,Math.round((lat-45)*1e5)/1e5+45);
}
const controls=oldRows.map(([id,flags,xy])=>({id,flags,points:xy.map(([lon,lat])=>packed(lon,lat))}));
export function montagueBridgeRows(digest:string|undefined,roads:readonly Row[]){
 return digest===hash&&controls.every(({id,flags,points})=>roads[id]?.flags===flags&&roads[id].points.length===points.length&&
  roads[id].points.every(({x,z},i)=>x===points[i].x&&z===points[i].z));
}
const output=spec.nativeAxis.map(([x,z])=>project(x,z));
const S=spec.nativeStations;
export const BRIDGE_START=0,BRIDGE_STOP=spec.sourceGrade,APPROACH_START=S[0],APPROACH_STOP=S[14];
type Section=Readonly<{x:number;z:number;nx:number;nz:number}>;
function smooth(a:number,b:number,x:number){
 const k=clamp((x-a)/(b-a),0,1);return k*k*(3.-2.*k);
}
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
function direction(a:BridgePoint,b:BridgePoint){
 const dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz);
 return {nx:dz/l,nz:-dx/l};
}
const normals=output.map((p,i)=>direction(output[Math.max(0,i-1)],output[Math.min(i+1,output.length-1)]));
const ends=[controls[1].points,controls[2].points];
const leftEndNormal=direction(...ends[0] as [BridgePoint,BridgePoint]);
const rightEndNormal=direction(...ends[1] as [BridgePoint,BridgePoint]);
export const MONTAGUE_PIER=spec.pier;
export const BRIDGE_STATIONS=S.filter(s=>s>=APPROACH_START&&s<=APPROACH_STOP);
export function montagueSection(ss:number):Section{
 const s=clamp(ss,APPROACH_START,APPROACH_STOP);
 let i=0;while(i+1<S.length-1&&S[i+1]<s)i++;
 const w=clamp((s-S[i])/(S[i+1]-S[i]),0,1);
 let x=mix(output[i].x,output[i+1].x,w),z=mix(output[i].z,output[i+1].z,w);
 let nx=mix(normals[i].nx,normals[i+1].nx,w),nz=mix(normals[i].nz,normals[i+1].nz,w);
 // Exact same geometry and crossline at the handoff to an unchanged NRN tile.
 const m0=1.-smooth(0,11,s-APPROACH_START),m1=1.-smooth(0,11,APPROACH_STOP-s);
 if(m0>0){
  const p=clamp((s-APPROACH_START)/(-APPROACH_START),0,1);
  x=mix(x,mix(ends[0][0].x,ends[0][1].x,p),m0);z=mix(z,mix(ends[0][0].z,ends[0][1].z,p),m0);
  nx=mix(nx,leftEndNormal.nx,m0);nz=mix(nz,leftEndNormal.nz,m0);
 }else if(m1>0){
  const p=clamp((s-BRIDGE_STOP)/(APPROACH_STOP-BRIDGE_STOP),0,1);
  x=mix(x,mix(ends[1][0].x,ends[1][1].x,p),m1);z=mix(z,mix(ends[1][0].z,ends[1][1].z,p),m1);
  nx=mix(nx,rightEndNormal.nx,m1);nz=mix(nz,rightEndNormal.nz,m1);
 }
 const n=Math.hypot(nx,nz);
 return {x,z,nx:nx/n,nz:nz/n};
}
type Ladder=readonly (readonly [number,number])[];
function lookup(q:number,p:Ladder){
 if(q<=p[0][0])return p[0][1];
 for(let i=1;i<p.length;i++)if(q<=p[i][0]){
  const [a,y]=p[i-1],[b,z]=p[i];
  return mix(y,z,(q-a)/(b-a));
 }
 return p[p.length-1][1];
}
export const BRIDGE_CROSS=spec.cross.map(([d])=>d);
export function measuredDeck(s:number,d:number){
 const t=clamp(s,0,BRIDGE_STOP)/BRIDGE_STOP-.5;
 return lookup(d,spec.cross)+t*(spec.angles[0]+t*(spec.angles[1]+t*spec.angles[2]));
}
const n0=spec.approach.filter(([s])=>s<0),n1=spec.approach.filter(([s])=>s>BRIDGE_STOP);
export function approachDelta(s:number){
 if(s<0)return (lookup(s,n0)-lookup(0,n0))*smooth(0,4,-s);
 if(s>BRIDGE_STOP)return (lookup(s,n1)-lookup(BRIDGE_STOP,n1))*smooth(0,4,s-BRIDGE_STOP);
 return 0;
}
const walkNodes=spec.walks.map(w=>[w.filter(([s])=>s<=0),w.filter(([s])=>s>=60)] as const);
export function walkDelta(s:number,side:number){
 if(s>=0&&s<=BRIDGE_STOP)return 0;
 const before=s<0,r=walkNodes[side<0?0:1][before?0:1];
 const base=before?0:BRIDGE_STOP;
 return (lookup(s,r)-lookup(base,r))*smooth(0,4,Math.abs(s-base));
}
export function transitionWeight(s:number){
 return smooth(0,9,s-APPROACH_START)*smooth(0,9,APPROACH_STOP-s);
}
export function roadEdges(s:number){
 const d=s<0?-s:Math.max(0,s-BRIDGE_STOP);
 const f=smooth(0,17,d);
 return [mix(-4.10,-4.8,f),mix(4.85,4.8,f)] as const;
}
