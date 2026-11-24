import assert from 'node:assert/strict';
import {test} from 'node:test';
import {sceneryOptions,shoreFoamDetailRequested} from '../src/app/scenery-profile.ts';

test('Standard uses the broken crests without replacing separately requested water baselines',()=>{
 const q=(s:string)=>shoreFoamDetailRequested(sceneryOptions(s));
 assert(q(''));assert(q('?departure=spinnakers-low'));assert(q('?scenery=detail'));
 assert(q('?coastalOptics'));
 for(const k of ['legacyShoreArcs','nearshoreFoamStudy','orthophotoSeamStudy','buildingShadows','surveyRelief','inlandRelief','basinChannel','basinWharf',
  'montagueReachOptics','montagueFoundationPreview','northBaywalkPreview','northBaywalkConcrete','spinnakersPreview','baywalkConcrete']){
  assert(!q('?'+k),k);
  assert(q('?'+k+'&shoreFoamDetail'),k);
 }
 assert(!q('?stockShoreFoam'));
 assert(!q('?scenery=detail&stockShoreFoam&shoreFoamDetail'));
});
