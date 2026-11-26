import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync as file} from 'node:fs';
import {verifiedPrinceOverview} from '../src/render/prince-grassland/source.ts';
const root=new URL('../public/',import.meta.url);
const rawFile=(path:string)=>file(new URL(path,root));
const {pins}=JSON.parse(rawFile('world/terrain-adaptive/v1/index.json').toString());
function source(mode:'range'|'whole'|'wrong-offset'|'short'|'tamper'='range'){
 const calls:([string,string|null])[]=[];
 const get:typeof fetch=async(input,init)=>{
  const path=new URL(String(input)).pathname,range=new Headers(init?.headers).get('range');
  calls.push([path,range]);const file=rawFile(path.slice(1));
  if(!range||mode==='whole')return new Response(Uint8Array.from(file));
  const q=range.match(/^bytes=(\d+)-(\d+)$/);assert(q);
  const offset=+q[1],end=+q[2],bits=Uint8Array.from(file.subarray(offset,end+(mode==='short'?0:1)));
  if(mode==='tamper')bits[7]^=1;
  const first=offset+(mode==='wrong-offset'?1:0);
  return new Response(bits,{status:206,headers:{'content-range':`bytes ${first}-${end}/${file.length}`}});
 };
 return {get,calls};
}
test('one exact range or one bounded verified static fallback; no retries',async()=>{
 for(const mode of ['range','whole'] as const){
  const a=source(mode),out=await verifiedPrinceOverview('https://atlas.invalid/',pins,a.get);
  assert(out);assert.equal(out.cells.length,23);
  assert(out.cells.every(([x,z])=>Number.isFinite(out.survey((x+.5)/112,(z+.5)/112))));
  assert.deepEqual(a.calls.sort(),[
   ['/world/terrain-adaptive/v1/index.json',null],
   ['/world/terrain-adaptive/v1/relief-03.pack','bytes=248019-285223'],
   ['/world/woodland/hedgerows-v1/index.json',null],
  ]);
 }
 for(const mode of ['wrong-offset','short','tamper'] as const){
  const a=source(mode);assert.equal(await verifiedPrinceOverview('https://atlas.invalid/',pins,a.get),undefined,mode);
  assert.equal(a.calls.length,3);
 }
 const wrong=source();assert.equal(await verifiedPrinceOverview('https://atlas.invalid/',{...pins,road:'0'.repeat(64)},wrong.get),undefined);
 assert.equal(wrong.calls.length,2);
 const abort=new AbortController(),inactive=source();abort.abort();
 assert.equal(await verifiedPrinceOverview('https://atlas.invalid/',pins,inactive.get,abort.signal),undefined);
 assert.equal(inactive.calls.length,0);
});

import {PRINCE_LANDSCAPE_ROUTE,PRINCE_LANDSCAPE_LENS,princeLandscapeState,sceneryOptions,switchPrinceLandscape} from '../src/app/scenery-profile.ts';
test('the exact field preview URL is local to its departure and does not replace other Standard settings',()=>{
 const original='https://atlas.invalid/?diagnostics&stockGreenGablesHouse&departure='+PRINCE_LANDSCAPE_ROUTE;
 const next=new URL(switchPrinceLandscape(original,true,PRINCE_LANDSCAPE_ROUTE));
 assert(next.searchParams.has(PRINCE_LANDSCAPE_LENS)&&princeLandscapeState(next.search).active);
 assert.deepEqual([...sceneryOptions(next.search)],[...sceneryOptions(new URL(original).search)]);
 for(const other of ['scenery=detail','qa','indianRiverGradeLens','surveyRelief','kingsRidgeGroundPreview','departure=summerside',PRINCE_LANDSCAPE_LENS]){
  assert(!princeLandscapeState(next.search+'&'+other).active,other);
 }
 assert.equal(switchPrinceLandscape(original,true,'kings-coastal-ridge'),original);
 assert.deepEqual([...new URL(switchPrinceLandscape(next.href,false,PRINCE_LANDSCAPE_ROUTE)).searchParams],[...new URL(original).searchParams]);
});
