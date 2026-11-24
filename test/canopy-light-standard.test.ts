import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canopyLightRequested,sceneryOptions} from '../src/app/scenery-profile.ts';
test('directional tree light defaults only in ordinary Standard settings',()=>{
 const light=(s:string)=>canopyLightRequested(sceneryOptions(s));
 assert(light(''));assert(light('?scenery=standard'));assert(light('?departure=cavendish-low'));
 assert(light('?scenery=detail'));assert(light('?woodland3D&canopyLight'));
 for(const flag of ['woodlandView','woodland3D','surveyRelief','inlandRelief','buildingShadows','seatedForestShadows',
  'miscoucheCanopyStudy','regionalCanopyStudy','pointPrimStudy','orthophotoSeamStudy','scenery=legacy',
  'duneReliefStudy','duneSandDetail','duneGrassSurface','kingsDryCrownStudy','mappedLaneCanopyStudy','greenGablesReview','beaconsfieldReview','northRusticoLighthouseStudy']){
  assert(!light('?'+flag),flag);
  assert(light('?'+flag+'&canopyLight'),flag);
 }
 for(const suffix of ['','&canopyLight','&scenery=detail']){
  assert(!light('?stockCanopyLight'+suffix),suffix);
  assert(!sceneryOptions('?stockCanopyLight'+suffix).has('canopyLight'));
 }
});
