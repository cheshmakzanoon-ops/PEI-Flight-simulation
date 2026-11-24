import assert from 'node:assert/strict';
import {test} from 'node:test';
import {emitRusticoMassing,matchesRusticoMassing} from '../src/render/rustico-neighbour.ts';
import {RUSTICO_NEIGHBOUR as R} from '../src/render/rustico-neighbour.generated.ts';
import {project} from '../src/sim/geo.ts';
test('only the exact historic atlas chunk and ordered Rustico building owner can change',()=>{
 const exact=(fp:readonly (readonly [number,number])[]=R.record.footprint)=>matchesRusticoMassing(R.atlas,R.chunk,R.tile,R.ordinal,fp,R.record.height,R.record.minHeight);
 assert(exact());assert(!exact([...R.record.footprint].reverse()));
 for(const args of [
  ['wrong-atlas',R.chunk,R.tile,R.ordinal],
  [R.atlas,'wrong-chunk',R.tile,R.ordinal],
  [R.atlas,R.chunk,'other-tile',R.ordinal],
  [R.atlas,R.chunk,R.tile,R.ordinal+1],
 ] as const)assert(!matchesRusticoMassing(...args,R.record.footprint,R.record.height,R.record.minHeight));
 assert(!matchesRusticoMassing(R.atlas,R.chunk,R.tile,R.ordinal,R.record.footprint,R.record.height+.001,R.record.minHeight));
 assert(!matchesRusticoMassing(R.atlas,R.chunk,R.tile,R.ordinal,R.record.footprint,R.record.height,R.record.minHeight,[R.record.footprint]));
});
test('all original plan and measured roof volume is emitted without new footprint or coarse y change',()=>{
 const ring=R.record.footprint.map(([x,z])=>project(x,z));
 const x=ring[0].x,z=ring[0].z;
 const plan=Math.abs(ring.reduce((sum,q,i)=>{
  const b=ring[(i+1)%ring.length];return sum+(q.x-x)*(b.z-z)-(q.z-z)*(b.x-x);
 },0))/2;
 let total=0,roofN=0,wallN=0,outer=0;const levels:number[]=[];
 emitRusticoMassing(ring,{
  roof(a,b,c,y){
   const area=Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))*.5;
   assert(area>0&&y.every(Number.isFinite));
   total+=area;roofN++;levels.push(...y);
  },
  wall(a,b,below,hi){
   assert(Math.hypot(a.x-b.x,a.z-b.z)>.01&&hi.every(Number.isFinite));
   if(!below)outer++;
   else assert(below[0]<=hi[0]+.0001&&below[1]<=hi[1]+.0001);
   wallN++;
  },
 });
 assert.equal(roofN+2*wallN,61);assert.equal(outer,15);
 assert(Math.abs(total-plan)<.001,[total,plan]);
 assert(Math.max(...levels)<7.55&&Math.min(...levels)<3.89);
});
