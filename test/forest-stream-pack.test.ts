import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

const dir=new URL('../public/world/woodland/stream-v1/',import.meta.url);
const index=JSON.parse(readFileSync(new URL('index.json',dir),'utf8'));
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');

test('provincial forest stream packs reconcile, including every shared interpolation halo',()=>{
 const packs=index.packs.map((p:{file:string;bytes:number;sha256:string})=>{
  const b=readFileSync(new URL(p.file,dir));assert.equal(b.length,p.bytes);assert.equal(sha(b),p.sha256);return b;
 }) as Buffer[];
 assert.equal(packs.reduce((a,b)=>a+b.byteLength,0),5426831);
 const chunks=new Map<string,Buffer>();
 const offsets=packs.map(()=>0);
 for(const t of index.tiles){
  assert.equal(t.offset,offsets[t.pack],t.id);offsets[t.pack]+=t.bytes;
  const raw=gunzipSync(packs[t.pack].subarray(t.offset,t.offset+t.bytes));
  assert.equal(raw.byteLength,324**2,t.id);
  assert.equal(sha(raw),t.sha256,t.id);
  assert.ok(!chunks.has(t.id),t.id);
  chunks.set(t.id,raw);
 }
 assert.equal(chunks.size,239);
 assert.deepEqual(offsets,packs.map(x=>x.length));
 let horizontal=0,vertical=0;
 for(const [id,a] of chunks){
  const [x,y]=id.split('-').map(Number),right=chunks.get((x+1)+'-'+y),down=chunks.get(x+'-'+(y+1));
  if(right){
   for(let row=0;row<324;row++)assert.equal(a.subarray(row*324+320,(row+1)*324).compare(right.subarray(row*324,row*324+4)),0,id);
   horizontal++;
  }
  if(down){assert.equal(a.subarray(320*324).compare(down.subarray(0,4*324)),0,id);vertical++;}
 }
 assert.ok(horizontal>200&&vertical>190);
});
