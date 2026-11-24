import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {cavendishAtlasMatches,loadCavendishWaterCore,type CavendishWaterSource} from '../src/sim/cavendish-water-core.ts';

const raw=new Uint8Array(1024).fill(240);
for(let r=7;r<24;r++)for(let i=8;i<22;i++)raw[32*r+i]=63;
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const datum={id:'test-cavendish-water',file:'cavendish/test-water.gz',width:32,height:32,left:0,top:0,step:1,units:32,waterY:1.451,
 terrainSha256:'elevation',coverCompressedSha256:'cover-wire',coverDecodedSha256:'cover-decoded'};
function stamp(b:Uint8Array):[CavendishWaterSource,Uint8Array]{
 const zip=new Uint8Array(gzipSync(b));
 return [{...datum,compressedBytes:zip.length,decodedBytes:b.length,wireSha256:sha(zip),sha256:sha(b)},zip];
}
test('bounded water pack accepts compressed or decoded HTTP and retains independent stage',async()=>{
 const [s,zip]=stamp(raw); const expected='/world/'+s.file;
 for(const chunk of [zip,raw]){
  const a=await loadCavendishWaterCore(s,'/world/',async(path,options)=>{
   assert.equal(path,expected);assert(options?.signal);return new Response(new Uint8Array(chunk));
  });
  assert(a?.water(12,12)&&!a.water(3,3));assert.equal(a.spec.waterY,1.451);
 }
 assert(cavendishAtlasMatches(s,'elevation','cover-wire','cover-decoded'));
 assert(!cavendishAtlasMatches(s,'elevation','cover-wire',undefined));
 assert(!cavendishAtlasMatches(s,'elevation','different','cover-decoded'));
});

test('no atlas water is installed from malformed status, body, boundary or elapsed deadline',async()=>{
 const [s]=stamp(raw);
 const corrupt=new Uint8Array(raw);corrupt[33]=241;
 for(const bad of [new Response(new Uint8Array(raw),{status:206}),new Response(corrupt),new Response(new Uint8Array(90_000)),
                  new Response(null,{status:404}),new Response(new Uint8Array([31,139,0,0,0]))]){
  assert.equal(await loadCavendishWaterCore(s,'/world/',async()=>bad),undefined);
 }
 const escaped=new Uint8Array(raw);escaped[31]=110;
 const [invalid,z]=stamp(escaped);
 assert.equal(await loadCavendishWaterCore(invalid,'/world/',async()=>new Response(new Uint8Array(z))),undefined);
 let signal:AbortSignal|null|undefined;
 const late=await loadCavendishWaterCore(s,'/world/',async(_url,o)=>{
  signal=o?.signal;
  await new Promise(resolve=>setTimeout(resolve,60));
  return new Response(new Uint8Array(raw));
 },12);
 assert.equal(late,undefined);assert(signal?.aborted);
});

test('the shipping archive matches final pins and wet/dry controls at game scale',async ()=>{
 const {readFileSync}=await import('node:fs');
 const {CAVENDISH_WATER_CORE:s}=await import('../src/sim/cavendish-water-core.generated.ts');
 const {project}=await import('../src/sim/geo.ts');
 const bytes=new Uint8Array(readFileSync(new URL('../public/world/'+s.file,import.meta.url)));
 assert.equal(bytes.byteLength,s.compressedBytes);
 assert.equal(sha(bytes),s.wireSha256);
 const a=await loadCavendishWaterCore(s,'/world/',async()=>new Response(bytes));
 assert(a);assert.equal(a.spec.waterY,1.468);
 const witnesses:ReadonlyArray<{expect:'wet'|'dry';coord:[number,number]}>=JSON.parse(
  readFileSync(new URL('../data/cavendish-dunelands/flight-surface-witnesses.json',import.meta.url),'utf-8'));
 for(const {expect,coord} of witnesses){
  const {x,z}=project(...coord);
  assert.equal(a.water(x,z),expect==='wet',JSON.stringify(coord));
 }
 assert.equal(a.bytes.filter(x=>x<128).length,243661);
});
