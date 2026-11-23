import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Cover} from '../src/sim/cover.ts';
import {Terrain} from '../src/sim/terrain.ts';
import {loadEastBench} from '../src/render/east-bench.ts';
import {EAST_BENCH} from '../src/render/east-bench.generated.ts';

const get=(p:string)=>Uint8Array.from(readFileSync(new URL('../'+p,import.meta.url)));
const meta=(p:string)=>JSON.parse(Buffer.from(get(p)).toString());
const world='public/world/';
const copy=()=>get(world+EAST_BENCH.asset);
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
test('bench mask is a small offline derivative of the pinned ground cohort, DTM and shoreline',()=>{
 assert.equal(EAST_BENCH.evidenceSHA256,sha(get('data/coastal-bench/east-point-source.json')));
 const dtm=meta('data/coastal-elevation/index.json').windows.find((w:{id:string})=>w.id==='east-point');
 assert.equal(EAST_BENCH.pinnedDTMSha256,dtm.sha256Decoded);
 assert.equal(EAST_BENCH.pinnedCoverSha256,sha(get(world+'cover.bin.gz')));
 const a=copy(),decoded=gunzipSync(a);
 assert.equal(a.byteLength,EAST_BENCH.compressedBytes);assert.ok(a.byteLength<1800);
 assert.equal(decoded.length,EAST_BENCH.width*EAST_BENCH.height);
 assert.equal(sha(decoded),EAST_BENCH.sha256);
 assert.equal(decoded.filter(x=>x!==0).length,EAST_BENCH.activeTexels);
});
test('every potentially affected mask neighbourhood stays on current Cover land',()=>{
 const coverSpec=meta(world+'cover.json'),c=new Cover(coverSpec.width,coverSpec.height,gunzipSync(get(world+'cover.bin.gz')));
 // Cover uses world bounds only; avoid allocating the province elevation plane.
 const t=new Terrain({width:2,height:2,bounds:meta(world+'terrain.json').bounds},new Int16Array(4));
 const raw=gunzipSync(copy()),{width,height,boundsXZ:[x0,z0],texelMetres:s}=EAST_BENCH;
 let checked=0;
 for(let j=0;j<height;j++)for(let i=0;i<width;i++){
  if(!raw[j*width+i])continue;
  assert.ok(i>0&&i<width-1&&j>0&&j<height-1,'transparent padding for linear filtering');
  // Cover is bilinear in its own raster cells; this mask never escapes its
  // current shoreline, including the full support of a linear GPU texel.
  for(const di of [-1,-.5,0,.5,1])for(const dj of [-1,-.5,0,.5,1]){
   const x=x0+(i+.5+di)*s,z=z0+(j+.5+dj)*s;checked++;
   assert.ok(c.distance(t,x,z)>0,'potential mask bleed through shoreline');
  }
 }
 assert.ok(checked>50_000);
});
test('material installs atomically; missing, delayed and corrupt bodies safely preserve the base color',async()=>{
 const known=await loadEastBench('/world/',async u=>{
  assert.equal(u,'/world/'+EAST_BENCH.asset);
  return new Response(copy());
 });
 assert.equal(known?.plan.id,'east-tidal-bench-v1');
 const decoded=Uint8Array.from(gunzipSync(copy()));
 const allowed=await loadEastBench('/',async()=>new Response(decoded));
 assert.deepEqual(allowed,known);
 decoded[900]^=4;
 const failures=[
  ()=>Promise.resolve(new Response(null,{status:404})),
  ()=>Promise.resolve(new Response(decoded.subarray(0,500),{status:206})),
  ()=>Promise.resolve(new Response(decoded)),
  ()=>new Promise<Response>(()=>{})
 ];
 for(const fetcher of failures)assert.equal(await loadEastBench('/',fetcher,250),undefined);
});
