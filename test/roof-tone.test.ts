import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {readRoofTone} from '../src/render/roof-tone.ts';
import {ROOF_TONES,TONE_ATLAS_SHA} from '../src/render/roof-tone.generated.ts';

test('2025 roof tone selects exact rows in the literal original streamed plans',()=>{
 const base=new URL('../public/world/buildings/',import.meta.url);
 const index=JSON.parse(readFileSync(new URL('index.json',base),'utf8'));
 const pack=readFileSync(new URL('tiles.pack',base));
 const sha=(v:Uint8Array)=>createHash('sha256').update(v).digest('hex');
 assert.equal(index.sha256,TONE_ATLAS_SHA);assert.equal(sha(pack),TONE_ATLAS_SHA);
 const check=(n:number)=>n>0&&n<=.25&&Number.isFinite(n);
 for(const [id,models]of Object.entries(ROOF_TONES)){
  const t=index.tiles.find((x:{id:string})=>x.id===id);assert.ok(t);
  const bytes=pack.subarray(t.offset,t.offset+t.bytes);assert.equal(sha(bytes),t.sha256);
  const {features}=JSON.parse(gunzipSync(bytes).toString('utf8'));
  let previous=-1;
  for(const [slot,ring,r,g,b] of models){
   assert.ok(slot>previous);previous=slot;
   const f=features[slot];assert.ok(f&&!f.holes?.length);
   assert.equal(ring.length,f.footprint.length*2);
   const rgb=readRoofTone(TONE_ATLAS_SHA,id,slot,f.footprint);
   assert.deepEqual(rgb,[r/2040,g/2040,b/2040]);assert.ok(rgb.every(check));
   assert.equal(readRoofTone(undefined,id,slot,f.footprint),undefined);
   assert.equal(readRoofTone(TONE_ATLAS_SHA,id,slot,f.footprint.slice().reverse()),undefined);
   const updated=f.footprint.map(([x,y]:[number,number],j:number)=>[j?x:x+1e-8,y]);
   assert.equal(readRoofTone(TONE_ATLAS_SHA,id,slot,updated),undefined);
  }
 }
});
