import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Vector3,Raycaster} from 'three';
import {makeCourtFishHouseStudy,originalCourtCore} from './court-fishhouse-study.ts';
import {COURT_2026_NAMES as N,COURT_2026_SWATCH as P,makeCourt2026Study,court2026Restraints} from './court-2026-study.ts';

const sha=data=>createHash('sha256').update(data).digest('hex');
const older=new URL('./court-fishhouse-study-manifest.json',import.meta.url);
const limitFile=new URL('./q633-annex-2026-scope.json',import.meta.url),bounds=JSON.parse(readFileSync(limitFile));
const priv=JSON.parse(readFileSync(older));
const locked=makeCourtFishHouseStudy('documented-2009');
const zero=makeCourt2026Study(),paint=makeCourt2026Study({paint:true});
const leaf=makeCourt2026Study({paint:true,redDoor:true}),full=makeCourt2026Study({paint:true,redDoor:true,annex:true});
const doorOnly=makeCourt2026Study({redDoor:true}),annexOnly=makeCourt2026Study({annex:true});
const get=(g,n)=>g.getObjectByName(n);
const pos=m=>m.geometry.getAttribute('position');
const bbox=g=>{const p=[];g.traverse(m=>{if(m.isMesh)p.push(m);});return p;};
const vertex=(m,i)=>new Vector3().fromBufferAttribute(pos(m),i);
const ntest=(m,n)=>m.geometry.getAttribute(n).array;
const same=(a,b)=>{
 assert(a&&b);assert.equal(a.name,b.name);
 for(const n of ['position','normal','uv'])assert.deepEqual(ntest(a,n),ntest(b,n),a.name+' '+n);
};
const tally=g=>[bbox(g).reduce((s,v)=>s+pos(v).count/3,0),bbox(g).length];
const tris=m=>{
 const p=ntest(m,'position'),n=ntest(m,'normal'),uv=ntest(m,'uv');
 const out=[];
 for(let i=0;i<pos(m).count;i+=3){
  const b=Buffer.alloc(96);let j=0;
  for(const q of [p.subarray(i*3,i*3+9),n.subarray(i*3,i*3+9),uv.subarray(i*2,i*2+6)])
   for(const v of q){b.writeFloatLE(v,j);j+=4;}
  out.push(sha(b));
 }
 return out;
};
const hit=(g,orig,dir)=>new Raycaster(orig,dir,0,40).intersectObjects(g.children,true)[0];

test('independent 2026 options and exact sealed historical predecessor bytes',()=>{
 assert.equal(sha(readFileSync(older)),'4c0d34590e78e8d1f0fa20abfb0998759161b05da1dcfccaaf95bedc6e09a0be');
 assert.equal(sha(readFileSync(new URL('./court-fishhouse-study.ts',import.meta.url))),priv.inputSha256['court-fishhouse-study.ts']);
 assert.equal(sha(readFileSync(limitFile)),'75d5ea701f81461ba662150a387355c78d93cc039503c9207231e7fc46435c09');
 for(const m of bbox(locked)){
  const z=get(zero,m.name);same(m,z);assert.equal(z.material.color.getHex(),m.material.color.getHex());assert.notEqual(m.material,z.material);
 }
 assert.deepEqual(tally(zero),[752,9]);assert.deepEqual(tally(paint),[752,10]);
 assert.deepEqual(tally(leaf),[792,12]);assert.deepEqual(tally(full),[812,16]);
 assert.equal(get(doorOnly,N.paintedSE),undefined);assert.equal(get(annexOnly,N.door),undefined);
 assert.equal(get(paint,N.annexGroup),undefined);assert.equal(get(leaf,N.annexGroup),undefined);
 for(const v of [zero,paint,leaf,full,doorOnly,annexOnly]){
  assert.equal(v.parent,null);assert.deepEqual(v.position.toArray(),[0,0,0]);assert.deepEqual(v.scale.toArray(),[1,1,1]);
  assert.match(v.userData.contact,/no dock, pier, terrain, water/);
  for(const m of bbox(v)){
   assert.equal(m.parent===v||m.parent?.name===N.annexGroup,true);
   assert.deepEqual(m.position.toArray(),[0,0,0]);assert.deepEqual(m.scale.toArray(),[1,1,1]);
   assert.equal(m.material.map,null);assert.equal(m.material.transparent,false);
   assert.equal(m.material.opacity,1);assert.equal(m.castShadow,false);assert.equal(m.receiveShadow,false);
   assert.equal(pos(m).count%3,0);assert.equal(m.geometry.index,null);
   assert(ntest(m,'position').every(Number.isFinite));assert(ntest(m,'normal').every(Number.isFinite));assert(ntest(m,'uv').every(Number.isFinite));
  }
 }
});

test('paint-only exact donor triangle partition and zero changes outside the two observed surfaces',t=>{
 for(const m of bbox(zero)){
  const v=get(paint,m.name);
  if(m.name!==N.sourceSE)same(m,v);
  if(m.name!==N.sourceNE)assert.equal(v.material.color.getHex(),m.material.color.getHex(),m.name);
 }
 const se=get(paint,N.paintedSE),base=get(zero,N.sourceSE),remainder=get(paint,N.sourceSE);
 assert.deepEqual([...tris(se),...tris(remainder)].sort(),tris(base).sort());
 const site=originalCourtCore().cornersUV,a=site[0],b=site[1],
  on=p=>Math.abs((b[0]-a[0])*(p.x-a[1])-(b[1]-a[1])*(-p.z-a[0]))/Math.hypot(b[0]-a[0],b[1]-a[1])<1e-6;
 for(let i=0;i<pos(se).count;i++)assert(on(vertex(se,i)));
 for(let i=0;i<pos(remainder).count;i+=3)assert([0,1,2].some(d=>!on(vertex(remainder,i+d))));
 assert.equal(get(paint,N.sourceNE).material.color.getHex(),P['landward-yellow']);
 assert.equal(se.material.color.getHex(),P['weathered-southeast']);
 same(get(paint,'court / core/roof'),get(full,'court / core/roof'));
 same(get(paint,'court / period/roof'),get(full,'court / period/roof'));
 t.diagnostic(JSON.stringify({originalShingleTriangles:pos(base).count/3,SEPaintedTriangles:pos(se).count/3,
  preservedOtherShingleTriangles:pos(remainder).count/3,NEPaintedTriangles:pos(get(paint,N.sourceNE)).count/3}));
});

test('NE red-leaf and exact enclosed aperture: unaffected original color/position paths, 2,832 opacity rays',t=>{
 for(const m of bbox(paint))if(m.name!==N.sourceNE)same(m,get(leaf,m.name));
 for(const n of [N.doorTrim,N.door])same(get(leaf,n),get(doorOnly,n));
 assert.equal(get(leaf,N.door).material.color.getHex(),P['red-leaf']);
 assert.equal(get(leaf,N.sourceNE).material.color.getHex(),P['landward-yellow']);
 assert.notEqual(get(doorOnly,N.sourceNE).material.color.getHex(),P['landward-yellow']);
 const q=court2026Restraints(),[u,v]=q.wallFrom,[U,V]=q.wallTo,dU=U-u,dV=V-v,L=q.coreWidth;
 const input=new Vector3(dU/L,0,dV/L),xyz=(s,y)=>new Vector3(v+s*dV/L,y,-u-s*dU/L);
 const [s0,s1,y0,y1]=q.redDoor.inner;
 let checked=0,recess=0;
 for(let j=0;j<59;j++){
  const s=.115+(L-.230)*(j+.2)/59;
  for(let i=0;i<48;i++){
   const y=.03+2.87*(i+.3)/48,a=xyz(s,y).addScaledVector(input,-2);
   const prior=hit(paint,a,input),curr=hit(leaf,a,input);assert(prior&&curr);
   assert(Math.abs(prior.distance-2)<1e-6);
   if(s>s0&&s<s1&&y>y0&&y<y1){
    assert.equal(curr.object.name,N.door);assert.ok(Math.abs(curr.distance-2-q.redDoor.recess)<1e-6);recess++;
   }else assert.ok(Math.abs(curr.distance-2)<1e-6);
   checked++;
  }
 }
 assert(recess>200);
 t.diagnostic(JSON.stringify({checked,recess,nearExactDepth:q.redDoor.recess}));
});

test('separate low annex is independently detachable, watertight, bounded horizontally, and has no holes/doors',t=>{
 for(const m of bbox(leaf))same(m,get(full,m.name));
 const sub=get(full,N.annexGroup),only=get(annexOnly,N.annexGroup);
 assert(sub.isGroup);assert.equal(only.name,sub.name);assert.equal(sub.children.length,4);
 assert.deepEqual(tally(sub),[20,4]);
 assert.equal(bounds.outsideFederalButInBothSourcesM2>2.399,true);
 assert(bounds.outsideOldMarginToProvincialRim>.18);assert(bounds.neighbourDistanceM['266']>5.89);
 const C=bounds.localCornersUV,signed=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const edge=new Map(),uniq=new Set();
 let nf=0;
 const key=p=>p.toArray().map(q=>Math.round(q*1e6)).join(',');
 for(const m of bbox(sub)){
  same(m,get(only,m.name));
  const count=pos(m).count;
  for(let i=0;i<count;i+=3){
   const p=[0,1,2].map(a=>vertex(m,i+a)),a=p[0],b=p[1],c=p[2],n=b.clone().sub(a).cross(c.clone().sub(a));
   assert(n.length()>1e-6);
   for(const q of p){
    uniq.add(key(q));assert(C.every((a,i)=>signed(a,C[(i+1)%4],[-q.z,q.x])<1.5e-6));
    assert(q.y>=0&&q.y<2.341);
   }
   if(m.name===N.annexTop)assert(n.y>0);
   if(m.name===N.annexSoffit)assert(n.y<0);
   for(let k=0;k<3;k++){
    const a=key(p[k]),b=key(p[(k+1)%3]),s=a<b?1:-1,q=a<b?a+'/'+b:b+'/'+a,x=edge.get(q)??[0,0];
    x[0]++;x[1]+=s;edge.set(q,x);
   }
   nf++;
  }
 }
 for(const p of edge.values())assert.deepEqual(p,[2,0]);
 assert.equal(uniq.size-edge.size+nf,2);
 // Non-opaque/unsupported see-through details never enter this bounded plan.
 const q=court2026Restraints(),A=q.wallFrom,B=q.wallTo;
 let proof=0;
 for(let v=-3.14;v<-.84;v+=.145)for(let d=.09;d<.95;d+=.09){
  const u=A[0]+(B[0]-A[0])*(v-A[1])/(B[1]-A[1])+d;
  const start=new Vector3(v,9,-u),down=new Vector3(0,-1,0),r=hit(full,start,down);
  assert.equal(hit(leaf,start,down),undefined);assert(r);assert.equal(r.object.name,N.annexTop);proof++;
 }
 t.diagnostic(JSON.stringify({outsidePlanRays:proof,annexEdges:edge.size,annexVertices:uniq.size,annexTriangles:nf}));
});
