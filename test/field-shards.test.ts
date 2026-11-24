import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {FieldShardSource,FIELD_SHARD_BYTES,fieldCandidates,fieldKey,readFieldDirectory,type FieldCell} from '../src/sim/field-shards.ts';
import {FieldStream} from '../src/render/field-stream.ts';
const hash=(a:Uint8Array)=>createHash('sha256').update(a).digest();
const raw=new Uint8Array(FIELD_SHARD_BYTES);
for(let i=0;i<100;i++)raw[i*261]=23+i%17;
const wire=gzipSync(raw);
const pack=Buffer.concat([wire,wire,wire,wire]);
const body=(q:Uint8Array)=>new Uint8Array(q).buffer;
function directory(){
 const b=new ArrayBuffer(12+36+80*4),v=new DataView(b),a=new Uint8Array(b);
 v.setUint32(0,0x46435231);v.setUint16(4,1,true);v.setUint16(6,1,true);v.setUint16(8,4,true);
 v.setUint32(12,pack.length,true);a.set(hash(pack),16);
 let i=0;
 for(const x of [-1,0])for(const z of [-1,0]){
  const at=48+i*80;
  v.setInt16(at,x,true);v.setInt16(at+2,z,true);
  v.setUint32(at+8,i*wire.length,true);v.setUint32(at+12,wire.length,true);
  a.set(hash(wire),at+16);a.set(hash(raw),at+48);++i;
 }
 return b;
}

test('the signed field index rejects nonlocal, duplicated or ambiguous entries',()=>{
 const b=directory(),dir=readFieldDirectory(b);assert.ok(dir);
 assert.equal(dir.cells.size,4);
 assert.deepEqual(fieldCandidates(0,0,dir).map(x=>x.key),['-1:-1','-1:0','0:-1','0:0']);
 assert.deepEqual(fieldCandidates(-513,-513,dir).map(x=>x.key),['-1:-1']);
 const v=new DataView(b);
 v.setUint32(48+80+8,123,true);assert.equal(readFieldDirectory(b),undefined);
 v.setUint32(48+80+8,wire.length,true);v.setInt16(48+80+2,-1,true);
 assert.equal(readFieldDirectory(b),undefined);
});

test('exact range and bounded pack fallback yield identical shard bytes',async()=>{
 const ix=new Uint8Array(directory()),zip=gzipSync(ix);
 const pin={rawSize:ix.length,packedSize:zip.length,rawHash:hash(ix).toString('hex'),packedHash:hash(zip).toString('hex')};
 let requests=0;
 const range:typeof fetch=async (_req,options)=>{
  ++requests;
  const h=new Headers(options!.headers),test=h.get('Range');
  if(!test)return new Response(body(zip));
  const [lo,hi]=test.slice(6).split('-').map(Number);
  return new Response(body(pack.subarray(lo,hi+1)),{status:206,headers:{'Content-Range':`bytes ${lo}-${hi}/${pack.length}`}});
 };
 const source=await FieldShardSource.open('https://assets.example/',pin,range);
 assert.ok(source);
 const cell=source.dir.cells.get('0:0')!;
 const received=await source.load(cell);assert.ok(received,'range did not load');assert.ok(hash(received).equals(hash(raw)));
 assert.equal(requests,2);
 for(const fault of ['wrong','overflow','partial','archive']){
  const req:typeof fetch=async()=>fault==='wrong'||fault==='archive'?
   new Response(body(fault==='wrong'?Buffer.concat([pack.subarray(0,-1),Buffer.of(pack.at(-1)!^0xa5)]):Buffer.alloc(wire.length)),{status:fault==='archive'?206:200,headers:{'Content-Range':`bytes ${cell.offset}-${cell.offset+cell.size-1}/${pack.length}`}}):
   fault==='overflow'?new Response(body(Buffer.concat([pack,pack]))):
   new Response(body(wire),{status:206,headers:{'Content-Range':'bytes 0-9/55'}});
  const bad=new FieldShardSource(source.dir,source.base,req);
  assert.ok((await bad.load(cell))===undefined,fault+' malformed response not rejected');
 }
 let full=0;
 const fallback=new FieldShardSource(source.dir,source.base,async()=>{++full;return new Response(body(pack));});
 const same=await Promise.all([fallback.load(cell),fallback.load(source.dir.cells.get('0:-1')!)]);assert.ok(same.every(v=>v&&hash(v).equals(hash(raw))),'full pack reuse');
 assert.equal(full,1);
});

test('scenery movement cannot paint stale data into a recycled field layer',async()=>{
 const dir=readFieldDirectory(directory())!;
 const waits:{cell:FieldCell;signal:AbortSignal;done:(r?:Uint8Array)=>void}[]=[];
 let time=0;
 const stream=new FieldStream({dir,load(cell,signal){
  return new Promise(resolve=>waits.push({cell,signal:signal!,done:resolve}));
 }},()=>time);
 assert.ok(stream.uniforms.fieldShardAreas.value.every(a=>a.w===0));
 stream.update(-515,-515,62);
 assert.equal(waits.length,1);assert.equal(waits[0].cell.key,fieldKey(-1,-1));
 time+=300;stream.update(513,513,62);
 assert.equal(waits[0].signal.aborted,true);
 assert.equal(waits[1].cell.key,fieldKey(0,0));
 waits[0].done(raw);await new Promise<void>(r=>setImmediate(r));
 assert.equal(stream.state.ready,0);
 waits[1].done(raw);await new Promise<void>(r=>setImmediate(r));
 assert.equal(stream.state.ready,1);assert.equal(stream.uniforms.fieldShardAreas.value[0].x,0);
 assert.equal(stream.texture.image.data!.byteLength,4*FIELD_SHARD_BYTES);
 time+=300;stream.update(513,513,550);assert.equal(stream.state.ready,0);
 stream.dispose();
});
