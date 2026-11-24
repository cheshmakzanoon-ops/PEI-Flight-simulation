import {aggregateTexture,gravelPilot,GRAVEL_RAW_SIZE} from './aggregate.ts';
import {GRAVEL_DRAW_AGL,GRAVEL_DRAW_RANGE,GRAVEL_PRELOAD_AGL,GRAVEL_REQUEST_RANGE,type GravelEye,type GravelSeatGuard} from './aggregate-admission.ts';
import type {Texture} from 'three';

export const GRAVEL_ART_PATH='art/aggregate/compact-aggregate-v1.rgba.gz';
export const GRAVEL_WIRE_SIZE=304552;
export const GRAVEL_WIRE_SHA256='c193525c7b1e0d5fd36dc3fd166b04711da6c3fa94eb6115ed4b05702d3a139b';
export const GRAVEL_TIMEOUT_MS=2200;
export const GRAVEL_EASE_MS=620;
const PROBE_INTERVAL_MS=200;
const PROBE_REFRAME_METRES=18;

type Failure='scene-source'|'unavailable'|'timeout'|'http'|'encoding'|'size'|'wire-hash'|'decoded-hash'|'decode'|'network';
type Loaded={texture:Texture}|{reason:Failure};
type GravelRequestSource=Readonly<{
 verifiedGravelSource:boolean;
 nearestGravel(eye:GravelEye,radius:number,dry:GravelSeatGuard):number;
}>;
type Probe={at:number;x:number;y:number;z:number;distance:number;radius:number;source:GravelRequestSource};

const cancel=(stream:ReadableStream<Uint8Array>|null)=>{void stream?.cancel().catch(()=>{});};
const hash=async (a:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a)),q=>q.toString(16).padStart(2,'0')).join('');
class SizeError extends Error {}

async function bounded(body:ReadableStream<Uint8Array>|null,cap:number,signal:AbortSignal){
 if(!body)throw new SizeError('Missing aggregate bytes');
 if(signal.aborted){cancel(body);throw Error('Aggregate request expired');}
 const reader=body.getReader(),data=new Uint8Array(cap);
 let size=0;
 const stop=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',stop,{once:true});
 try{
  for(;;){
   const next=await reader.read();
   if(signal.aborted)throw Error('Aggregate request expired');
   if(next.done)return data.buffer.slice(0,size);
   if(next.value.byteLength>cap-size){stop();throw new SizeError('Aggregate body exceeded signed bound');}
   data.set(next.value,size);size+=next.value.byteLength;
  }
 }finally{signal.removeEventListener('abort',stop);reader.releaseLock();}
}

/** Verify the exact named art. Fetch can already have decoded HTTP gzip;
 * in that case only the *exact* independently pinned raw shape is admitted. */
export async function loadGravelSurface(
 base:string,request:typeof fetch=fetch,timeoutMS=GRAVEL_TIMEOUT_MS,
):Promise<Loaded>{
 if(!globalThis.crypto?.subtle)return {reason:'unavailable'};
 const abort=new AbortController(),deadline=performance.now()+timeoutMS;
 const expired=()=>abort.signal.aborted||performance.now()>=deadline;
 let timer:ReturnType<typeof setTimeout>|undefined;
 const stop=new Promise<Loaded>(resolve=>{timer=setTimeout(()=>{abort.abort();resolve({reason:'timeout'});},timeoutMS);});
 const transfer=async ():Promise<Loaded>=>{
  try{
   const response=await request(base+GRAVEL_ART_PATH,{signal:abort.signal,redirect:'error'});
   if(expired()){cancel(response.body);return {reason:'timeout'};}
   if(response.status!==200||response.headers.has('Content-Range')){cancel(response.body);return {reason:'http'};}
   // Content-Encoding can be CORS-hidden even when fetch decoded the body.
   const encoding=response.headers.get('Content-Encoding')?.trim().toLowerCase();
   if(encoding&&encoding!=='gzip'&&encoding!=='x-gzip'&&encoding!=='identity'){
    cancel(response.body);return {reason:'encoding'};
   }
   const declared=response.headers.get('Content-Length');
   if(declared!==null&&(!/^\d+$/.test(declared)||(Number(declared)!==GRAVEL_RAW_SIZE&&Number(declared)!==GRAVEL_WIRE_SIZE))){
    cancel(response.body);return {reason:'size'};
   }
   let bytes=await bounded(response.body,GRAVEL_RAW_SIZE,abort.signal);
   if(expired())return {reason:'timeout'};
   if(bytes.byteLength===GRAVEL_WIRE_SIZE){
    if(await hash(bytes)!==GRAVEL_WIRE_SHA256)return {reason:'wire-hash'};
    if(expired())return {reason:'timeout'};
    if(typeof DecompressionStream==='undefined')return {reason:'unavailable'};
    try{
     const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
     bytes=await bounded(stream,GRAVEL_RAW_SIZE,abort.signal);
    }catch{return {reason:expired()?'timeout':'decode'};}
   }
   if(bytes.byteLength!==GRAVEL_RAW_SIZE)return {reason:'size'};
   if(expired())return {reason:'timeout'};
   const texture=await aggregateTexture(new Uint8Array(bytes));
   if(expired()){texture?.dispose();return {reason:'timeout'};}
   return texture?{texture}:{reason:'decoded-hash'};
  }catch(e){return {reason:expired()?'timeout':e instanceof SizeError?'size':'network'};}
 };
 try{return await Promise.race([transfer(),stop]);}
 finally{clearTimeout(timer);}
}

/** One optional transfer per page. No warm-path spatial query unless the
 * diagnostic observer asks; the shader itself clips the cached map by distance. */
export class GravelSurfaceStudy {
 readonly look=gravelPilot();
 private phase:'idle'|'loading'|'ready'|'failed'='idle';
 private readonly base:string;
 private readonly request:typeof fetch;
 private readonly timeoutMS:number;
 private readonly time:()=>number;
 private readyAt=Infinity;
 private sourceGood=false;
 private sourceKnown=false;
 private tries=0;
 private failure?:Failure;
 private probe?:Probe;
 private near=false;
 private requestedDistance?:number;
 private verifyScene?:()=>Promise<boolean>;
 private sceneProof:'not-needed'|'cold'|'waiting'|'verified'|'stock'='not-needed';
 constructor(base:string,request:typeof fetch=fetch,
  config:Readonly<{timeoutMS?:number;time?:()=>number;verifyScene?:()=>Promise<boolean>}>={}){
  this.base=base;this.request=request;this.timeoutMS=config.timeoutMS??GRAVEL_TIMEOUT_MS;this.time=config.time??(()=>performance.now());
  this.verifyScene=config.verifyScene;if(this.verifyScene)this.sceneProof='cold';
 }
 update(eye:GravelEye,agl:number,liveFlight:boolean,source:GravelRequestSource|undefined,
  dry:GravelSeatGuard,diagnose=false,now=this.time()){
  this.sourceGood=source?.verifiedGravelSource===true;this.sourceKnown=!!source;
  const validEye=[eye.x,eye.y,eye.z,agl,now].every(Number.isFinite)&&agl>=0;
  this.look.aggregateEyeAGL.value=validEye?agl:1e9;
  const drawable=validEye&&this.sourceGood&&agl<GRAVEL_DRAW_AGL;
  const progress=drawable&&this.phase==='ready'?Math.min(1,Math.max(0,(now-this.readyAt)/GRAVEL_EASE_MS)):0;
  this.look.aggregateGain.value=progress*progress*(3-2*progress);
  const cold=this.phase==='idle'&&liveFlight&&drawable&&agl<GRAVEL_PRELOAD_AGL&&this.sceneProof!=='waiting'&&this.sceneProof!=='stock';
  let diagnosticRadius=diagnose&&this.phase==='ready'&&drawable?GRAVEL_DRAW_RANGE:0;
  const radius=cold?GRAVEL_REQUEST_RANGE:diagnosticRadius;
  if(!source||!radius){this.near=this.phase==='loading'&&drawable&&this.probe?.source===source&&
   !!this.probe&&Math.hypot(this.probe.x-eye.x,this.probe.y-eye.y,this.probe.z-eye.z)+this.probe.distance<GRAVEL_REQUEST_RANGE;return;}
  const probe=this.probe;
  if(probe?.source===source&&probe.radius===radius&&now>=probe.at&&now-probe.at<PROBE_INTERVAL_MS&&
     Math.hypot(probe.x-eye.x,probe.y-eye.y,probe.z-eye.z)<PROBE_REFRAME_METRES){
   // Never start from a stale positive result. A cold positive starts
   // below in the same update that verified actual triangle distance.
   this.near=Number.isFinite(probe.distance);return;
  }
  let distance=Infinity;
  try{
   const d=source.nearestGravel(eye,radius,dry);
   if(Number.isFinite(d)&&d>=0&&d<radius)distance=d;
  }catch{/* Scenery position is never blocked by a failed optional query. */}
  this.probe={at:now,x:eye.x,y:eye.y,z:eye.z,distance,radius,source};
  this.near=Number.isFinite(distance);
  if(!cold||!this.near)return;
  if(this.sceneProof==='cold'&&this.verifyScene){
   this.sceneProof='waiting';
   void Promise.resolve().then(this.verifyScene).then(
    ok=>{this.sceneProof=ok?'verified':'stock';this.probe=undefined;},
    ()=>{this.sceneProof='stock';this.probe=undefined;});
   return;
  }
  if(this.sceneProof==='waiting'||this.sceneProof==='stock')return;
  this.phase='loading';this.tries++;this.requestedDistance=distance;
  void loadGravelSurface(this.base,this.request,this.timeoutMS).then(result=>{
   if('texture' in result){
    this.look.aggregateMap.value=result.texture;this.readyAt=this.time();this.phase='ready';
   }else{this.failure=result.reason;this.phase='failed';this.near=false;}
  });
 }
 get state(){
  const status=this.sourceKnown&&!this.sourceGood?'source-mismatch':this.sceneProof==='stock'?'scene-mismatch':this.phase;
  return {status,near:this.near,active:this.near&&this.look.aggregateGain.value>0,
   gain:this.look.aggregateGain.value,attempts:this.tries,reason:status==='source-mismatch'?'source':status==='scene-mismatch'?'scene-source':this.failure??null,
   requestDistance:this.requestedDistance??null};
 }
}
