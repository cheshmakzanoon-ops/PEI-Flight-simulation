import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {millShape,makeMillDetached,MILL_RELATIVE_PLAN,millStudioFloor} from './mill-exterior.ts';
const model=makeMillDetached();
const role=hit=>model.mesh.geometry.attributes.millRole.getX(hit.face.a);
const dx=new T.Vector3(-1,0,0),dy=new T.Vector3(0,-1,0);
const rays=(O,D)=>new T.Raycaster(new T.Vector3(...O),D).intersectObject(model.mesh,false);
test('one bounded exact packed frame shape, independently valid Float32 triangles',()=>{
 const p=model.geometry.attributes.position,b=model.geometry.attributes.normal,u=model.geometry.attributes.uv,m=model.geometry.attributes.millRole;
 assert.equal(p.count,3712*3);assert.equal(p.count,b.count);assert.equal(p.count,u.count);assert.equal(p.count,m.count);
 assert.equal(model.geometry.index,null);assert(model.material.depthWrite&&model.material.depthTest&&!model.material.transparent);
 const again=millShape();
 for(const k of ['position','normal','uv','millRole']){
  assert.deepEqual(again.geometry.attributes[k].array,model.geometry.attributes[k].array);
  assert(model.geometry.attributes[k].array.every(Number.isFinite));
 }
 const q=new T.Vector3(),r=q.clone(),s=q.clone(),t=q.clone(),N=q.clone();
 for(let i=0;i<p.count;i+=3){
  q.fromBufferAttribute(p,i);r.fromBufferAttribute(p,i+1);s.fromBufferAttribute(p,i+2);t.copy(r).sub(q).cross(s.sub(q));
  assert(t.lengthSq()>1e-12);
  N.fromBufferAttribute(b,i);assert(t.normalize().dot(N)>.9999);
  assert.equal(m.getX(i),m.getX(i+1));assert.equal(m.getX(i+1),m.getX(i+2));
 }
 again.geometry.dispose();
});
test('three fitted daughter roofs remove the closed parent sheet and touch their exact host at rising shoulders',()=>{
 const E=MILL_RELATIVE_PLAN.primaryEaveY,H=MILL_RELATIVE_PLAN.ridgeY,h=MILL_RELATIVE_PLAN.ridgeX;
 const S=(H-E)/(2.02+.239-h), Y=x=>H-(x-h)*S;
 const all=model.junctions;assert.equal(all.length,3);
 assert(all.every(a=>a.clearance>.95&&a.containsHostCavity));
 assert(all[1].w>1.45*all[0].w&&all[1].top>all[0].top+.50);
 assert(MILL_RELATIVE_PLAN.observedDormers[1].panes===2);
 for(const j of all){
  assert(Math.abs(Y(j.heel)-j.plate)<1e-10&&Math.abs(Y(j.peakLink)-j.top)<1e-10);
  const x=j.frontX-.29,y=Y(x);
  const roof=rays([x,13,j.z],dy)[0];
  assert.equal(role(roof),1);assert(Math.abs(roof.point.y-j.top)<1e-5);
  const noBuriedOldSheet=rays([x,y+.06,j.z],dy);
  assert(noBuriedOldSheet.every(f=>Math.abs(f.point.y-y)>.15));
 }
});
test('all three 4-light banks are apertures with truly opaque recessed glazing, not a colored wall',()=>{
 for(const z of model.riverSashBankCentres)for(let i=0;i<4;i++){
  const u=z+(i-1.5)*.995;
  const h=rays([10,2.782,u],dx)[0];
  assert.equal(role(h),4);
  assert(Math.abs(h.point.x-(6.49-.073))<1e-5);
 }
 for(const j of model.junctions){
  const offsets=j.w>2?[-.4325,.4325]:[0];
  for(const dz of offsets){
   const h=rays([8,j.base+.436,j.z+dz+.093],dx)[0];
   assert.equal(role(h),4,'dormer front pane should be physical aperture');
   assert(Math.abs(h.point.x-(j.frontX-.073))<1e-5);
  }
 }
});
test('true opaque workbench asset with local skin only and separately disposed floor',()=>{
 const fake=makeMillDetached();const floor=millStudioFloor();
 assert.equal(fake.mesh.parent,null);assert.equal(fake.mesh.children.length,0);
 assert.equal(floor.attributes.position.count,6);
 let a=0,b=0;fake.geometry.addEventListener('dispose',()=>a++);
 fake.material.addEventListener('dispose',()=>b++);
 fake.dispose();floor.dispose();
 assert.equal(a,1);assert.equal(b,1);
});
