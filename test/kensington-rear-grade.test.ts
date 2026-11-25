import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const src=new URL('../tools/art/kensington-station-study/fit/',import.meta.url);
const bytes=(name:string)=>readFileSync(new URL(name,src));
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const planBytes=bytes('rear-grade-protocol.json');
const plan=JSON.parse(planBytes.toString());
const proof=JSON.parse(bytes('rear-grade-aggregate.json').toString());

test('Kensington rear comparison uses frozen public inputs, not the original sealed fit points',()=>{
 assert.equal(sha(planBytes),'c990dcc23a900653208f52c483346503145c92118f2f45c09267cf32008a6c46');
 assert.equal(sha(bytes('rear-grade-aggregate.json')),'91b2eecf9551d2b7fdb7e38572c0bf253cf3c8e8d9f8605b90003f5ddf122a1b');
 assert.equal(sha(bytes('fit-sealed.json')),'44e06f8cdbc30e356366dc9f0a0dd03288d6d1fb4007e2272dd866dd092bc45c');
 assert.equal(proof.prelock,sha(planBytes));
 assert.equal(proof.sourceETag,plan.copc.etag);
 assert.equal(plan.copc.class,2);
 assert.equal(plan.rules.geometryAdmission,false);
 assert.equal(plan.rules.publishPoints,false);
 assert.equal(proof.oldPulseDisjointVerified,false);
 assert(proof.bodyWireBytes>0&&proof.bodyWireBytes<=plan.copc.closedWindowBytesLimit);
 assert(proof.queryDecodedPoints>0&&proof.queryDecodedPoints<=plan.copc.capCandidatePoints);
 for(const [i,a] of plan.blocks.entries()){
   assert(a.v[0]>=18.75&&a.v[1]<=22.75);
   for(const b of plan.blocks.slice(i+1))assert(a.u[1]<b.u[0]||b.u[1]<a.u[0]);
 }
});

test('fixed near-datum correction and original terrain LOD residuals stay distinct',()=>{
 assert.equal(proof.deduplicatedSameBlockReturns,0);
 let fit=0,check=0;
 for(const q of plan.blocks){
   const b=proof.blocks[q.label];
   assert.equal(b.role,q.role);
   assert(b.usableClass2Returns>=b.uniquePulses&&b.uniquePulses>=12);
   if(q.role==='fit')fit+=b.uniquePulses;
   else {
     check+=b.uniquePulses;
     assert(b.p90AbsoluteM[0]<.04, 'N112 held residual');
     assert(b.p90AbsoluteM[1]>.11&&b.p90AbsoluteM[1]<.12, 'N56 with same scalar only');
     assert(b.p90AbsoluteM[2]>4.4, 'N8 with same scalar only');
   }
 }
 assert.deepEqual([fit,check],[72,65]);
 assert(Math.abs(proof.fitCommonCGVD2013MinusCurrentGameN112M-(-.1123664569862477))<1e-10);
});
