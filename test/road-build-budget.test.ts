import assert from 'node:assert/strict';
import test from 'node:test';
import {advanceRoadBuild,ROAD_BUILD_SLICE_MS} from '../src/render/road-build-budget.ts';

test('one road build resumes in order, without getting early access to half an output',()=>{
 let clock=0;const units:number[]=[];
 function* puzzle(){
  for(let i=0;i<7;i++){units.push(i);clock+=1.6;yield;}
  clock+=.3;return units.slice();
 }
 const gen=puzzle(),samples=[];
 const first=advanceRoadBuild(gen,0,()=>clock);assert.deepEqual(first,{done:false,steps:0});
 let count=0;
 while(count++<10){
  const result=advanceRoadBuild(gen,clock+ROAD_BUILD_SLICE_MS,()=>clock);
  samples.push(result.steps);
  if(result.done){
   assert.deepEqual(result.value,[0,1,2,3,4,5,6]);
   break;
  }
  assert.equal('value' in result,false);
 }
 assert.deepEqual(samples,[3,3,2]);
});

test('work does not start after the deadline; cancellation never publishes a partial tile',()=>{
 let time=0,ended=false,tris=0;
 function* mesh(){
  try{
   for(let i=0;i<99;i++){tris+=3;time+=2.1;yield;}
   throw Error('stale build should not complete');
  }finally{ended=true;}
 }
 const g=mesh();
 const result=advanceRoadBuild(g,time+ROAD_BUILD_SLICE_MS,()=>time);
 assert.deepEqual(result,{done:false,steps:2});assert.equal(tris,6);
 assert.equal(advanceRoadBuild(g,time,()=>time).steps,0);
 g.return(undefined as never);assert.equal(ended,true);
 assert.equal(tris,6);
});

import * as THREE from 'three';
import {RoadFloatChunks,expandRoadBounds,normalizeRoadTriangles} from '../src/render/road-buffer-slices.ts';

test('chunked Float32 writes and phased normals/bounds are byte-exact against the inherited mesh path',()=>{
 const raw=Array.from({length:45_207},(_,i)=>(Math.sin(i/3)*i*.29+Math.cos(i/19))*((i%3===2)?1:.1));
 const stream=new RoadFloatChunks(v=>v/127);
 for(let i=0;i<raw.length;i+=3)stream.push(...raw.slice(i,i+3));
 const prog=stream.finish();
 let slice=prog.next(),n=0;
 while(!slice.done){n++;slice=prog.next();}
 assert.ok(n>=5);
 assert.deepEqual(slice.value,Float32Array.from(raw,v=>v/127));
 const indices=new Float32Array(raw);
 const a=new THREE.BufferGeometry(),b=new THREE.BufferGeometry();
 for(const q of [a,b])q.setAttribute('position',new THREE.BufferAttribute(indices,3));
 const d=Float32Array.from({length:indices.length/3},(_,i)=>Math.sin(i)*1.39);
 a.computeVertexNormals();a.computeBoundingSphere();a.boundingSphere!.radius+=Math.max(...d.map(Math.abs));
 let normalSlices=0;for(const _ of normalizeRoadTriangles(b))normalSlices++;
 let boundSlices=0;for(const _ of expandRoadBounds(b,d))boundSlices++;
 assert.ok(normalSlices>=4&&boundSlices>4);
 const p=(m:THREE.BufferGeometry)=>m.getAttribute('normal').array;
 assert.deepEqual(p(a),p(b));
 assert.deepEqual(a.boundingSphere,b.boundingSphere);
});
