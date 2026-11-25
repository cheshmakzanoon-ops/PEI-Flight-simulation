import assert from 'node:assert/strict';
import test from 'node:test';
import {orbyClosureRequested,sceneryOptions,standardOpenCoastRequested} from '../src/app/scenery-profile.ts';
import {SHORT_OPEN_COAST_CELLS,allowShortOpenArc} from '../src/sim/open-coast-closure.ts';
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
