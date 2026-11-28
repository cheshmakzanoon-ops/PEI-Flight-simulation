import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {gunzipSync} from 'node:zlib';
import {sceneryDeparture} from '../src/app/scenery-profile.ts';
import {Cover} from '../src/sim/cover.ts';
import {FIXED_STEP,neutral,spawn,step} from '../src/sim/flight.ts';
import {NEW_GLASGOW_FIELD_EDGE_DEPARTURE as route,runwayAt,SITES} from '../src/sim/places.ts';
import {Terrain,type TerrainSpec} from '../src/sim/terrain.ts';

test('New Glasgow has a unique ordinary Dispatch bookmark, without changing the stock default',()=>{
 const catalogue=[...SITES,route],ids=catalogue.map(q=>q.id);
 assert.equal(ids.filter(q=>q==='new-glasgow-field-edge').length,1);
 assert.equal(catalogue[sceneryDeparture('?departure=new-glasgow-field-edge',ids)],route);
 for(const search of ['', '?departure=unknown'])assert.equal(catalogue[sceneryDeparture(search,ids)],SITES[0]);
 assert.equal(route.runway,undefined);
 assert.equal(route.region,'Queens County');
 assert.deepEqual([route.lon,route.lat,route.heading,route.height],[-63.37845781400669,46.40798791295192,225,42]);
});

test('the public low pass clears existing terrain through the approach, field edge and exit',()=>{
 const world=new URL('../public/world/',import.meta.url),read=(name:string)=>readFileSync(new URL(name,world));
 const spec:TerrainSpec&{file:string}=JSON.parse(read('terrain.json').toString());
 const mask:{width:number;height:number;file:string}=JSON.parse(read('cover.json').toString());
 const raw=gunzipSync(read(spec.file));
 const terrain=new Terrain(spec,new Int16Array(raw.buffer,raw.byteOffset,raw.byteLength/2));
 const cover=new Cover(mask.width,mask.height,gunzipSync(read(mask.file)));
 const surface=(x:number,z:number)=>{
  const land=cover.distance(terrain,x,z)>=0;
  return {height:terrain.contactHeight(x,z,land),land,runway:!!runwayAt(x,z)};
 };
 const f=spawn(route,surface),origin={x:f.x,z:f.z},ground=surface(f.x,f.z);
 assert(ground.land&&!ground.runway);
 assert.equal(f.y-ground.height,42);
 const ranges=[230,345,710],clearances:number[]=[];
 for(let i=0;i<Math.ceil(18/FIXED_STEP)&&clearances.length<ranges.length;i++){
  step(f,neutral,surface,FIXED_STEP);
  const contact=surface(f.x,f.z),clearance=f.y-contact.height;
  assert.ok(contact.land&&!contact.runway&&f.status==='flying'&&!f.stalled&&clearance>=28);
  assert.ok(f.x<origin.x&&f.z>origin.z);
  if(Math.hypot(f.x-origin.x,f.z-origin.z)>=ranges[clearances.length])clearances.push(clearance);
 }
 assert.equal(clearances.length,ranges.length);
});
