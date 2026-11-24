import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {HOG_PHOTO_PINS as P} from '../src/render/hog-photo-pins.generated.ts';
import {matchesHogPhoto,hogInfrastructureMatches} from '../src/render/hog-photo.ts';
import {sceneryOptions,sceneryReviewBlock} from '../src/app/scenery-profile.ts';
import {project} from '../src/sim/geo.ts';
import {Terrain} from '../src/sim/terrain.ts';
import {Cover} from '../src/sim/cover.ts';
import {SITES} from '../src/sim/places.ts';
import {spawn,step,neutral,FIXED_STEP} from '../src/sim/flight.ts';
const read=(p:string)=>readFileSync(new URL('../public/world/'+p,import.meta.url));
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');

test('the two opt-in Hog Island textures keep their precise dry atlas owners',()=>{
 const h=gunzipSync(read('height.bin.gz')),coverArchive=read('cover.bin.gz'),c=gunzipSync(coverArchive);
 const d=JSON.parse(read('cover.json').toString()),terrain=new Terrain(JSON.parse(read('terrain.json').toString()),new Int16Array(h.buffer,h.byteOffset,h.byteLength/2));
 const cover=new Cover(d.width,d.height,c);
 assert(matchesHogPhoto(sha(h),sha(coverArchive),sha(c)));
 assert(!matchesHogPhoto(sha(h),sha(coverArchive),undefined));
 assert(hogInfrastructureMatches(sha(gunzipSync(read('roads.bin.gz'))),sha(read('buildings/tiles.pack'))));
 assert(!hogInfrastructureMatches(undefined,sha(read('buildings/tiles.pack'))));
 assert(!sceneryOptions('').has('hogIslandPhotoStudy'));
 assert(!sceneryReviewBlock('hogIslandPhotoStudy',sceneryOptions('?hogIslandPhotoStudy')));
 for(const f of ['surveyRelief','inlandRelief','scenery=detail'])
  assert(sceneryReviewBlock('hogIslandPhotoStudy',sceneryOptions('?hogIslandPhotoStudy&'+f)));
 for(const a of P){
  const known=read(a.file);assert.equal(known.length,a.size);assert.equal(sha(known),a.sha);
  const [x,z,ex,ez,sx,sz]=a.domain;
  for(let j=0;j<=13;j++)for(let i=0;i<=21;i++){
   const px=x+ex*i/21+sx*j/13,pz=z+ez*i/21+sz*j/13;
   const [u,v]=terrain.uv(px,pz);
   assert.deepEqual([Math.floor(u*32),Math.floor(v*22)],a.tile);
   assert(cover.distance(terrain,px,pz)>57);
  }
 }
});
test('both Hog Island approaches depart offshore and clear the exact existing dry patch',()=>{
 const h=gunzipSync(read('height.bin.gz')),c=gunzipSync(read('cover.bin.gz'));
 const d=JSON.parse(read('cover.json').toString()),t=new Terrain(JSON.parse(read('terrain.json').toString()),new Int16Array(h.buffer,h.byteOffset,h.byteLength/2));
 const cover=new Cover(d.width,d.height,c);
 const s=(x:number,z:number)=>{const land=cover.distance(t,x,z)>=0;return {land,height:t.contactHeight(x,z,land),runway:false};};
 for(const a of P){
  const site=SITES.find(s=>s.id==='hog-island-'+a.id+'-pass');assert(site);
  const f=spawn(site,s),[x,z,ex,ez,sx,sz]=a.domain;
  assert(cover.distance(t,f.x,f.z)<-200);
  let near=Infinity,minClear=Infinity,wet=true;
  for(let j=0;j<16/FIXED_STEP;j++){
   step(f,neutral,s,FIXED_STEP);
   near=Math.min(near,Math.hypot(f.x-x-(ex+sx)*.5,f.z-z-(ez+sz)*.5));
   minClear=Math.min(minClear,f.y-s(f.x,f.z).height);wet&&=!s(f.x,f.z).land;
  }
  assert(!wet&&near<11&&minClear>=57&&f.status==='flying');
 }
});
