import test from 'node:test';
import assert from 'node:assert/strict';
import {shoreToneRequested,smoothShoreTone,SHORE_TONE_FULL_M,SHORE_TONE_FAR_M,
 SHORE_TONE_EDGE_STOCK_M,SHORE_TONE_EDGE_FULL_M,SHORE_TONE_INTEGER_TOLERANCE_DN} from '../src/render/shore-tone.ts';

const fixture=`
uniform vec2 detailSize;
uniform sampler2D imageMap,coverMap,detailMap,paintMap;
void main(){
 vec2 cover=texture2D(coverMap,vuv).rg;float coast=(cover.g*255.-128.)*2.;
 if(coast<0.)discard;
 vec2 q=(vuv-detailBox.xy)*detailBox.zw;
 float d=distance(cameraPosition,p);
 float beach=(1.-smoothstep(4.,25.,coast))*(1.-smoothstep(4.,14.,p.y));
 float cliff=(1.-smoothstep(3.,15.,coast))*smoothstep(3.,16.,p.y);
}
`;
test('Shore tone is explicitly opt-in and protected material sources are literal stock',()=>{
 assert(!shoreToneRequested(new URLSearchParams('')));
 assert(shoreToneRequested(new URLSearchParams('shoreToneStudy')));
 assert(!shoreToneRequested(new URLSearchParams('shoreToneStudy&scenery=detail')));
 assert.equal(smoothShoreTone(fixture,false),fixture);
 const unknown=fixture.replace('uniform vec2 detailSize;','');
 assert.equal(smoothShoreTone(unknown,true),unknown);
});
test('The original Cover, discard, and material roles are reused; only two existing colour terms differ',()=>{
 const newFrag=smoothShoreTone(fixture,true);
 const prefix=fixture.slice(fixture.indexOf('void main'),fixture.indexOf(' float beach='));
 assert(newFrag.includes(prefix));
 const tail=newFrag.slice(newFrag.indexOf(' float colourCoast'));
 assert.equal(tail.replace(' float colourCoast=colourShoreDistance(vuv,q,coast,d);\n','').replaceAll('colourCoast','coast'),
  fixture.slice(fixture.indexOf(' float beach=')));
 assert.equal((newFrag.match(/texelFetch\(coverMap/g)??[]).length,4);
 assert(newFrag.indexOf('if(shoreToneGain<=0.')<newFrag.indexOf('texelFetch(coverMap'));
 assert(newFrag.indexOf('abs(code-round(code))')<newFrag.indexOf('texelFetch(coverMap'));
 assert(newFrag.indexOf('if(seam<=1.)')<newFrag.indexOf('texelFetch(coverMap'));
 assert.equal(SHORE_TONE_FULL_M,300);assert.equal(SHORE_TONE_FAR_M,480);
 assert.equal(SHORE_TONE_EDGE_STOCK_M,1);assert.equal(SHORE_TONE_EDGE_FULL_M,24);
 const errors=Array.from({length:256},(_,i)=>Math.abs(Math.fround(Math.fround(i/255)*255)-i));
 assert(Math.max(...errors)<SHORE_TONE_INTEGER_TOLERANCE_DN);
 assert(SHORE_TONE_INTEGER_TOLERANCE_DN<1/255);
});
