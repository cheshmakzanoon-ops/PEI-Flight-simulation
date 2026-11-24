import assert from 'node:assert/strict';
import {test} from 'node:test';
import {orbyClosureRequested,sceneryOptions} from '../src/app/scenery-profile.ts';
import {matchesOrbyTerrainBounds} from '../src/sim/orby-shore-closure.ts';
test('the bounded Orby closure joins Standard without taking over independent shore comparisons',()=>{
 const q=(s:string)=>orbyClosureRequested(sceneryOptions(s));
 assert(matchesOrbyTerrainBounds([-64.47,45.94,-61.93,47.10]));
 assert(!matchesOrbyTerrainBounds([-64.46,45.94,-61.93,47.10]));
 assert(!matchesOrbyTerrainBounds([-64.47,45.94,-61.93,47.10,0]));
 assert(q(''));assert(q('?departure=cavendish-low'));assert(q('?coastalOptics'));
 for(const flag of ['stockOrbyCoast','legacyShoreArcs','scenery=detail']){
  assert(!q('?'+flag),flag);assert(!q('?'+flag+'&orbyCoastClosure'),flag);
 }
 for(const flag of ['orthophotoSeamStudy','nearshoreFoamStudy','surveyRelief','inlandRelief','buildingShadows']){
  assert(!q('?'+flag),flag);assert(q('?'+flag+'&orbyCoastClosure'),flag);
 }
});
