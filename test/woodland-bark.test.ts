import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {loadWoodlandBark} from '../src/render/woodland-bark.ts';
import {sceneryOptions,sceneryReviewBlock} from '../src/app/scenery-profile.ts';

const where=new URL('../public/art/bark/',import.meta.url);
const wire=readFileSync(new URL('wood-v1.rgba.gz',where));
const raw=gunzipSync(wire);
const meta=JSON.parse(readFileSync(new URL('sources.json',where),'utf8'));
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
test('the raw and encoded bark packages resolve to the same authenticated DataTexture',async()=>{
 assert.equal(raw.length,256*256*4);
 assert.equal(wire.length,meta.packBytes);
 assert.ok(wire.length<300000);
 assert.equal(sha(wire),meta.packSha256);
 assert.equal(sha(raw),meta.decodedSha256);
 for(const bytes of [wire,raw]){
  const t=await loadWoodlandBark('/preview/',async url=>{
   assert.equal(url,'/preview/art/bark/wood-v1.rgba.gz');
   return new Response(bytes);
  });
  assert.ok(t);assert.equal(t.image.width,256);assert.equal(t.image.height,256);
  assert.equal(sha(t.image.data),meta.decodedSha256);
  assert.equal(t.generateMipmaps,true);t.dispose();
 }
});
test('corrupt, oversize and partial bark responses keep the old wood surface',async()=>{
 for(const b of [wire,raw]){
  const c=Uint8Array.from(b);c[1024]^=128;
  assert.equal(await loadWoodlandBark('/',async()=>new Response(c)),undefined);
 }
 assert.equal(await loadWoodlandBark('/',async()=>new Response(wire,{status:206})),undefined);
 assert.equal(await loadWoodlandBark('/',async()=>new Response(new Uint8Array(raw.length+1))),undefined);
});
test('the optional material follows existing supported close woodland modes',()=>{
 assert.equal(sceneryOptions('').has('woodlandBark'),false);
 assert.ok(sceneryOptions('?woodlandBark').has('woodland3D'));
 assert.equal(sceneryReviewBlock('woodlandBark',sceneryOptions('?woodlandBark&woodlandCrownBase')),undefined);
 for(const k of ['inlandRelief','buildingShadows','duneGrassSurface','seatedForestShadows']){
  const q=sceneryOptions('?woodlandBark&'+k);
  assert.equal(sceneryReviewBlock('woodlandBark',q),'terrain');assert.equal(q.has('woodland3D'),false);
 }
});
