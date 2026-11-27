import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {departureBriefing} from '../src/app/departure-briefing.ts';
import {sceneryDeparture} from '../src/app/scenery-profile.ts';
import {Cover} from '../src/sim/cover.ts';
import {spawn,step,FIXED_STEP,neutral} from '../src/sim/flight.ts';
import {project} from '../src/sim/geo.ts';
import {SITES} from '../src/sim/places.ts';
import {DALVAY_WATER_VISUAL as L} from '../src/render/dalvay-lake-optics.ts';
import {Terrain,type TerrainSpec} from '../src/sim/terrain.ts';
const id='dalvay-lake-coastal-pass';

test('Dalvay coastal dispatch remains a selectable sightseeing start with an explicitly optional lake preview',()=>{
 const ids=SITES.map(q=>q.id),origin=SITES[0];
 assert.equal(ids.filter(q=>q===id).length,1);
 assert.equal(SITES[sceneryDeparture('',ids)],origin);
 const site=SITES[sceneryDeparture('?departure='+id,ids)];assert.equal(site.id,id);
 assert.equal(site.runway,undefined);
 assert.match(departureBriefing(site,'?dalvayWaterOptics'),/preview is enabled/);
 assert.match(departureBriefing(site,''),/after verification/);
 for(const s of ['?stockDalvayWaterOptics', '?dalvayWaterOptics&stockDalvayWaterOptics','?dalvayWaterOptics&scenery=detail'])
  assert.match(departureBriefing(site,s),/preview is off/);
});
test('Stock dispatch approaches the mapped estate and flies on across the lake without changing flight dynamics',()=>{
 const dir=new URL('../public/world/',import.meta.url),read=(n:string)=>readFileSync(new URL(n,dir));
 const t:TerrainSpec&{file:string}=JSON.parse(read('terrain.json').toString());
 const c=JSON.parse(read('cover.json').toString());
 const bytes=gunzipSync(read(t.file));
 const terrain=new Terrain(t,new Int16Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/2));
 const cover=new Cover(c.width,c.height,gunzipSync(read(c.file)));
 const surface=(x:number,z:number)=>{
  const land=cover.distance(terrain,x,z)>=0;
  return {land,runway:false,height:terrain.contactHeight(x,z,land)};
 };
 const manor=project(-63.07337348670973,46.41470500130027),site=SITES.find(q=>q.id===id)!;
 const f=spawn(site,surface),height0=f.y;let closest=Infinity,cross=0,signed=0,optical=0,seenManor=false;
 const stencil=gunzipSync(read(L.file)).subarray(24);
 const sampleCore=(x:number,z:number)=>{
  const i=Math.floor((x-L.world[0])/L.step),j=Math.floor((z-L.world[1])/L.step);
  return i>=0&&i<L.width&&j>=0&&j<L.height&&stencil[j*L.width+i]>0;
 };
 assert.equal(surface(f.x,f.z).land,false);assert.ok(Math.abs(f.z-manor.z+1400)<.01);
 for(let i=0;i<36*90&&f.z-manor.z<355;i++){
  const g=surface(f.x,f.z);if(g.land)signed++;if(sampleCore(f.x,f.z))optical++;
  closest=Math.min(closest,Math.hypot(f.x-manor.x,f.z-manor.z));cross=Math.max(cross,Math.abs(f.x-manor.x));
  if(closest<8)seenManor=true;
  assert(f.status==='flying'&&!f.stalled);
  assert(f.y-g.height>=100&&f.speed>=52);
  step(f,neutral,surface,FIXED_STEP);
 }
 assert(seenManor&&signed>0&&optical>35&&cross<1&&f.z-manor.z>=355&&height0>105,{closest,cross,signed,optical,f});
});
