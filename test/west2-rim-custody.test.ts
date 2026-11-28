import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Terrain} from '../src/sim/terrain.ts';
import {Cover} from '../src/sim/cover.ts';
import {CANOPY_FENCE} from '../src/render/canopy-fence.generated.ts';
import {STOCK_TERRAIN_VERTEX} from '../src/render/regular-z-rim-clip-v2.ts';
import {WEST2_RIM,WEST2_RIM_VERTEX,west2ClipWorldZ,west2DryTapProof} from '../src/render/west2-rim-host.ts';

const world=new URL('../public/world/',import.meta.url);
const read=(p:string)=>readFileSync(new URL(p,world));
const sha=(p:Uint8Array)=>createHash('sha256').update(p).digest('hex');
test('West2 patch is exactly four negative-world-Z raster positions, no varying or overall source change',()=>{
 const {oldZ,donorZ,gain,localZ}=WEST2_RIM;
 const chunk=`if(${gain} == 1.0 && gl_VertexID >= 12723 && gl_VertexID <= 12726 && position.z == ${localZ})\n  w.z=${donorZ};\n `;
 assert.equal(WEST2_RIM_VERTEX.replace(`uniform highp float ${gain};\n`,'').replace(chunk,''),STOCK_TERRAIN_VERTEX);
 assert(WEST2_RIM_VERTEX.indexOf('p=w.xyz;vuv=uv;')<WEST2_RIM_VERTEX.indexOf(chunk));
 assert(donorZ<0);assert.equal(donorZ-oldZ,0.00390625);
 for(let i=0;i<12769;i++){
  for(const inactive of [0,-1,2,NaN])assert.equal(west2ClipWorldZ(localZ,i,oldZ,inactive),oldZ);
  assert.equal(west2ClipWorldZ(-localZ,i,oldZ,1),oldZ);
  assert.equal(west2ClipWorldZ(localZ,i,oldZ,1),i>=12723&&i<=12726?donorZ:oldZ);
 }
});
test('complete five-cell star on both banks is separated from nodata and shoreline by signed original atlas taps',()=>{
 const s=JSON.parse(read('terrain.json').toString());
 const d=gunzipSync(read(s.file)),raw=new DataView(d.buffer,d.byteOffset,d.byteLength);
 assert.equal(sha(d),CANOPY_FENCE.pins.terrain);
 const t=new Terrain(s,Int16Array.from({length:d.length/2},(_,i)=>raw.getInt16(i*2,true)));
 const m=JSON.parse(read('cover.json').toString());const wire=read(m.file),bytes=new Uint8Array(gunzipSync(wire));
 assert.equal(sha(wire),CANOPY_FENCE.pins.cover);assert.equal(sha(bytes),CANOPY_FENCE.pins.coverDecoded);
 const c=new Cover(m.width,m.height,bytes);
 const q=west2DryTapProof(t,c);
 assert(q); assert.deepEqual([q.x0,q.x1,q.z0,q.z1],[-63432.8146875,-63160.78296875,-55026.55296875,-54921.865]);
 assert.deepEqual([q.i0,q.i1,q.j0,q.j1,q.cells,q.minSignedCover],[714,721,245,248,32,254]);
 const k=q.j1*c.width+q.i1,save=t.samples[k];t.samples[k]=-32768;
 assert.equal(west2DryTapProof(t,c),undefined);t.samples[k]=save;
 bytes[2*k+1]=128;
 assert.equal(west2DryTapProof(t,c),undefined);
});
