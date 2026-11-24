import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {spawn,step,FIXED_STEP,neutral} from '../src/sim/flight.ts';
import {project} from '../src/sim/geo.ts';
import {Terrain,type TerrainSpec} from '../src/sim/terrain.ts';
import {Cover} from '../src/sim/cover.ts';
import {SITES,runwayAt} from '../src/sim/places.ts';

test('field passes cross all three named regions with ordinary flight dynamics',()=>{
 const base=new URL('../public/world/',import.meta.url),read=(p:string)=>readFileSync(new URL(p,base));
 const spec:TerrainSpec&{file:string}=JSON.parse(read('terrain.json').toString());
 const cd:{width:number;height:number;file:string}=JSON.parse(read('cover.json').toString());
 const raw=gunzipSync(read(spec.file)),terrain=new Terrain(spec,new Int16Array(raw.buffer,raw.byteOffset,raw.byteLength/2));
 const cover=new Cover(cd.width,cd.height,gunzipSync(read(cd.file)));
 const surface=(x:number,z:number)=>{
  const land=cover.distance(terrain,x,z)>=0;
  return {height:terrain.contactHeight(x,z,land),land,runway:!!runwayAt(x,z)};
 };
 for(const [key,lon,lat] of [
  ['prince-fields',-63.87186370,46.45305911],['queens-fields',-63.50647740,46.36342343],['kings-fields',-62.36842309,46.34532357]
 ] as const){
  const location=SITES.find(q=>q.id===key);assert.ok(location);
  const goal=project(lon,lat),f=spawn(location,surface);
  assert.equal(surface(f.x,f.z).land,true);
  let nearest=Infinity,minimum=Infinity;
  for(let i=0;i<90*12;i++){
   step(f,neutral,surface,FIXED_STEP);
   assert.equal(f.status,'flying');
   nearest=Math.min(nearest,Math.hypot(goal.x-f.x,goal.z-f.z));
   minimum=Math.min(minimum,f.y-surface(f.x,f.z).height);
  }
  assert.ok(nearest<12,`${key} missed its comparison position: ${nearest}`);
  assert.ok(minimum>=35,`${key} had insufficient visual clearance: ${minimum}`);
 }
});
