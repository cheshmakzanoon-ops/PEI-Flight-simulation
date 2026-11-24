import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {CANOPY_FENCE as F} from '../src/render/canopy-fence.generated.ts';
import {DUNE_SAND_MASK as M,DUNE_SAND_PHOTO as P} from '../src/render/dune-sand-pins.generated.ts';
import {DuneSand,duneMaskBytes,duneSandSources,duneSandOverlays} from '../src/render/dune-sand.ts';
import {sceneryOptions,sceneryReviewBlock} from '../src/app/scenery-profile.ts';
const base=new URL('../public/world/dune-sand/v1/',import.meta.url);
const wrap=(b:Uint8Array)=>new Response(new Uint8Array(b));

test('dry dune material skips ordinary and conflicting terrain studies',()=>{
 assert(!sceneryOptions('?scenery=detail').has('duneSandDetail'));
 assert.equal(sceneryReviewBlock('duneSandDetail',sceneryOptions('?duneSandDetail&scenery=detail')),'detail');
 for(const conflict of ['sourceGrassNap','surveyRelief','hogIslandWestGround','hogIslandPhotoStudy','inlandRelief','buildingShadows','northCapeWind','cavendishDetail']){
  assert.equal(sceneryReviewBlock('duneSandDetail',sceneryOptions('?duneSandDetail&'+conflict)),'terrain');
 }
 const s=F.pins;
 assert(duneSandSources(s.terrain,s.cover,s.coverDecoded));assert(!duneSandSources(s.terrain,s.cover));
 assert(duneSandOverlays(s.road,s.buildings,s.sidewalk,s.parking));assert(!duneSandOverlays(s.road,undefined,s.sidewalk,s.parking));
});

test('all native authority stamps fit exact owner and signed stream budgets',async()=>{
 let sum=0,bytes=0;const owners=new Set<string>();
 for(const s of M.variants){
  const key=s.tile.join('-'); assert(!owners.has(key));owners.add(key);
  const b=readFileSync(new URL(s.file,base));
  assert(s.wire<3500&&s.decoded<1_000_000);
  const mapped=await duneMaskBytes(s,'https://example.test/',async input=>{
   assert.equal(input,'https://example.test/dune-sand/v1/'+s.file);return wrap(b);
  });
  assert(mapped&&mapped.length===s.size[0]*s.size[1]);
  assert(mapped.subarray(0,s.size[0]).every(v=>v===0));
  assert(mapped.subarray(mapped.length-s.size[0]).every(v=>v===0));
  assert.equal(mapped.reduce((n,x)=>n+Number(x>0),0),s.number);
  sum+=s.number;bytes+=s.wire;
 }
 assert.equal(owners.size,29);
 assert(!owners.has("1-9")&&!owners.has("31-12"));assert.equal(sum,24270);
 assert(bytes<16000);
 for(const map of P){
  const b=readFileSync(new URL(map.payload,base));
  assert.equal(b.byteLength,map.size);
  assert.equal(b.readUInt32BE(16),map.pixels);
  assert.equal(b.readUInt32BE(20),map.pixels);
 }
});

test('corrupt, missing or excessive optional geometry bodies fail stock-safe',async()=>{
 const s=M.variants[0];
 const b=readFileSync(new URL(s.file,base)),parsed=gunzipSync(b);
 assert(await duneMaskBytes(s,'',async()=>wrap(parsed)));
 const damaged=Uint8Array.from(b);damaged[12]^=1;
 assert.equal(await duneMaskBytes(s,'',async()=>wrap(damaged)),undefined);
 assert.equal(await duneMaskBytes(s,'',async()=>wrap(new Uint8Array(s.decoded+1))),undefined);
 assert.equal(await duneMaskBytes(s,'',async()=>new Response(null,{status:404})),undefined);
});

test('no optional network from unauthorized, distant or high scenery',()=>{
 let reads=0;const streamer=new DuneSand('',async()=>{reads++;return new Response(null,{status:404});});
 const s=M.variants[0].outputOrigin;
 streamer.update(s[0],s[1],20);assert.equal(reads,0);
 streamer.allow();streamer.update(s[0],s[1],239);assert.equal(reads,0);
 streamer.update(-1000000,-1000000,20);assert.equal(reads,0);
 assert.deepEqual(streamer.note().active,[]);
});
