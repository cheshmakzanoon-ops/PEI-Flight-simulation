import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {railRequested} from '../src/render/summerside-station/admit.ts';
import {RAIL_ART as A} from '../src/render/summerside-station/art.generated.ts';
import {SUMMERSIDE_STATION as S} from '../src/render/summerside-station/source.generated.ts';

const sha=(a:Uint8Array)=>createHash('sha256').update(a).digest('hex');
test('the station art is the exact original reproduction and only the authenticated Water Street owner changes',()=>{
 const wire=readFileSync(new URL('../public/art/'+A.file,import.meta.url));
 assert.equal(wire.length,A.wire);assert.equal(sha(wire),A.wireSha);
 const raw=gunzipSync(wire,{maxOutputLength:A.raw});
 assert.equal(raw.length,A.raw);assert.equal(sha(raw),A.rawSha);
 assert.equal(raw.toString('ascii',0,4),'RAIL');assert.equal(raw.readUInt16LE(4),1);
 assert.equal(raw.readUInt16LE(6),A.parts.length);assert.equal(A.parts.length,10);
 assert.equal(raw.readUInt32LE(8),A.raw);
 let at=16,triangles=0;
 for(const [i,g] of A.parts.entries()){
  assert.equal(raw.readUInt16LE(at),i);
  const n=raw.readUInt16LE(at+2),k=raw.readUInt32LE(at+4),t=raw.readUInt32LE(at+8);
  assert.deepEqual([n,k,t],[g.nv,g.ni,g.textureSize]);assert.ok(k%3===0);
  at+=16+n*44;
  for(let j=0;j<k;j++)assert.ok(raw.readUInt16LE(at+j*2)<n);
  at+=k*2+(k%2)*2+4*t*t;triangles+=k/3;
 }
 assert.equal(at,raw.length);assert.equal(triangles,5299);
 assert.deepEqual([S.tile,S.ordinal,S.vertices,S.start,S.end],['q032001',163,69894,30618,30666]);
});
test('the station opt-in cannot take another approved receiver or act in default scenery',()=>{
 const q=(s:string)=>railRequested(new URLSearchParams(s));
 assert.equal(q(''),false);assert.equal(q('summersideStationReview'),false);
 assert.equal(q('buildingShadows'),false);
 assert.equal(q('buildingShadows&summersideStationReview'),true);
 for(const k of ['scenery=detail','surveyRelief','inlandRelief','seatedRoads','spinnakersPreview','northBaywalkPreview'])
  assert.equal(q(k+'&summersideStationReview&buildingShadows'),false,k);
});
