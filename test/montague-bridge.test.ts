import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {sceneryDeparture} from '../src/app/scenery-profile.ts';
import {MONTAGUE_BRIDGE_DEPARTURE,SITES} from '../src/sim/places.ts';
import {decodeRoads} from '../src/render/roads.ts';
import {loadMontagueFoundation,supportedMontagueFoundation} from '../src/sim/montague-foundation.ts';
import {MONTAGUE_FOUNDATION as plan}from '../src/sim/montague-foundation.generated.ts';
import {APPROACH_START,APPROACH_STOP,BRIDGE_STOP,MONTAGUE_PIER,montagueBridgeRows,montagueSection,
 measuredDeck,roadEdges,transitionWeight}from '../src/sim/montague-bridge.ts';

const file=(name:string)=>readFileSync(new URL('../public/world/'+name,import.meta.url));
test('preview foundation installs verified water and height together, with unchanged fallback',async()=>{
 const a=file(plan.asset);
 const h=await loadMontagueFoundation('/',async()=>new Response(new Uint8Array(a)),500);
 assert.ok(h);
 assert.equal(h.water.plan.id,'montague-bridge-channel-preview');
 assert.equal(h.ground.spec.id,'montague-bridgehead-dry-preview');
 assert.equal(h.ground.samples.length,129**2);
 const old=gunzipSync(a);old[old.length-10]^=19;
 for(const alt of [new Response(null,{status:404}),new Response(new Uint8Array(gzipSync(old)))]){
  assert.equal(await loadMontagueFoundation('/',async()=>alt,500),undefined);
 }
 assert.equal(supportedMontagueFoundation(plan.pinCoverSha256,plan.pinTerrainSha256,plan.pinCoverDecodedSha256),true);
 assert.equal(supportedMontagueFoundation(plan.pinCoverSha256,undefined,plan.pinCoverDecodedSha256),false);
 assert.equal(supportedMontagueFoundation(plan.pinCoverSha256,plan.pinTerrainSha256,'changed'),false);
});
test('Montague replaces only all three exact registered road rows, never a changed atlas',()=>{
 const r=gunzipSync(file('roads.bin.gz')),sha=createHash('sha256').update(r).digest('hex');
 const b=Uint8Array.from(r).buffer;
 const roads=decodeRoads(b);
 assert.ok(montagueBridgeRows(sha,roads));
 assert.ok(!montagueBridgeRows('invalid',roads));
 for(const q of [15171,15263,15316]){
  const broken=roads.slice(),v=roads[q];broken[q]={flags:v.flags,points:v.points.slice(0,-1)};
  assert.ok(!montagueBridgeRows(sha,broken));
 }
 assert.deepEqual(roadEdges(APPROACH_START),[-4.8,4.8]);
 assert.deepEqual(roadEdges(APPROACH_STOP),[-4.8,4.8]);
 assert.equal(transitionWeight(APPROACH_START),0);assert.equal(transitionWeight(APPROACH_STOP),0);
 assert.deepEqual([montagueSection(APPROACH_START).x,montagueSection(APPROACH_START).z],
  [roads[15316].points[0].x,roads[15316].points[0].z]);
 assert.deepEqual([montagueSection(APPROACH_STOP).x,montagueSection(APPROACH_STOP).z],
  [roads[15263].points.at(-1)!.x,roads[15263].points.at(-1)!.z]);
});
test('cross-sections remain finite and retain both resolved raised walk profiles',()=>{
 assert.ok(BRIDGE_STOP>60&&BRIDGE_STOP<61);
 assert.ok(MONTAGUE_PIER.station>MONTAGUE_PIER.visualBounds[0]&&MONTAGUE_PIER.station<MONTAGUE_PIER.visualBounds[1]);
 for(const q of [0,10,20,35,45,50.49,BRIDGE_STOP]){
  const p=montagueSection(q);
  assert.ok(Math.abs(Math.hypot(p.nx,p.nz)-1)<1e-12);
  assert.ok(measuredDeck(q,-5.18)>measuredDeck(q,-3.78)+.18);
  assert.ok(measuredDeck(q,5.6)>measuredDeck(q,4.1)+.18);
 }
});

test('saved low bridge links fall back to the existing Montague departure when not admitted',()=>{
 const ids=SITES.map(s=>s.id),low=MONTAGUE_BRIDGE_DEPARTURE.id;
 assert.ok(!ids.includes(low));
 const search='?departure='+low;
 assert.equal(ids[sceneryDeparture(search,ids)],'montague');
 const admitted=[...ids,low];
 assert.equal(admitted[sceneryDeparture(search,admitted)],low);
 assert.equal(sceneryDeparture('?departure=unknown',admitted),0);
 assert.equal(sceneryDeparture('?departure='+low,['cavendish']),0);
});
