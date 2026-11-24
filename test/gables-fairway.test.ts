import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {GABLES_FAIRWAY as S} from '../src/render/gables-fairway.generated.ts';
import {GablesFairway,loadGablesFairway} from '../src/render/gables-fairway.ts';

test('the exact packed fairway is bounded and only admits the frozen body',async()=>{
 const wire=new Uint8Array(await readFile(new URL('../public/world/'+S.file,import.meta.url)));
 const raw=new Uint8Array(gunzipSync(wire));
 for(const given of [wire,raw]){
  const mat=await loadGablesFairway('/world/',async(u,o)=>{
   assert.equal(u,'/world/'+S.file);assert(o?.signal);return new Response(given);
  });
  assert(mat);assert.equal(mat.map.image.width,78);assert.equal(mat.map.image.height,122);
  assert.equal(mat.bytes.filter(x=>x>0).length,2630);
  assert(mat.intersects(S.left,S.top,S.left+4,S.top+5));
  assert(!mat.intersects(S.left-19,S.top-19,S.left-9,S.top-9));
 }
 const corrupt=Uint8Array.from(raw);corrupt[42]^=8;
 assert.equal(await loadGablesFairway('/world/',async()=>new Response(corrupt)),undefined);
 assert.equal(await loadGablesFairway('/world/',async()=>new Response(new Uint8Array(30_000))),undefined);
 assert.equal(await loadGablesFairway('/world/',async()=>new Response(null,{status:404})),undefined);
 assert.throws(()=>new GablesFairway(corrupt),/reserve/);
 let aborted=false;
 assert.equal(await loadGablesFairway('/world/',(_u,o)=>new Promise((_r,reject)=>{
  o?.signal?.addEventListener('abort',()=>{aborted=true;reject(Error('late'));},{once:true});
 }),10),undefined);
 assert(aborted);
});
