import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rudderDeflection,createRudder} from '../src/render/rudder.ts';
import * as THREE from 'three';
import {RAD} from '../src/sim/geo.ts';
test('visual rudder is an articulated tail shell with bounded deflection',()=>{
 const root=new THREE.Group(),material=new THREE.MeshBasicMaterial();
 const rudder=createRudder(root,material,material,material),moving=root.getObjectByName('Survey aircraft rudder')!;
 assert.ok(moving.children.length>0);
 assert.equal(rudderDeflection(4),22*RAD);
 assert.equal(rudderDeflection(-4),-22*RAD);
 for(let i=0;i<120;i++)rudder.update(1,1/60);
 assert.ok(Math.abs(rudder.angle()-22*RAD)<1e-7);
 assert.ok(moving.quaternion.y>0);
 for(let i=0;i<120;i++)rudder.update(0,1/60);
 assert.ok(Math.abs(rudder.angle())<1e-7);
});
