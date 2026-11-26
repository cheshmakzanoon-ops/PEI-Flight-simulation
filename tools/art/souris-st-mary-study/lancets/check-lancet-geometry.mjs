import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {makeDetachedMaryGeometry as old,makeDetachedSaintMary as previous} from '../souris-saint-mary-forms.ts';
import {makeDetachedMaryGeometryV3B,makeDetachedSaintMaryV3B} from './souris-st-mary-collar-v3b.ts';
const hash=b=>createHash('sha256').update(b).digest('hex'),shaF=(p)=>hash(readFileSync(new URL(p,import.meta.url)));
const A=old(),B=makeDetachedMaryGeometryV3B(), stream=(g,k)=>g.getAttribute(k).array;
const sealed=JSON.parse(readFileSync(new URL('../st-marys-detached-exact-buffers.json',import.meta.url)));
const keys=['position','normal','uv'];
const arcs=[[-4.37,7.47,15.11,1.02],[-.13,7.1,17.12,1.32],[4.11,7.52,15.11,.99]].map(([x,y,Y,w])=>[x-w-.411,x+w+.411,y-.411,Y+.351]);
export const independentTargets=arcs;
const z0=25.6, equal=(a,b)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).equals(Buffer.from(b.buffer,b.byteOffset,b.byteLength));
const fullRaw=(g,k)=>{const q=stream(g,k);return Buffer.from(q.buffer,q.byteOffset,q.byteLength);};
function triPoints(g,n){return [0,1,2].map(v=>[0,1,2].map(j=>g.attributes.position.array[(n*3+v)*3+j]));}
function membership(Q){
 return arcs.findIndex(([x,X,y,Y])=>Q.every(([u,v,w])=>u>=x&&u<=X&&v>=y&&v<=Y&&w>=25.302&&w<=25.727));
}
export function selectNativeCasingRanges(g){
 const list=[];for(let k=0;k<g.attributes.position.count/3;k++)if(membership(triPoints(g,k))>=0){
  const m=list.at(-1);if(m&&m[1]===3*k)m[1]+=3;else list.push([k*3,k*3+3]);
 }
 return list;
}
const negate=(g,role)=>{
 const v=[];
 for(let t=0;t<g.attributes.position.count/3;t++){
  const p=triPoints(g,t);
  if(role==='stone'&&p.every(a=>Math.abs(a[2]-z0)<2e-6))continue;
  if(role==='freestone'&&membership(p)>=0)continue;
  for(const k of keys){const n=g.attributes[k].itemSize*3;v.push(fullRaw(g,k).subarray(t*n*4,(t+1)*n*4));}
 }
 return Buffer.concat(v);
};
const depth={old:{},v3:{},unrelatedKeys:{}};
let n=0;
let exactNN=1;
for(const r of A.keys()){
 const a=A.get(r),b=B.get(r);n+=b.attributes.position.count/3;
 const allAttr=wh=>Object.fromEntries(keys.map(k=>[k,hash(fullRaw(wh,k))]));
 const aSh=allAttr(a),bSh=allAttr(b);assert.deepEqual(aSh,sealed.stats[r].byteSha);
 depth.old[r]=aSh;depth.v3[r]=bSh;
 if(r!=='freestone')assert.deepEqual(aSh,bSh);
 if(r==='freestone')for(const k of keys)assert(fullRaw(b,k).subarray(0,fullRaw(a,k).length).equals(fullRaw(a,k)));
 assert(negate(a,r).equals(negate(b,r)),`${r}: adjacent primitives changed`);
 depth.unrelatedKeys[r]=hash(negate(a,r));
 for(let t=0;t<b.attributes.position.count/3;t++){
  const p=triPoints(b,t).map(P=>new T.Vector3(...P)), v=p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0]));
  assert(v.lengthSq()>1e-12);v.normalize();
  for(let k=0;k<3;k++){
   const N=new T.Vector3().fromBufferAttribute(b.attributes.normal,t*3+k);
   assert(Math.abs(N.length()-1)<2.e-7);const d=N.dot(v);exactNN=Math.min(exactNN,d);
   assert(d>.99994);
  }
 }
}
assert.equal(n,4886);
const ranges=B.get('freestone').userData.lancetRanges;
assert.equal(ranges.length,3);
let declared=0;for(let a=0;a<3;a++){
 const [l,h]=ranges[a]; assert(l%3===0&&h%3===0);
 for(let t=l/3;t<h/3;t++){assert.equal(membership(triPoints(B.get('freestone'),t)),a);declared++;}
}
const coat=()=>new T.MeshBasicMaterial({color:0xe6e3d8});
const p=previous(coat),q=makeDetachedSaintMaryV3B(coat);p.updateMatrixWorld(true);q.updateMatrixWorld(true);
const bounds=o=>{const w=new T.Box3().setFromObject(o);return [w.min.toArray(),w.max.toArray()];};
assert.deepEqual(bounds(p),bounds(q));
const rc=new T.Raycaster();const at=(g,x,y)=>{
 rc.set(new T.Vector3(x,y,35),new T.Vector3(0,0,-1));
 return rc.intersectObjects(g.children,false)[0];
};
let oldGlass=0,newGlass=0,scopeDiff=0,unchanged=0;
for(let x=-6.1;x<5.8;x+=.107)for(let y=6.4;y<17.6;y+=.093){
 const a=at(p,x,y),b=at(q,x,y);
 const z=a.point.z,v=b.point.z,ar=a.object.name.split('.').at(-1),br=b.object.name.split('.').at(-1);
 if(ar==='glass')oldGlass++;if(br==='glass')newGlass++;
 if(ar==='glass'||br==='glass'){assert.equal(ar,br);assert.equal(z,v);}
 if(ar===br&&Math.abs(z-v)<2e-6) unchanged++;
 else {assert(membership([[x,y,25.6]])>=0);scopeDiff++;}
}
assert(oldGlass===newGlass&&scopeDiff>200&&unchanged>1000);
let exactCollarJointVertices;
{
 const oldP=stream(A.get('freestone'),'position'),newP=stream(B.get('freestone'),'position');
 const p=(q,i)=>q.slice(i,i+3).join(',');
 const previous=new Set(Array.from({length:oldP.length/3},(_,i)=>p(oldP,3*i)));
 const join=new Set(Array.from({length:(newP.length-oldP.length)/3},(_,i)=>p(newP,oldP.length+3*i)).filter(v=>previous.has(v)));
 assert.equal(join.size,39);exactCollarJointVertices=join.size;
}
const receipt={scope:'Three r187 same matrix positions for exact frozen V2, forward-facing three existing dressing sections only. Sealed author witness, no source datum or landscape replacement.',lock:shaF('V3B-COLLAR-LOCK.md'),sourceNew:shaF('souris-st-mary-collar-v3b.ts'),sourceOld:shaF('../souris-saint-mary-forms.ts'), materials:shaF('../souris-st-mary-finish-v2.ts'),n,batches:q.children.length,bounds:bounds(q),minExactNormalDot:exactNN,changedCasingTriangles:declared,exactCollarJointVertices,unchanged,localizedDifferent:scopeDiff,exactSameGlassRays:oldGlass,ranges,
 verifiedCasingMasks:{old:selectNativeCasingRanges(A.get('freestone')),v3:selectNativeCasingRanges(B.get('freestone'))},streams:depth};
if(process.argv[1]?.endsWith('check-lancet-geometry.mjs'))console.log(JSON.stringify(receipt,null,2));
