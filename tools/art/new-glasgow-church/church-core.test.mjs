import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {churchCoreGeometry,churchStudioGround,makeChurchDetached,CHURCH_CORE_PLAN as P} from './church-core.ts';

const word=attr=>Buffer.from(attr.array.buffer,attr.array.byteOffset,attr.array.byteLength);
const digest=attr=>createHash('sha256').update(word(attr)).digest('hex');

test('one deterministic opaque owned mesh, no textures or scene dependencies',()=>{
 const A=makeChurchDetached(), B=makeChurchDetached(), floor=churchStudioGround();
 try{
   assert.equal(T.REVISION,'187');
   assert.equal(A.mesh.geometry,A.geometry);assert.equal(A.mesh.material,A.material);
   assert.equal(A.mesh.parent,null);assert.equal(A.mesh.children.length,0);
   assert.equal(A.geometry.groups.length,0);assert.equal(A.geometry.index,null);
   assert.equal(A.material.transparent,false);
   assert.equal(A.material.side,T.FrontSide);assert(A.material.depthWrite&&A.material.depthTest);
   assert.deepEqual(Object.keys(A.material.uniforms),['churchSun']);
   const keys=['position','normal','uv','churchRole'];
   assert.deepEqual(Object.keys(A.geometry.attributes),keys);
   for(const k of keys)assert.equal(digest(A.geometry.attributes[k]),digest(B.geometry.attributes[k]));
   assert.equal(floor.attributes.position.count,6);
   let disposed=0;A.material.addEventListener('dispose',()=>disposed++);
   A.geometry.addEventListener('dispose',()=>disposed++);
   A.dispose();assert.equal(disposed,2);
 }finally{B.dispose();floor.dispose();}
});

test('every packed triangle has finite position, correct orientation, and one exact material role',()=>{
 const {geometry:g,sections}=churchCoreGeometry(),{position:p,normal:n,uv,churchRole:m}=g.attributes;
 try{
   assert.equal(p.count,6376*3);
   assert.equal(Object.values(sections).reduce((s,x)=>s+x,0),6376);
   assert.equal(p.count,n.count);assert.equal(p.count,uv.count);assert.equal(p.count,m.count);
   for(const a of [p,n,uv,m])assert(a.array.every(Number.isFinite));
   for(let i=0;i<p.count;i+=3){
      const a=new T.Vector3().fromBufferAttribute(p,i);
      const b=new T.Vector3().fromBufferAttribute(p,i+1).sub(a);
      const c=new T.Vector3().fromBufferAttribute(p,i+2).sub(a);
      const d=b.cross(c),normal=new T.Vector3().fromBufferAttribute(n,i);
      assert(d.length()>1e-6);
      assert(d.normalize().dot(normal)>.99998);
      assert.equal(m.getX(i),m.getX(i+1));assert.equal(m.getX(i),m.getX(i+2));assert(m.getX(i)>=0&&m.getX(i)<8);
   }
   assert.equal(g.boundingBox.min.y,0);
   assert.equal(g.boundingBox.max.y,Math.fround(P.finialTop));
 }finally{g.dispose();}
});

test('roof sheets and opposed forged leaf shells are closed, including reflected outward winding',()=>{
 const b=churchCoreGeometry(),p=b.geometry.getAttribute('position');
 function check(label,roles){
   const edges=new Map();
   const w=i=>[p.getX(i),p.getY(i),p.getZ(i)].join(',');
   for(const t of roles)for(const [lo,hi] of b.runs[t])for(let i=lo;i<hi;i+=3)
      for(const [a,d] of [[i,i+1],[i+1,i+2],[i+2,i]]){
         const [x,y]=[w(a),w(d)];assert.notEqual(x,y);
         const key=x<y?x+'|'+y:y+'|'+x,sign=x<y?1:-1;
         const v=edges.get(key)||[0,0]; v[0]++;v[1]+=sign;edges.set(key,v);
      }
   let bad=0;for(const v of edges.values())if(v[0]!==2||v[1]!==0)bad++;
   assert.equal(bad,0,label); assert(edges.size>15);
 }
 try{
   check('closed roof', ['steep roof','roof underside','trimmed rake/eave']);
   check('closed thistle leaves', ['forged leaf silhouettes','closed thistle leaf edges']);
   check('closed thistle crown', ['thistle flower','thistle flower tip','thistle socket closure']);
 }finally{b.geometry.dispose();}
});

test('actual window rays hit recessed backing and real door, not painted flat rectangles',()=>{
 const b=makeChurchDetached(),g=b.geometry.getAttribute('churchRole');
 const front=(x,y)=>new T.Raycaster(new T.Vector3(x,y,-16),new T.Vector3(0,0,1)).intersectObject(b.mesh)[0];
 const fromSide=(y,z)=>new T.Raycaster(new T.Vector3(9,y,z),new T.Vector3(-1,0,0)).intersectObject(b.mesh)[0];
 const role=h=>g.getX(h.face.a);
 const near=(v,x)=>assert(Math.abs(v-x)<1e-5,`${v} versus ${x}`);
 try{
   const nave=front(2.375,1.1), siding=front(1.11,1.4),oculus=front(2.375,4.8625),portal=front(-1.75,.82);
   assert.equal(role(nave),5);near(nave.point.z,-12.85+.093);
   assert.equal(role(siding),0);near(siding.point.z,-12.85);
   assert.equal(role(oculus),4);near(oculus.point.z,-12.85+.093);
   assert.equal(role(portal),0);near(portal.point.z,-13.2+.085);
   for(const z of [-11.394,-9.24,-7.06,-4.875]){
     const q=fromSide(1.41,z);assert.equal(role(q),5);near(q.point.x,5.75-.093);
   }
 }finally{b.dispose();}
});

test('closed finial tube starts physically inside the cap plane and the square ring matches the shaft perimeter',()=>{
 const b=churchCoreGeometry(),p=b.geometry.getAttribute('position');
 const ys=t=>b.runs[t].flatMap(([l,r])=>Array.from({length:r-l},(_,i)=>p.getY(l+i)));
 const ul=b.runs['torus and swept shoulder'];
 try{
   assert.equal(P.spireStemSocket,11.23);
   assert(Math.min(...ys('forged stem'))<P.spireStemSocket);
   assert(Math.max(...ys('forged stem'))>Math.min(...ys('thistle socket closure')));
   const lateral=[];
   for(const [l,r] of ul)for(let i=l;i<r;i++)if(p.getY(i)===Math.fround(P.tower.shaft))
      lateral.push([p.getX(i),p.getZ(i)]);
   assert.equal(new Set(lateral.map(p=>p.join(','))).size,8);
   for(const [x,z] of lateral)assert(
      [P.tower.x0,P.tower.x1].map(Math.fround).includes(x)||
      [P.tower.z0,P.tower.z1].map(Math.fround).includes(z));
 }finally{b.geometry.dispose();}
});
