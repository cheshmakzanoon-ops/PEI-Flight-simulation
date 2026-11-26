import assert from 'node:assert/strict';
import * as T from 'three';
import {createHash} from 'node:crypto';
import {makeHolmanDetached} from './holman-closed-study.ts';
import {HOLMAN_PLAN} from './holman-plan.generated.ts';
const hash=b=>createHash('sha256').update(b).digest('hex');
const shaArray=a=>hash(Buffer.from(a.buffer,a.byteOffset,a.byteLength));
const q=makeHolmanDetached();q.group.updateMatrixWorld(true);
const eps=1e-4;
const cross2=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const area=p=>p.reduce((s,x,i)=>s+(x[0]*p[(i+1)%p.length][1]-x[1]*p[(i+1)%p.length][0])*.5,0);
const old=q.oldOutline,wholeArea=area(old);
assert(wholeArea>2500&&wholeArea<2600);
const inside=(p)=>{
 let v=false;for(let i=0;i<old.length;i++){
  const a=old[i],b=old[(i+1)%old.length];
  const mag=Math.hypot(b[0]-a[0],b[1]-a[1]),dot=(p[0]-a[0])*(p[0]-b[0])+(p[1]-a[1])*(p[1]-b[1]);
  if(Math.abs(cross2(a,b,p))/mag<=eps&&dot<=eps)return true;
  if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<a[0]+(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1]))v=!v;
 }
 return v;
};
const report={draws:q.draws,triangleCount:q.triangles,areaOld:wholeArea,pieces:q.pieces.map(x=>({...x,area:area(x.ring)})),streams:{},roles:q.roleTriangles};
assert(Math.abs(report.pieces.reduce((s,p)=>s+p.area,0)-wholeArea)<1e-5);
const edges=[new Map(),new Map(),new Map(),new Map()],vol=[0,0,0,0];const sameWeld=[];
const P=new T.Vector3(),A=new T.Vector3(),B=new T.Vector3(),N=new T.Vector3();
let minArea=Infinity,minNormal=1,mismatched=0;
for(const mesh of q.group.children){
 const a=mesh.geometry.attributes,resource=mesh.geometry.userData;
 assert.equal(a.position.count%3,0); assert.equal(a.position.count,a.uv.count);assert.equal(a.position.count,a.normal.count);
 assert(a.position.array.every(Number.isFinite)&&a.normal.array.every(Number.isFinite)&&a.uv.array.every(Number.isFinite));
 report.streams[mesh.name]=Object.fromEntries(['position','normal','uv'].map(s=>[s,shaArray(a[s].array)]));
 const parents=resource.part; assert.equal(parents.length,a.position.count/3);assert.equal(parents.length,resource.faceRole.length);
 for(let i=0;i<a.position.count;i+=3){
  const ps=[i,i+1,i+2].map(j=>new T.Vector3().fromBufferAttribute(a.position,j)); const w=parents[i/3];
  N.copy(ps[1]).sub(ps[0]).cross(A.copy(ps[2]).sub(ps[0]));const measure=N.length();minArea=Math.min(minArea,measure*.5);assert(measure>1e-10,mesh.name+' '+i);
  N.multiplyScalar(1/measure);const stored=P.fromBufferAttribute(a.normal,i); const winding=N.dot(stored);minNormal=Math.min(minNormal,winding);assert(winding>.9999995,`${mesh.name} ${i} ${measure} ${winding} ${resource.faceRole[i/3]} ${JSON.stringify(ps.map(x=>x.toArray()))} ${stored.toArray()}`);
  vol[w]+=ps[0].dot(A.copy(ps[1]).cross(ps[2]))/6;
  for(let j=0;j<3;j++){
   const a=ps[j],b=ps[(j+1)%3];assert(inside([a.x,a.z]));assert(inside([(a.x+b.x)*.5,(a.z+b.z)*.5]));
   const x=a.toArray().join(','),y=b.toArray().join(',');assert(x!==y);
   const m=x<y?1:-1,k=x<y?x+'|'+y:y+'|'+x,v=edges[w].get(k)??[0,0];v[0]++;v[1]+=m;edges[w].set(k,v);
  }
  const center=ps.reduce((a,b)=>a.add(b),new T.Vector3()).multiplyScalar(1/3);
  assert(inside([center.x,center.z]));
 }
}
assert(vol.every(v=>v>0));const counts=edges.map(m=>{const fail=[...m].filter(e=>e[1][0]!==2||e[1][1]!==0);return {edges:m.size,wrong:fail.length,examples:fail.slice(0,9)};});
const xyz=(a,b,n=0)=>new T.Vector3(a,n,b);
// Portable arithmetic samples deliberately not an external survey or a reserve roster.
const screen=new T.Raycaster(),imageHits={};
const hit=(o,dir)=>{screen.set(o,dir);return screen.intersectObject(q.group,true).at(0)};
let mainHeightMax=0, eastHeightMax=0, mainN=0,eastN=0;
for(const [id,points] of [['main',[[21.18,5.17],[44.76,27.51],[33.003,14.903],[57.61,25.61]]],['east',[[72.181,33.291],[67.814,13.204],[76.21,10.661]]]])for (const [u,v] of points){
 const {beta:[A,B,C,D],origin,knots}=HOLMAN_PLAN[id];
 const expect=(id==='east'?A:A+B*(u-origin[0])+C*(v-origin[1])+D*Math.abs(u-knots[0]))-q.rulerNotDatum;
 const h=hit(xyz(u,v,100),new T.Vector3(0,-1,0));assert(h?.object.name==='roof',`${id}: ${u} ${v}`);
 const err=Math.abs(h.point.y-expect);assert(err<.000004);
 if(id==='east'){eastHeightMax=Math.max(eastHeightMax,err);eastN++}else{mainHeightMax=Math.max(mainHeightMax,err);mainN++}
}
for(const [name,u,y,expected]of [['curtain-lower',59.10,2.28,'curtain'],['curtain-upper',59.10,9.73,'curtain'],['not-left-on-black',53.0,7.1,'brick'],['east-controls-no-black',69.12,7.62,'!curtain'],['base-material-east',77.51,.61,'stoneBase']]){
 const h=hit(xyz(u,55,y),new T.Vector3(0,0,-1));assert(h&&(expected.startsWith('!')?h.object.name!==expected.slice(1):h.object.name===expected),`${name} actual ${h?.object.name}`);imageHits[name]={actual:h.object.name,worldStudy:h.point.toArray()};
}
assert.equal(q.triangles,5054);assert.equal(q.draws,7);assert.equal(counts.reduce((a,b)=>a+b.wrong,0),0);assert.equal(counts.reduce((a,b)=>a+b.edges,0),7581);
// Optional optical material choice cannot rewrite masonry/roof streams.
const neutral=makeHolmanDetached(()=>new T.MeshBasicMaterial());
assert.deepEqual(neutral.group.children.map(mesh=>Object.fromEntries(['position','normal','uv'].map(s=>[s,shaArray(mesh.geometry.attributes[s].array)]))),Object.values(report.streams));
console.log(`Holman detached: ${q.triangles} tris, ${q.draws} batches, 7581 paired Float32 edges, ${mainN+eastN} modeled roof scope points, ${Object.keys(imageHits).length} subsidiary exact material-role rays, zero outside owner.`);
