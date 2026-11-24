import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyReviewSceneryURL,COASTAL_OPTICS_FLAGS,reviewedScenery,sceneryOptions,sceneryReviewBlock}
 from '../src/app/scenery-profile.ts';
test('the coastal shortcut opts in without persisting or changing its member flags',()=>{
 const url='https://sim.example/?departure=cavendish-low&diagnostics';
 const next=new URL(applyReviewSceneryURL(url,new Set(['coastalOptics']),'cavendish-low'));
 assert.deepEqual(reviewedScenery(next.search),['coastalOptics']);
 assert.equal(next.searchParams.get('departure'),'cavendish-low');
 assert(next.searchParams.has('diagnostics'));
 for(const k of COASTAL_OPTICS_FLAGS){
  assert(!next.searchParams.has(k));assert(sceneryOptions(next.search).has(k));
  assert(!sceneryOptions(new URL(url).search).has(k));
 }
 const independently=new URL(applyReviewSceneryURL(next.href+'&shoreToneStudy',new Set(),'cavendish-low'));
 assert(!independently.searchParams.has('coastalOptics'));
 assert(independently.searchParams.has('shoreToneStudy'));
 assert(!sceneryOptions(independently.search).has('aerialPerspectiveStudy'));
});
test('the shortcut neither overrides a protected explicit study nor changes Detail',()=>{
 for(const k of ['legacyShoreArcs','orthophotoSeamStudy','buildingShadows','surveyRelief','inlandRelief','kingsDryCrownStudy','duneReliefStudy']){
  const q=new URLSearchParams('coastalOptics&'+k);
  assert.equal(sceneryReviewBlock('coastalOptics',q),'terrain');
  for(const x of COASTAL_OPTICS_FLAGS)assert(!sceneryOptions('?'+q).has(x));
 }
 assert.equal(sceneryReviewBlock('coastalOptics',new URLSearchParams('scenery=detail')),'detail');
 const defaultDetail=sceneryOptions('?scenery=detail'),selected=sceneryOptions('?scenery=detail&coastalOptics');
 selected.delete('coastalOptics');
 assert.equal(selected.toString(),defaultDetail.toString());
});
