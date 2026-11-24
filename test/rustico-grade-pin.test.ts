import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {loadBoundedGrade,gradeAtlasMatches} from '../src/sim/bounded-grade.ts';
import {RUSTICO_GRADE} from '../src/sim/rustico-grade.generated.ts';
import {sceneryOptions,sceneryReviewBlock} from '../src/app/scenery-profile.ts';

test('Rustico grade is explicitly attributed to the stock sources, rejects corruption and has its own cap',async()=>{
 const s=RUSTICO_GRADE,r=readFileSync(new URL('../public/world/'+s.file,import.meta.url));const d=gunzipSync(r);
 const digest=(x:Uint8Array)=>createHash('sha256').update(x).digest('hex');
 assert.equal(r.length,3201);assert.equal(d.length,49923);
 assert.equal(digest(r),s.wireSha);assert.equal(digest(d),s.sha256);
 assert.equal(gradeAtlasMatches(s,s.terrainSha256,s.coverCompressedSha256,s.coverDecodedSha256),true);
 assert.equal(gradeAtlasMatches(s,s.terrainSha256,s.coverCompressedSha256,'alternate decoded atlas'),false);
 const n=d.length/3;
 let max=0,moved=0;
 for(let i=0;i<n;i++){
  const cm=d.readInt16LE(2*i);assert(cm>=0);
  max=Math.max(max,cm);if(cm)moved++;
  const x=i%129,z=Math.floor(i/129);
  if(x===0||x===128||z===0||z===128)assert.equal(cm+d[n*2+i],0);
 }
 assert.equal(max,236);assert.equal(s.maxRelativeDeltaCm,240);assert.equal(moved,1834);
 assert(await loadBoundedGrade(s,'/world/',async()=>new Response(new Uint8Array(r))));
 assert.equal(await loadBoundedGrade(s,'/world/',async()=>new Response(new Uint8Array(r.length))),undefined);
 assert.equal(await loadBoundedGrade(s,'/world/',async()=>new Response(new Uint8Array(d.length))),undefined);
});

test('Rustico does not activate implicitly and preserves the independent Cavendish grade option',()=>{
 assert(!sceneryOptions('?scenery=detail&cavendishDetail').has('northRusticoLighthouseStudy'));
 const q=sceneryOptions('?cavendishDetail&northRusticoLighthouseStudy');
 assert(q.has('gablesGradeReview'));assert.equal(sceneryReviewBlock('northRusticoLighthouseStudy',q),undefined);
 for(const f of ['inlandRelief','surveyRelief','buildingShadows']){
  assert.equal(sceneryReviewBlock('northRusticoLighthouseStudy',sceneryOptions('?northRusticoLighthouseStudy&'+f)),'terrain');
 }
});
