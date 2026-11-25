import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync as read} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {PerspectiveCamera,Vector3} from 'three';
import {departureBriefing} from '../src/app/departure-briefing.ts';
import {OLEARY,olearyCloseCamera} from '../src/render/oleary-railway/authority.ts';
import {Cover} from '../src/sim/cover.ts';
import {FIXED_STEP,neutral,spawn,step} from '../src/sim/flight.ts';
import {project} from '../src/sim/geo.ts';
import {runwayAt,SITES} from '../src/sim/places.ts';
import {Terrain} from '../src/sim/terrain.ts';

const site=SITES.find(s=>s.id==='oleary-railway-low')!;
test('O’Leary fictional dispatch selects only its own briefing and stock comparison',()=>{
 assert(site&&site.region==='Prince County'&&!site.runway&&site.heading===221&&site.height===65);
 assert.match(site.note,/Virtual sightseeing only, not a navigation route/);
 assert.match(departureBriefing(site,'?departure=oleary-railway-low&olearyExteriorStudy'),/optional station exterior is selected/);
 assert.match(departureBriefing(site,'?departure=oleary-railway-low&olearyExteriorStudy&stockOlearyExterior'),/stock station exterior/);
 assert.match(departureBriefing(site,'?departure=oleary-railway-low&olearyExteriorStudy&scenery=detail'),/stock station exterior/);
});
test('existing unmodified simulator and data put the station in the neutral approach, with clear ground',()=>{
 const base='public/world/',j=(name:string)=>JSON.parse(read(base+name,'utf8'));
 const spec=j('terrain.json'),{width,height}=j('cover.json');
 const plain=(name:string)=>{const b=gunzipSync(read(base+name));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
 const terrain=new Terrain(spec,new Int16Array(plain(spec.file)));
 const cover=new Cover(width,height,new Uint8Array(plain('cover.bin.gz')));
 const sample=(x:number,z:number)=>{const land=cover.distance(terrain,x,z)>=0;return {height:terrain.contactHeight(x,z,land),land,runway:!!runwayAt(x,z)};};
 const p=spawn(site,sample),a=project(site.lon,site.lat),[x,z]=OLEARY.xz;
 assert(p.status==='flying'&&p.x===a.x&&p.z===a.z&&Math.abs(Math.hypot(x-a.x,z-a.z)-1210)<1e-6);
 assert(olearyCloseCamera(p.x,p.y,p.z));
 const lens=new PerspectiveCamera(53,1.5,.2,5000),t=new Vector3(),subject=new Vector3(x,OLEARY.groundOrigin+3.5,z),ss=new Vector3();
 let closest=Infinity,least=Infinity,visibleApproachSeconds=0;
 for(let k=0;k<27*90;k++){
  const s=sample(p.x,p.z),dx=Math.sin(p.heading),dz=-Math.cos(p.heading),d=Math.hypot(x-p.x,z-p.z);
  assert(s.land&&!s.runway&&p.status==='flying');
  closest=Math.min(closest,d);least=Math.min(least,p.y-s.height);
  if(d<310&&d>100){
   lens.position.set(p.x-16.8*dx,p.y+4.2,p.z-16.8*dz);
   t.set(p.x+7.8*dx,p.y+1.18+Math.sin(p.pitch)*4.5,p.z+7.8*dz);
   lens.lookAt(t);lens.updateMatrixWorld();
   ss.copy(subject).project(lens);
   if(Math.abs(ss.x)<.88&&Math.abs(ss.y)<.88&&Math.abs(ss.z)<1)visibleApproachSeconds+=FIXED_STEP;
  }
  step(p,neutral,sample);
 }
 assert(least>=59&&closest<45&&visibleApproachSeconds>2.2,JSON.stringify({least,closest,visibleApproachSeconds}));
});
