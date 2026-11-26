import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fieldCandidates,FIELD_SHARD_BYTES,FIELD_SHARD_CELL,FIELD_SHARD_HALO,FIELD_SHARD_SIDE,FIELD_SHARD_SPAN,readFieldDirectory} from '../src/sim/field-shards.ts';
import {FIELD_DIRECTORY_PIN} from '../src/render/province-fields.generated.ts';
import {spawn,step,FIXED_STEP,neutral} from '../src/sim/flight.ts';
import {project} from '../src/sim/geo.ts';
import {Terrain,type TerrainSpec} from '../src/sim/terrain.ts';
import {Cover} from '../src/sim/cover.ts';
import {KINGS_MAPPED_FARMLAND_DEPARTURE,SITES,runwayAt} from '../src/sim/places.ts';

function fieldGround(){
 const base=new URL('../public/world/',import.meta.url),read=(p:string)=>readFileSync(new URL(p,base));
 const spec:TerrainSpec&{file:string}=JSON.parse(read('terrain.json').toString());
 const cd:{width:number;height:number;file:string}=JSON.parse(read('cover.json').toString());
 const raw=gunzipSync(read(spec.file)),terrain=new Terrain(spec,new Int16Array(raw.buffer,raw.byteOffset,raw.byteLength/2));
 const cover=new Cover(cd.width,cd.height,gunzipSync(read(cd.file)));
 const surface=(x:number,z:number)=>{
  const land=cover.distance(terrain,x,z)>=0;
  return {height:terrain.contactHeight(x,z,land),land,runway:!!runwayAt(x,z)};
 };
 return {surface,read};
}

test('field passes cross all three named regions with ordinary flight dynamics',()=>{
 const {surface}=fieldGround();
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

test('new Kings mapped farmland departure visits the exact signed v2 field and leaves the old start intact',()=>{
 const {surface,read}=fieldGround();
 const old=SITES.find(q=>q.id==='kings-fields');
 assert.ok(old);
 assert.deepEqual([old.lon,old.lat,old.heading,old.height],[-62.36975541,46.34643049,140.268,62]);
 const route=KINGS_MAPPED_FARMLAND_DEPARTURE;
 assert.equal(route.id,'kings-mapped-farmland-pass');
 assert.ok(!SITES.some(q=>q.id===route.id)); // preserve all old catalogue indices
 assert.deepEqual([route.lon,route.lat,route.heading,route.height],[-62.63729889216559,46.39645292554363,197.3,62]);
 const f=spawn(route,surface),goal={x:43126,z:11730};
 assert.equal(surface(f.x,f.z).land,true);
 assert.ok(Math.abs(f.y-surface(f.x,f.z).height-62)<1e-8);
 const h=(a:Uint8Array)=>createHash('sha256').update(a).digest('hex');
 const base='fields-province/v2/',wire=read(base+'index.fcr.gz'),raw=gunzipSync(wire);
 assert.equal(h(wire),FIELD_DIRECTORY_PIN.packedHash);assert.equal(h(raw),FIELD_DIRECTORY_PIN.rawHash);
 const dir=readFieldDirectory(Uint8Array.from(raw).buffer);assert.ok(dir);
 const tx=Math.floor(goal.x/FIELD_SHARD_SPAN),tz=Math.floor(goal.z/FIELD_SHARD_SPAN);
 const hit=dir.cells.get(tx+':'+tz);assert.ok(hit);
 const pack=read(base+'crop-'+String(hit.pack).padStart(2,'0')+'.pack');
 const body=pack.subarray(hit.offset,hit.offset+hit.size);
 assert.equal(h(body),hit.packedHash);
 const field=gunzipSync(body);
 assert.equal(field.length,FIELD_SHARD_BYTES);assert.equal(h(field),hit.decodedHash);
 const px=Math.floor((goal.x-tx*FIELD_SHARD_SPAN)/FIELD_SHARD_CELL)+FIELD_SHARD_HALO;
 const pz=Math.floor((goal.z-tz*FIELD_SHARD_SPAN)/FIELD_SHARD_CELL)+FIELD_SHARD_HALO;
 assert.ok(field[2*(pz*FIELD_SHARD_SIDE+px)+1]>153);
 let closest=Infinity,minAlt=Infinity,directoryReady=false;
 for(let i=0;i<90*10;i++){
  step(f,neutral,surface,FIXED_STEP);
  assert.equal(f.status,'flying');
  const native=surface(f.x,f.z);assert.equal(native.land,true);
  minAlt=Math.min(minAlt,f.y-native.height);closest=Math.min(closest,Math.hypot(f.x-goal.x,f.z-goal.z));
  if(i>=90&&i<=90*8&&i%90===0)directoryReady||=fieldCandidates(f.x,f.z,dir).some(q=>q===hit);
 }
 assert.ok(directoryReady);
 assert.ok(closest<30,'neutral path distance '+closest);
 assert.ok(minAlt>=50,'neutral path simulated clearance '+minAlt);
});
