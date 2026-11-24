import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {DUNE_RELIEF as R} from '../src/sim/dune-relief.generated.ts';
import {boundedGradeTiles,gradeAtlasMatches,loadBoundedGrade} from '../src/sim/bounded-grade.ts';
import {sceneryOptions,sceneryReviewBlock} from '../src/app/scenery-profile.ts';
const file=(name:string)=>readFileSync(new URL('../public/world/'+name,import.meta.url));
const response=(b:Uint8Array)=>new Response(new Uint8Array(b));

test('two surveyed dunes use independent stock terrain owners and never flag default',()=>{
 assert.equal(sceneryOptions('?scenery=detail').has('duneReliefStudy'),false);
 assert.equal(sceneryReviewBlock('duneReliefStudy',sceneryOptions('?duneReliefStudy&inlandRelief')),'terrain');
 assert.equal(sceneryReviewBlock('duneReliefStudy',sceneryOptions('?duneReliefStudy&duneSandDetail')),undefined);
 assert.equal(sceneryReviewBlock('duneSandDetail',sceneryOptions('?duneReliefStudy&duneSandDetail')),undefined);
 assert.deepEqual([...boundedGradeTiles(R.map(spec=>({grid:{spec}} as never))).keys()],['6-7','30-11']);
});

test('each small signed fill uses a zero-boundary weight mask and authenticated inputs',async()=>{
 for(const p of R){
  assert(gradeAtlasMatches(p,p.terrainSha256,p.coverCompressedSha256,p.coverDecodedSha256));
  assert(!gradeAtlasMatches(p,p.terrainSha256,p.coverCompressedSha256,undefined));
  const buffer=file(p.file);
  assert(buffer.length<5500);
  assert(await loadBoundedGrade(p,'',async()=>response(buffer)));
  const data=gunzipSync(buffer),N=65*65,v=new DataView(data.buffer,data.byteOffset,data.byteLength);
  const moved=data.subarray(N*2).filter(Boolean).length;
  assert(moved>1200&&moved<2100);
  for(let j=0;j<65;j++)for(let i=0;i<65;i++){
   const k=j*65+i,weight=data[k+2*N],d=v.getInt16(k*2,true);
   assert((weight===0)===(d===0)&&Math.abs(d)<=240);
   if(i===0||j===0||i===64||j===64)assert.equal(d,0);
  }
 }
});

test('failure in one bounded dune request does not produce a callable height sampler',async()=>{
 const base=file(R[0].file);const damaged=Uint8Array.from(base);damaged[base.length-4]^=1;
 assert.equal(await loadBoundedGrade(R[0],'',async()=>response(damaged)),undefined);
 assert(await loadBoundedGrade(R[1],'',async()=>response(gunzipSync(file(R[1].file)))));
});
