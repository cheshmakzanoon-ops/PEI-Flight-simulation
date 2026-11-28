import {test} from 'node:test';
import A from 'node:assert/strict';
import * as T from 'three';
import {createHash} from 'node:crypto';
import {createBasinCannery} from '../../../../src/render/basin-cannery.ts';
import {FRONT_FINISH,prepareCanneryWaterfrontFinish,patchCanneryWood} from '../basin-waterfront-finish.ts';
const modes=Object.keys(FRONT_FINISH);
const source=()=>createBasinCannery();
const find=(g,k)=>g.getObjectByName('Cannery '+k);
const shader=()=>({vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}});
const sha=a=>createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
function geometry(g){return g.children.map(m=>[m,m.geometry,m.material,...Object.values(m.geometry.attributes).map(x=>[x,x.version,sha(x.array)])]);}
const dispose=g=>g.children.forEach(m=>{m.geometry.dispose();m.material.dispose();});

test('same complete exact owner, retained asset geometry/placement/mesh/material references',async()=>{
 const g=source();try{
  const models=geometry(g),at=g.position.toArray(), stock=g.children.map(m=>[m.material.onBeforeCompile,m.material.customProgramCacheKey]);
  const lease=await prepareCanneryWaterfrontFinish(g);A(lease);
  A.equal(await prepareCanneryWaterfrontFinish(g),undefined);
  const uniforms=[];
  for(const role of modes){
   const m=find(g,role).material, q=shader();
   m.onBeforeCompile(q,undefined);A(q.vertexShader.includes('canneryWoodRole'));
   uniforms.push(q.uniforms.canneryWoodGain);
  }
  A.equal(new Set(uniforms).size,1);
  A.equal(uniforms[0].value,0);A(lease.set(true));A.equal(uniforms[0].value,1);
  A(lease.set(false));A.equal(uniforms[0].value,0);
  lease.release();lease.release();A.equal(lease.set(false),false);
  A.deepEqual(g.position.toArray(),at);A.deepEqual(geometry(g),models);
  A.deepEqual(g.children.map(m=>[m.material.onBeforeCompile,m.material.customProgramCacheKey]),stock);
  A.equal(g.children.reduce((x,m)=>x+m.geometry.attributes.position.count/3,0),1460);
 }finally{dispose(g);}
});
test('exact two wall, ten door and two apron triangles only, supported physical spans',()=>{
 const g=source();try{
  const areas=[];
  for(const role of modes){
   const s=FRONT_FINISH[role], attr=find(g,role).geometry.attributes;
   for(const k of ['position','normal','uv'])A.equal(sha(attr[k].array),s[k]);
   const [l,r]=s.span;let area=0;A.equal(l%3,0);A.equal(r%3,0);
   for(let i=l;i<r;i+=3){
    const a=new T.Vector3().fromBufferAttribute(attr.position,i);
    const b=new T.Vector3().fromBufferAttribute(attr.position,i+1);
    const c=new T.Vector3().fromBufferAttribute(attr.position,i+2);
    const n=b.clone().sub(a).cross(c.clone().sub(a));area+=n.length()*.5;n.normalize();
    role==='gallery'?A(Math.abs(n.y)>.99999):A(Math.abs(n.y)<.00001);
   }
   areas.push(area);
  }
  A.deepEqual(areas.map(a=>Number(a.toFixed(5))),[59.90599,11.23349,54.94670]);
  const q=find(g,'door').geometry.attributes.position;
  for(let n=0;n<5;n++)A(Math.abs(q.getY(n*6+2)-q.getY(n*6)-2.15)<2e-6);
 }finally{dispose(g);}
});
test('one corrupted source word refuses before mutating any material or peer',async()=>{
 const g=source();try{
  const a=find(g,'gallery').geometry.attributes.uv.array;
  new Uint32Array(a.buffer,a.byteOffset,1)[0]^=1;
  const before=g.children.map(o=>o.material.onBeforeCompile);
  A.equal(await prepareCanneryWaterfrontFinish(g),undefined);
  A.deepEqual(g.children.map(o=>o.material.onBeforeCompile),before);
 }finally{dispose(g);}
});
test('source owner disappearance and a later foreign hook fail closed without overwriting it',async()=>{
 const g=source();try{
  const a=find(g,'cladding').material,l=await prepareCanneryWaterfrontFinish(g);A(l);A(l.set(true));
  const m=shader();a.onBeforeCompile(m,undefined);
  const c=()=>{},k=()=> 'foreign';
  a.onBeforeCompile=c;a.customProgramCacheKey=k;
  A.equal(l.set(true),false);A.equal(m.uniforms.canneryWoodGain.value,0);
  l.release();A.equal(a.onBeforeCompile,c);A.equal(a.customProgramCacheKey,k);
  const s=shader();s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>','');
  const before={...s};A(!patchCanneryWood(s,'gallery',{value:1}));A.deepEqual(s,before);
 }finally{dispose(g);}
});
