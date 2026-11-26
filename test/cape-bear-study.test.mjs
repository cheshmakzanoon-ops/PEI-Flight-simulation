import * as T from 'three';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync as file} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {makeCapeBearLanternV2,CAPE_BEAR_LANTERN_V2 as cfg} from '../tools/art/cape-bear-study/cape-bear-lantern-v2.ts';
const h=x=>createHash('sha256').update(x).digest('hex');
const read=(path)=>file(new URL('../tools/art/cape-bear-study/'+path,import.meta.url));
const source=h(read('cape-bear-lantern-v2.ts')),v1=h(read('cape-bear-exterior.ts'));
assert.equal(v1,'abff016bf31977429569e73cdecfd0215d518022e416c25af1d7a0712f34f0c2');
const model=makeCapeBearLanternV2(1),a=model.originalGeometry,b=model.correctedGeometry;
assert.equal(model.mesh.geometry,b);assert.notEqual(a,b);
assert.deepEqual(a.groups,b.groups);
assert.deepEqual(a.boundingBox.min.toArray(),b.boundingBox.min.toArray()); assert.deepEqual(a.boundingBox.max.toArray(),b.boundingBox.max.toArray());
assert.deepEqual(a.boundingSphere.center.toArray(),b.boundingSphere.center.toArray()); assert.equal(a.boundingSphere.radius,b.boundingSphere.radius);
const names=['position','normal','uv'];
const raw=(g,k)=>Buffer.from(g.attributes[k].array.buffer);
const left=new Set(model.oldTarget),right=new Set(model.newTarget);
assert.equal(left.size,36);assert.equal(right.size,36);
const unchanged=[];
for(const name of names){
 const u=raw(a,name),v=raw(b,name),width=a.attributes[name].itemSize*12,keep=(set,x,g)=>{
  const p=[];
  for(let i=g.start;i<g.start+g.count;i+=3)if(!set.has(i))p.push(x.subarray(i/3*width,(i/3+1)*width));
  return Buffer.concat(p);
 };
 for(const g of a.groups)assert.ok(keep(left,u,g).equals(keep(right,v,g)),'Outside payload changed '+name+' '+g.materialIndex);
 const A=Buffer.concat(a.groups.map(g=>keep(left,u,g))),B=Buffer.concat(b.groups.map(g=>keep(right,v,g)));
 assert.ok(A.equals(B));assert.equal(A.length,(2824-36)*width);
 unchanged.push({name,wholeBefore:h(u),wholeAfter:h(v),protectedHashes:[h(A),h(B)],bits:A.length*8});
}
const originalMaterial=model.mesh.material;model.apply(false);
assert.equal(model.mesh.geometry,a);assert.equal(model.mesh.material,originalMaterial);
const matrix=model.mesh.matrix.toArray();
assert.deepEqual(matrix,new T.Matrix4().toArray());assert.equal(model.mesh.castShadow,false);
const rays=new T.Raycaster(),v=(x,y,z)=>new T.Vector3(x,y,z),sections=[];
model.mesh.updateMatrixWorld(true);
for(const [branch,expected]of [['V1',cfg.v1Clear],['V2',cfg.clear]]){
 model.apply(branch==='V2');assert.equal(model.mesh.material,originalMaterial);
 const labels=[];
 for(let i=0;i<8;i++){
  const a=2*Math.PI/8*(i+.5),b=2*Math.PI/8*(i+1.5);
  const cen=v(.545*(Math.sin(a)+Math.sin(b)),10.8,.545*(Math.cos(a)+Math.cos(b)));
  const n=v(cen.x,0,cen.z).normalize(),ray=(y,d=.1)=>{
   const pt=cen.clone().setY(y).addScaledVector(v(-n.z,0,n.x),d);
   rays.set(pt.addScaledVector(n,4),n.clone().negate());
   return rays.intersectObject(model.mesh)[0];
  };
  const item=ray(10.8),glass=expected.includes(i);
  assert.ok(item);assert.equal(item.face.materialIndex,glass?7:3);
  assert.ok(Math.abs(item.distance-4-(glass?.042:0))<6e-7);
  const high=ray(11.379),low=ray(9.826,.039);
  labels.push({i,glass,range:item.distance,upperBand:[high?.face.materialIndex,high?.distance],
   lowerBand:[low?.face.materialIndex,low?.distance]});
 }
 sections.push(labels);
}
assert.deepEqual(sections[0].map(i=>[i.upperBand,i.lowerBand]),sections[1].map(i=>[i.upperBand,i.lowerBand]));
const key=p=>p.toArray().map(q=>Math.round(q*1e7)).join(':');
const manifold=[];
for(const [name,nums]of model.closedComponentPositions){
 if(!name.startsWith('sealed-'))continue;
 let vol=0,min=Infinity;const E=new Map;
 for(let i=0;i<nums.length;i+=9){
  const [a,b,c]=[0,3,6].map(o=>new T.Vector3().fromArray(nums,i+o));
  vol+=a.dot(b.clone().cross(c))/6;
  min=Math.min(min,b.clone().sub(a).cross(c.clone().sub(a)).length()/2);
  const v=[a,b,c].map(key);
  for(let j=0;j<3;j++){
   const [s,t]=[v[j],v[(j+1)%3]],z=s<t?[s,t,1]:[t,s,-1];
   const k=z[0]+';'+z[1],old=E.get(k)??[0,0];
   old[0]++;old[1]+=z[2];E.set(k,old);
  }
 }
 assert.ok(min>0&&vol>0&&[...E.values()].every(([a,b])=>a===2&&b===0),name);
 manifold.push({name,num:nums.length/9,volume:vol,min,edges:E.size});
}
assert.equal(manifold.length,6);
assert.equal(manifold.find(x=>x.name==='sealed-octagonal-backed-iron-panels-and-glazing').num,232);
model.apply(false);assert.equal(model.mesh.geometry,a);assert.equal(model.mesh.material,originalMaterial);
model.dispose();
assert.equal(source,'1a65dc14740211d289c912fe5ffcf05a0c44f90cafc38bd2c1e9d0e56e7ef4a3');
assert.equal(a.groups.reduce((n,g)=>n+g.count/3,0),2824);
const wire=read('cape-aligned-solver-r2.gz'),ground=gunzipSync(wire);
assert.equal(wire.length,1951);
assert.equal(ground.length,12675);
assert.equal(h(ground),'0e8204fc1d4708a5e647702bd43dbdceafeea287a11dab576d43002370a70c1b');
const compact=read('cape-contact-master-weights.bin'),expanded=Buffer.alloc(193**2);
assert.equal(compact.length,723);
assert.equal(h(compact),'c1b4cfadcb2c88c364c3726562c2627f0e903794a4b9747aba2a040b1c72a086');
let before=-1;
for(let i=0;i<compact.length;i+=3){
 const index=compact.readUInt16LE(i),w=compact[i+2];
 assert.ok(index>before&&index<expanded.length&&w>0);
 expanded[index]=w;before=index;
}
assert.equal(h(expanded),'e76f463bec111eb0e6ba06f7e41bdf265f77e910907854f2db15094400b9c804');
