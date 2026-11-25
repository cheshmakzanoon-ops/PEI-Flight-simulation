import assert from 'node:assert/strict';
import {test} from 'node:test';
import {BufferGeometry,Float32BufferAttribute} from 'three';
import {nearStandardWharf,standardWharfDraw,standardWharfPositionsAllow,standardWharfRequested,trackWharfSpans,type WharfSpan} from '../src/render/spinnakers-standard.ts';
import {SPINNAKERS_DECK as DECK} from '../src/render/spinnakers-deck.generated.ts';
import {project} from '../src/sim/geo.ts';

test('the Standard pier switch does not broaden the historical preview or affect the station veto',()=>{
 assert(standardWharfRequested(new URLSearchParams()));
 assert(standardWharfRequested(new URLSearchParams('stockStationExterior')));
 for(const flags of ['stockSpinnakersDeck','spinnakersPreview','northBaywalkPreview','northBaywalkConcrete','buildingShadows','scenery=detail','scenery=future','scenery=standard&scenery=detail','surveyRelief','inlandRelief','seatedRoads']){
  assert.equal(standardWharfRequested(new URLSearchParams(flags)),false,flags);
 }
});

test('the local wharf gates fetch and draw by horizontal range and height with bounded hysteresis',()=>{
 const {x,z}=project(...DECK.anchor);
 assert(nearStandardWharf(x,82,z));
 assert(!nearStandardWharf(x,460,z));
 assert(!nearStandardWharf(x+1751,82,z));
 assert(nearStandardWharf(x+1751,82,z,true));
 assert(nearStandardWharf(x+1900,489,z,true));
 assert(!nearStandardWharf(x+2101,82,z,true));
 assert(!nearStandardWharf(x,Infinity,z,true));
});

test('only the two signed full source spans are eligible; unchanged positions must prove independently',async()=>{
 const span=new Map<number,WharfSpan>();
 for(const [i,start] of [[239,51222],[240,51228],[241,51429],[313,65600],[314,65855],[315,65946],[316,65988],[317,66099]])trackWharfSpans(span,i,start);
 assert.deepEqual([...span],[[240,[51228,51429]],[315,[65946,65988]]]);
 const g=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(new Float32Array(69906*3),3));
 assert.deepEqual(standardWharfDraw(g,span)?.map(p=>p.span),[[51228,51429],[65946,65988]]);
 const changed=new Map(span).set(315,[65946,65991]);
 assert.equal(standardWharfDraw(g,changed),undefined);
 assert.equal(await standardWharfPositionsAllow(g),false);
 g.setIndex([0,1,2]);assert.equal(standardWharfDraw(g,span),undefined);
});
