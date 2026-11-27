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

function stationFixture(){
 const mesh=new Mesh(new BufferGeometry()),flags={dispatch:true,flight:false,valid:true,stationValid:true};
 const asks:{signal:AbortSignal;finish:(ready:boolean)=>void}[]=[];
 const shown:{shed:boolean;station:boolean}[]=[];
 let stationReady=false,viewsDisposed=0;
 const session=new StandardIndustrialSession({current:()=>flags.valid,preparing:()=>flags.dispatch,flying:()=>flags.flight,
  ground:()=>({fine:mesh,seams:'112:112,112,112,112'}),
  stage:async(permit,signal)=>({intact:()=>permit()&&!signal.aborted,stationIntact:()=>stationReady&&flags.stationValid,
   prepareStation(s){return new Promise<boolean>(resolve=>asks.push({signal:s,finish(ready){
    if(!s.aborted&&ready)stationReady=true;
    resolve(ready);
   }}));},
   compare(shed,paint,station){const a=!!(shed&&permit()),b=!!(a&&station&&stationReady&&flags.stationValid);
    shown.push({shed:a,station:b});return paint(a,b);},
   dispose(){viewsDisposed++;}})});
 return {session,flags,asks,shown,disposed:()=>viewsDisposed,
  async start(){session.prepare();await flush();assert(session.ready);session.prepare();session.prepare();await flush();},
  takeoff(){const result=session.authorizeDeparture();flags.dispatch=false;flags.flight=true;return result;}};
}
test('a delayed station offer never appears after Begin and cannot disable the cleared shed',async()=>{
 const f=stationFixture();await f.start();
 assert.equal(f.asks.length,1);assert(!f.session.stationReady);assert(f.takeoff());
 assert(f.asks[0].signal.aborted);
 f.asks[0].finish(true);await flush();
 assert.equal(f.session.draw(()=>9),9);assert(f.session.drawn);assert(!f.session.stationDrawn);
 assert.deepEqual(f.shown,[{shed:true,station:false}]);
 f.session.dispose();assert.equal(f.disposed(),1);
});
test('a ready station may draw with the shed, but later station-proof loss cannot re-arm on the same flight',async()=>{
 const f=stationFixture();await f.start();
 f.asks[0].finish(true);await flush();
 assert(f.session.stationReady);assert(f.takeoff());
 f.session.draw(()=>{});assert(f.session.stationDrawn);
 f.flags.stationValid=false;f.session.draw(()=>{});assert(f.session.drawn);assert(!f.session.stationDrawn);
 f.flags.stationValid=true;f.session.draw(()=>{});assert(f.session.drawn);assert(!f.session.stationDrawn);
 assert.deepEqual(f.shown,[{shed:true,station:true},{shed:true,station:false},{shed:true,station:false}]);
 f.session.dispose();
});
test('a terminal invalid station is not fetched on every Dispatch frame',async()=>{
 const f=stationFixture();await f.start();f.asks[0].finish(false);await flush();
 for(let i=0;i<10;i++)f.session.prepare();await flush();
 assert.equal(f.asks.length,1);assert(!f.session.stationReady);assert(f.takeoff());
 f.session.draw(()=>{});assert(f.session.drawn);assert(!f.session.stationDrawn);f.session.dispose();
});

import {olearyStationStandardRequested} from '../src/app/scenery-profile.ts';
test('the station-only veto protects the composed roof and shed and cannot opt in on a legacy path',()=>{
 const q=(s:string)=>new URLSearchParams(s);
 assert(olearyStationStandardRequested(q('departure=oleary-railway-low')));
 const veto=q('departure=oleary-railway-low&stockOlearyStation');
 assert(!olearyStationStandardRequested(veto));assert(olearyIndustrialStandardRequested(veto));
 assert(olearyAccessRoofRequested(veto));assert(olearyCompoundRoofsRequested(veto));
 for(const flag of ['olearyExteriorStudy','stockOlearyExterior','stockOlearyIndustrial','qa','scenery=detail','departure=a&departure=b'])
  assert(!olearyStationStandardRequested(q(flag)),flag);
});

test('on dispatch selection or phase exit, cancel the current station offer and isolate it from a later visit',async()=>{
 const f=stationFixture();await f.start();
 f.flags.dispatch=false;f.session.leaveStationDispatch();assert(f.asks[0].signal.aborted);
 f.asks[0].finish(true);await flush();
 f.flags.dispatch=true;f.session.prepare();await flush();
 assert.equal(f.asks.length,2);assert(!f.session.stationReady);
 f.asks[1].finish(true);await flush();assert(f.session.stationReady);assert(f.takeoff());
 f.session.draw(()=>{});assert(f.session.drawn);assert(f.session.stationDrawn);f.session.dispose();
});

test('selection change before the station microtask starts does not consume the next real visit',async()=>{
 const f=stationFixture();
 f.session.prepare();await flush();assert(f.session.ready);
 // The route synchronously changed from the dispatch control, but the next
 // render has not yet delivered leaveStationDispatch().
 f.session.prepare();f.flags.dispatch=false;await flush();
 assert.equal(f.asks.length,0);assert(!f.session.stationUnavailable);
 f.session.leaveStationDispatch();f.flags.dispatch=true;f.session.prepare();await flush();
 assert.equal(f.asks.length,1);
 f.asks[0].finish(true);await flush();assert(f.session.stationReady);
 f.session.dispose();
});
