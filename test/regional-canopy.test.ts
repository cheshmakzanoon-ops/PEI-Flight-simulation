import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {regionalCanopyRequested,sceneryOptions,sceneryReviewBlock,reviewedScenery} from '../src/app/scenery-profile.ts';
import {decodeRegionalCanopy,readRegionalCanopy} from '../src/render/regional-canopy/assets.ts';
import {REGIONAL_STANDS} from '../src/render/regional-canopy/spec.ts';
import {REGIONAL_CANOPY_DEPARTURES} from '../src/render/regional-canopy/departures.ts';
import {SITES} from '../src/sim/places.ts';
const bytes=(a:Uint8Array)=>Uint8Array.from(a).buffer;

test('regional canopy is explicitly separate from default, Detail and other woodland cohorts',()=>{
 assert(!regionalCanopyRequested(sceneryOptions('')));
 assert(!regionalCanopyRequested(sceneryOptions('?miscoucheCanopyStudy')));
 assert(regionalCanopyRequested(sceneryOptions('?regionalCanopyStudy')));
 assert(regionalCanopyRequested(sceneryOptions('?regionalCanopyStudy&mist&miscoucheCanopyStudy')));
 assert.equal(sceneryReviewBlock('regionalCanopyStudy',sceneryOptions('?scenery=detail')),'detail');
 for(const mode of ['scenery=detail','scenery=unknown','canopyLight','woodlandView','surveyRelief','inlandRelief',
  'forestFloor','woodland3D','woodlandCrownBase','woodlandBark','mappedLaneCanopyStudy','buildingShadows','seatedForestShadows','stockRegionalCanopy']){
  assert(!regionalCanopyRequested(sceneryOptions('?regionalCanopyStudy&'+mode)),mode);
 }
 assert.deepEqual(reviewedScenery('?regionalCanopyStudy'),['regionalCanopyStudy']);
 assert(REGIONAL_CANOPY_DEPARTURES.every((s)=>s.height===112&&s.heading===90&&!SITES.some(old=>old.id===s.id)));
});

test('authenticates both small RCV1 cohorts and rejects malformed transports, body and identities',async()=>{
 for(const s of REGIONAL_STANDS){
  const gzip=bytes(readFileSync(new URL('../public/world/regional-canopy-v1/'+s.file,import.meta.url))),raw=bytes(gunzipSync(gzip));
  const both=[['identity',gzip],['gzip',raw]] as const;
  for(const [encoding,file] of both){
   let calls=0;
   const items=await readRegionalCanopy('/fixture/',s,async(path,init)=>{
    assert.equal(path,'/fixture/regional-canopy-v1/'+s.file);assert.equal(init?.redirect,'error');calls++;
    return new Response(file,{headers:{'content-length':String(s.wireBytes),'content-encoding':encoding}});
   });
   assert.equal(calls,1);assert.equal(items?.length,s.count);
  }
  const flip=gzip.slice(0);new Uint8Array(flip)[9]^=32; // Payload decodes to the exact original model.
  const badDecoded=raw.slice(0);new Uint8Array(badDecoded)[23]^=16;
  for(const r of [new Response(null,{status:404}),new Response(gzip,{status:206}),new Response(gzip,{headers:{'content-range':'bytes 0-4/5'}}),
   new Response(flip),new Response(raw),new Response(gzip.slice(0,100)),new Response(new ArrayBuffer(gzip.byteLength+1)),
   new Response(badDecoded,{headers:{'content-encoding':'gzip'}}),new Response(gzip,{headers:{'content-encoding':'br'}})])
   assert.equal(await readRegionalCanopy('/',s,async()=>r),undefined);
  for(const i of [0,4,8,10]){
   const twin=raw.slice(0);new Uint8Array(twin)[i]^=1;assert.equal(decodeRegionalCanopy(twin,s),undefined);
  }
  const infinite=raw.slice(0);new DataView(infinite).setFloat32(12,-Infinity,true);assert.equal(decodeRegionalCanopy(infinite,s),undefined);
 }
});

test('late success cannot arm a cohort and oversize streaming aborts before parse',async()=>{
 const s=REGIONAL_STANDS[0],gzip=bytes(readFileSync(new URL('../public/world/regional-canopy-v1/'+s.file,import.meta.url)));
 let aborted=false,cancelled=false;
 const late=await readRegionalCanopy('/',s,async(_path,init)=>{
  init?.signal?.addEventListener('abort',()=>aborted=true);
  await new Promise(r=>setTimeout(r,35));return new Response(gzip);
 },7);
 assert(!late&&aborted);
 const oversize=await readRegionalCanopy('/',s,async()=>new Response(new ReadableStream<Uint8Array>({
  start(c){c.enqueue(new Uint8Array(gzip.byteLength+8));},cancel(){cancelled=true;}
 })));
 assert(!oversize&&cancelled);
});
