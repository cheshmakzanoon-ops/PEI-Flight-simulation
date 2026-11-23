import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {BASIN_FOOTBRIDGE as d} from '../src/render/basin-footbridge.generated.ts';
import {basinCrossingWorld,bridgeDeckY,bridgeTrack,createBasinFootbridge} from '../src/render/basin-footbridge.ts';

test('Basin Head crossing retains the surveyed arched deck and its native-side offset',()=>{
 const lo=d.spanS[0],hi=d.spanS[1],c=11.75;
 const p=basinCrossingWorld(lo,0),q=basinCrossingWorld(hi,0),a=basinCrossingWorld(c,0);
 assert(Math.hypot(q.x-p.x,q.z-p.z)>10.2&&Math.hypot(q.x-p.x,q.z-p.z)<10.5);
 assert(a.y>2.32&&a.y<2.39&&a.y-p.y>.30&&a.y-q.y>.30);
 assert.equal(bridgeDeckY(c,bridgeTrack(c)),a.y);
 const lateral=basinCrossingWorld(c,1);
 assert(lateral.x<a.x&&lateral.z<a.z,'native left is north-west in the simulator frame');
 assert(Math.abs(Math.hypot(a.x-lateral.x,a.z-lateral.z)-1)<.015);
});
test('the optional crossing is rejected over wet or incompatible ground; installed geometry is finite',()=>{
 assert.equal(createBasinFootbridge(()=>1.52,()=>false),undefined);
 assert.equal(createBasinFootbridge(()=>-3,()=>true),undefined);
 assert.equal(createBasinFootbridge(()=>5,()=>true),undefined);
 assert.equal(createBasinFootbridge(()=>NaN,()=>true),undefined);
 const g=createBasinFootbridge(()=>1.52,()=>true);assert(g);
 g.updateMatrixWorld(true);
 assert.equal(g.children.length,4);
 for(const child of g.children){
  assert(child instanceof THREE.Mesh);
  const g=child.geometry,pos=g.getAttribute('position');
  assert(g.index&&g.index.count>0);
  assert(Array.from(pos.array).every(Number.isFinite));
 }
 const p=basinCrossingWorld(11.7,0);
 const rays=new THREE.Raycaster(new THREE.Vector3(p.x,6,p.z),new THREE.Vector3(0,-1,0));
 const hit=rays.intersectObject(g,true)[0];assert(hit);
 assert(Math.abs(hit.point.y-p.y)<.15);
});
