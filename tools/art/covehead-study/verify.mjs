/** Verify the exact detached Covehead asset using the game repository's Three.js. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { DATA, buildCovehead } from './covehead.ts';
const source = readFileSync(new URL('./covehead.ts', import.meta.url));
assert.equal(createHash('sha256').update(source).digest('hex'),
  '175bc2f933af64380c89da09e7d402ce12a1a6fb0b220ef794551fcf9f7d00ca');
const witness = [];
for (const [tier,draws,faces] of [['heritage',10,2596],['flight',10,1592]]) {
  const model = buildCovehead(tier);
  assert.equal(DATA.currentPlacement, false);
  assert.equal(model.userData.covehead.detached, true);
  assert.equal(model.children.length,draws);
  let triangles = 0;
  const roles = [];
  for (const {name, geometry, material} of model.children) {
    roles.push(name);
    const positions=geometry.getAttribute('position');
    const normals=geometry.getAttribute('normal');
    assert.equal(positions.count%3,0);
    assert.equal(normals.count,positions.count);
    assert(!geometry.index && material.isMeshStandardMaterial);
    assert(positions.array.every(Number.isFinite) && normals.array.every(Number.isFinite));
    triangles+=positions.count/3;
  }
  assert.equal(triangles,faces);
  model.updateMatrixWorld(true);
  const peg = new THREE.Vector3(0,0,0), down=new THREE.Vector3(0,-1,0);
  const ray=(x,z)=>new THREE.Raycaster(peg.set(x,12,z),down)
    .intersectObject(model,true)[0];
  const interior = ray(.40,.29), gallery = ray(1.85,.19);
  assert(interior && gallery && Math.abs(interior.point.y-8.23631)<.02);
  assert(Math.abs(gallery.point.y-(DATA.galleryTopCGVD2013-DATA.groundDatumCGVD2013))<.002);
  assert.equal(ray(2.8,2.8),undefined);
  witness.push({tier,draws,triangles,roles,roofRayY:interior.point.y,galleryRayY:gallery.point.y});
}
console.log(JSON.stringify(witness,null,2));
