import {BASIN_GROUND} from './basin-bank-relief.generated.ts';
import {CoastalGrid,facet,type MeshSurveySource,GROUND_LIFT} from './coastal-terrain.ts';
import {readCoastalPack} from './coastal-packs.ts';
import type {Terrain} from './terrain.ts';

export type NativeBankSource={terrain:MeshSurveySource;weights:Uint8Array};
const side=(n:number)=>n*BASIN_GROUND.sub+1;
const count=side(BASIN_GROUND.cellsX)*side(BASIN_GROUND.cellsZ);
export function loadBasinGround(base:string,fetcher:typeof fetch=fetch,timeoutMs=2000){
 return readCoastalPack(base+BASIN_GROUND.asset,fetcher,timeoutMs,BASIN_GROUND,raw=>{
  if(raw.byteLength!==count*3)return;
  const v=new DataView(raw),samples=Int16Array.from({length:count},(_,i)=>v.getInt16(i*2,true));
  const amount=new Uint8Array(raw,count*2);
  const nx=side(BASIN_GROUND.cellsX),nz=side(BASIN_GROUND.cellsZ);
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
   const k=j*nx+i,w=amount[k];
   if((i===0||j===0||i===nx-1||j===nz-1)&&(w||samples[k]))return;
   if(!w&&samples[k])return;
  }
  return {terrain:{spec:BASIN_GROUND,samples,renderWeights:amount},weights:amount};
 });
}
export class NativeBank {
 readonly grid:CoastalGrid;private readonly weights:Uint8Array;
 constructor(t:Terrain,source:NativeBankSource){
  this.grid=new CoastalGrid(t,source.terrain,(x,z)=>t.atlasElevation(x,z));this.weights=source.weights;
  if(this.weights.length!==this.grid.nx*this.grid.nz)throw Error('Unexpected native bank authority mask dimensions');
 }
 authority(x:number,z:number){
  const g=this.grid;if(!g.inside(x,z))return 0;
  const a=Math.max(0,Math.min(g.nx-1,(x-g.x0)/g.stepX)),b=Math.max(0,Math.min(g.nz-1,(z-g.z0)/g.stepZ));
  const i=Math.min(g.nx-2,Math.floor(a)),j=Math.min(g.nz-2,Math.floor(b)),k=j*g.nx+i,q=this.weights;
  return facet(a-i,b-j,q[k],q[k+1],q[k+g.nx],q[k+g.nx+1])/255;
 }
 touches(x0:number,z0:number,x1:number,z1:number){
  const g=this.grid;
  if(g.x1<x0||g.x0>x1||g.z1<z0||g.z0>z1)return false;
  const ix=Math.max(0,Math.floor((x0-g.x0)/g.stepX)),ex=Math.min(g.nx-1,Math.ceil((x1-g.x0)/g.stepX));
  const iz=Math.max(0,Math.floor((z0-g.z0)/g.stepZ)),ez=Math.min(g.nz-1,Math.ceil((z1-g.z0)/g.stepZ));
  for(let j=iz;j<=ez;j++)for(let i=ix;i<=ex;i++)if(this.weights[j*g.nx+i])return true;
  return false;
 }
 acceptsParent(i:number,j:number){
  const g=this.grid,sub=g.spec.sub;
  const x=i-g.spec.firstX,z=j-g.spec.firstZ;
  if(x<0||x>=g.spec.cellsX||z<0||z>=g.spec.cellsZ)return false;
  for(let b=z*sub;b<=(z+1)*sub;b++)for(let a=x*sub;a<=(x+1)*sub;a++)
   if(this.weights[b*g.nx+a])return true;
  return false;
 }
 height(x:number,z:number,otherwise:number){
  const h=this.authority(x,z);
  if(!h)return otherwise;
  const correction=h*h*(3-2*h);
  // Match the actual visible terrain in the surveyed core. The collar
  // returns smoothly to original collision grade where the survey stops.
  const oldVisual=this.grid.parentHeight(x,z)+GROUND_LIFT;
  const newVisual=this.grid.height(x,z)!+GROUND_LIFT;
  // Delta already contains the authored fade. Taper only the pre-existing
  // difference between visual and gameplay elevation, not the delta again.
  return newVisual+(1-correction)*(otherwise-oldVisual);
 }
}
