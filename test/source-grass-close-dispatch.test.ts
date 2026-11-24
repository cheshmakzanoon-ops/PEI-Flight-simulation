import assert from 'node:assert/strict';
import {test} from 'node:test';
import {sceneryOptions,sceneryReviewBlock} from '../src/app/scenery-profile.ts';
test('Close grass detail is opt-in and shares the existing authenticated grass scope',()=>{
 const plain=sceneryOptions('');
 assert(!plain.has('sourceGrassNap')&&!plain.has('sourceGrassStudy'));
 const ordinary=sceneryOptions('?sourceGrassStudy');
 assert(!ordinary.has('sourceGrassNap'));
 const close=sceneryOptions('?sourceGrassNap');
 assert(close.has('sourceGrassStudy'));
 assert.equal(sceneryReviewBlock('sourceGrassNap',close),undefined);
 for(const forbidden of ['scenery=detail','surveyRelief','inlandRelief','buildingShadows','cropRowsReview','provinceFieldsReview','meadowTexture','northCapeWind']){
  const p=sceneryOptions('?sourceGrassNap&'+forbidden);
  assert(!p.has('sourceGrassStudy'));
  assert(sceneryReviewBlock('sourceGrassNap',p));
 }
});
