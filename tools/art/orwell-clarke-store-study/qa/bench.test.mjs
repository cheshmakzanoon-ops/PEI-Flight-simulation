import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DoubleSide,Mesh,MeshBasicMaterial,Raycaster,Vector3} from 'three';
import {makeClarkeFront} from '../front.ts';
import {makeClarkeDisplayBench,makeClarkeFrontWithDisplayBench,CLARKE_DISPLAY_BENCH as B} from '../orwell-display-bench.ts';

const hash=q=>createHash('sha256').update(q).digest('hex'),file=p=>readFileSync(new URL('../'+p,import.meta.url));
const stamp=o=>o.children.map(d=>[d.name,...Object.entries(d.geometry.attributes).map(([k,a])=>[k,hash(Buffer.from(a.array.buffer))]),...Object.entries(d.material).filter(([k,v])=>k.endsWith('Map')||k==='map').map(([k,v])=>[k,v?hash(v.image.data):null]),d.material.type,d.material.roughness,d.material.metalness,d.material.opacity,d.material.transparent]);
const d=makeClarkeFrontWithDisplayBench(),[old,b]=d.children;
const [ends,boards]=b.children;
const rc=new Raycaster();
const hit=(q,p,a=[0,0,-1])=>{
 rc.set(new Vector3(...p),new Vector3(...a));
 return rc.intersectObject(q,true)[0];
};
d.updateMatrixWorld(true);
test('the old source, meshes, geometry roles, generated maps and all 42 panes are identical',()=>{
 assert.deepEqual(['front.ts','surfaces.ts','lettering.ts'].map(p=>hash(file(p))),[
 '7fd41cc3672522024302504f325b31819d72ef7390bb1f5cc3dfbddf4e418467',
 'f2a9a1300160f48f048c2b64169ec2993cd9b21f0ee0102765def9f0f85872e0',
 '47e2b5e4e9fadd71472f182a95118c04f0e27cd515a2879a753bd6e3d6d9cb89']);
 assert.deepEqual(stamp(old),stamp(makeClarkeFront()));
 assert.equal(old.userData.panes.length,42);
 for(const p of old.userData.panes){
  const a=[p.x,p.y,5],src=hit(old,a),now=hit(d,a);
  assert.equal(now.object,src.object);
  assert.equal(now.object.name,'glazing');
  assert.equal(now.distance,src.distance);
 }
});
test('bench is bounded under the display and clear of the existing entry, not installed',()=>{
 assert.equal(d.userData.placement,false);assert.equal(b.userData.placement,false);
 const deck=old.getObjectByName('deck'),rail=old.getObjectByName('portal-timber');
 deck.geometry.computeBoundingBox();rail.geometry.computeBoundingBox();
 const box=ends.geometry.boundingBox;
 assert.equal(box.min.y,Math.fround(B.studioBottomY));
 assert.ok(box.min.x-deck.geometry.boundingBox.max.x>.14);
 assert.ok(box.min.x-rail.geometry.boundingBox.max.x>.34);
 assert.ok(box.min.z>.219 && box.max.z<.778);
 assert.ok(box.max.y<.78);
 const horizontal=hit(d,[-1.216,1.17,5]);
 assert.equal(horizontal.object.name,'portal-timber');
 const g=makeClarkeDisplayBench();assert.deepEqual(stamp(g),stamp(b));
 const tris=g.children.reduce((s,m)=>s+m.geometry.attributes.position.count/3,0);
 assert.equal(tris,404);
 assert.ok(g.children.every(m=>!m.castShadow&&!m.material.map&&!m.material.transparent));
});
test('both dark cheek frames and all five boards are separately closed and outward',()=>{
 const vec=(x,i)=>new Vector3().fromBufferAttribute(x,i);
 for(const m of b.children) {
  const p=m.geometry.attributes.position;
  for(const s of m.userData.sections) {
   const edge=new Map();let signed=0;
   for(let k=s.firstVertex;k<s.firstVertex+s.count;k+=3){
    const a=[0,1,2].map(j=>vec(p,k+j)),keys=a.map(q=>q.toArray().join(','));
    const [x,y,z]=a;signed+=x.dot(y.clone().cross(z))/6;
    assert.ok(y.clone().sub(x).cross(z.clone().sub(x)).length()>1e-6);
    for(const j of [0,1,2]){
     const id=[keys[j],keys[(j+1)%3]].sort().join(' | ');
     edge.set(id,(edge.get(id)??0)+1);
    }
   }
   assert.ok(signed>.001,s.name);
   assert.ok([...edge.values()].every(n=>n===2),s.name);
  }
 }
 const p=ends.geometry.attributes.position;
 for(const s of ends.userData.sections) {
  const lows=new Set();
  for(let i=s.firstVertex;i<s.firstVertex+s.count;i++)
   if(p.getY(i)===Math.fround(B.studioBottomY))lows.add(p.getZ(i));
  assert.equal(lows.size,4);
 }
});
test('cross-axis rays prove board seats at both cheeks and photographed open-back spacing',()=>{
 const testMesh=m=>new Mesh(m.geometry,new MeshBasicMaterial({side:DoubleSide}));
 const cheek=testMesh(ends),slat=testMesh(boards);
 for(const [y,z] of [[.385,.376],[.395,.513],[.402,.655],[.511,.329],[.669,.309]]){
  rc.set(new Vector3(-.1,y,z),new Vector3(1,0,0));
  const C=rc.intersectObject(cheek).map(p=>p.point.x).sort((a,b)=>a-b);
  const S=rc.intersectObject(slat).map(p=>p.point.x).sort((a,b)=>a-b);
  assert.ok(C.length>=4,[y,z,C]);assert.ok(S.length>=2,[y,z,S]);
  const l=S[0],r=S.at(-1),small=0.006;
  assert.ok(l-C[0]>small&&C[1]-l>small,[y,z,C,S]);
  assert.ok(r-C.at(-2)>small&&C.at(-1)-r>small,[y,z,C,S]);
 }
 assert.equal(hit(b,[1.08,.597,3]),undefined);
 assert.equal(hit(b,[1.08,.668,3]).object,boards);
 assert.equal(hit(b,[1.08,.512,3]).object,boards);
});
