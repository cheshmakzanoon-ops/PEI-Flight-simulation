import assert from 'node:assert/strict';
import test from 'node:test';
import {GroundIndex,auditEdges} from './coast-edge-audit.mjs';
function fixture(leftStart, rightHeight) {
  const mesh=new GroundIndex({x0:0,x1:10,z0:0,z1:10},1);
  // Deliberately create a T junction, fine against coarse, on a steep continuous plane.
  function quad(x0,x1,z0,z1,offset=0){
    const v=(x,z)=>({x,z,y:3*x-2*z+offset}),a=v(x0,z0),b=v(x1,z0),c=v(x0,z1),d=v(x1,z1);
    mesh.add(a,c,b);mesh.add(c,d,b);
  }
  quad(0,5,0,5);quad(0,5,5,10);quad(leftStart,10,0,10,rightHeight);
  return auditEdges(mesh);
}
test('a continuous, steep T junction is not mistaken for a geometric crack',()=>{
  const r=fixture(5,0);assert.ok(r.profiles>10);assert.equal(r.gaps,0);assert.equal(r.overlaps,0);assert.ok(r.maxEdgeJumpM<1e-7);
});
test('real discontinuity, missing ground, and double-covered triangles each trigger a distinct metric',()=>{
  assert.equal(fixture(5,.14).maxEdgeJumpM,.14);
  assert.ok(fixture(5.02,0).gaps>0);assert.ok(fixture(4.98,0).overlaps>0);
});
