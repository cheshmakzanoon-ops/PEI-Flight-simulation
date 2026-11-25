import assert from 'node:assert/strict';
import {test} from 'node:test';
import {olearyExteriorRequested} from '../src/app/scenery-profile.ts';
import {OLEARY,olearyCloseCamera} from '../src/render/oleary-railway/authority.ts';
import {SPINNAKERS_DECK} from '../src/render/spinnakers-deck.generated.ts';
import {nearStandardWharf,standardWharfRequested} from '../src/render/spinnakers-standard.ts';
import {project} from '../src/sim/geo.ts';

test('disjoint signed scenes retain their own Standard-only selection and local veto with the other switch set',()=>{
 const flags=(x:string)=>new URLSearchParams(x);
 const open='departure=spinnakers-low&scenery=standard&olearyExteriorStudy';
 assert(standardWharfRequested(flags(open)));
 assert(olearyExteriorRequested(flags(open)));
 for(const veto of ['&stockSpinnakersDeck','&stockStationExterior']){
  assert(olearyExteriorRequested(flags(open+veto)));
 }
 assert(!standardWharfRequested(flags(open+'&stockSpinnakersDeck')));
 assert(standardWharfRequested(flags(open+'&stockOlearyExterior')));
 assert(!olearyExteriorRequested(flags(open+'&stockOlearyExterior')));
 assert(!olearyExteriorRequested(flags(open+'&spinnakersPreview')));
 assert(!standardWharfRequested(flags(open+'&spinnakersPreview')));
 const [x,z]=OLEARY.xz,s=project(...SPINNAKERS_DECK.anchor);
 assert(Math.hypot(x-s.x,z-s.z)>48000);
 assert(!nearStandardWharf(x,50,z));
 assert(!olearyCloseCamera(s.x,50,s.z));
});
