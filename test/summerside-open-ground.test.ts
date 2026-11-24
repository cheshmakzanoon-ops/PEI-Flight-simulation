import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {Terrain} from '../src/sim/terrain.ts';
import {Cover} from '../src/sim/cover.ts';
import {OPEN_LANE_SOURCE as P} from '../src/render/mapped-lane-canopy.ts';
import {authenticateSummersideFrontage,summersideFrontageCompatible} from '../src/render/summerside-open-ground.ts';

test('Water Street open ground admits only the actual synthetic fallback site',async()=>{
 const read=(n:string)=>readFileSync(new URL('../public/world/'+n,import.meta.url));
 const raw=gunzipSync(read('height.bin.gz')),z=read('cover.bin.gz'),c=gunzipSync(z);
 const sum=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
 const t=new Terrain(JSON.parse(read('terrain.json').toString()),new Int16Array(raw.buffer,raw.byteOffset,raw.length/2));
 const m=JSON.parse(read('cover.json').toString()),cover=new Cover(m.width,m.height,c,undefined,sum(z));
 const token=await authenticateSummersideFrontage(t,cover,sum(raw),P.road);
 assert(token);assert.deepEqual(token.owners,['-236:62']);assert.equal(token.size,1);
 const full=[-45157.51953125,12089.5615234375,16.367158889770508,15.841443061828613] as const;
 assert(token.excludes(...full));assert(token.forOwner('-236:62')!(...full));assert(!token.forOwner('-236:61'));
 for(let i=0;i<full.length;i++){
  const changed=[...full] as number[];changed[i]+=.005;
  assert(!token.excludes(changed[0],changed[1],changed[2],changed[3]));
 }
 assert.equal(await authenticateSummersideFrontage(t,cover,P.terrain,'wrong'),undefined);
 const bad=Uint8Array.from(c);bad[5]^=1;
 assert.equal(await authenticateSummersideFrontage(t,new Cover(m.width,m.height,bad,undefined,sum(z)),P.terrain,P.road),undefined);
 for(const flag of ['stockSummersideFrontage','scenery=detail','woodland3D','northBaywalkPreview','mappedLaneCanopyStudy'])
  assert(!summersideFrontageCompatible(new URLSearchParams(flag)));
 assert(summersideFrontageCompatible(new URLSearchParams('townWallStudy')));
});
