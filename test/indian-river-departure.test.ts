import test from 'node:test';
import assert from 'node:assert/strict';
import {IndianRiverDeparture,type RiverCohort} from '../src/app/indian-river-departure.ts';

const drain=()=>new Promise<void>(done=>setImmediate(done));
const fixture=()=>{
 let dispatch=true,ground='stock',ready=true,commit=true;
 let calls:string[]=[];
 const seat=new IndianRiverDeparture<object>(()=>dispatch),flight={};
 const q:RiverCohort={ready:()=>ready,commit:()=>{
  calls.push('install');ground='measured';return commit;
 },maintain:()=>ready,dispose:()=>{
  calls.push('restore');ground='stock';
 }};
 return {seat,flight,q,setDispatch:(d:boolean)=>dispatch=d,source:(v:boolean)=>ready=v,
  failCommit:()=>commit=false,ground:()=>ground,calls};
};

test('the prepared grade is installed before the first physics step and withdrawal cannot be readmitted',async()=>{
 const x=fixture();
 x.seat.prepare(async()=>x.q);await drain();assert(x.seat.ready);assert.equal(x.ground(),'stock');
 assert(x.seat.begin(x.flight,true));x.setDispatch(false);
 assert(x.seat.beforeStep(x.flight,true,true));assert.equal(x.ground(),'measured');
 x.source(false);assert(!x.seat.beforeStep(x.flight,true,true));assert.equal(x.ground(),'stock');
 x.source(true);assert(!x.seat.beforeStep(x.flight,true,true));assert.deepEqual(x.calls,['install','restore']);
});

test('a partially installed cohort and a low first frame both restore stock before physics',async()=>{
 for(const low of [false,true]){
  const x=fixture();x.seat.prepare(async()=>x.q);await drain();
  assert(x.seat.begin(x.flight,true));x.setDispatch(false);x.failCommit();
  assert(!x.seat.beforeStep(x.flight,true,!low));assert.equal(x.ground(),'stock');
  assert.deepEqual(x.calls,low?['restore']:['install','restore']);
 }
});

test('starting early aborts the checked fetch and cannot advance a late result into a different flight',async()=>{
 const x=fixture();let finish:(q:RiverCohort)=>void=()=>assert.fail(),signal:AbortSignal|undefined;
 x.seat.prepare(s=>{signal=s;return new Promise(done=>finish=done);});
 assert(signal&&!signal.aborted);assert(!x.seat.begin(x.flight,true));x.setDispatch(false);assert(signal.aborted);
 finish(x.q);await drain();assert(!x.seat.beforeStep(x.flight,true,true));
 assert(!x.seat.beforeStep({},true,true));assert.equal(x.ground(),'stock');assert.deepEqual(x.calls,['restore']);
});
