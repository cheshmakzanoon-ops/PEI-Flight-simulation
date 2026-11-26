import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {departureBriefing} from '../src/app/departure-briefing.ts';
import {sceneryDeparture,standardSeacowExteriorRequested,seacowDefaultFlight} from '../src/app/scenery-profile.ts';
import {SEACOW} from '../src/render/seacow-exterior-seat.ts';
import {Cover} from '../src/sim/cover.ts';
import {spawn,step,FIXED_STEP,neutral} from '../src/sim/flight.ts';
import {SITES} from '../src/sim/places.ts';
import {Terrain,type TerrainSpec} from '../src/sim/terrain.ts';

const id='seacow-head-coast';
test('Seacow is a selectable departure and accurately describes its Standard exterior',()=>{
  const ids=SITES.map(q=>q.id);
  assert.equal(ids.filter(q=>q===id).length,1);
  const i=sceneryDeparture('?departure='+id,ids);
  assert.notEqual(i,0);
  const site=SITES[i];
  assert.equal(site.id,id);
  assert.equal(site.runway,undefined);
  assert.match(departureBriefing(site,'?departure='+id+'&seacowExteriorStudy'),/tapered white tower and red lantern/);
  assert.match(departureBriefing(site,''),/tapered white tower and red lantern/);
  for(const search of ['?stockSeacowExterior', '?seacowExteriorStudy&stockSeacowExterior', '?seacowExteriorStudy&scenery=detail'])
    assert.match(departureBriefing(site,search),/authored exterior is off/);
});

test('default exterior permits only ordinary settings and the actual flying route',()=>{
  for(const query of ['', 'diagnostics&stockGreenGablesHouse', 'departure=cavendish-low'])
    assert(standardSeacowExteriorRequested(new URLSearchParams(query)));
  for(const query of ['stockSeacowExterior','scenery=detail','scenery=standard&scenery=detail','scenery=standard&scenery=standard','qa','surveyRelief','unknown'])
    assert(!standardSeacowExteriorRequested(new URLSearchParams(query)),query);
  for(const mode of ['map','help','credits']){
   assert(seacowDefaultFlight(id,mode,'flight'));
   assert(!seacowDefaultFlight(id,mode,'dispatch'));assert(!seacowDefaultFlight(id,mode,'crash'));
  }
  for(const mode of ['flight','paused'])assert(seacowDefaultFlight(id,mode,'dispatch'));
  for(const mode of ['dispatch','crash','unknown'])assert(!seacowDefaultFlight(id,mode,'flight'));
  assert(!seacowDefaultFlight('cavendish-low','flight','flight'));
});
test('Seacow starts offshore and approaches the mapped tower in unmodified flight',()=>{
  const dir=new URL('../public/world/',import.meta.url),read=(n:string)=>readFileSync(new URL(n,dir));
  const t:TerrainSpec&{file:string}=JSON.parse(read('terrain.json').toString());
  const c=JSON.parse(read('cover.json').toString());
  const a=gunzipSync(read(t.file));
  const terrain=new Terrain(t,new Int16Array(a.buffer,a.byteOffset,a.byteLength/2));
  const cover=new Cover(c.width,c.height,gunzipSync(read(c.file)));
  const surface=(x:number,z:number)=>{
    const land=cover.distance(terrain,x,z)>=0;
    return {land,runway:false,height:terrain.contactHeight(x,z,land)};
  };
  const [x,z]=SEACOW.xz;
  const site=SITES.find(q=>q.id===id);assert.ok(site);
  const state=spawn(site,surface);
  const distance=()=>Math.hypot(state.x-x,state.z-z);
  assert.ok(Math.abs(distance()-1450)<1);
  let minimumGameClearance=Infinity;
  for(let i=0;i<90*24&&distance()>=620;i++){
    const ground=surface(state.x,state.z);
    assert.equal(ground.land,false);
    assert.equal(state.stalled,false);
    assert.equal(state.status,'flying');
    minimumGameClearance=Math.min(minimumGameClearance,state.y-ground.height);
    step(state,neutral,surface,FIXED_STEP);
  }
  assert.ok(distance()<620&&minimumGameClearance>60,{distance:distance(),minimumGameClearance});
});
