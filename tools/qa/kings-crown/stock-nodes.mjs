/* Absolute N112 owner and height evaluator for one authored relative grid. No GL. */
import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {Terrain} from '../../../src/sim/terrain.ts';
import {CoastalGrid} from '../../../src/sim/coastal-terrain.ts';
import {Cover} from '../../../src/sim/cover.ts';
const w=process.env.PEI_WORLD,sha=b=>createHash('sha256').update(b).digest('hex');
const [dem,cv]=['height','cover'].map(k=>gunzipSync(fs.readFileSync(path.join(w,k+'.bin.gz'))));
const terrainSHA='661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d';
const coverSHA='e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9';
assert.equal(sha(dem),terrainSHA);assert.equal(sha(cv),coverSHA);
const cfg=JSON.parse(fs.readFileSync(path.join(w,'terrain.json'))),cs=JSON.parse(fs.readFileSync(path.join(w,'cover.json')));
const t=new Terrain(cfg,new Int16Array(dem.buffer,dem.byteOffset,dem.byteLength/2)),
 c=new Cover(cs.width,cs.height,cv);
const spec={tileX:21,tileZ:12,firstX:29,firstZ:61,cellsX:4,cellsZ:4,sub:32,
 id:'kings-coast-dry-crown-2020',kind:'inland',relativeToParent:true,sparseRelative:true,maxRelativeDeltaCm:1250};
const n=(spec.cellsX*spec.sub+1)*(spec.cellsZ*spec.sub+1);
const g=new CoastalGrid(t,{spec,samples:new Int16Array(n)},(x,z)=>t.atlasElevation(x,z));
const a=new Float64Array(n*6);
for(let j=0,k=0;j<g.nz;j++)for(let i=0;i<g.nx;i++,k+=6){
 const x=g.x0+i*g.stepX,z=g.z0+j*g.stepZ;
 a.set([x,z,g.parentHeight(x,z),t.contactHeight(x,z,c.distance(t,x,z)>=0),c.distance(t,x,z),c.sample(t,x,z)],k);
}
fs.writeFileSync('stock-nodes.f64',Buffer.from(a.buffer));
fs.writeFileSync('owner-grid.json',JSON.stringify({spec,decodedTerrainSha:terrainSHA,decodedCoverSha:coverSHA,
 bounds:[g.x0,g.z0,g.x1,g.z1],shape:[g.nz,g.nx],step:[g.stepX,g.stepZ]},null,2)+'\n');
