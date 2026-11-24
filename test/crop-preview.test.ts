import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {checkedFieldPilot,cropFieldAtlasMatches} from '../src/render/fields-pilot.ts';
import {FIELD_PILOT as M} from '../src/render/fields-pilot.generated.ts';
const packed=readFileSync(new URL('../public/world/fields-pilot.rgba.gz',import.meta.url));
const raw=gunzipSync(packed);
const scan=readFileSync(new URL('../public/world/furrow-relief.webp',import.meta.url));
const base='https://assets.example/world/';
const bytes=(b:Buffer)=>new Uint8Array(b);
const both=(mask:Buffer,status=200,furrow:Buffer=scan):typeof fetch=>async url=>
 new Response(bytes(String(url).endsWith('.gz')?mask:furrow),{status:String(url).endsWith('.gz')?status:200});

test('dated field preview admits the two exact wire representations only',async()=>{
 for(const input of [packed,raw]){
  const value=await checkedFieldPilot(base,both(input),3000);
  assert.ok(value);
  assert.deepEqual(Buffer.from(value!.bytes),raw);
  assert.deepEqual(Buffer.from(value!.scan),scan);
 }
});

test('field preview stays stock on altered, partial, missing, and oversized assets',async()=>{
 const bad=Buffer.from(packed),badScan=Buffer.from(scan);
 bad[bad.length-6]^=127;
 badScan[badScan.length-8]^=127;
 for(const f of [both(bad),both(packed.subarray(0,-1)),both(packed,404),both(packed,206),
  both(packed,200,badScan),both(packed,200,Buffer.concat([scan,scan]))]){
  assert.equal(await checkedFieldPilot(base,f,2200),undefined);
 }
 assert.ok(cropFieldAtlasMatches(M.terrainSha,M.coverSha,M.coverDecodedSha));
 assert.ok(!cropFieldAtlasMatches(M.terrainSha,M.coverSha,undefined));
 assert.ok(!cropFieldAtlasMatches(M.terrainSha,undefined,M.coverDecodedSha));
 assert.ok(!cropFieldAtlasMatches(undefined,M.coverSha,M.coverDecodedSha));
});

test('field preview aborts stalled assets without constructing renderer objects',async()=>{
 const signals:AbortSignal[]=[];
 const hold:typeof fetch=async (_url,options)=>{
  signals.push(options!.signal!);
  return new Response(new ReadableStream<Uint8Array>({start(){}}));
 };
 assert.equal(await checkedFieldPilot(base,hold,18),undefined);
 assert.equal(signals.length,2);
 assert.ok(signals.every(s=>s.aborted));
});
