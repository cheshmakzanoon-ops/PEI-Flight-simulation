import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Ray,Vector3} from 'three';
import {makeTignishGradeStudy,TIGNISH_GRADE_FRAME as F} from '../tools/art/tignish-grade-study/ground.ts';

const dir=new URL('../data/tignish-grade-study/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('source.json',dir),'utf8'));
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const read=(spec:{file:string;storedSHA256:string;decodedSHA256:string;bytes:number})=>{
 const b=readFileSync(new URL(spec.file,dir)),r=gunzipSync(b);
 assert.equal(sha(b),spec.storedSHA256);assert.equal(sha(r),spec.decodedSHA256);assert.equal(r.length,spec.bytes);
 return Float32Array.from({length:r.length/4},(_,i)=>r.readFloatLE(i*4));
};
const point=new Vector3(),a=new Vector3(),b=new Vector3(),c=new Vector3(),origin=new Vector3();
test('exact 1m Tignish samples survive original-height, physical Three vertex packing and winding',()=>{
 const z=read(manifest.height),w=makeTignishGradeStudy(z,manifest.registration);
 try{
  assert.equal(w.group.parent,null);assert.equal(w.group.children.length,1);
  const g=w.mesh.geometry,p=g.getAttribute('position'),n=g.getAttribute('normal'),ind=g.index!;
  assert.equal(p.count,9216);assert.equal(ind.count,95*95*6);assert.equal(w.mesh.material.map,null);
  assert.deepEqual(w.group.position.toArray(),[F.base[0],F.datum,F.base[1]]);
  for(let i=0;i<p.count;i++){
   assert.ok(Math.abs(p.getY(i)+F.datum-z[i])<1e-7);
   assert.ok(n.getY(i)>.85);
  }
 }finally{w.dispose();}
});
test('three side controls use 1291 distinct raw ground returns on the actual four-corner triangle geometry',()=>{
 const z=read(manifest.height),q=read(manifest.checkRows),w=makeTignishGradeStudy(z,manifest.registration);
 try{
  const g=w.mesh.geometry,p=g.getAttribute('position'),idx=g.index!;
  assert.equal(q.length/3,1291);
  let j=0;
  for(const k of manifest.checkOrder){
   const expected=manifest.checks[k],N=expected.first,err:number[]=[];
   for(let i=0;i<N;i++,j+=3){
    const [u,v,y]=q.subarray(j,j+3),x=Math.floor(u),z0=Math.floor(v),k=(z0*95+x)*6;
    origin.set(F.col[0]*u+F.row[0]*v,20,F.col[1]*u+F.row[1]*v);
    const ray=new Ray(origin,new Vector3(0,-1,0));
    const local=(u-x)+(v-z0)<=1?k:k+3;
    const t=ray.intersectTriangle(
      a.fromBufferAttribute(p,idx.getX(local)),b.fromBufferAttribute(p,idx.getX(local+1)),
      c.fromBufferAttribute(p,idx.getX(local+2)),true,point);
    assert.ok(t);err.push(Math.abs(F.datum+t.y-y));
   }
   err.sort((a,b)=>a-b);const k90=(N-1)*.9,i0=Math.floor(k90);
   const p90=err[i0]*(1-k90+i0)+err[i0+1]*(k90-i0);
   assert.ok(Math.abs(p90-expected.p90Abs)<1e-5&&p90<.019);
   assert.ok(Math.abs(err[N-1]-expected.maxAbs)<1e-5&&err[N-1]<.047);
  }
  assert.equal(j,q.length);
 }finally{w.dispose();}
});
test('a displaced row basis or void measurement never generates alternate grade',()=>{
 const h=read(manifest.height),r=structuredClone(manifest.registration);
 r.worldXZForRow[0]+=.001;
 assert.throws(()=>makeTignishGradeStudy(h,r),/unsupported/);
 h[257]=-32767;
 assert.throws(()=>makeTignishGradeStudy(h,manifest.registration),/unsupported/);
});
