import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {HOG_WEST_GRADE as G} from '../src/sim/hog-west-grade.generated.ts';
import {gradeAtlasMatches,loadBoundedGrade} from '../src/sim/bounded-grade.ts';
import {pinnedHogBuildingIndex} from '../src/sim/hog-west-grade.ts';
import {sceneryOptions,sceneryReviewBlock} from '../src/app/scenery-profile.ts';

test('Hog Island grade is not a stock terrain or detail-profile override',()=>{
 assert.equal(sceneryOptions('?').has('hogIslandWestGround'),false);
 for(const flag of ['surveyRelief','inlandRelief','buildingShadows','seatedForestShadows']){
  assert.equal(sceneryReviewBlock('hogIslandWestGround',sceneryOptions('?hogIslandWestGround&'+flag)),'terrain');
 }
 assert.equal(sceneryReviewBlock('hogIslandWestGround',sceneryOptions('?scenery=detail&hogIslandWestGround')),'detail');
 assert.equal(sceneryReviewBlock('hogIslandWestGround',sceneryOptions('?hogIslandWestGround&hogIslandPhotoStudy')),undefined);
});

test('western native relief is signed to exact packaged bytes and feasible sparse positions',async()=>{
 const file=readFileSync(new URL('../public/world/'+G.file,import.meta.url));
 const res=(b:Uint8Array)=>new Response(new Uint8Array(b));
 assert.equal(gradeAtlasMatches(G,G.terrainSha256,G.coverCompressedSha256,G.coverDecodedSha256),true);
 assert.equal(gradeAtlasMatches(G,G.terrainSha256,G.coverCompressedSha256,undefined),false);
 assert(await loadBoundedGrade(G,'https://example.test/',async()=>res(file)));
 assert(await loadBoundedGrade(G,'https://example.test/',async()=>res(gunzipSync(file))));
 const damaged=Uint8Array.from(file);damaged[70]^=1;
 assert.equal(await loadBoundedGrade(G,'https://example.test/',async()=>res(damaged)),undefined);
 const buf=gunzipSync(file),n=(G.cellsX*G.sub+1)*(G.cellsZ*G.sub+1),v=new DataView(buf.buffer,buf.byteOffset,buf.byteLength);
 let moved=0;
 for(let i=0;i<n;i++){
  const x=i%65,z=Math.floor(i/65),cm=v.getInt16(i*2,true),w=buf[2*n+i];
  assert(Math.abs(cm)<=G.maxRelativeDeltaCm);
  assert.equal(cm===0,w===0);
  if(x===0||z===0||x===64||z===64)assert.equal(cm,0);
  moved+=Number(cm!==0);
 }
 assert(moved>1200&&moved<1500);
});

test('only the exactly bounded certified building index can authorize the dry seat',async()=>{
 const index=readFileSync(new URL('../public/world/buildings/index.json',import.meta.url));
 const res=(v:Uint8Array)=>new Response(new Uint8Array(v));
 assert.equal(await pinnedHogBuildingIndex('https://example.test/',async url=>{
  assert.equal(url,'https://example.test/buildings/index.json');return res(index);
 }),true);
 assert.equal(await pinnedHogBuildingIndex('',async()=>res(index.subarray(1))),false);
 assert.equal(await pinnedHogBuildingIndex('',async()=>res(Buffer.concat([index,Buffer.from(' ')]))),false);
 const changed=Uint8Array.from(index);changed[70]^=1;
 assert.equal(await pinnedHogBuildingIndex('',async()=>res(changed)),false);
 assert.equal(await pinnedHogBuildingIndex('',async()=>new Response(null,{status:404})),false);
});
