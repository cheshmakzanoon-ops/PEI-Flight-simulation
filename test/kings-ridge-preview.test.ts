import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from 'three';
import {KINGS_RIDGE_LENS,KINGS_RIDGE_ROUTE,kingsRidgeLensState,switchKingsRidgeLens,kingsRidgeAirState,sceneryOptions} from '../src/app/scenery-profile.ts';
import {kingsRidgeMayDraw} from '../src/render/kings-ridge-view.ts';

test('one local ridge URL does not change normalized Standard or enable a different departure',()=>{
 const raw='https://atlas.invalid/sim/?diagnostics&scenery=standard&stockSeacowExterior&departure='+KINGS_RIDGE_ROUTE;
 const on=new URL(switchKingsRidgeLens(raw,true,KINGS_RIDGE_ROUTE));
 assert(on.searchParams.has(KINGS_RIDGE_LENS));
 assert.deepEqual([...sceneryOptions(on.search)],[...sceneryOptions(new URL(raw).search)]);
 assert(kingsRidgeLensState(on.search).active);
 assert.equal(switchKingsRidgeLens(raw,true,'summerside'),raw);
 for(const k of ['qa','scenery=detail','indianRiverGradeLens','kingsDryCrownStudy','departure=summerside',KINGS_RIDGE_LENS])
  assert(!kingsRidgeLensState(on.search+'&'+k).active,k);
 assert.deepEqual([...new URL(switchKingsRidgeLens(on.href,false,KINGS_RIDGE_ROUTE)).searchParams],[...new URL(raw).searchParams]);
 assert.deepEqual(kingsRidgeAirState(KINGS_RIDGE_ROUTE,'flight','dispatch'),{initiate:true,retain:true});
 for(const mode of ['paused','crash','map','help','credits'])
  assert.deepEqual(kingsRidgeAirState(KINGS_RIDGE_ROUTE,mode,'flight'),{initiate:false,retain:true});
 assert.deepEqual(kingsRidgeAirState(KINGS_RIDGE_ROUTE,'map','dispatch'),{initiate:false,retain:false});
 assert.deepEqual(kingsRidgeAirState('summerside','flight','paused'),{initiate:false,retain:false});
});
test('the conservative view test only rejects terrain when every old/new corner falls below the clip plane',()=>{
 const camera=new PerspectiveCamera(45,1200/760,.08,100000);
 camera.position.set(32130,120,6600);camera.lookAt(new Vector3(32170,14,6910));camera.updateMatrixWorld();
 assert(kingsRidgeMayDraw(camera));
 camera.lookAt(new Vector3(32130,190,7100));camera.updateMatrixWorld();
 assert(!kingsRidgeMayDraw(camera));
 camera.projectionMatrix.elements[5]=NaN;assert(kingsRidgeMayDraw(camera));
});

import {readFileSync} from 'node:fs';
import {Buildings} from '../src/render/buildings.ts';

test('prepared ridge atlas still streams unrelated signed tiles with a browser-like receiver',async()=>{
 const root=new URL('../public/world/buildings/',import.meta.url);
 const raw=readFileSync(new URL('index.json',root)),body=readFileSync(new URL('tiles.pack',root));
 const manifest=JSON.parse(raw.toString());
 let ranges=0;
 const unbound=async function(this:undefined,input:RequestInfo|URL,opts?:RequestInit){
  assert.equal(this,undefined,'a browser native fetch must not be called as a PackedBytes property');
  if(String(input).endsWith('index.json'))return new Response(Uint8Array.from(raw));
  const range=new Headers(opts?.headers).get('range')?.match(/^bytes=(\d+)-(\d+)$/);
  assert(range);ranges++;
  const a=+range[1],b=+range[2];
  return new Response(Uint8Array.from(body.subarray(a,b+1)),{status:206,headers:{'content-range':`bytes ${a}-${b}/${body.length}`}});
 };
 const ready=await Buildings.prepareKingsDryCrown(unbound,3000);
 assert(ready?.kingsCrown);
 const second=manifest.tiles.find((tile:{id:string})=>tile.id!=='q12303');
 const data=await ready.pack.read(second.offset,second.bytes);
 assert.deepEqual(Buffer.from(data),body.subarray(second.offset,second.offset+second.bytes));
 assert.equal(ranges,2,'one signed q12303 read, then one unrelated tile');
});
