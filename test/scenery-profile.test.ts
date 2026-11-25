import {test} from 'node:test';
import assert from 'node:assert/strict';
import {project} from '../src/sim/geo.ts';
import {OPEN_WATER_WINDOWS,openWaterRippleEnvelope} from '../src/render/open-water-ripples.ts';
import {applyReviewSceneryURL,CAVENDISH_PACKAGE_FLAGS,cavendishPackageState,switchCavendishPackageURL,provinceFieldBlock,sceneryReviewBlock,reviewedScenery,DETAIL_FLAGS,isDetailScenery,sceneryDeparture,sceneryOptions,switchSceneryURL,standardPanmurePastureRequested,standardOpenRipplesRequested,forestFloorProfile,standardTracadieOrtho,standardCountyOrtho,coastalMarshRequested} from '../src/app/scenery-profile.ts';

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

test('the Cavendish pack keeps independent options through enable and disable',()=>{
 const first='https://example.test/PEI-Flight-simulation/?diagnostics&greenGablesReview=manual&cropRowsReview#atlas';
 const next=switchCavendishPackageURL(first,true,'cavendish-dunelands-low');
 const q=new URL(next);
 assert.equal(q.hash,'#atlas');
 assert.equal(q.pathname,'/PEI-Flight-simulation/');
 assert.equal(q.searchParams.get('departure'),'cavendish-dunelands-low');
 assert.deepEqual(cavendishPackageState(q.search),{selected:true,active:true,blocked:false});
 assert(CAVENDISH_PACKAGE_FLAGS.every(x=>sceneryOptions(q.search).has(x)));
 assert.equal(sceneryOptions(q.search).get('greenGablesReview'),'manual');
 assert(sceneryOptions(q.search).has('cropRowsReview'));
 assert(!sceneryOptions(q.search).has('gablesGravelReview'));
 const off=new URL(switchCavendishPackageURL(next,false,'cavendish-dunelands-low'));
 assert.equal(sceneryOptions(off.search).get('greenGablesReview'),'manual');
 assert(!sceneryOptions(off.search).has('greenGablesBarnReview'));
});
test('a saved but incompatible regional pack cannot implicitly enable any scenery',()=>{
 for(const flag of ['buildingShadows','inlandRelief','surveyRelief']){
  const q='?cavendishDetail&'+flag;
  assert.deepEqual(cavendishPackageState(q),{selected:true,active:false,blocked:true});
  assert(CAVENDISH_PACKAGE_FLAGS.every(x=>!sceneryOptions(q).has(x)));
 }
});

test('open ripple comparison leaves other ordinary scenery eligible',()=>{
 const active=(s:string)=>standardOpenRipplesRequested(sceneryOptions(s));
 for(const s of ['','?scenery=standard','?departure=bridge&diagnostics','?qa=1'])assert.ok(active(s),s);
 for(const s of ['?scenery=detail','?shoreFoamDetail','?surveyRelief','?beaconsfieldReview','?other=1','?stockOpenRipples=0'])
  assert.equal(active(s),false,s);
 assert.equal(standardPanmurePastureRequested(sceneryOptions('?departure=panmure-head-coast&stockOpenRipples')),true);
});

test('open-water offshore envelopes admit their cores but not freshwater or sheltered landmarks',()=>{
 for(const [lon,lat,inner,outer] of OPEN_WATER_WINDOWS){
  const {x,z}=project(lon,lat);
  assert.equal(openWaterRippleEnvelope(x,z),1);
  assert.equal(openWaterRippleEnvelope(x+inner,z),1);
  assert.ok(openWaterRippleEnvelope(x+(inner+outer)/2,z)<1);
  assert.ok(openWaterRippleEnvelope(x+(inner+outer)/2,z)>0);
  assert.equal(openWaterRippleEnvelope(x+outer+.01,z),0);
 }
 for(const [lon,lat] of [[-62.02144468,46.42678075],[-61.981,46.418],[-63.124,46.232],[-63.410,46.486],[-62.645,46.170]]){
  const {x,z}=project(lon,lat);
  assert.equal(openWaterRippleEnvelope(x,z),0);
 }
});


test('standard forest floor loads only in ordinary scenery and does not alter explicit preview ownership',()=>{
 const profile=(s:string)=>forestFloorProfile(sceneryOptions(s));
 for(const q of ['', '?scenery=standard&diagnostics', '?qa=1&departure=kings-woodland'])assert.equal(profile(q),'standard',q);
 for(const q of ['?surveyRelief','?buildingShadows','?northRusticoLighthouseStudy','?seatedRoads','?departure=a&unknown=1'])
  assert.equal(profile(q),false,q);
 for(const q of ['?forestFloor','?scenery=detail','?woodlandView'])assert.equal(profile(q),true,q);
 assert.equal(profile('?scenery=detail&stockForestFloor'),false);
 assert.equal(profile('?stockForestFloor=0'),false);
});


test('standard Tracadie imagery join leaves Detail and separately locked variants alone',()=>{
 const q=sceneryOptions;
 assert.equal(standardTracadieOrtho(q('?diagnostics&qa=1')),true);
 assert.equal(standardTracadieOrtho(q('?stockForestFloor=0')),true);
 for(const flag of ['scenery=detail','stockTracadieOrtho','orthophotoSeamStudy','forestFloor','surveyRelief','buildingShadows'])
  assert.equal(standardTracadieOrtho(q('?'+flag)),false,flag);
 assert.equal(forestFloorProfile(q('?stockTracadieOrtho')),'standard');
 assert.equal(standardOpenRipplesRequested(q('?stockTracadieOrtho')),true);
});


test('each stock A/B switch leaves independent Standard shading active',()=>{
 const q=(x:string)=>sceneryOptions('?departure=hunter-river-trail&diagnostics&'+x);
 for(const flag of ['stockConfederationTrail','stockCanopyLight','stockRegionalCanopy']){
  assert.equal(forestFloorProfile(q(flag)),'standard');
  assert.equal(standardTracadieOrtho(q(flag)),true);
  assert.equal(standardOpenRipplesRequested(q(flag)),true);
 }
 assert.equal(forestFloorProfile(q('stockForestFloor')),false);
 assert.equal(standardTracadieOrtho(q('stockTracadieOrtho')),false);
 assert.equal(standardOpenRipplesRequested(q('stockOpenRipples')),false);
 for(const flag of ['surveyRelief','buildingShadows','unknownOption']){
  assert.equal(forestFloorProfile(q(flag)),false);
  assert.equal(standardTracadieOrtho(q(flag)),false);
  assert.equal(standardOpenRipplesRequested(q(flag)),false);
 }
});


test('coastal marsh admits ordinary Standard but not unrelated studies or independent reference choices',()=>{
 const q=sceneryOptions;
 assert.equal(coastalMarshRequested(q('?diagnostics&qa=1')),true);
 assert.equal(coastalMarshRequested(q('?stockForestFloor&stockTracadieOrtho')),true);
 for(const flag of ['stockCoastalMarsh','scenery=detail','surveyRelief','orthophotoSeamStudy','woodlandView'])
  assert.equal(coastalMarshRequested(q('?'+flag)),false,flag);
 assert.equal(forestFloorProfile(q('?stockCoastalMarsh')),'standard');
 assert.equal(standardTracadieOrtho(q('?stockCoastalMarsh')),true);
});

test('the three Standard county imagery joins and Tracadie have independent source comparisons',()=>{
 const q=sceneryOptions;
 for(const flags of ['', '?scenery=standard','?diagnostics&qa=1','?stockForestFloor&stockCoastalMarsh']){
  assert(standardCountyOrtho(q(flags)),flags);assert(standardTracadieOrtho(q(flags)),flags);
 }
 assert(!standardCountyOrtho(q('?stockCountyOrtho')));
 assert(standardTracadieOrtho(q('?stockCountyOrtho')));
 assert(standardCountyOrtho(q('?stockTracadieOrtho')));
 const both=q('?stockTracadieOrtho&stockCountyOrtho');assert(!standardTracadieOrtho(both)&&!standardCountyOrtho(both));
 for(const flags of ['?stockCountyOrtho','?stockTracadieOrtho&stockCountyOrtho']){
  assert(coastalMarshRequested(q(flags)),flags);
  assert.equal(forestFloorProfile(q(flags)),'standard',flags);
  assert(standardOpenRipplesRequested(q(flags)),flags);
 }
 for(const flag of ['scenery=detail','scenery=legacy','surveyRelief','buildingShadows','orthophotoSeamStudy','unrecognized']){
  assert(!standardCountyOrtho(q('?'+flag)),flag);
 }
});

test('inland imagery references leave older Standard groups independent in all eight combinations',async()=>{
 const {standardInlandOrtho,standardCountyOrtho,standardTracadieOrtho}=await import('../src/app/scenery-profile.ts');
 const keys=['stockTracadieOrtho','stockCountyOrtho','stockInlandOrtho'];
 for(let mask=0;mask<8;mask++){
  const q=sceneryOptions('?diagnostics&'+keys.filter((_,i)=>mask&(1<<i)).join('&'));
  assert.equal(standardTracadieOrtho(q),!(mask&1));assert.equal(standardCountyOrtho(q),!(mask&2));
  assert.equal(standardInlandOrtho(q),!(mask&4));assert(coastalMarshRequested(q));assert.equal(forestFloorProfile(q),'standard');
 }
 for(const key of ['orthophotoSeamStudy','surveyRelief','provinceFieldsReview','scenery=detail','unknown']){
  assert.equal(standardInlandOrtho(sceneryOptions('?'+key)),false,key);
 }
});
