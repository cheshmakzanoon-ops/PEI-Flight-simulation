import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {ReliefPacks,validReliefPlan} from '../src/sim/relief-pack.ts';
const sha=(data:string|Buffer)=>createHash('sha256').update(data).digest('hex');
const mask=112**2/8,n=385,ix=14,jz=12,encoded=Buffer.alloc(mask+n*n*2);
const t=(jz*112+ix);
encoded[t>>3]=1<<(t&7);
for(let j=0;j<n;j++){
 encoded.writeInt16LE(500+j,mask+(j*n)*2);
 for(let i=1;i<n;i++)encoded.writeInt16LE(1,mask+(j*n+i)*2);
}
const gz=gzipSync(encoded),hedge='unit test hedge index';
const pin={terrain:sha('a'),cover:sha('b'),road:sha('c'),buildings:sha('d'),hedges:sha(hedge)};
const plan={version:1,encoding:'guard-bitset-i16le-row-delta-dm',cols:32,rows:22,intervals:384,parentIntervals:112,
 bounds:[-64.47,45.94,-61.93,47.1],pins:pin,bytes:gz.length,
 packs:[{file:'relief-00.pack',bytes:gz.length,sha256:sha(gz)}],
 tiles:[{id:'11-11',pack:0,offset:0,bytes:gz.length,cells:1,sha256:sha(encoded),archiveSha256:sha(gz)}]};
const indexHash=sha(JSON.stringify(plan));
test('terrain streams fail closed against any source pin, bad ranges or unscoped path',()=>{
 assert.ok(validReliefPlan(plan,pin));
 for(const k of Object.keys(pin))assert.equal(validReliefPlan(plan,{...pin,[k]:sha('other')}),false);
 assert.equal(validReliefPlan({...plan,tiles:[{...plan.tiles[0],id:'03-4'}]},pin),false);
 assert.equal(validReliefPlan({...plan,tiles:[{...plan.tiles[0],offset:1}]},pin),false);
 assert.equal(validReliefPlan({...plan,packs:[{...plan.packs[0],file:'../outside'}]},pin),false);
 assert.equal(validReliefPlan({...plan,tiles:[{...plan.tiles[0],cells:0}]},pin),false);
});
test('verified range and ignored-range fallback decode the same signed terrain',async()=>{
 for(const partial of [true,false]){
  const requests:string[]=[];
  const req:typeof fetch=async(url,init)=>{
   const s=String(url);
   if(s.includes('hedgerows'))return new Response(hedge);
   if(s.endsWith('.json'))return Response.json(plan);
   requests.push(new Headers(init?.headers).get('Range')||'');
   return new Response(new Uint8Array(gz),partial?{status:206,headers:{'Content-Range':`bytes 0-${gz.length-1}/${gz.length}`}}:{status:200});
  };
  const stream=await ReliefPacks.open('/',pin,req,24000,indexHash);
  assert.ok(stream?.has('11-11'));assert.equal(stream.has('9-4'),false);
  const a=await stream.load('11-11'),b=await stream.load('11-11');
  assert.equal(a?.height(.5,.5),88.4);assert.equal(b?.height(.5,.5),88.4);
  assert.equal(a?.accepts(ix,jz),true);assert.equal(b?.accepts(ix-1,jz),false);
  assert.deepEqual(requests,Array.from({length:partial?2:1},()=>`bytes=0-${gz.length-1}`));
 }
});
test('absent, changed hedge receipt, truncated and corrupt chunks do not produce a seed',async()=>{
 const req=(mode:string):typeof fetch=>async(url)=>{
  const s=String(url);
  if(s.includes('hedgerows'))return new Response(mode==='hedge'?'different':hedge);
  if(s.endsWith('.json'))return mode==='absent'?new Response(null,{status:404}):Response.json(plan);
  if(mode==='truncated')return new Response(new Uint8Array(gz.slice(0,7)));
  const mut=Buffer.from(encoded);mut.writeInt16LE(6,mask+6);
  const content=gzipSync(mut);
  const result=new Uint8Array(gz);result.set(content.subarray(0,result.length));
  return new Response(result);
 };
 assert.equal(await ReliefPacks.open('/',pin,req('hedge'),24000,indexHash),undefined);
 assert.equal(await ReliefPacks.open('/',pin,req('absent'),24000,indexHash),undefined);
 const a=await ReliefPacks.open('/',pin,req('truncated'),24000,indexHash),b=await ReliefPacks.open('/',pin,req('bad'),24000,indexHash);
 await assert.rejects(a!.load('11-11'));await assert.rejects(b!.load('11-11'));
});
