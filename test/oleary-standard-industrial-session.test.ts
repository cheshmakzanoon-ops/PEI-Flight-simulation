import assert from 'node:assert/strict';
import test from 'node:test';
import {BufferGeometry,Mesh} from 'three';
import {StandardIndustrialSession,type IndustrialStandardView} from '../src/render/oleary-railway/standard-industrial-session.ts';

const flush=()=>new Promise<void>(r=>setImmediate(r));
function fixture(){
 const mesh=new Mesh(new BufferGeometry()), flags={dispatch:true,flight:false,owner:true,seams:'112:112,112,112,112',verified:true};
 const work:{permit:()=>boolean;signal:AbortSignal;finish:(v:IndustrialStandardView|undefined)=>void}[]=[];
 const audit={attemptedDraws:0,measured:0,disposed:0};
 const session=new StandardIndustrialSession({current:()=>flags.owner,preparing:()=>flags.dispatch,flying:()=>flags.flight,
  ground:()=>({fine:mesh,seams:flags.seams}),stage:(permit,signal)=>new Promise(resolve=>work.push({permit,signal,finish:resolve}))});
 const complete=(i:number)=>{
  const task=work[i],intact=()=>flags.verified&&!task.signal.aborted&&task.permit();
  task.finish({intact,compare(on,draw){audit.attemptedDraws++;const active=on&&intact();audit.measured+=+active;return draw(active);},
   dispose(){audit.disposed++;}});
 };
 const takeoff=()=>{const result=session.authorizeDeparture();flags.dispatch=false;flags.flight=true;return result;};
 return {session,flags,work,audit,complete,takeoff};
}

test('only a verified Dispatch owner can draw, and an in-flight revocation cannot re-arm',async()=>{
 const {session,flags,work,audit,complete,takeoff}=fixture();
 session.prepare();session.prepare();assert.equal(work.length,1);assert(!session.ready);
 complete(0);await flush();assert(session.ready);assert(takeoff());
 assert.equal(session.draw(()=>42),42);assert(session.drawn);
 flags.verified=false;session.draw(()=>{});assert(!session.drawn);
 flags.verified=true;session.draw(()=>{});assert(!session.drawn);
 assert.deepEqual(audit,{attemptedDraws:2,measured:1,disposed:0});
 session.dispose();assert.equal(audit.disposed,1);
});

test('a late result or a branch that bypasses Dispatch never alters an ongoing flight',async()=>{
 const {session,flags,work,audit,complete,takeoff}=fixture();
 session.prepare();assert(!takeoff());assert(work[0].signal.aborted);
 complete(0);await flush();session.draw(()=>{});assert(!session.drawn);
 assert.deepEqual(audit,{attemptedDraws:0,measured:0,disposed:1});
 flags.flight=false;flags.dispatch=true;
 session.prepare();assert.equal(work.length,2);complete(1);await flush();assert(session.ready);
 session.stockDeparture();flags.dispatch=false;flags.flight=true;session.draw(()=>{});assert(!session.drawn);
 session.dispose();
});

test('a switched terrain owner cannot borrow its predecessor’s clearance',async()=>{
 const {session,flags,work,audit,complete,takeoff}=fixture();
 session.prepare();flags.seams='112:112,56,112,112';complete(0);await flush();
 assert(!session.ready);assert.equal(audit.disposed,1);
 session.prepare();assert.equal(work.length,2);complete(1);await flush();assert(session.ready);
 assert(takeoff());flags.owner=false;session.draw(()=>{});assert(!session.drawn);
 assert.equal(audit.attemptedDraws,0);session.dispose();
});

import {olearyAccessRoofRequested,olearyCompoundRoofsRequested,olearyIndustrialStandardRequested,
 OLEARY_STANDARD_INDUSTRIAL_ROUTE} from '../src/app/scenery-profile.ts';
test('the Standard industrial veto does not turn off its two roof co-owners',()=>{
 const q=(s:string)=>new URLSearchParams(s);
 assert.equal(OLEARY_STANDARD_INDUSTRIAL_ROUTE,'oleary-railway-low');
 assert(olearyIndustrialStandardRequested(q('')));
 assert(olearyIndustrialStandardRequested(q('diagnostics&scenery=standard&departure='+OLEARY_STANDARD_INDUSTRIAL_ROUTE)));
 assert(!olearyIndustrialStandardRequested(q('stockOlearyIndustrial')));
 assert(olearyAccessRoofRequested(q('stockOlearyIndustrial')));
 assert(olearyCompoundRoofsRequested(q('stockOlearyIndustrial')));
 for(const s of ['scenery=detail','scenery=standard&scenery=standard','departure=a&departure=b','qa',
  'stockOlearyAccessRoof','stockOlearyExterior','olearyExteriorStudy','olearyWarehouseStudy','unrelatedReview'])
  assert(!olearyIndustrialStandardRequested(q(s)),s);
});
