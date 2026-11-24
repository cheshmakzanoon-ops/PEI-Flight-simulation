import assert from 'node:assert/strict';
import {test} from 'node:test';
import {northCapeAtlas,northCapeMode,NorthCapeStream,NORTH_CAPE_COVER_SHA,NORTH_CAPE_TERRAIN_SHA} from '../src/render/north-cape-stream.ts';

import {sceneryOptions} from '../src/app/scenery-profile.ts';
const tick=()=>new Promise<void>(done=>setImmediate(done));
const eye=(x=0,y=120,z=0)=>({x,y,z});

test('ordinary North Cape is compatible and its alternate profiles retain their earlier intent',()=>{
 const mode=(q:string)=>northCapeMode(new URLSearchParams(q));
 assert.equal(mode(''),'ordinary');
 for(const key of ['scenery=detail','surveyRelief','inlandRelief','buildingShadows']){
  assert.equal(mode(key),'stock');
  assert.equal(mode(key+'&northCapeWind'),'explicit');
 }
 assert.equal(mode('northCapeWind'),'explicit');
 assert.equal(mode('northCapeWind&stockNorthCapeWind'),'stock');
 const bounds=[-64.47,45.94,-61.93,47.10];
 const cover={sourceSha:NORTH_CAPE_COVER_SHA,width:4096,height:2720};
 const terrain={sha:NORTH_CAPE_TERRAIN_SHA,width:4096,height:2720,bounds};
 assert(northCapeAtlas(terrain,cover));
 assert(!northCapeAtlas({...terrain,sha:'other'},cover));
 assert(!northCapeAtlas({...terrain,bounds:bounds.slice(0,3)},cover));
 assert(!northCapeAtlas(terrain,{...cover,sourceSha:'other'}));
 assert(!northCapeAtlas(terrain,{...cover,width:2720,height:4096}));
 assert(!sceneryOptions('?stockNorthCapeWind&northCapeWind').has('northCapeWind'));
 assert(!sceneryOptions('?stockNorthCapeWind&scenery=detail').has('northCapeWind'));
 assert.equal(northCapeMode(sceneryOptions('?scenery=detail')),'explicit');
});

test('late data never attaches far away and a warm reentry neither refetches nor duplicates scene leases',async()=>{
 let fetches=0,creates=0,disposes=0;const updates:number[]=[];
 const art=()=>{creates++;return {update(_:ReturnType<typeof eye>,t:number){updates.push(t);},dispose(){disposes++;}};};
 let resolve!:(x:()=>ReturnType<typeof art>)=>void;
 const load=()=>{fetches++;return new Promise<typeof art>(done=>{resolve=done;});};
 const stream=new NorthCapeStream(0,0,100,load);
 stream.update(eye(-8800),1);stream.update(eye(NaN),2);await tick();
 assert.deepEqual([fetches,creates,disposes],[0,0,0]);
 stream.update(eye(8550),3);await tick();assert.equal(fetches,1);
 stream.update(eye(9410),4);resolve(art);await tick();
 assert.equal(creates,0);assert.equal(stream.art,undefined);
 stream.update(eye(8590),5);stream.update(eye(9350),6);
 assert.deepEqual([fetches,creates,disposes],[1,1,0]);
 stream.update(eye(9401),7);stream.update(eye(8610),8);
 assert.deepEqual([fetches,creates,disposes],[1,1,1]);
 stream.update(eye(),9);stream.update(eye(0,Infinity),10);
 assert.deepEqual([fetches,creates,disposes],[1,2,2]);
 assert.deepEqual(updates,[5,6,9]);
});

test('missing or throwing art silently preserves the old scene and is not retried every frame',async()=>{
 for(const fail of [()=>Promise.reject(Error('missing chunk')),async()=>undefined,async()=>()=>{throw Error('art unavailable');}]){
  let loads=0;
  const s=new NorthCapeStream(0,0,0,()=>{loads++;return fail();});
  s.update(eye(),0);await tick();
  for(let i=1;i<20;i++)s.update(eye(),i);
  assert.equal(s.art,undefined);assert.equal(loads,1);
 }
});
