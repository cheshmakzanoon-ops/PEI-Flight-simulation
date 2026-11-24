import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyReviewSceneryURL,provinceFieldBlock,sceneryReviewBlock,reviewedScenery,DETAIL_FLAGS,isDetailScenery,sceneryDeparture,sceneryOptions,switchSceneryURL} from '../src/app/scenery-profile.ts';

test('detailed scenery only combines the documented flags and preserves explicit overrides',()=>{
 const standard=sceneryOptions('?noBasinBank&shoreFoamDetail=&diagnostics');
 assert.equal(standard.get('shoreFoamDetail'),'');
 assert.equal(standard.has('northCapeWind'),false);
 const detailed=sceneryOptions('?scenery=detail&noBasinBank&shoreFoamDetail=manual');
 for(const f of DETAIL_FLAGS)assert.equal(detailed.has(f),true);
 assert.equal(detailed.getAll('shoreFoamDetail').length,1);
 assert.equal(detailed.get('shoreFoamDetail'),'manual');
 assert.equal(detailed.has('noBasinBank'),true);
 assert.equal(isDetailScenery('?scenery=anything'),false);
});

test('dispatch scenery toggles the current page only and preserves valid departure and manual flags',()=>{
 const plain='https://example.test/pei/?diagnostics&forestFloor#help';
 const detail=new URL(switchSceneryURL(plain,true,'northcape'));
 assert.equal(detail.pathname,'/pei/');
 assert.equal(detail.hash,'#help');
 assert.equal(detail.searchParams.has('diagnostics'),true);
 assert.equal(detail.searchParams.has('forestFloor'),true);
 assert.equal(sceneryDeparture(detail.search,['cavendish','northcape']),1);
 const standard=new URL(switchSceneryURL(detail.href,false,'cavendish'));
 assert.equal(standard.searchParams.has('scenery'),false);
 assert.equal(standard.searchParams.has('forestFloor'),true);
 assert.equal(sceneryDeparture(standard.search,['cavendish','northcape']),0);
 assert.equal(sceneryDeparture('?departure=not-a-site',['cavendish','northcape']),0);
});


test('named review switches retain the departure, application path and unrelated choices',()=>{
 const source='https://example.test/subpath/?diagnostics&scenery=detail&forestFloor=manual&beaconsfieldReview#features';
 assert.deepEqual(reviewedScenery(new URL(source).search),['beaconsfieldReview']);
 assert.deepEqual(reviewedScenery('?scenery=detail'),[]);
 const next=new URL(applyReviewSceneryURL(source,new Set(['cropRowsReview']),'cysu'));
 assert.equal(next.pathname,'/subpath/');
 assert.equal(next.hash,'#features');
 assert.equal(next.searchParams.get('departure'),'cysu');
 assert.equal(next.searchParams.get('scenery'),'detail');
 assert.equal(next.searchParams.get('forestFloor'),'manual');
 assert.equal(next.searchParams.has('diagnostics'),true);
 assert.deepEqual(reviewedScenery(next.search),['cropRowsReview']);
 assert.deepEqual(reviewedScenery(new URL(applyReviewSceneryURL(next.href,new Set(),'cavendish')).search),[]);
});


test('the province field atlas shares one eligibility check with Dispatch',()=>{
 const block=(q:string)=>provinceFieldBlock(sceneryOptions(q));
 assert.equal(block('?provinceFieldsReview&cropRowsReview&meadowTexture'),undefined);
 assert.equal(block('?scenery=detail&provinceFieldsReview'),'detail');
 for(const flag of ['surveyRelief','inlandRelief','northCapeWind','buildingShadows']){
  assert.equal(block('?provinceFieldsReview&'+flag+'=0'),'terrain');
 }
 const source='https://example.test/PEI-Flight-simulation/?diagnostics&beaconsfieldReview&provinceFieldsReview#atlas';
 const detail=switchSceneryURL(source,true,'kings-fields');
 assert.equal(block(new URL(detail).search),'detail');
 assert.deepEqual(reviewedScenery(new URL(detail).search),['beaconsfieldReview','provinceFieldsReview']);
 const standard=switchSceneryURL(detail,false,'kings-fields');
 assert.equal(block(new URL(standard).search),undefined);
 const next=new URL(applyReviewSceneryURL(standard,new Set(['provinceFieldsReview']),'prince-fields'));
 assert.deepEqual(reviewedScenery(next.search),['provinceFieldsReview']);
 assert.equal(next.searchParams.get('departure'),'prince-fields');
 assert.equal(next.searchParams.has('diagnostics'),true);
 assert.equal(next.hash,'#atlas');
});

test('Cavendish studies share exact profile rules and persist while suspended',()=>{
 const options=(s:string)=>sceneryOptions(s);
 assert.equal(sceneryReviewBlock('greenGablesReview',options('?scenery=detail')),undefined);
 assert.equal(sceneryReviewBlock('cavendishWaterReview',options('?scenery=detail')),undefined);
 assert.equal(sceneryReviewBlock('greenGablesReview',options('?inlandRelief')),undefined);
 assert.equal(sceneryReviewBlock('cavendishWaterReview',options('?inlandRelief')),'terrain');
 for(const f of ['greenGablesReview','cavendishWaterReview'] as const){
  assert.equal(sceneryReviewBlock(f,options('?surveyRelief')),'terrain');
  assert.equal(sceneryReviewBlock(f,options('?buildingShadows')),'terrain');
 }
 assert.equal(sceneryReviewBlock('beaconsfieldReview',options('?buildingShadows')),'terrain');
 assert.equal(sceneryReviewBlock('cropRowsReview',options('?buildingShadows')),undefined);
 const a=applyReviewSceneryURL('https://example.test/app/?diagnostics&surveyRelief#landings',
  new Set(['greenGablesReview','cavendishWaterReview']),'cavendish-dunelands-low');
 assert.deepEqual(reviewedScenery(new URL(a).search),['greenGablesReview','cavendishWaterReview']);
 assert.ok(a.includes('surveyRelief')&&a.endsWith('#landings'));
});
