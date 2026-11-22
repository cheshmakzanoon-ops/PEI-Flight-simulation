import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { SITES, RUNWAYS, runwayAt } from '../src/sim/places.ts';
import { project, geographic } from '../src/sim/geo.ts';
import { Terrain } from '../src/sim/terrain.ts';
import { step, neutral, spawn, FIXED_STEP } from '../src/sim/flight.ts';
const bin=gunzipSync(readFileSync(new URL('../public/world/height.bin.gz',import.meta.url)));
const terrain=new Terrain(JSON.parse(readFileSync(new URL('../public/world/terrain.json',import.meta.url),'utf8')),new Int16Array(bin.buffer,bin.byteOffset,bin.byteLength/2));
const ground=(x:number,z:number)=>({height:terrain.elevation(x,z)+.12,land:terrain.isLand(x,z),runway:!!runwayAt(x,z)});
test('all departure locations round-trip in WGS84',()=>{for(const s of SITES){const p=project(s.lon,s.lat),ll=geographic(p.x,p.z);assert.ok(Math.abs(ll.lon-s.lon)<1e-9&&Math.abs(ll.lat-s.lat)<1e-9);}});
test('shore mask and elevations do not interpolate the missing-value sentinel',()=>{const t=new Terrain({width:2,height:2,bounds:[-64,46,-63,47]},new Int16Array([-32768,22,-32768,24]));
 const p=project(-63.49,46.75);assert.equal(t.isLand(p.x,p.z),true);assert.ok(t.elevation(p.x,p.z)>=22);
 const water=project(-63.75,46.75);assert.equal(t.elevation(water.x,water.z),0);assert.equal(t.isLand(water.x,water.z),false);});
test('all air starts stay finite and airborne for two neutral simulated minutes',()=>{for(const s of SITES.filter(s=>!s.runway)){const f=spawn(s,ground);for(let k=0;k<10800;k++)step(f,neutral,ground);assert.ok(Number.isFinite(f.speed)&&f.speed>25);assert.equal(f.status,'flying',s.id);}});
for(const s of SITES.filter(s=>s.runway))test('full-power keyboard rotation works on measured terrain: '+s.id,()=>{
 const f=spawn(s,ground);let t0=-1;
 for(let k=0;k<90*55;k++){
  const pitch=f.speed*1.94384>=65||t0>=0?1:0;
  step(f,{...neutral,power:1,pitch:t0>=0&&f.time-t0>8?.25:pitch},ground);
  if(t0<0&&f.status==='flying')t0=f.time;
  assert.notEqual(f.status,'stopped','ground contact at '+f.time);
 }
 assert.ok(t0>0&&t0<40);assert.ok(f.status==='flying'&&f.y>ground(f.x,f.z).height+15);
});
test('pausing clocks and replayed inputs have deterministic behaviour',()=>{const a=spawn(SITES[1],ground),b={...a};step(a,neutral,ground,0);assert.deepEqual(a,b);for(let i=0;i<800;i++){const u={...neutral,roll:.38,yaw:.03};step(a,u,ground,FIXED_STEP);step(b,u,ground,FIXED_STEP);}assert.deepEqual(a,b);assert.ok(a.bank>.35);});
test('runways contain their centreline and reject off-strip points',()=>{for(const r of RUNWAYS){const x=r.p.x+r.dx*200,z=r.p.z+r.dz*200;assert.ok(runwayAt(x,z));assert.equal(runwayAt(x+r.dz*200,z-r.dx*200),undefined);}});
