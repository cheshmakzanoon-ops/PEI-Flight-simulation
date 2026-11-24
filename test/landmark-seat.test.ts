import {test} from 'node:test';
import assert from 'node:assert/strict';
import {landmarkSeatFailure} from '../src/sim/landmark-seat.ts';

test('landmark admission rejects missing, dry-but-floating and unseated contact independently',()=>{
 const probes=[{x:20,z:25,low:2.6,high:2.9,minDryDistance:12},{x:21,z:30,low:2.65,high:2.9,minDryDistance:12}];
 const exact={gradeInstalled:(id:string)=>id==='site-fine',dryDistance:()=>33,visualY:()=>2.78,contactY:()=>2.78};
 assert.equal(landmarkSeatFailure('site-fine',probes,exact),undefined);
 assert.equal(landmarkSeatFailure('site-other',probes,exact),'grade');
 assert.equal(landmarkSeatFailure('site-fine',[],exact),'empty');
 assert.equal(landmarkSeatFailure('site-fine',probes,{...exact,dryDistance:()=>2}),'surface');
 assert.equal(landmarkSeatFailure('site-fine',probes,{...exact,visualY:()=>NaN}),'surface');
 assert.equal(landmarkSeatFailure('site-fine',probes,{...exact,visualY:(x:number)=>x===21?.95:2.78}),'seat');
 assert.equal(landmarkSeatFailure('site-fine',probes,{...exact,contactY:()=>2.72}),'contact');
});
