import assert from 'node:assert/strict';
import {test} from 'node:test';
import {FrontSide,GLSL3,Group,REVISION} from 'three';
import {createVisitorStudy,VISITOR_STUDY_TRIANGLE_LIMIT} from './north-cape-visitor.ts';
const arr=(g,k)=>g.getAttribute(k).array;
const each=(parts,n)=>parts.filter(x=>x.name===n);
const eps=1e-6;
test('one self-contained r187 opaque unplaced mesh; no donor texture or mutation',()=>{
 assert.equal(REVISION,'187');
 const a=createVisitorStudy(),b=createVisitorStudy();
 assert(!a.group.parent&&!b.group.parent&&a.mesh.parent===a.group);
 assert.deepEqual(a.group.position.toArray(),[0,0,0]);
 assert.deepEqual(a.group.rotation.toArray(),[0,0,0,'XYZ']);
 assert.equal(a.group.children.length,1);
 assert.notEqual(a.mesh.geometry,b.mesh.geometry);assert.notEqual(a.mesh.material,b.mesh.material);
 assert.deepEqual(a.mesh.geometry.getAttribute('position').array,b.mesh.geometry.getAttribute('position').array);
 assert.deepEqual(a.mesh.material.uniforms,{});
 assert.equal(a.mesh.material.glslVersion,GLSL3);
 assert.equal(a.mesh.material.side,FrontSide);
 assert.equal(a.mesh.material.transparent,false);
 assert.equal(a.mesh.material.depthTest,true);
 assert.equal(a.mesh.material.depthWrite,true);
 assert.equal(a.mesh.geometry.groups.length,0);
 const host=new Group;host.add(b.group);
 let g=0,m=0;
 a.mesh.geometry.addEventListener('dispose',()=>g++);
 a.mesh.material.addEventListener('dispose',()=>m++);
 a.dispose();a.dispose();
 assert.equal(g,1);assert.equal(m,1);
 assert.equal(a.mesh.parent,null);assert.equal(host.children[0],b.group);
 host.remove(b.group);b.dispose();
});
test('all 101 labelled parts are nondegenerate outward closed prisms with exact Float32 adjacent edges',()=>{
 const a=createVisitorStudy(),g=a.mesh.geometry,P=arr(g,'position'),N=arr(g,'normal'),F=arr(g,'finish');
 assert.equal(F.length,1240*3);assert.equal(F.length/3<=VISITOR_STUDY_TRIANGLE_LIMIT,true);
 assert(g.boundingBox.min.y>=0&&g.boundingBox.max.y<=8.14);
 assert(g.boundingBox.max.x-g.boundingBox.min.x<29);
 assert(g.boundingBox.max.z-g.boundingBox.min.z<21);
 assert.deepEqual([...new Set(F)].sort((a,b)=>a-b),[1,2,3,4,5,6,7,8,9,10]);
 assert.equal(a.parts.length,101);let end=0;
 const vec=(a,b)=>a.map((x,i)=>x-b[i]),det=(a,b,c)=>a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]);
 for(const part of a.parts){
  assert.equal(part.first,end);end+=part.count;assert.equal(part.count%3,0);
  const oriented=new Map();let vol=0;
  for(let k=part.first;k<end;k+=3){
   const points=[k,k+1,k+2].map(k=>Array.from(P.slice(3*k,3*k+3))), n=Array.from(N.slice(3*k,3*k+3));
   const [x,y,z]=points;
   assert(det(vec(y,x),vec(z,x),n)>1e-6,part.name);
   assert(Math.abs(Math.hypot(...n)-1)<eps);
   assert.equal(F[k],F[k+1]);assert.equal(F[k],F[k+2]);
   vol+=det(x,y,z)/6;
   for(let i=0;i<3;i++){
    const p=points[i].join(':'),q=points[(i+1)%3].join(':');assert.notEqual(p,q);
    const key=p<q?p+'|'+q:q+'|'+p,sg=p<q?1:-1;
    const t=oriented.get(key)||[0,0];t[0]+=1;t[1]+=sg;oriented.set(key,t);
   }
  }
  assert(vol>1e-7,part.name);
  for(const n of oriented.values())assert.deepEqual(n,[2,0],part.name);
 }
 assert.equal(end,F.length);a.dispose();
});
test('original authored hip uses the two released slope magnitudes, neither as a geospatial assertion',()=>{
 const a=createVisitorStudy(),g=a.mesh.geometry,root=each(a.parts,'closed main roof')[0];
 const P=arr(g,'position'),N=arr(g,'normal'),R=arr(g,'finish');
 const slope=[];
 for(let k=root.first;k<root.first+root.count;k+=3){
  if(R[k]===2){assert(Math.abs(N[3*k])<eps);slope.push(-N[3*k+2]/N[3*k+1]);}
  for(let x=0;x<3;x++)assert(Number.isFinite(P[3*k+x]));
 }
 assert.equal(slope.length,6);
 assert(slope.some(s=>Math.abs(s+.24673148996413063)<eps));
 assert(slope.some(s=>Math.abs(s-.3068586792694685)<eps));
 a.dispose();
});
test('all upper prism/cover and lower porch supports have genuinely nonzero depth rather than floating',()=>{
 const a=createVisitorStudy(),one=n=>each(a.parts,n)[0].bounds;
 const roof=one('closed main roof'),body=one('body shell'),head=one('seated raised cedar head'),headCap=one('raised overhanging steel head'),
  soffit=one('porch soffit'),porch=one('closed low steel porch cover'),landing=one('porch landing');
 const h=(z)=>7.59-(z>-1.36?(z+1.36)*.24673148996413063:(-1.36-z)*.3068586792694685);
 const a0=-10.14,a1=8.18;
 function under(z){const t=(z-a0)/(a1-a0);return (1-t)*h(a0)+t*h(a1)-.128;}
 for(const z of [body[4],body[5]])assert(h(z)-.092>under(z)+.035);
 assert(roof[0]<body[0]&&roof[1]>body[1]&&roof[4]<body[4]&&roof[5]>body[5]);
 // Raised head front and rear are on long, central roof face, not a hip endpoint;
 // the full rectangular riser is sunk through that analytic plane at all 4 plan corners.
 assert(head[0]>-8&&head[1]<8.44&&head[4]>-1.36&&head[5]<roof[5]);
 for(const z of [head[4],head[5]])assert(head[2]<h(z)-.3);
 assert(headCap[2]<7.69-.04&&headCap[0]<head[0]&&headCap[1]>head[1]);
 assert(soffit[4]<body[5]-.18&&porch[4]<body[5]-.20);
 for(const {bounds:p} of each(a.parts,'seated porch column')){
  const topAt=(z,b,L,R)=>R+(L-R)*(z-b[4])/(b[5]-b[4]);
  assert(p[2]<landing[3]-.01&&p[4]>landing[4]&&p[5]<landing[5]);
  assert(p[3]>topAt(p[4],soffit,2.818,3.044));
  assert(p[3]<topAt(p[5],porch,2.903,3.251));
  assert(p[3]>porch[2]+.04);
 }
 a.dispose();
});
test('true rebate is behind the slim casing, glazed shoulder recedes, and metal fold is seated',()=>{
 const a=createVisitorStudy(),one=n=>each(a.parts,n)[0].bounds;
 const shoulder=one('recessed glazing shoulder'),body=one('body shell'),fold=one('seated steel ridge fold');
 const roof=one('closed main roof');
 assert.equal(shoulder[1],body[0]);
 assert(Math.abs(body[5]-shoulder[5]-.90)<eps);
 assert(fold[2]<roof[3]-.06 && fold[3]>roof[3]+.05 && fold[3]<7.65);
 const pane=each(a.parts,'showcase pane')[0].bounds,back=each(a.parts,'deep opaque glazing backing')[0].bounds,
   gasket=each(a.parts,'vertical glazing stop')[0].bounds,trim=each(a.parts,'mullion')[0].bounds;
 assert(back[5]>pane[4]&&back[5]<pane[5]);
 assert(gasket[5]>pane[5]);
 assert(trim[5]>pane[5]+.09&&trim[1]-trim[0]<.121);
 const shellBefore=JSON.stringify(a.parts);
 assert(shellBefore.includes('closed main roof')&&shellBefore.includes('monitor recessed opaque light'));
 a.dispose();
});
