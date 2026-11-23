import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {spawn,step,FIXED_STEP,neutral} from '../src/sim/flight.ts';
import {project} from '../src/sim/geo.ts';
import {Terrain,type TerrainSpec} from '../src/sim/terrain.ts';
import {Cover} from '../src/sim/cover.ts';
import {SITES} from '../src/sim/places.ts';
import {NORTH_CAPE_V47} from '../src/render/north-cape.generated.ts';

test('North Cape wind-scene departure crosses the field without changing the flight model',()=>{
 const base=new URL('../public/world/',import.meta.url),read=(p:string)=>readFileSync(new URL(p,base));
 const spec:TerrainSpec&{file:string}=JSON.parse(read('terrain.json').toString());
 const cd:{width:number;height:number;file:string}=JSON.parse(read('cover.json').toString());
 const raw=gunzipSync(read(spec.file)),terrain=new Terrain(spec,new Int16Array(raw.buffer,raw.byteOffset,raw.byteLength/2));
 const cover=new Cover(cd.width,cd.height,gunzipSync(read(cd.file)));
 const surface=(x:number,z:number)=>{
  const land=cover.distance(terrain,x,z)>=0;
  return {height:terrain.contactHeight(x,z,land),land,runway:false};
 };
 for(const [key,lon,lat] of [['northcape-wind-low',-63.99745,47.04959]] as const){
  const location=SITES.find(q=>q.id===key);assert(location);
  const goal=project(lon,lat),f=spawn(location,surface);
  assert.equal(surface(f.x,f.z).land,false);
  assert.equal(f.status,'flying');
  let nearest=Infinity,minimum=Infinity,airGap=Infinity;
  const upper=NORTH_CAPE_V47.map(([,lon,lat])=>{
   const q=project(lon,lat);
   return {...q,high:surface(q.x,q.z).height+73.5+8};
  });
  for(let i=0;i<90*40;i++){
   step(f,neutral,surface,FIXED_STEP);
   assert.equal(f.status,'flying');
   nearest=Math.min(nearest,Math.hypot(goal.x-f.x,goal.z-f.z));
   minimum=Math.min(minimum,f.y-surface(f.x,f.z).height);
   // An extra 8 m above the nominal tip bounds the old terrain LOD and 1 m sources.
   for(const q of upper)if(Math.hypot(q.x-f.x,q.z-f.z)<47)airGap=Math.min(airGap,f.y-q.high);
  }
  assert.ok(nearest<18,`${key} missed its destination: ${nearest}`);
  assert.ok(Number.isFinite(airGap)&&airGap>24,`range-limited turbine-envelope gap: ${airGap}`);
  assert.ok(minimum>=107,`${key} had insufficient clearance: ${minimum}`);
 }
});
