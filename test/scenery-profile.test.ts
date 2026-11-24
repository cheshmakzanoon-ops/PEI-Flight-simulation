import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyReviewSceneryURL,reviewedScenery,DETAIL_FLAGS,isDetailScenery,sceneryDeparture,sceneryOptions,switchSceneryURL} from '../src/app/scenery-profile.ts';

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
