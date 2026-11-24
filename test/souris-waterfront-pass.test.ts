import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Cover} from '../src/sim/cover.ts';
import {FIXED_STEP,neutral,spawn,step} from '../src/sim/flight.ts';
import {project} from '../src/sim/geo.ts';
import {SITES,runwayAt} from '../src/sim/places.ts';
import {Terrain,type TerrainSpec} from '../src/sim/terrain.ts';

test('Souris waterfront pass starts offshore and traverses the town with unchanged controls',()=>{
 const base=new URL('../public/world/',import.meta.url), read=(n:string)=>readFileSync(new URL(n,base));
 const spec:TerrainSpec&{file:string}=JSON.parse(read('terrain.json').toString());
 const manifest:{width:number;height:number;file:string}=JSON.parse(read('cover.json').toString());
 const bytes=gunzipSync(read(spec.file));
 const terrain=new Terrain(spec,new Int16Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/2));
 const cover=new Cover(manifest.width,manifest.height,gunzipSync(read(manifest.file)));
 const sample=(x:number,z:number)=>{
  const land=cover.distance(terrain,x,z)>=0;
  return {height:terrain.contactHeight(x,z,land),land,runway:!!runwayAt(x,z)};
 };
 const site=SITES.find(q=>q.id==='souris-waterfront-pass');
 assert.ok(site);assert.equal(site.region,'Kings County');assert.equal(site.runway,undefined);
 const goal=project(-62.25501367,46.355186667), f=spawn(site,sample),x=f.x,z=f.z;
 assert.equal(sample(x,z).land,false);
 assert.ok(cover.distance(terrain,x,z)<-130); // signed source proxy, not surveyed units
 assert.ok(Math.abs(f.y-sample(x,z).height-98)<.001);
 let wetToLand=0, nearest=Infinity, minimum=Infinity, visit=0, rangeEast=0;
 for(let i=1;i<=29*90;i++){
  step(f,neutral,sample,FIXED_STEP);
  assert.equal(f.status,'flying');
  const m=sample(f.x,f.z);
  if(m.land&&!wetToLand)wetToLand=i*FIXED_STEP;
  minimum=Math.min(minimum,f.y-m.height);
  const offset=Math.hypot(f.x-goal.x,f.z-goal.z);
  if(offset<nearest){nearest=offset;visit=i*FIXED_STEP;rangeEast=f.x-goal.x;}
 }
 assert.ok(Math.hypot(f.x-x,f.z-z)>1450);
 assert.ok(wetToLand>7&&wetToLand<9&&visit>12&&visit<15);
 assert.ok(minimum>=78&&nearest>=28&&nearest<38&&rangeEast>25);
});
