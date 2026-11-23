import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DETAIL_FADE_SECONDS,DETAIL_NEIGHBOURS,DETAIL_NOT_READY,DETAIL_TRANSITION_METRES} from '../src/render/detail-blend.ts';

const step=(v:number)=>{const n=Math.min(1,Math.max(0,v));return n*n*(3-2*n);};

test('mixed and loading detail owners share temporal weights along full seams and corners',()=>{
 // Evaluate the shader's conservative distance rule in common world space,
 // including different arrival clocks for each of the four corner owners.
 const tiles=[[0,0],[1,0],[0,1],[1,1]];
 const size=5400;
 const ready=[.21,99,.29,.37];
 const field=(east:number,south:number,x:number,z:number,t:number)=>{
  const idx=(x:number,z:number)=>tiles.findIndex(([u,v])=>u===x&&v===z);
  const floor=(y:number)=>step((t-y)/DETAIL_FADE_SECONDS);
  const local=ready[idx(east,south)];
  let f=floor(local);
  for(const [dx,dz] of DETAIL_NEIGHBOURS){
   const c=east+dx,r=south+dz,origin=idx(c,r);
   const l=Math.max(c*size-x,0,x-(c+1)*size),m=Math.max(r*size-z,0,z-(r+1)*size);
   const a=step(Math.hypot(l,m)/DETAIL_TRANSITION_METRES),n=floor(origin<0?DETAIL_NOT_READY:ready[origin]);
   f=Math.min(f,n+(1-n)*a);
  }
  return f;
 };
 for(const t of [0,.25,.44,.5,.6,2,100])for(const d of [0,1,19.1,40,71.999,74.1,150,2600]){
  for(const o of [size-d,size+d]){
   const j=o>size?1:0;assert.equal(field(0,j,size,o,t),field(1,j,size,o,t));
   assert.equal(field(j,0,o,size,t),field(j,1,o,size,t));
  }
 }
 assert.equal(field(0,0,size,2500,1),0,'unready neighbour keeps shared line on the base atlas');
 assert.equal(field(0,0,size-100,2500,1),1,'settled tile interior has original detail');
 assert.equal(field(0,0,size,2500,100),1,'full detail returns after both images finish their transition');
});
