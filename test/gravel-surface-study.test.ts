import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {BufferGeometry,Float32BufferAttribute,Int8BufferAttribute} from 'three';
import {GRAVEL_KIND,GRAVEL_RAW_SHA256,GRAVEL_RAW_SIZE,classifiedGravel,gravelAuthority} from '../src/render/aggregate.ts';
import {GRAVEL_SOURCE_COUNT,GRAVEL_SOURCE_SHA256} from '../src/render/gravel.generated.ts';
import {GRAVEL_PRELOAD_AGL,GRAVEL_REQUEST_RANGE,nearestRegisteredGravel} from '../src/render/aggregate-admission.ts';
import {GravelSurfaceStudy,GRAVEL_ART_PATH,GRAVEL_WIRE_SHA256,GRAVEL_WIRE_SIZE,loadGravelSurface} from '../src/render/gravel-surface-study.ts';
import {SCENERY_REVIEWS,sceneryOptions,sceneryReviewBlock,standardGravelSurfaceRequested} from '../src/app/scenery-profile.ts';

const wire=new Uint8Array(readFileSync(new URL('../public/'+GRAVEL_ART_PATH,import.meta.url)));
const raw=new Uint8Array(gunzipSync(wire));
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const until=async (ok:()=>boolean)=>{
 const expires=performance.now()+3000;
 while(!ok()&&performance.now()<expires)await sleep(3);
 assert(ok());
};
const goodReply:typeof fetch=async()=>new Response(wire);
const skyGuard=()=>true;
const eye={x:0,y:62,z:0};

test('Standard gravel preserves the old explicit review and does not inject a bundled flag',()=>{
 assert(SCENERY_REVIEWS.some(row=>row.flag==='gravelSurfaceStudy'));
 assert.equal(sceneryOptions('?scenery=detail').has('gravelSurfaceStudy'),false);
 assert.equal(sceneryOptions('').has('gravelSurfaceStudy'),false);
 assert.equal(sceneryReviewBlock('gravelSurfaceStudy',sceneryOptions('?gravelSurfaceStudy&scenery=detail')),'detail');
 assert.equal(sceneryReviewBlock('gravelSurfaceStudy',sceneryOptions('?gravelSurfaceStudy&buildingShadows&seatedRoads')),undefined);
 assert(standardGravelSurfaceRequested(sceneryOptions('?departure=prince-grassland')));
 for(const name of ['scenery=detail','sourceGrassStudy','buildingShadows','seatedRoads','inlandRelief','gravelSurfaceStudy','stockGravelSurface'])
  assert(!standardGravelSurfaceRequested(sceneryOptions('?'+name)),name);
 assert(!sceneryOptions('?stockGravelSurface&gravelSurfaceStudy').has('gravelSurfaceStudy'));
 const trust=gravelAuthority(GRAVEL_SOURCE_COUNT,GRAVEL_SOURCE_SHA256);
 assert(trust);assert.equal(gravelAuthority(GRAVEL_SOURCE_COUNT-1,GRAVEL_SOURCE_SHA256),undefined);
 assert.equal(gravelAuthority(GRAVEL_SOURCE_COUNT,'changed'),undefined);
 assert.equal(Array.from({length:GRAVEL_SOURCE_COUNT},(_,i)=>classifiedGravel(trust,i,0)).filter(Boolean).length,2651);
 for(const i of [19365,19375,-1,19465,7208.5])assert.equal(classifiedGravel(trust,i,0),false);
 assert.equal(classifiedGravel(trust,7208,1),true);
 assert.equal(classifiedGravel(trust,7208,9),false);
 assert.equal(classifiedGravel(trust,7208,17),false);
});

test('authenticates exact optional gzip and independently pinned decoded fetch response',async()=>{
 assert.equal(wire.byteLength,GRAVEL_WIRE_SIZE);assert.equal(sha(wire),GRAVEL_WIRE_SHA256);
 assert.equal(raw.byteLength,GRAVEL_RAW_SIZE);assert.equal(sha(raw),GRAVEL_RAW_SHA256);
 for(const mode of ['identity','auto-decoded','cors-hidden','fragmented']){
  const u=mode==='identity'||mode==='fragmented'?wire:raw;
  const data=mode==='fragmented'?new ReadableStream<Uint8Array>({start(c){
   for(let i=0;i<u.byteLength;i+=4093)c.enqueue(u.subarray(i,i+4093));
   c.close();
  }}):u;
  const headers:Record<string,string>=mode==='identity'?{'Content-Length':String(wire.byteLength)}
    :mode==='auto-decoded'?{'Content-Length':String(wire.byteLength),'Content-Encoding':'gzip'}
    :mode==='cors-hidden'?{'Content-Length':String(wire.byteLength)}:{};
  let calls=0;
  const result=await loadGravelSurface('/test-base/',async(input,init)=>{
   calls++;assert.equal(input,'/test-base/'+GRAVEL_ART_PATH);assert(init?.signal);
   assert.equal(init.signal.aborted,false);assert.equal(init.redirect,'error');
   return new Response(data,{headers});
  });
  assert.equal(calls,1);
  assert('texture'in result,JSON.stringify(result));
  assert.equal(result.texture.image.width,320);assert.equal(result.texture.image.height,320);
  assert.deepEqual(result.texture.image.data,raw);
  assert.equal(result.texture.generateMipmaps,true);assert.equal(result.texture.flipY,false);
  result.texture.dispose();
 }
});

test('bounded loader rejects HTTP/length/encoding, truncation, and same-size unsigned bodies',async()=>{
 const pendingCases=[
  [{status:404},'http'],[{status:206},'http'],[{headers:{'Content-Range':'bytes 0-4/5'}},'http'],
  [{headers:{'Content-Encoding':'br'}},'encoding'],[{headers:{'Content-Length':String(raw.length+1)}},'size'],
  [{headers:{'Content-Length':'NaN'}},'size'],
 ] as const;
 for(const [options,reason] of pendingCases){
  let canceled=false;
  const stream=new ReadableStream<Uint8Array>({cancel(){canceled=true;}});
  const result=await loadGravelSurface('/',async()=>new Response(stream,options));
  assert.deepEqual(result,{reason});assert(canceled,JSON.stringify(options));
 }
 const changedWire=wire.slice();
 // Gzip timestamp change leaves the decoded data equivalent but is not
 // the exact wire asset; never inflate/reuse bytes for this transport.
 changedWire[4]^=0x16;assert.deepEqual(new Uint8Array(gunzipSync(changedWire)),raw);
 assert.deepEqual(await loadGravelSurface('/',async()=>new Response(changedWire)),{reason:'wire-hash'});
 const changedRaw=raw.slice();changedRaw[271]^=0x3;
 assert.deepEqual(await loadGravelSurface('/',async()=>new Response(changedRaw)),{reason:'decoded-hash'});
 assert.deepEqual(await loadGravelSurface('/',async()=>new Response(wire.slice(0,-1))),{reason:'size'});
 let oversizeCanceled=false;
 const beyond=new Uint8Array(GRAVEL_RAW_SIZE+1);
 const oversized=new ReadableStream<Uint8Array>({start(stream){
  stream.enqueue(beyond.subarray(0,340000));stream.enqueue(beyond.subarray(340000));
 },cancel(){oversizeCanceled=true;}});
 assert.deepEqual(await loadGravelSurface('/',async()=>new Response(oversized)),{reason:'size'});
 assert(oversizeCanceled);
 assert.deepEqual(await loadGravelSurface('/',async()=>{throw Error('offline');}),{reason:'network'});
});

test('deadline aborts the body itself and closes a valid-but-late response without admission',async()=>{
 let abortSignal:AbortSignal|undefined,late:(r:Response)=>void=()=>{};
 const noHeaders=new Promise<Response>(resolve=>late=resolve);
 const result=await loadGravelSurface('/',async(_,init)=>{abortSignal=init?.signal??undefined;return noHeaders;},18);
 assert.deepEqual(result,{reason:'timeout'});assert(abortSignal?.aborted);
 let canceled=false;
 const glass=new ReadableStream<Uint8Array>({start(c){c.enqueue(wire);},cancel(){canceled=true;}});
 late(new Response(glass));
 await until(()=>canceled);
 let stalledCanceled=false,stalledAsked=false;
 const stalls=new ReadableStream<Uint8Array>({start(c){c.enqueue(wire.subarray(0,512));},cancel(){stalledCanceled=true;}});
 assert.deepEqual(await loadGravelSurface('/',async()=>{stalledAsked=true;return new Response(stalls);},45),{reason:'timeout'});
 assert(stalledAsked&&stalledCanceled);
});

const pointPatch=(kinds:number[],float=false)=>{
 const vertices:number[]=[],labels:number[]=[];
 for(let i=0;i<kinds.length;i++){
  const x=i*12,k=float?kinds[i]/127:kinds[i];
  vertices.push(x,0,0,x+10,0,0,x,0,10);labels.push(0,k,0,k,0,k);
 }
 const g=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(vertices,3));
 g.setAttribute('roadSurface',float?new Float32BufferAttribute(labels,2):new Int8BufferAttribute(labels,2,true));
 return g;
};

test('true slant from positive existing triangles, physical ground guard and seated-view displacement',()=>{
 for(const float of [false,true]){
  const g=pointPatch([GRAVEL_KIND,0,64,-64,127],float);
  // 3 m horizontal/4 m vertical triangle-edge distance; exact 5 m gate
  // is excluded, and pavement directly below the eye cannot qualify.
  const where={x:2500+13,y:4,z:-2500};
  const probe=(cap:number,floor=skyGuard)=>nearestRegisteredGravel(g,2500,-2500,where,cap*cap,0,floor);
  assert.equal(probe(5),Infinity);assert.equal(probe(5.01),25);
  assert.equal(probe(6,()=>false),Infinity);
  g.setAttribute('roadSeatDelta',new Float32BufferAttribute(new Array(15).fill(2),1));
  const floor=(x:number,y:number,z:number)=>x===2510&&z===-2500&&y>=.75;
  assert.equal(nearestRegisteredGravel(g,2500,-2500,where,36,0,floor),Infinity);
  assert.equal(nearestRegisteredGravel(g,2500,-2500,where,36,.5,floor),18);
 }
 const falseClasses=pointPatch([0,64,-64,127],false);
 assert.equal(nearestRegisteredGravel(falseClasses,2500,-2500,{x:2510,y:.14,z:-2500},940*940),Infinity);
 const mixed=pointPatch([GRAVEL_KIND],false);
 mixed.getAttribute('roadSurface').array[3]=64;
 assert.equal(nearestRegisteredGravel(mixed,0,0,{x:1,y:4,z:1},36),Infinity);
});

test('no dispatch/high/off-road/stale roster request, one cached approach and no warm query cost without diagnostics',async()=>{
 let now=10,calls=0,queries=0,distance=Infinity;
 const q=new GravelSurfaceStudy('/atlas/',async(input,init)=>{calls++;return goodReply(input,init);},{time:()=>now});
 const set=(a:number,dist:number)=>({x:a,y:62,z:dist});
 const roster={verifiedGravelSource:true,nearestGravel(_eye:typeof eye,radius:number,dry:()=>boolean){
  queries++;assert(radius===GRAVEL_REQUEST_RANGE||radius===485);assert(dry());return distance;
 }};
 const stale={...roster,verifiedGravelSource:false};
 q.update(eye,30,false,roster,skyGuard,true);
 q.update(eye,35,true,undefined,skyGuard,true);
 q.update(eye,30,true,stale,skyGuard,true);
 assert.equal(q.state.status,'source-mismatch');
 q.update(eye,GRAVEL_PRELOAD_AGL,true,roster,skyGuard,true);
 q.update(eye,280,true,roster,skyGuard,true);
 assert.equal(calls,0);assert.equal(queries,0);
 q.update(eye,45,true,roster,skyGuard,true);assert.equal(queries,1);
 for(let i=0;i<4;i++){now+=20;q.update(set(i,0),45,true,roster,skyGuard,true);}
 assert.equal(queries,1);assert.equal(calls,0);
 distance=305;now+=10;
 q.update(set(50,0),52,true,roster,skyGuard,true);
 assert.equal(calls,1);assert.equal(queries,2);assert(q.state.near);
 assert.equal(q.state.status,'loading');assert.equal(q.state.requestDistance,305);
 await until(()=>q.state.status==='ready');
 q.update(eye,52,true,roster,skyGuard,true);assert.equal(q.state.gain,0);
 now+=700;q.update(eye,52,true,roster,skyGuard,true);assert(q.state.active);assert.equal(q.state.gain,1);
 const saved=q.look.aggregateMap.value;assert(saved);
 const was=queries;
 now+=300;q.update(eye,52,true,roster,skyGuard);assert.equal(queries,was);
 q.update(eye,220,true,roster,skyGuard,true);assert.equal(q.state.gain,0);assert(!q.state.active);
 distance=720;now+=500;q.update(set(1000,0),46,true,roster,skyGuard,true);assert(!q.state.near);assert(!q.state.active);
 distance=140;now+=500;q.update(set(100,0),46,true,roster,skyGuard,true);assert(q.state.active);
 assert.equal(calls,1);assert.equal(q.state.attempts,1);assert.strictEqual(q.look.aggregateMap.value,saved);
 q.update(eye,24,true,stale,skyGuard,true);assert.equal(q.state.gain,0);
});

test('failed first request stays stock across repeated frames, route and pitch changes',async()=>{
 let calls=0,queries=0;
 const now=()=>performance.now();
 const q=new GravelSurfaceStudy('/',async()=>{calls++;return new Response('gone',{status:404});},{time:now});
 const roster={verifiedGravelSource:true,nearestGravel(){queries++;return 7;}};
 q.update(eye,13,true,roster,skyGuard,true);
 await until(()=>q.state.status==='failed');
 for(let i=0;i<150;i++)q.update({x:i*45,y:62,z:0},i<50?500:110,true,roster,skyGuard,true,now()+i*800);
 assert.equal(calls,1);assert.equal(queries,1);assert.equal(q.state.attempts,1);
 assert.equal(q.state.gain,0);assert.equal(q.state.reason,'http');
 assert.equal(q.look.aggregateMap.value,null);
});

test('default gravel awaits a live exposed-road proof and cannot fetch after a late proof off site',async()=>{
 let submit:(valid:boolean)=>void=()=>{};
 let fetches=0,sceneHashes=0;
 const then=new Promise<boolean>(resolve=>{submit=resolve;});
 const source={verifiedGravelSource:true,nearestGravel:(p:typeof eye)=>p.x<100?70:Infinity};
 const gravel=new GravelSurfaceStudy('/',async()=>{fetches++;return new Response(wire);},
  {verifyScene:()=>{sceneHashes++;return then;}});
 gravel.update(eye,210,true,source,skyGuard,false,0);
 gravel.update(eye,62,false,source,skyGuard,false,1);
 gravel.update({...eye,x:140},62,true,source,skyGuard,false,2);
 assert.equal(sceneHashes,0);
 gravel.update(eye,62,true,source,skyGuard,false,210);
 await until(()=>sceneHashes===1);
 gravel.update({...eye,x:145},62,true,source,skyGuard,false,211);
 submit(true);await sleep(0);
 gravel.update({...eye,x:145},62,true,source,skyGuard,false,220);
 assert.equal(fetches,0);
 gravel.update(eye,62,true,source,skyGuard,false,800);
 await until(()=>gravel.state.status==='ready');
 assert.equal(fetches,1);
 assert.equal(gravel.state.attempts,1);
 const wrong=new GravelSurfaceStudy('/',async()=>{fetches++;return new Response(wire);},{verifyScene:async()=>false});
 wrong.update(eye,62,true,source,skyGuard,false,0);
 await until(()=>wrong.state.status==='scene-mismatch');
 wrong.update(eye,62,true,source,skyGuard,false,600);
 assert.equal(wrong.state.attempts,0);
 assert.equal(wrong.state.gain,0);
 assert.equal(fetches,1);
});
