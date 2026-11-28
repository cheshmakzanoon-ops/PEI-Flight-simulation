import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {makeStalkBuffer,pack,STALK_ART} from './corn-stalk.ts';
import {makeCornStudy} from './corn-study.ts';
const sha=a=>createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const parts=g=>Object.fromEntries(Object.entries(g.attributes).map(([k,v])=>[k,sha(v.array)]));
test('Weathered hero has 11 alternate, curved attached blades and kept opaque whole plant roles',()=>{
 for(const s of STALK_ART.seeds){
  const h=makeStalkBuffer(s,'hero','weathered');
  assert.equal(h.leafInfo.length,11);assert(h.tasselTop[1]>h.stemEnd[1]+.2);
  let prior;
  for(const l of h.leafInfo){
   assert(l.crestY-l.root[1]>.08&&l.crestY-l.tip[1]>.05);
   if(prior!==undefined)assert(Math.cos(prior-l.heading)<-.58);
   assert(l.tip[1]>=.05999);
   const found=h.g.role.findIndex((r,i)=>r===0&&l.root.every((x,k)=>h.g.p[i*3+k]===x));
   assert(found>=0,'blade exact stem point absent');
   prior=l.heading;
  }
  assert([0,1,2,3].every(r=>h.g.role.includes(r)));
 }
});
test('Native Float32 triangles for hero variants are finite, have no repeated ids or role leaks',()=>{
 for(const s of STALK_ART.seeds){
  const h=makeStalkBuffer(s,'hero','weathered'),g=pack(h.g),p=g.attributes.position.array,rr=g.attributes.cornRole.array;
  const e=g.index.array;
  assert(g.index.array instanceof Uint16Array&&g.attributes.pigment.normalized);assert(e.length/3<2000);
  assert(p.every(Number.isFinite)&&g.attributes.normal.array.every(Number.isFinite));
  let min=Infinity;
  for(let j=0;j<e.length;j+=3){
    const q=[e[j],e[j+1],e[j+2]];assert(q[0]!==q[1]&&q[0]!==q[2]&&q[1]!==q[2]);
    assert(rr[q[0]]===rr[q[1]]&&rr[q[1]]===rr[q[2]]);
    const [a,b,c]=q.map(i=>new T.Vector3().fromArray(p,i*3));
    min=Math.min(min,b.sub(a).cross(c.sub(a)).length());
  }
  assert(min>1e-8,min);g.dispose();
 }
});
test('One unmounted opaque resource set per detached study; no texture, network, gameplay or repeated disposal',()=>{
 for(const id of ['near','near-single']){
  const a=makeCornStudy(id);
  assert.equal(a.mesh.parent,null);assert.equal(a.mesh.children.length,0);
  assert.equal(a.geometry.groups.length,0);assert.equal(a.material.side,T.DoubleSide);
  assert(!a.material.transparent&&a.material.depthWrite&&a.material.depthTest);
  assert(Object.values(a.material.uniforms).every(v=>!v.value?.isTexture));
  const n=[0,0];
  for(const [j,x] of [a.geometry,a.material].entries())x.addEventListener('dispose',()=>n[j]++);
  a.dispose();a.dispose();assert.deepEqual(n,[1,1]);
 }
 assert.throws(()=>makeCornStudy('bad mode'),/Unknown/);
});
