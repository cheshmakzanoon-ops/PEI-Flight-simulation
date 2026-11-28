import { resolve } from 'node:path';
import { readFileSync as read } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PACKET } from './packet-pins.generated.ts';
import { verifyCompactCarrier } from './compact-carrier.ts';
const stockDir=process.env.PANMURE_STOCK_DIR;
assert(stockDir,'set PANMURE_STOCK_DIR to the output of replay-stock.mjs');
const f=(root,leaf)=>new Uint8Array(read(root==='current-stock-25-18'?resolve(stockDir,leaf):new URL(root+'/'+leaf,import.meta.url)));
const old=()=>({
 tile:'25-18',n:112,matrixWorld:[...PACKET.modelMatrixColumnMajorOriginalF64],
 position:new Float32Array(f('current-stock-25-18','position.f32le').buffer),
 normal:new Float32Array(f('current-stock-25-18','normal.f32le').buffer),
 uv:new Float32Array(f('current-stock-25-18','uv.f32le').buffer),
 index:new Uint16Array(f('current-stock-25-18','index.u16le').buffer)
});
const pack=()=>Object.fromEntries(Object.keys(PACKET.packetLeaves).map(k=>[k,f('packet',k)]));
const sha=a=>createHash('sha256').update(new Uint8Array(a.buffer)).digest('hex');

test('exact local/rebased runs and owned byte copies; no live geometry',async()=>{
 const o=old(),s=pack(),b=await verifyCompactCarrier(o,s);
 assert(b);
 assert(!b.canMount);assert.deepEqual(b.oldRun,[9552,9558]);
 assert.deepEqual(Array.from(b.originalIndexRun),[1606,1719,1607,1719,1720,1607]);
 assert.equal(b.localIndex.length,1356);
 const e=new Uint16Array(76614), P=new Float32Array(38982);
 const [lo,hi]=b.oldRun;
 e.set(o.index.subarray(0,lo));e.set(b.replacementIndex,lo);e.set(o.index.subarray(hi),lo+b.replacementIndex.length);
 P.set(o.position);P.set(b.positions.subarray(12),o.position.length);
 assert.equal(sha(e),'ab81bbfc38298250d661289271ed92d9c1975a5b99ac35ad6a306d4d8b9b6383');
 assert.equal(sha(P),'3e3e911e6270a704b0787f464b28eedbf1d4e91a7afad729300a9db5166335cf');
 s['active.p.f32le'].fill(0);assert.notEqual(b.positions[7],0);
 assert.equal(sha(o.index),PACKET.oldWholeAssetSHA256.index);
});
test('same sizes with off-scope alteration require refusal',async()=>{
 const t=old();t.index[500]=t.index[500]+1;
 assert.equal(await verifyCompactCarrier(t,pack()),null);
 const q=old();q.normal[1]=0;
 assert.equal(await verifyCompactCarrier(q,pack()),null);
});
test('corrupt/mixed compact candidate, transform and LOD fail closed',async()=>{
 const b=pack();b['replacement.rebased.i.u16le'][2]^=1;
 assert.equal(await verifyCompactCarrier(old(),b),null);
 const c=old();c.matrixWorld[12]+=1e-11;
 assert.equal(Math.fround(c.matrixWorld[12]),PACKET.modelMatrixColumnMajorUniformF32[12]);
 assert.equal(await verifyCompactCarrier(c,pack()),null);
 assert.equal(await verifyCompactCarrier({...old(),n:56},pack()),null);
 const d=pack();d['uv.f32le']=d['uv.f32le'].subarray(1);
 assert.equal(await verifyCompactCarrier(old(),d),null);
});
