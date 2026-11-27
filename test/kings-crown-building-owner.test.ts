import assert from 'node:assert/strict';
import test from 'node:test';
import {openSync,readSync,closeSync,readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as T from 'three';
import {Buildings} from '../src/render/buildings.ts';
import {KINGS_CROWN_BUILDINGS as B} from '../src/render/kings-crown-building-owner.ts';
import {Terrain} from '../src/sim/terrain.ts';

const world=(p:string)=>new URL('../public/world/'+p,import.meta.url);
const index=readFileSync(world('buildings/index.json'));
const raw=new Uint8Array(B.bytes),fd=openSync(world('buildings/tiles.pack'),'r');
try{assert.equal(readSync(fd,raw,0,raw.length,B.offset),raw.length);}finally{closeSync(fd);}
const range='bytes='+B.offset+'-'+(B.offset+B.bytes-1),cr=range.replace('=',' ')+'/'+B.packBytes;
const current=()=>new Response(new Uint8Array(raw),{status:206,headers:{'Content-Range':cr}});
const indexRes=()=>new Response(new Uint8Array(index));
function serve(part:()=>Response|Promise<Response>=current,idx:()=>Response|Promise<Response>=indexRes){
 const seen:{kind:string;range:string|null}[]=[];
 const get:typeof fetch=async (u,o)=>{
  const k=String(u).split('/').at(-1)!,r=new Headers(o?.headers).get('range');seen.push({kind:k,range:r});
  if(k==='index.json'){assert.equal(r,null);return idx();}
  if(k==='tiles.pack'){assert.equal(r,range);return part();}
  throw new Error('Crown test request escaped scope: '+u);
 };
 return {get,seen};
}

test('Crown preflight authenticates and reuses the exact 548 q12303 rows in actual stock draw, including return after eviction',async()=>{
 const s=serve(),prep=await Buildings.prepareKingsDryCrown(s.get);
 assert(prep&&prep.kingsCrown);assert.equal(prep.kingsCrown.length,B.count);
 assert.deepEqual(s.seen,[{kind:'index.json',range:null},{kind:'tiles.pack',range}]);
 const spec=JSON.parse(readFileSync(world('terrain.json'),'utf8'));
 const dem=gunzipSync(readFileSync(world('height.bin.gz')));
 const terr=new Terrain(spec,new Int16Array(dem.buffer,dem.byteOffset,dem.byteLength/2));
 const a=await Buildings.create(new T.Scene(),terr,undefined,undefined,undefined,Promise.resolve(prep));
 const ctrl=serve(),preRaw={...prep,pack:new (await import('../src/sim/packed-bytes.ts')).PackedBytes('/world/buildings/tiles.pack',B.packBytes,ctrl.get),kingsCrown:undefined};
 const b=await Buildings.create(new T.Scene(),terr,undefined,undefined,undefined,Promise.resolve(preRaw));
 type Draw={wanted:Set<string>;tiles:{id:string}[];meshes:Map<string,T.Mesh>;load(tile:{id:string}):Promise<void>;update(x:number,z:number):void};
 const get=async(a:Buildings)=>{
  const draw=a as unknown as Draw;const tile=draw.tiles.find(t=>t.id===B.tile)!;draw.wanted.add(B.tile);await draw.load(tile);
  const mesh=draw.meshes.get(B.tile);assert(mesh);
  const g=mesh.geometry, positions=g.getAttribute('position');assert(positions&&positions.count>0);
  return Object.fromEntries(Object.entries(g.attributes).map(([k,v])=>[k,Buffer.from(v.array.buffer,v.array.byteOffset,v.array.byteLength)]));
 };
 const original=await get(b); assert.deepEqual(ctrl.seen,[{kind:'tiles.pack',range}]);
 assert.deepEqual(await get(a),original); a.update(10_000_000,10_000_000);
 assert.deepEqual(await get(a),original);assert.equal(s.seen.length,2);
});

test('Crown never arms from wrong owner bytes, an unpinned index, missing/ignored/malformed range or a late verified body',async()=>{
 const wrong=new Uint8Array(raw);wrong[19]^=128;
 const badIndex=new Uint8Array(index);badIndex[10]^=8;
 const metadata=serve(current,()=>new Response(badIndex));
 assert.equal(await Buildings.prepareKingsDryCrown(metadata.get),undefined);assert.equal(metadata.seen.length,1);
 let ignoredBodyPulled=false,ignoredBodyCancelled=false;
 const faults=[
  ()=>new Response(null,{status:404}),
  ()=>new Response(wrong,{status:206,headers:{'Content-Range':cr}}),
  ()=>new Response(raw,{status:206,headers:{'Content-Range':cr.replace('3844984','3844985')}}),
  ()=>new Response(new Uint8Array(B.bytes+1),{status:206,headers:{'Content-Range':cr}}),
  ()=>new Response(new ReadableStream({pull(){ignoredBodyPulled=true;},cancel(){ignoredBodyCancelled=true;}},{highWaterMark:0})),
 ];
 for(const f of faults){const s=serve(f);assert.equal(await Buildings.prepareKingsDryCrown(s.get),undefined);assert.equal(s.seen.length,2);}
 assert(!ignoredBodyPulled&&ignoredBodyCancelled);
 let late=false;const s=serve(async()=>{await new Promise(done=>setTimeout(done,60));late=true;return current();});
 assert.equal(await Buildings.prepareKingsDryCrown(s.get,25),undefined);
 await new Promise(done=>setTimeout(done,75));assert(late&&s.seen.length===2);
 let stalled=false;const z=serve(()=>new Response(new ReadableStream({cancel(){stalled=true;}},{highWaterMark:0}),{status:206,headers:{'Content-Range':cr}}));
 assert.equal(await Buildings.prepareKingsDryCrown(z.get,25),undefined);assert(stalled);
});

test('the ordinary streamed owner is qualified lazily without any repeat range and cannot bless an evicted mesh',async()=>{
 const seed=serve(),prep=await Buildings.prepareKingsDryCrown(seed.get);assert(prep);
 const spec=JSON.parse(readFileSync(world('terrain.json'),'utf8')),dem=gunzipSync(readFileSync(world('height.bin.gz')));
 const ter=new Terrain(spec,new Int16Array(dem.buffer,dem.byteOffset,dem.byteLength/2));
 const {PackedBytes}=await import('../src/sim/packed-bytes.ts');
 const s=serve(),resident={...prep,pack:new PackedBytes('/world/buildings/tiles.pack',B.packBytes,s.get),
   kingsCrown:undefined,residentProofIndex:Uint8Array.from(index).buffer};
 const a=await Buildings.create(new T.Scene(),ter,undefined,undefined,undefined,Promise.resolve(resident));
 a.enableStandardKingsRidge();
 const scene=a as unknown as {wanted:Set<string>;tiles:{id:string}[];meshes:Map<string,T.Mesh>;load(tile:{id:string}):Promise<void>};
 const tile=scene.tiles.find(t=>t.id===B.tile)!;
 const attach=async()=>{scene.wanted.add(B.tile);await scene.load(tile);const m=scene.meshes.get(B.tile);assert(m);return m;};
 const load=await attach();assert(!a.kingsRidgeOwnerLive);
 const p=a.prepareKingsRidgeOwner();assert(p);assert.equal(a.prepareKingsRidgeOwner(),p);assert(await p);
 assert(a.kingsRidgeOwnerLive);assert.equal(s.seen.length,1);
 a.update(10_000_000,10_000_000);assert(!a.kingsRidgeOwnerLive);
 const next=await attach();assert.notEqual(next,load);assert(!a.kingsRidgeOwnerLive);
 const eviction=a.prepareKingsRidgeOwner();assert(eviction);a.update(11_000_000,11_000_000);
 assert(!await eviction);assert(!a.kingsRidgeOwnerLive);
 assert.equal(s.seen.length,2);
 const changed=await attach();changed.position.y++;
 assert(!a.prepareKingsRidgeOwner());assert(!a.kingsRidgeOwnerLive);
 assert.equal(s.seen.length,3);
});
