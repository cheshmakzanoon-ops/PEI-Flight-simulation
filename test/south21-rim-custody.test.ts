import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {Terrain} from '../src/sim/terrain.ts';
import {Cover} from '../src/sim/cover.ts';
import {CANOPY_FENCE} from '../src/render/canopy-fence.generated.ts';
import {STOCK_TERRAIN_VERTEX} from '../src/render/regular-z-rim-clip-v2.ts';
import {SOUTH21,SOUTH21_VERTEX,south21ClipWorldZ,south21DryTaps} from '../src/render/south21-rim.ts';

const read=(k:string)=>readFileSync(new URL('../public/world/'+k,import.meta.url));
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
test('South21 inserts exactly four signed north-row IDs after the stock world and texture varyings',()=>{
 const {gain,localZ,fromZ,toZ}=SOUTH21;
 const snippet=`if(${gain} == 1.0 && gl_VertexID >= 37 && gl_VertexID <= 40 && position.z == ${localZ})\n  w.z=${toZ};\n `;
 assert.equal(SOUTH21_VERTEX.replace(`uniform highp float ${gain};\n`,'').replace(snippet,''),STOCK_TERRAIN_VERTEX);
 assert(SOUTH21_VERTEX.indexOf(snippet)>SOUTH21_VERTEX.indexOf('p=w.xyz;vuv=uv;'));
 assert.equal(toZ-fromZ,-.00390625);assert(toZ>0);assert(localZ<0);
 for(let i=0;i<12769;i++){
  assert.equal(south21ClipWorldZ(localZ,i,fromZ,1),(i>=37&&i<=40)?toZ:fromZ);
  assert.equal(south21ClipWorldZ(-localZ,i,fromZ,1),fromZ);
  for(const inactive of [0,-1,Infinity,NaN])assert.equal(south21ClipWorldZ(localZ,i,fromZ,inactive),fromZ);
 }
 for(const bad of [36.999,37.001,40.001,111,112,12723])assert.equal(south21ClipWorldZ(localZ,bad,fromZ,1),fromZ);
});
test('the exact South21 changed star and its donor remain fully dry through all 32 signed bilinear taps',()=>{
 const meta=JSON.parse(read('terrain.json').toString()),buffer=gunzipSync(read(meta.file));
 assert.equal(sha(buffer),CANOPY_FENCE.pins.terrain);
 const view=new DataView(buffer.buffer,buffer.byteOffset,buffer.byteLength);
 const terrain=new Terrain(meta,Int16Array.from({length:buffer.byteLength/2},(_,i)=>view.getInt16(i*2,true)));
 const C=JSON.parse(read('cover.json').toString()),wire=read(C.file),raw=new Uint8Array(gunzipSync(wire));
 assert.equal(sha(wire),CANOPY_FENCE.pins.cover);assert.equal(sha(raw),CANOPY_FENCE.pins.coverDecoded);
 const cover=new Cover(C.width,C.height,raw);
 assert.deepEqual(south21DryTaps(terrain,cover),{
  box:[50702.70875,56336.64234375,50974.74046875,56441.3303125],
  cols:[3112,3119],rows:[2594,2597],cells:32,signedCover:254,
 });
 const k=2597*C.width+3119,val=terrain.samples[k];terrain.samples[k]=-32768;
 assert.equal(south21DryTaps(terrain,cover),undefined);terrain.samples[k]=val;
 raw[k*2+1]=128;assert.equal(south21DryTaps(terrain,cover),undefined);
});
