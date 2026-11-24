import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {spawn,step,FIXED_STEP,neutral} from '../src/sim/flight.ts';
import {Terrain,type TerrainSpec} from '../src/sim/terrain.ts';
import {Cover} from '../src/sim/cover.ts';
import {SITES} from '../src/sim/places.ts';
import {ST_DAVIDS as S} from '../src/render/st-davids/source.generated.ts';

test('Georgetown starts over harbour water and clears the modeled tower on the neutral simulator pass',()=>{
 const base=new URL('../public/world/',import.meta.url),read=(n:string)=>readFileSync(new URL(n,base));
 const spec:TerrainSpec&{file:string}=JSON.parse(read('terrain.json').toString());
 const cv=JSON.parse(read('cover.json').toString()),rb=gunzipSync(read(spec.file));
 const terrain=new Terrain(spec,new Int16Array(rb.buffer,rb.byteOffset,rb.byteLength/2));
 const cover=new Cover(cv.width,cv.height,gunzipSync(read(cv.file)));
 const ground=(x:number,z:number)=>{
  const land=cover.distance(terrain,x,z)>=0;
  return {height:terrain.contactHeight(x,z,land),land,runway:false};
 };
 const site=SITES.find(x=>x.id==='georgetown-low');assert.ok(site);assert.equal(site.height,61);
 const f=spawn(site,ground);assert.equal(ground(f.x,f.z).land,false);
 let nearest=Infinity,minTowerClearance=Infinity,minSurfaceClearance=Infinity,crossedLand=false;
 const top=S.seatY+S.localMinMaxXYZ[4];
 for(let t=0;t<31*50;t++){
  step(f,neutral,ground,FIXED_STEP);
  const s=ground(f.x,f.z),d=Math.hypot(f.x-S.originXZ[0],f.z-S.originXZ[1]);
  assert.equal(f.status,'flying');
  crossedLand ||= s.land;
  nearest=Math.min(nearest,d);
  if(d<200)minTowerClearance=Math.min(minTowerClearance,f.y-top);
  minSurfaceClearance=Math.min(minSurfaceClearance,f.y-s.height);
 }
 assert.ok(crossedLand);
 assert.ok(nearest<52&&minTowerClearance>24&&minSurfaceClearance>38,{nearest,minTowerClearance,minSurfaceClearance});
});
