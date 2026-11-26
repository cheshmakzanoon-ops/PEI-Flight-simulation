import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {buildFoundersRailShop} from './founders-rail-shop-study.ts';
import {buildFoundersWestClipStudy} from './founders-west-clip-study.ts';
import {WEST_CLIP_FIXTURE as F} from './founders-west-clip-fixture.generated.ts';
const h=b=>createHash('sha256').update(b).digest('hex');
const data=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
test('portable V7 is pinned to the exact published V5 source and is physically no app import',()=>{
 for(const [name,sha]of Object.entries(F.ordinarySha))assert.equal(h(readFileSync(new URL(name,import.meta.url))),sha,name);
 assert(F.phase==='detached-browser-only-no-collision');
 const s=readFileSync(new URL('founders-west-clip-study.ts',import.meta.url),'utf8');
 assert(!s.includes('../'));assert(!s.includes('fetch('));
});
test('ready is dormant and all original Float32 ramps survive byte-for-byte',async()=>{
 const stock=buildFoundersRailShop(),safe=await buildFoundersWestClipStudy();
 assert.equal(safe.verified,true);assert.equal(safe.group.parent,null);assert.equal(safe.batches,17);
 assert.equal(safe.triangles,F.submittedTriangles);assert.equal(F.submittedTriangles-stock.triangles,47);
 assert.equal(safe.setEnabled(false),false);assert.equal(safe.setEnabled(true),true);assert.equal(safe.setEnabled(false),false);
 for(const m of stock.group.children){
  const a=m.geometry,b=safe.group.children.find(o=>o.name===m.name).geometry,old=F.original[m.name],extra=F.localAppend[m.name];
  for(const k of ['normal','position','uv']){
   const A=data(a.attributes[k].array),B=data(b.attributes[k].array);
   assert.equal(h(A),old.channels[k]);assert.deepEqual(A,B.subarray(0,A.length));assert.equal(h(B),extra?.compositeChecksums[k]??old.channels[k]);
  }
  const order=b.attributes.westStripMode;
  if(extra){
   assert(order);for(const [s,ids]of Object.entries(extra.switchIndices))for(const i of ids)assert([0,1,2].every(k=>order.array[i*3+k]===Number(s)));
  }else assert.equal(order,undefined);
 }
});
test('without local SHA-256, the existing unmodified preview remains and cannot enable optional scope',async()=>{
 const orig=Object.getOwnPropertyDescriptor(globalThis,'crypto');
 Object.defineProperty(globalThis,'crypto',{configurable:true,value:undefined});
 try{
  const p=await buildFoundersWestClipStudy();
  assert.equal(p.verified,false);assert.equal(p.triangles,1792);assert.equal(p.setEnabled(true),false);
  assert.equal(p.group.children.some(m=>m.geometry.attributes.westStripMode),false);
 }finally{
  if(orig)Object.defineProperty(globalThis,'crypto',orig);else delete globalThis.crypto;
 }
});
