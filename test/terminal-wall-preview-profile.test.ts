import {downtownSceneryCompatible} from '../src/render/summerside-roof-source.ts';
import {standardWharfRequested} from '../src/render/spinnakers-standard.ts';
import {railStandardRequested} from '../src/render/summerside-station/admit.ts';
import {test} from 'node:test';
import {beaconsfieldGradeRequested} from '../src/sim/beaconsfield-grade-admit.ts';
import assert from 'node:assert/strict';
import {terminalWallPreviewRequested,standardOpenRipplesRequested,forestFloorProfile,standardCountyOrtho,
   standardPanmurePastureRequested,coastalMarshRequested,olearyExteriorRequested,olearyIndustrialStudyRequested,olearyWarehouseRequested} from '../src/app/scenery-profile.ts';
test('the exact terminal visual option does not turn off unrelated Standard layers',()=>{
 const old=new URLSearchParams('departure=summerside-harbour&diagnostics'),next=new URLSearchParams(old);
 next.set('summersideTerminalWallPreview','');
 assert(!terminalWallPreviewRequested(old));assert(terminalWallPreviewRequested(next));
 for(const k of [standardOpenRipplesRequested,forestFloorProfile,standardCountyOrtho,standardPanmurePastureRequested,coastalMarshRequested,olearyExteriorRequested,olearyIndustrialStudyRequested,olearyWarehouseRequested]){
   assert.equal(k(next),k(old));
 }
 for(const query of ['spinnakersPreview','scenery=detail','summersideStationReview','buildingShadows','scenery=standard&scenery=detail']){
  assert(!terminalWallPreviewRequested(new URLSearchParams(query+'&summersideTerminalWallPreview')));
 }
});
test('an unrelated existing standalone study still sees its exact grade dispatcher',()=>{
 const before=new URLSearchParams('scenery=standard&beaconsfieldReview');
 const after=new URLSearchParams(before);after.set('summersideTerminalWallPreview','');
 assert(beaconsfieldGradeRequested(before));assert(beaconsfieldGradeRequested(after));
 assert(!terminalWallPreviewRequested(after));
});

test('the explicit stock case vetoes walls only, retaining q150 and both downtown neighbor policies',()=>{
 const base=new URLSearchParams('departure=summerside-harbour&diagnostics&olearyExteriorStudy&olearyWarehouseStudy');
 base.set('qa',JSON.stringify({olearyIndustrial192:true}));
 const on=new URLSearchParams(base);on.set('summersideTerminalWallPreview','');
 const off=new URLSearchParams(on);off.set('stockSummersideTerminalWalls','');
 const only=new URLSearchParams(base);only.set('stockSummersideTerminalWalls','');
 assert(terminalWallPreviewRequested(on));assert(!terminalWallPreviewRequested(off));assert(!terminalWallPreviewRequested(only));
 for(const f of [downtownSceneryCompatible,standardWharfRequested,railStandardRequested,
   olearyExteriorRequested,olearyIndustrialStudyRequested,olearyWarehouseRequested,standardOpenRipplesRequested]){
  assert(f(base));assert(f(on));assert(f(off));assert(f(only));
 }
 const stationOnly=new URLSearchParams(on);stationOnly.set('stockSpinnakersDeck','');
 assert(terminalWallPreviewRequested(stationOnly));assert(!standardWharfRequested(stationOnly));assert(railStandardRequested(stationOnly));
 const wharfOnly=new URLSearchParams(on);wharfOnly.set('stockStationExterior','');
 assert(terminalWallPreviewRequested(wharfOnly));assert(standardWharfRequested(wharfOnly));assert(!railStandardRequested(wharfOnly));
});
