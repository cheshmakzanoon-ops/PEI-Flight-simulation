import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {BAYWALK_COURT as spec} from '../src/sim/baywalk-native.generated.ts';
import {BAYWALK_COVER_DECODED_SHA,BaywalkNative,loadBaywalkCourt,supportedBaywalkCourt} from '../src/sim/baywalk-native.ts';

const payload=readFileSync(new URL('../public/world/'+spec.asset,import.meta.url));
const response=(buffer:Buffer)=>new Response(Uint8Array.from(buffer));
const original=()=>loadBaywalkCourt('/world/',async url=>{
 assert.equal(url,'/world/'+spec.asset);
 return response(payload);
});

test('Baywalk uses the complete surveyed package against all three atlas digests',async()=>{
 const p=await original();
 assert.ok(p);
 assert.equal(p.shore.length,spec.width*spec.height);
 assert.equal(p.y.length,p.shore.length);
 assert.equal(supportedBaywalkCourt(spec.pinCoverSha,spec.pinTerrainSha,BAYWALK_COVER_DECODED_SHA),true);
 assert.equal(supportedBaywalkCourt(undefined,spec.pinTerrainSha,BAYWALK_COVER_DECODED_SHA),false);
 assert.equal(supportedBaywalkCourt(spec.pinCoverSha,'changed terrain',BAYWALK_COVER_DECODED_SHA),false);
 assert.equal(supportedBaywalkCourt(spec.pinCoverSha,spec.pinTerrainSha,'changed cover receipt'),false);
});

test('Baywalk falls back on a missing or legitimately recompressed altered payload',async()=>{
 assert.equal(await loadBaywalkCourt('/world/',async()=>new Response(null,{status:404})),undefined);
 const changed=gunzipSync(payload);
 changed[changed.length-1]^=1;
 assert.equal(await loadBaywalkCourt('/world/',async()=>response(gzipSync(changed))),undefined);
});

test('Baywalk only adds supported dry land and preserves outside and already dry values',async()=>{
 const data=await original();
 assert.ok(data);
 const q=new BaywalkNative(data);
 const draw=data.shore.findIndex((v,i)=>v>143&&data.y[i]>=50);
 assert.ok(draw>0);
 const x=q.x0+(draw%q.width)*q.step,z=q.z0+Math.floor(draw/q.width)*q.step;
 assert.equal(q.inside(x,z),true);
 assert.equal(q.restored(-1,x,z),true);
 assert.equal(q.restored(1,x,z),false);
 assert.equal(q.distance(-1,x,z),q.signed(x,z));
 assert.equal(q.distance(2.5,x,z),2.5);
 assert.equal(q.distance(-2.5,q.x0-2,z),-2.5);
 assert.equal(q.distance(-2.5,q.x0,z),-2.5);
 assert.ok(Math.abs(q.heightM(x,z)-data.y[draw]*.01)<1e-9);
});
