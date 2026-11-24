import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Cover} from '../src/sim/cover.ts';
import {FIXED_STEP,neutral,spawn,step} from '../src/sim/flight.ts';
import {project} from '../src/sim/geo.ts';
import {SITES} from '../src/sim/places.ts';
import {Terrain} from '../src/sim/terrain.ts';

test('North Rustico pass starts offshore, crosses dry coastal land and clears the historic light',()=>{
 const load=(file:string)=>readFileSync(new URL('../public/world/'+file,import.meta.url));
 const dem=gunzipSync(load('height.bin.gz')),land=gunzipSync(load('cover.bin.gz'));
 const terrain=new Terrain(JSON.parse(load('terrain.json').toString()),new Int16Array(dem.buffer,dem.byteOffset,dem.byteLength/2));
 const shape=JSON.parse(load('cover.json').toString());
 const cover=new Cover(shape.width,shape.height,new Uint8Array(land.buffer,land.byteOffset,land.byteLength));
 const sample=(x:number,z:number)=>{
  const land=cover.distance(terrain,x,z)>=0;
  return {height:terrain.contactHeight(x,z,land),land,runway:false};
 };
 const tower=project(-63.2919614805,46.4553077072);
 const route=SITES.find(s=>s.id==='north-rustico-harbour-low')!;
 const pilot=spawn(route,sample);
 assert(cover.distance(terrain,pilot.x,pilot.z)<-200);
 assert(!sample(pilot.x,pilot.z).land);assert.equal(pilot.y-sample(pilot.x,pilot.z).height,72);
 let closest=Infinity,minTerrainClearance=Infinity,heightAtLight=-Infinity,overDry=0;
 for(let k=0;k<Math.round(18/FIXED_STEP);k++){
  step(pilot,neutral,sample,FIXED_STEP);
  const ground=sample(pilot.x,pilot.z),d=Math.hypot(tower.x-pilot.x,tower.z-pilot.z);
  if(ground.land)overDry++;
  if(d<closest){closest=d;heightAtLight=pilot.y;}
  minTerrainClearance=Math.min(minTerrainClearance,pilot.y-ground.height);
 }
 assert(closest>27&&closest<47);assert(heightAtLight-13.65>60);
 assert(minTerrainClearance>70&&overDry>100);assert.equal(pilot.status,'flying');
});
