import assert from 'node:assert/strict';
import test from 'node:test';
import {orbyClosureRequested,sceneryOptions,standardOpenCoastRequested} from '../src/app/scenery-profile.ts';
import {SHORT_OPEN_COAST_CELLS,allowShortOpenArc,PANMURE_SHORE_CELLS,allowPanmureOpenArc,TRYON_SHORE_CELLS,allowTryonOpenArc} from '../src/sim/open-coast-closure.ts';
import {allowOrbyZeroArc, ORBY_COVER_SHA} from '../src/sim/orby-shore-closure.ts';
import {strictArc,type Quad} from '../src/sim/strict-shore-arc.ts';
import {LEGACY_SHORE_MIN_CHORD_M} from '../src/sim/shoreline.ts';

test('two exact short chords opt out independently of Orby and the broad preview',()=>{
 const options=(q='')=>sceneryOptions('?'+q);
 assert(standardOpenCoastRequested(options()));
 assert(standardOpenCoastRequested(options('stockOrbyCoast')));
 assert(orbyClosureRequested(options('stockOpenCoast')));
 for(const flag of ['stockOpenCoast','legacyShoreArcs','scenery=detail','nearshoreFoamStudy','surveyRelief','basinChannel','duneReliefStudy']){
  assert(!standardOpenCoastRequested(options(flag)),flag);
 }
});

test('one exact loaded grid cell in each exposed area admits a shorter pinned wall with unchanged edge crossings',()=>{
 assert.equal(SHORT_OPEN_COAST_CELLS.length,2);
 for(const [i,j,q] of SHORT_OPEN_COAST_CELLS){
  assert(allowShortOpenArc(i,j,4096,2720,ORBY_COVER_SHA,q));
  assert(!allowShortOpenArc(i+1,j,4096,2720,ORBY_COVER_SHA,q));
  assert(!allowShortOpenArc(i,j,4096,2720,undefined,q));
  assert(!allowShortOpenArc(i,j,2048,1360,ORBY_COVER_SHA,q));
  assert(!allowShortOpenArc(i,j,4096,2720,ORBY_COVER_SHA,[q[0],q[1],q[2]+1,q[3]]));
  assert(!allowOrbyZeroArc(i,j,4096,2720,ORBY_COVER_SHA,q));
  const w=(2.54*76762.59317717304)/4096,h=(1.16*111161.08375388647)/2720;
  const old=strictArc(q,w,h,.047,96,LEGACY_SHORE_MIN_CHORD_M);
  const repair=strictArc(q,w,h,.047,96,.6);
  assert.equal(old.mode,'unsupported');
  assert.equal(repair.mode,'exact');assert(repair.points.length>2&&repair.points.length<11);
  assert(repair.boundM<=.047&&repair.oldChordErrorM!>.7&&repair.oldChordErrorM!<.8);
  assert.deepEqual([repair.points[0],repair.points.at(-1)],old.points);
  for(const [u,v] of repair.points){
   const [a,b,c,d]=q as Quad;
   assert(Math.abs(a*(1-u)*(1-v)+b*u*(1-v)+c*u*v+d*(1-u)*v)<1e-10);
  }
 }
});

test('Panmure qualifies only frozen mixed cells near the east headland and retains inherited ends',()=>{
 assert.equal(PANMURE_SHORE_CELLS.length,5);
 const w=2.54*76762.59317717304/4096,h=1.16*111161.08375388647/2720;
 for(const [i,j,q] of PANMURE_SHORE_CELLS){
  assert(allowPanmureOpenArc(i,j,4096,2720,ORBY_COVER_SHA,q));
  assert(!allowPanmureOpenArc(i,j,4096,2720,'wrong',q));
  assert(!allowPanmureOpenArc(i,j,4096,2720,ORBY_COVER_SHA,[q[0]+1,q[1],q[2],q[3]]));
  assert(!allowShortOpenArc(i,j,4096,2720,ORBY_COVER_SHA,q));
  const z=q.includes(0),baseline=strictArc(q,w,h,.047,96,LEGACY_SHORE_MIN_CHORD_M,z);
  const newArc=strictArc(q,w,h,.047,96,.60,z);
  assert.equal(newArc.mode,'exact');assert(newArc.boundM<=.047&&newArc.oldChordErrorM!>=.6);
  assert.deepEqual([newArc.points[0],newArc.points.at(-1)],[baseline.points[0],baseline.points.at(-1)]);
  for(const [u,v] of newArc.points){
   const [a,b,c,d]=q;
   assert(Math.abs(a*(1-u)*(1-v)+b*u*(1-v)+c*u*v+d*(1-u)*v)<1e-10);
  }
 }
});

test('Cape Tryon keeps isolated one-zero cells on the existing mask and does not round neighbouring shores',()=>{
 assert.equal(TRYON_SHORE_CELLS.length,5);
 const w=2.54*76762.59317717304/4096,h=1.16*111161.08375388647/2720;
 for(const [i,j,q] of TRYON_SHORE_CELLS){
  assert.equal(q.filter(v=>v===0).length,1);
  assert(allowTryonOpenArc(i,j,4096,2720,ORBY_COVER_SHA,q));
  assert(!allowTryonOpenArc(i,j,4096,2720,undefined,q));
  assert(!allowTryonOpenArc(i,j,4096,2720,ORBY_COVER_SHA,[q[0]+.1,q[1],q[2],q[3]]));
  assert(!allowPanmureOpenArc(i,j,4096,2720,ORBY_COVER_SHA,q));
  assert(!allowShortOpenArc(i,j,4096,2720,ORBY_COVER_SHA,q));
  const prior=strictArc(q,w,h,.047,96,99,true),next=strictArc(q,w,h,.047,96,.35,true);
  assert.equal(next.mode,'exact');assert(next.boundM<=.047&&next.oldChordErrorM!>=.35);
  assert.deepEqual([next.points[0],next.points.at(-1)],[prior.points[0],prior.points.at(-1)]);
  for(const [u,v] of next.points){const [a,b,c,d]=q;assert(Math.abs(a*(1-u)*(1-v)+b*u*(1-v)+c*u*v+d*(1-u)*v)<1e-10);}
 }
});
