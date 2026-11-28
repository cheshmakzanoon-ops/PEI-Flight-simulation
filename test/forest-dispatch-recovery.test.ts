import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {unpackGzip} from '../src/sim/compression.ts';
import {ForestStream} from '../src/sim/forest-stream.ts';
import {project} from '../src/sim/geo.ts';
import {QUEENS_DISPATCH_STAND as q} from '../src/render/queens-dispatch-contract.ts';
const dir=new URL('../public/world/woodland/stream-v1/',import.meta.url);
const manifest=readFileSync(new URL('index.json',dir),'utf8'),index=JSON.parse(manifest);
const tile=index.tiles.find(t=>t.id===q.owner),source=index.packs[tile.pack],loc=project(q.lon,q.lat);
const range='bytes='+tile.offset+'-'+(tile.offset+tile.bytes-1);
const own=readFileSync(new URL(source.file,dir));
const corrupt=gzipSync(new Uint8Array(324**2).fill(48));
const wrong=new Uint8Array(tile.bytes);
// A GZIP FEXTRA field fills the same signed wire span without trailing junk.
const extra=wrong.byteLength-corrupt.length-2;
wrong.set(corrupt.subarray(0,10));wrong[3]|=4;
new DataView(wrong.buffer).setUint16(10,extra,true);
wrong.set(corrupt.subarray(10),12+extra);
function setup(act:(attempt:number)=>'ok'|'fail'|'abort'|'header'|'body'|'hash'){
 let count=0,allowed=true;
 const fetcher:typeof fetch=async (input,init)=>{
  const path=String(input).split('/').pop()!;
  if(path==='index.json')return new Response(manifest);
  const all=path===source.file?own:readFileSync(new URL(path,dir));
  const requested=new Headers(init?.headers).get('Range')!;
  const [,x,y]=/^bytes=(\d+)-(\d+)$/.exec(requested)!;
  const offset=+x,end=+y,size=end-offset+1;
  const kind=path===source.file&&requested===range?act(++count):'ok';
  if(kind==='fail')throw new DOMException('operation exceeded budget','TimeoutError');
  if(kind==='abort')throw new DOMException('not a timeout','AbortError');
  const contentRange=kind==='header'?'bytes 0-1/'+all.length:'bytes '+x+'-'+y+'/'+all.length;
  const failBody=kind==='body'?new ReadableStream({pull(c){c.error(new DOMException('body stuck','TimeoutError'));}}):null;
  return new Response(failBody??(kind==='hash'?wrong.slice(0,size):new Uint8Array(all.subarray(offset,end+1))),{status:206,headers:{'Content-Range':contentRange}});
 };
 const stream=new ForestStream('/',fetcher);
 return {stream,attempts:()=>count,arm:(sha=q.sha256)=>stream.setDispatchHeightRecovery(q.owner,sha,()=>allowed),
  leave:()=>{allowed=false;stream.clearDispatchHeightRecovery();},
  settle:()=>stream.warm(loc.x,loc.z,1000),signed:()=>stream.captureHeightPlan(q.owner,q.sha256)};
}
test('the same verified dispatch tile alone may recover a fetch or body timeout before Begin',async()=>{
 for(const kind of ['fail','body'] as const){
  const f=setup(n=>n===1?kind:'ok');f.arm();await f.settle();
  assert.equal(f.attempts(),2);assert.equal(f.signed()?.sha256,q.sha256);
 }
});
test('no automatic retry for mismatched digest, forbidden HTTP metadata, AbortError, or no manual permit',async()=>{
 const decoded=await unpackGzip(wrong.buffer);
 assert.equal(decoded.byteLength,324**2);
 assert.notEqual(createHash('sha256').update(new Uint8Array(decoded)).digest('hex'),q.sha256);
 for(const kind of ['abort','header','hash'] as const){
  const f=setup(()=>kind);f.arm();await f.settle();
  assert.equal(f.attempts(),1);assert.equal(f.signed(),undefined);
 }
 const opt=setup(()=> 'fail');await opt.settle();assert.equal(opt.attempts(),1);
 const wrongOwner=setup(()=> 'fail');wrongOwner.arm('a'.repeat(64));await wrongOwner.settle();assert.equal(wrongOwner.attempts(),1);
});
test('the second timeout is terminal and leaving before or during retry cannot install a late height view',async()=>{
 const double=setup(()=> 'fail');double.arm();await double.settle();assert.equal(double.attempts(),2);assert.equal(double.signed(),undefined);
 const before=setup(()=>{before.leave();return 'fail';});before.arm();await before.settle();assert.equal(before.attempts(),1);
 const during=setup(n=>{if(n===1)return 'fail';during.leave();return 'ok';});
 during.arm();await during.settle();assert.equal(during.attempts(),2);assert.equal(during.signed(),undefined);
 assert.equal(during.stream.heightPlanUnavailable(q.owner,q.sha256),true);
});
