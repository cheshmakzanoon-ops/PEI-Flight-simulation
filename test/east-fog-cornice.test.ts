import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {studyEastFogCornice,FOG_TRIM_METRES as F} from '../tools/art/east-fog-study/east-fog-cornice-study.ts';
const doc=JSON.parse(readFileSync(new URL('../tools/art/east-fog-study/east-fog-bulk-v2.json',import.meta.url)));
const plan=doc.closedBodyPlan;
const sha=b=>createHash('sha256').update(Buffer.from(b.buffer,b.byteOffset,b.byteLength)).digest('hex');
const key=(p)=>p.join('/');
const sub=(a,b)=>a.map((q,i)=>q-b[i]);
const cross=([x,y,z],[u,v,w])=>[y*w-v*z,z*u-x*w,x*v-y*u];
const dot=(a,b)=>a.reduce((s,q,i)=>s+q*b[i],0);
test('same complete measured original bulk and 20 separate authored cornice prisms',()=>{
 const q=studyEastFogCornice(plan),r=studyEastFogCornice(plan);assert.equal(q.base,402);assert.equal(q.prisms.length,20);
 for(const [k,v] of Object.entries(doc.modelBytes)){
  const old=q.bulk.getAttribute(k),live=q.geometry.getAttribute(k);
  assert.equal(sha(old.array),v);assert.equal(sha(live.array.subarray(0,old.array.length)),v);
  assert.equal(live.array.length,(402+36*20)*old.itemSize);
  assert.equal(sha(live.array),sha(r.geometry.getAttribute(k).array));
 }
});
test('real Float32 closed outward nondegenerate solids, no invented pitches',()=>{
 const q=studyEastFogCornice(plan),a=q.geometry.getAttribute('position');
 let sum=0;
 for(const p of q.prisms){
  const seen=new Map();let v=0;
  assert.equal(p.end-p.first,36);
  for(let i=p.first;i<p.end;i+=3){
   const vertices=[i,i+1,i+2].map(j=>[a.getX(j),a.getY(j),a.getZ(j)]);
   const [A,B,C]=vertices,w=cross(sub(B,A),sub(C,A));
   assert(dot(w,w)>1e-13);
   v+=dot(A,cross(B,C))/6;
   for(let j=0;j<3;j++){
    const a=key(vertices[j]),b=key(vertices[(j+1)%3]);assert(a!==b);
    const k=a<b?a+' '+b:b+' '+a;
    const [n,d]=seen.get(k)??[0,0];seen.set(k,[n+1,d+(a<b?1:-1)]);
   }
  }
  assert([...seen.values()].every(k=>k[0]===2&&k[1]===0));assert(v>0);
  sum+=v;
 }
 assert(sum>.4&&sum<1.5);
});
test('every packed surface is below even the extrapolated pitch, backing seats through wall, joints nonoverlapping',()=>{
 const q=studyEastFogCornice(plan),a=q.geometry.getAttribute('position'),[s,c]=[Math.sin(plan.yaw),Math.cos(plan.yaw)];
 let min=Infinity,max=0;
 for(const p of q.prisms){
  const b=plan.body.find(q=>q.id===p.body),[l,r,lo,hi]=b.box;
  for(let i=p.first;i<p.end;i++){
   const dx=a.getX(i)-plan.originXZ[0],dz=a.getZ(i)-plan.originXZ[1],u=c*dx-s*dz,v=s*dx+c*dz;
   const roof=b.ridgeY-b.pitch*Math.abs(u-b.ridgeU);
   min=Math.min(min,roof-a.getY(i));max=Math.max(max,Math.hypot(Math.max(l-u,u-r,0),Math.max(lo-v,v-hi,0)));
  }
  if(p.kind==='side-fascia')assert(p.backLocal.every(([u])=>l+.02<u&&u<r-.02));
  else assert(p.backLocal.every(([,,v])=>b.id==='low-tower-side'?v>lo+.02:v<hi-.02));
 }
 assert(min>.007&&max<.061);
 for(const b of plan.body){
  const parts=q.prisms.filter(q=>q.body===b.id);
  const side=parts.filter(q=>q.kind==='side-fascia').flatMap(q=>q.frontLocal.map(a=>a[2]));
  const end=parts.filter(q=>q.kind!=='side-fascia').flatMap(q=>[...q.frontLocal,...q.backLocal].map(a=>a[2]));
  const gap=b.id==='low-tower-side'?Math.min(...side)-Math.max(...end):Math.min(...end)-Math.max(...side);
  assert(gap>=F.jointGap-1e-9&&gap<=F.jointGap+1e-9);
 }
});
