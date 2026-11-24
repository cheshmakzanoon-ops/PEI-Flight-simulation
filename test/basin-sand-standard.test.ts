import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {sceneryOptions,standardBasinSandRequested} from '../src/app/scenery-profile.ts';
import {BASIN_SAND_BOUNDS,loadStandardBasinSand,StandardBasinSand} from '../src/render/basin-head-sand.ts';
import {BASIN_SAND as sand} from '../src/render/basin-head-sand-pin.generated.ts';
import {BASIN_SCAN as scan} from '../src/render/basin-head-scan-pin.generated.ts';

const wires=new Map([sand,scan].map(s=>[s.asset,new Uint8Array(readFileSync(new URL('../public/world/'+s.asset,import.meta.url)))] as const));
const bytes=(input:RequestInfo|URL)=>wires.get(String(input).replace(/^\//,''))!;
const tick=()=>new Promise<void>(done=>setImmediate(done));
test('ordinary Basin sand does not consume separate shoreline, wetland or art studies',()=>{
 const q=(s:string)=>sceneryOptions(s);
 assert(standardBasinSandRequested(q('')));assert(standardBasinSandRequested(q('?departure=basin-head-low')));
 for(const key of ['scenery=detail','scenery=legacy','stockBasinSand','basinSand','shoreToneStudy','basinChannel','basinWharf','legacyShoreArcs','pointPrimStudy','regionalCanopyStudy','duneGrassSurface','canopyLight']){
  assert(!standardBasinSandRequested(q('?'+key)),key);
 }
 assert(!q('?stockBasinSand&basinSand').has('basinSand'));
});
test('ordinary transport admits only bounded exact wire or HTTP-decoded assets',async()=>{
 for(const decoded of [false,true]){
  const pack=await loadStandardBasinSand('/',async(url,o)=>{
   assert.equal(o?.redirect,'error');
   return new Response(decoded?new Uint8Array(gunzipSync(bytes(url))):bytes(url));
  });
  assert(pack);assert.equal(pack.basinSandGain.value,1);
  pack.basinSandMap.value.dispose();pack.basinSandScan.value.dispose();
 }
 for(const behavior of ['partial','corrupt','same-gzip-plain','oversize','bad-header']){
  const pack=await loadStandardBasinSand('/',async url=>{
   const t=bytes(url);if(!String(url).includes('seaward'))return new Response(t);
   if(behavior==='partial')return new Response(t,{status:206});
   if(behavior==='oversize')return new Response(new Uint8Array(sand.decodedBytes+1));
   if(behavior==='bad-header')return new Response(t,{headers:{'content-length':'1'}});
   const copy=t.slice();copy[behavior==='same-gzip-plain'?9:600]^=1;
   return new Response(copy);
  });
  assert.equal(pack,undefined,behavior);
 }
 const late=await loadStandardBasinSand('/',()=>new Promise(()=>{}),8);
 assert.equal(late,undefined);
});
test('a proof completing after exit does not start material requests away from the coast',async()=>{
 const [a,c,b,d]=BASIN_SAND_BOUNDS,x=(a+b)/2,z=(c+d)/2;let verifies=0,reads=0,finish!:(ok:boolean)=>void;
 const world=new StandardBasinSand('/',async()=>{reads++;return new Response(null,{status:404});});
 world.permit(()=>{verifies++;return new Promise<boolean>(ok=>{finish=ok;});});
 world.update(x,680,z);world.update(x+50000,100,z);await tick();assert.deepEqual([verifies,reads],[0,0]);
 world.update(x,80,z);await tick();assert.deepEqual([verifies,reads],[1,0]);
 world.update(x+50000,100,z);finish(true);await tick();world.update(x+50000,100,z);await tick();
 assert.deepEqual([verifies,reads],[1,0]);assert.equal(world.state.active,false);
 world.update(x,80,z);await tick();assert.equal(reads,2);
});
test('the vertical fade reaches zero before withdrawal and cached art can return',async()=>{
 const [a,c,b,d]=BASIN_SAND_BOUNDS,x=(a+b)/2,z=(c+d)/2;
 const mat=new StandardBasinSand('/',async url=>new Response(bytes(url)));
 mat.permit(async()=>true);
 mat.update(x,80,z,0);await tick();mat.update(x,80,z,16);
 for(let n=0;n<150&&mat.state.proof!=='ready';n++)await new Promise(done=>setTimeout(done,2));
 assert.equal(mat.state.proof,'ready');
 mat.update(x,80,z,20);mat.update(x,80,z,500);
 assert.equal(mat.uniforms.basinSandGain.value,1);
 mat.update(x,390,z,501);assert(mat.uniforms.basinSandGain.value<.01);
 mat.update(x,395,z,502);assert.equal(mat.uniforms.basinSandGain.value,0);
 mat.update(x,411,z,503);assert.equal(mat.uniforms.basinSandGain.value,0);
 mat.update(x,80,z,600);assert.equal(mat.uniforms.basinSandGain.value,0);
 mat.update(x,80,z,1000);assert.equal(mat.uniforms.basinSandGain.value,1);
 assert.equal(mat.state.requests,1);
});
