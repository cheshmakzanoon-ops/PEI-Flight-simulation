import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Raycaster, Vector3 } from 'three';
import { buildFoundersRailShop } from './founders-rail-shop-study.ts';
import { FOUNDERS_PLAN } from './founders-exterior-plan.generated.ts';

const fixture=JSON.parse(readFileSync(new URL('./proof.json', import.meta.url), 'utf8'));
const hash=x=>createHash('sha256').update(x).digest('hex');
const bytes=b=>Buffer.from(b.buffer,b.byteOffset,b.byteLength);

test('unplaced Founders exterior has exact original role streams and closed opaque portions',()=>{
 const scene=buildFoundersRailShop();
 assert.equal(scene.group.parent,null);
 assert.equal(scene.batches,fixture.scene.draws);
 assert.equal(scene.triangles,fixture.scene.triangles);
 assert.equal(hash(readFileSync(new URL('./founders-rail-shop-study.ts', import.meta.url))),fixture.scene.sealedSourceSha);
 assert.equal(hash(readFileSync(new URL('./founders-exterior-plan.generated.ts', import.meta.url))),fixture.scene.planSha);
 assert.deepEqual(Object.keys(fixture.roles).sort(), scene.group.children.map(n=>n.name).sort());
 const groups=new Map();
 for(const node of scene.group.children){
  const g=node.geometry,h=fixture.roles[node.name],p=g.attributes.position;
  for(const k of ['position','normal','uv']){
   const a=g.attributes[k].array;assert(a instanceof Float32Array&&a.every(Number.isFinite));assert.equal(hash(bytes(a)),h[k]);
  }
  assert.equal(p.count/3,h.tris);
  for(let j=0;j<h.tris;j++){
   const id=g.userData.component[j];if(id===255)continue;
   const b=groups.get(id)??new Map();groups.set(id,b);
   const xyz=[0,1,2].map(k=>new Vector3().fromBufferAttribute(p,j*3+k).toArray().join(','));
   for(let k=0;k<3;k++){
    const u=xyz[k],v=xyz[(k+1)%3];assert.notEqual(u,v);const key=u<v?u+'|'+v:v+'|'+u;
    const cnt=b.get(key)??[0,0];cnt[0]++;cnt[1]+=u<v?1:-1;b.set(key,cnt);
   }
  }
 }
 assert.equal(groups.size,fixture.scene.closedOwnerParts);
 for(const map of groups.values())for(const n of map.values())assert.deepEqual(n,[2,0]);
});

test('same fixed edge7 rays prove lower opaque-backed panes, raised entrance case, and real setback',()=>{
 const subject=buildFoundersRailShop().group;subject.updateMatrixWorld(true);
 const a=FOUNDERS_PLAN.outline[8],b=FOUNDERS_PLAN.outline[7],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
 const n=new Vector3(dz/len,0,-dx/len),ray=new Raycaster();
 for(const f of fixture.stubProof.shapeCardinals){
  const u=.055+.89*f.v,front=new Vector3(a[0]+dx*u,f.y,a[1]+dz*u),toward=n.clone().negate();
  ray.set(front.clone().addScaledVector(n,27),toward);const first=ray.intersectObject(subject,true).at(0);
  assert.equal(first?.object.name,f.role);
  assert(Math.abs(first.point.clone().sub(front).dot(toward)-f.dep)<1e-7);
 }
});
