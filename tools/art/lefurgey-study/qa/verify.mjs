/** Replay the frozen authoring artifact. No game hook, scene edits or output files. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync as read } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as T from 'three';
import { studioGLB } from '../studio.mjs';
import { LEFURGEY as Q } from '../src/lefurgey-survey.generated.ts';
import { buildLefurgeyAuthoringStudy } from '../src/lefurgey-study.ts';
import { at, caps, clip, outline, planTriangles, signedArea, signedPlanDistance } from '../src/lefurgey-roof.ts';

const packageDir = new URL('../', import.meta.url);
const dev = path => read(new URL(path, packageDir));
const sha = data => createHash('sha256').update(data).digest('hex');
const expected = JSON.parse(dev('proof/reproducibility.json'));
for (const [name, digest] of Object.entries(expected.frozenFiles)) assert.equal(sha(dev(name)), digest, name);

const stockDir = new URL('../../../../public/world/buildings/', import.meta.url);
const index = JSON.parse(read(new URL('index.json', stockDir)));
const pack = read(new URL('tiles.pack', stockDir));
const stock = expected.stockAtlas;
assert.equal(sha(pack), stock.layerSHA256);
assert.equal(index.sha256, stock.layerSHA256);
const tile = index.tiles.find(t => t.id === stock.tile);
const bound = pack.subarray(tile.offset, tile.offset + tile.bytes);
assert.equal(sha(bound), stock.tileSHA256);
assert.equal(tile.sha256, stock.tileSHA256);
const row = JSON.parse(gunzipSync(bound)).features[stock.ordinal];
assert.equal(sha(JSON.stringify(row)), Q.rawRowSHA);
assert.equal(Q.rawRowSHA, stock.rowSHA256);

const model = buildLefurgeyAuthoringStudy();
model.updateMatrixWorld(true);
assert.equal(model.userData.locationEnabled, false);
assert.equal(model.children.length, expected.mesh.materials);
const area = v => Math.abs(signedArea(v));
const partitionArea = caps().reduce((n,p) => n + area(p.polygon), 0);
assert(Math.abs(partitionArea - area(outline)) < 1e-8);

const bounds = planTriangles.map(poly => poly.map((a,i) => {
  const b = poly[(i+1)%poly.length];
  const dx = b[0]-a[0], dy = b[1]-a[1], s = Math.sign(signedArea(poly));
  return [s*(dy*a[0]-dx*a[1]),-s*dy,s*dx];
}));
let tris = 0, planEdgeM = 0, planAreaSpillM2 = 0;
for (const object of model.children) {
  const p = object.geometry.attributes.position;
  const n = object.geometry.attributes.normal;
  assert(p.array.every(Number.isFinite) && n.array.every(Number.isFinite));
  assert.equal(sha(Buffer.from(p.array.buffer,p.array.byteOffset,p.array.byteLength)),
    expected.mesh.positionHashes[object.name], object.name);
  tris += p.count / 3;
  for (let i=0;i<p.count;i+=3) {
    const tri = [i,i+1,i+2].map(k => [p.getX(k),-p.getZ(k)]);
    for (let k=0;k<3;k++) {
      const a=tri[k], b=tri[(k+1)%3];
      for (const f of [0,.25,.5,.75]) {
        planEdgeM = Math.max(planEdgeM,-signedPlanDistance([a[0]+f*(b[0]-a[0]),a[1]+f*(b[1]-a[1])]));
      }
    }
    const fromFace = area(tri);
    if (fromFace < 1e-9) continue;
    const kept = bounds.reduce((n, sides) => n + area(sides.reduce((poly,line) => clip(poly,line),tri)),0);
    planAreaSpillM2 = Math.max(planAreaSpillM2, fromFace-kept);
  }
}
assert.equal(tris, expected.mesh.triangles);
assert(planEdgeM < .000002 && planAreaSpillM2 < .000019);

const roof = model.children.find(x => x.name === 'shingle');
const down = new T.Raycaster(new T.Vector3(), new T.Vector3(0,-1,0), 0, 160);
let inside=0, outside=0, maxErrorM=0;
for (let u=-2.12;u<21;u+=.1151) for (let v=-1.039;v<18.35;v+=.123) {
  const d = signedPlanDistance([u,v]);
  if (Math.abs(d)<.00003) continue;
  down.ray.origin.set(u,25,-v);
  const hits=down.intersectObject(roof);
  if (d<0) { assert.equal(hits.length,0); outside++; continue; }
  assert.equal(hits.length,1); inside++;
  maxErrorM=Math.max(maxErrorM,Math.abs(hits[0].point.y+Q.CGVD2013Datum-at([u,v]).y));
}
assert.equal(inside,expected.mesh.roofRays.inside);
assert.equal(outside,expected.mesh.roofRays.outside);
assert(maxErrorM<.00003);

const side = new T.Raycaster(new T.Vector3(), new T.Vector3(),0,100);
let frontage=0;
for (const [x,y,z] of [[1,0,0],[1,.06,.19],[1,-.04,-.28]]) {
  side.ray.direction.set(x,y,z).normalize();
  for(let h=11.45;h<=17.22;h+=.091) for(let v=1.16;v<=14.58;v+=.112) {
    side.ray.origin.set(2.313,h-Q.CGVD2013Datum,-v).addScaledVector(side.ray.direction,-12);
    assert(side.intersectObjects(model.children,false).some(hit => hit.point.x<=2.315));
    frontage++;
  }
}
assert.equal(frontage,expected.mesh.opaqueSouthRays);

const [cu,cv,,,,,yaw] = Q.capNominalOctagon.nativeFit;
const radius = Q.capNominalOctagon.rBody / Math.cos(Math.PI/8);
const ring=Array.from({length:8},(_,i)=>{
  const a=yaw+Math.PI/8+i*Math.PI/4;
  return new T.Vector3(cu+radius*Math.cos(a),0,-(cv+radius*Math.sin(a)));
});
const shaft=model.children.find(x=>x.name==='quietCream');
const center=new T.Vector3(cu,0,-cv);
let seatRays=0, seatMinM=Infinity;
for(let i=0;i<8;i++) for(let j=1;j<127;j++) {
  const p=ring[i].clone().lerp(ring[(i+1)%8],j/127);
  down.ray.origin.set(p.x,25,p.z);
  const top=down.intersectObject(roof)[0].point.y;
  seatMinM=Math.min(seatMinM,top+Q.CGVD2013Datum-21.13);
  const radial=p.clone().sub(center).normalize();
  side.ray.direction.copy(radial).negate();
  side.ray.origin.set(p.x,top+.005,p.z).addScaledVector(radial,.145);
  const hit=side.intersectObject(shaft)[0];
  assert(hit && Math.abs(hit.distance-.145)<.00002);
  seatRays++;
}
assert.equal(seatRays,expected.mesh.lanternSeat.rays);
assert(seatMinM>.20);

const beforeExportReader=Object.getOwnPropertyDescriptor(globalThis,'FileReader');
const [glb, repeatedGLB]=await Promise.all([studioGLB(model),studioGLB()]);
assert(glb.equals(repeatedGLB));
assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'FileReader'),beforeExportReader);
assert.equal(glb.toString('ascii',0,4),'glTF');
assert.equal(glb.readUInt32LE(4),2);
assert.equal(glb.readUInt32LE(8),glb.length);
assert.equal(glb.toString('ascii',16,20),'JSON');
const startBin=20+glb.readUInt32LE(12);
const manifest=JSON.parse(glb.toString('utf8',20,startBin));
assert.equal(glb.readUInt32LE(startBin+4),0x004e4942);
assert.equal(startBin+8+glb.readUInt32LE(startBin),glb.length);
assert.equal(manifest.asset.version,'2.0');
assert.equal(manifest.meshes.length,model.children.length);
assert.equal(manifest.materials.length,model.children.length);
assert.equal(manifest.buffers.length,1);
assert(manifest.buffers.every(b=>!('uri' in b)) && !manifest.images);
assert(manifest.nodes.some(n=>n.extras?.locationEnabled===false));
for(const ob of model.children) {
  const linked=manifest.nodes.find(n=>n.name===ob.name);
  const shape=manifest.meshes[linked.mesh].primitives[0];
  assert.equal(shape.mode??4,4);
  const rgba=manifest.materials[shape.material].pbrMetallicRoughness?.baseColorFactor??[1,1,1,1];
  assert.deepEqual(rgba,[ob.material.color.r,ob.material.color.g,ob.material.color.b,1]);
  const ac=manifest.accessors[shape.attributes.POSITION], bw=manifest.bufferViews[ac.bufferView];
  const actual=ob.geometry.attributes.position;
  assert.equal(ac.count,actual.count);assert.equal(ac.componentType,5126);assert.equal(ac.type,'VEC3');
  const base=startBin+8+(bw.byteOffset??0)+(ac.byteOffset??0),stride=bw.byteStride??12;
  for(let i=0;i<actual.count;i++) for(let j=0;j<3;j++) {
    assert.equal(glb.readFloatLE(base+stride*i+4*j),actual.array[3*i+j],ob.name);
  }
}
console.log(JSON.stringify({
  productionPlacement:false, three:T.REVISION, tris, materials:model.children.length,
  atlasRow:Q.owner, inside, outside, maxErrorM, planEdgeM, planAreaSpillM2, frontage, seatRays, seatMinM,
  glb:{bytes:glb.length,sha256:sha(glb),externalResources:0,positionBufferExact:true}
},null,2));
