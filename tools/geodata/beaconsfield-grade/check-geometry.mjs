/** Numeric proof of the exact sparse submitted grade and each original canopy receiver triangle. */
import * as T from 'three';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {Terrain} from '../../../src/sim/terrain.ts';import {BoundedGrade} from '../../../src/sim/bounded-grade.ts';import {World} from '../../../src/render/world.ts';import {BEACON_GRADE as S} from '../../../src/sim/beaconsfield-grade.generated.ts';
import {positiveGround} from '../../../src/render/beaconsfield-grade/positive-topology.ts';
import {measureShadowChange} from '../../../src/render/beaconsfield-grade/receiver.ts';import {facet} from '../../../src/sim/coastal-terrain.ts';
const out=process.argv[2];if(!out)throw Error('Need output directory');fs.mkdirSync(out,{recursive:true});const read=p=>fs.readFileSync('public/world/'+p),Tj=JSON.parse(read('terrain.json')),H=gunzipSync(read('height.bin.gz'));const t=new Terrain(Tj,new Int16Array(H.buffer,H.byteOffset,H.length/2));const raw=gunzipSync(read(S.file)),N=129*129; const Q=new Int16Array(raw.buffer,raw.byteOffset,N).slice(),W=new Uint8Array(raw.buffer,raw.byteOffset+2*N,N).slice();
const g=new BoundedGrade(t,S,Q,W,(x,z)=>t.atlasElevation(x,z));const world=Object.assign(Object.create(World.prototype),{terrain:t,mat:new T.MeshBasicMaterial()});const tw=(t.right-t.left)/32,th=(t.bottom-t.top)/22,l=t.left+tw*16,z=t.top+th*16, stock=world.patch(l,z,tw,th,112),live=world.patch(l,z,tw,th,112,g,false,positiveGround);const d=measureShadowChange({mesh:live,regular:stock,grade:g});assert(d,'physical canopy delta draft missing');
const POS=live.geometry.getAttribute('position'),IDS=live.geometry.index.array;
const sh=x=>createHash('sha256').update(x).digest('hex');function save(s,b){fs.writeFileSync(out+'/'+s,Buffer.from(b.buffer,b.byteOffset,b.byteLength));return sh(Buffer.from(b.buffer,b.byteOffset,b.byteLength));}
const d0=d.geom.getAttribute('position').array,d1=d.geom.getAttribute('uv').array,d2=d.geom.getAttribute('museumVariant').array;
// Old below-surface faces remain physically present, but the fragment depth mask
// prevents them appearing below the raised positives (except the bounded AA depth seal).
const oldI=stock.geometry.index.array, oldP=stock.geometry.getAttribute('position').array,oldUV=stock.geometry.getAttribute('uv').array;
assert.deepEqual(Array.from(IDS.slice(0,oldI.length)),Array.from(oldI));
assert.deepEqual(POS.array.slice(0,oldP.length),oldP);
assert.deepEqual(live.geometry.getAttribute('uv').array.slice(0,oldUV.length),oldUV);
assert.equal(IDS.length,oldI.length+3*3243);assert(IDS.subarray(oldI.length).every(v=>v>=oldP.length/3));
const P0=d0.length,depths=d.geom.getAttribute('museumDepth');assert(depths&&depths.count===P0/3);
const r={stockRetention:{indexCount:oldI.length,vertexCount:oldP.length/3,positionUnchanged:true,uvUnchanged:true,indicesUnchanged:true,positiveOnlyDrawn:true,originalBuriedTrianglesRetainedInCPU:true},grade:S.id,raw:S.sha256,triangles:live.geometry.index.count/3,stockTriangles:stock.geometry.index.count/3,actualGroundOrigin:live.position.toArray(),groundVertices:POS.count,maskedTriangles:d.moved,groundGrid:{x0:g.grid.x0,z0:g.grid.z0,dx:g.grid.stepX,dz:g.grid.stepZ},shapeQueries:S,actualGroundBuffers:{position:save('ground-position.f32',POS.array),index:save('ground-index.u32',new Uint32Array(IDS))},shadowShift:{rosterIndices:d.used,triangles:d0.length/9,position:save('receiver-position.f32',d0),uv:save('receiver-uv.f32',d1),variant:save('receiver-variant.f32',d2),oldAndNewClearance:save('receiver-clearance.f32',depths.array),affectedTriangleBits:save('affected-cell-mask.u8',d.mask)}};
fs.writeFileSync(out+'/geometry.json',JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(r).slice(0,1050));
