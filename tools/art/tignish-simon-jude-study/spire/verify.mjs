import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {DESIGN,triangles,skinSeatN,detachedUpperSpire} from './upper-spire.ts';
const data=detachedUpperSpire();
const {tris,surveys,root,slats,hoods}=data;
root.updateMatrixWorld(true);
const core=tris.filter(t=>t.role.startsWith('core:'));
const ray=(n,localU,y,s=1)=>{
 const Ns=new T.Vector3(...n),tan=new T.Vector3(n[2],0,-n[0]);
 const from=new T.Vector3(0,y,0).addScaledVector(Ns,s).addScaledVector(tan,localU);
 const hit=new T.Raycaster(from,Ns.clone().negate(),0,.75).intersectObject(root,true)[0];
 if(!hit)return;
 const tri=tris.filter(t=>t.batch===hit.object.name)[hit.faceIndex];
 return {r:tri.role,d:hit.point.dot(Ns)};
};
const close=(p,q,e=2e-7)=>Math.abs(p-q)<e;
test('standalone original two-draw mesh, no registered origin, external materials, texture or shadow work',()=>{
 assert(!DESIGN.registered&&!DESIGN.stageMount&&data.root.userData.sceneSupport===false);
 assert.equal(data.root.children.length,2);assert.equal(data.root.parent,null);
 assert(tris.length<=DESIGN.maxTriangles);
 assert(tris.length>700);
 assert.equal(tris.reduce((b,t)=>b+t.p.length,0),root.children.reduce((b,m)=>b+m.geometry.getAttribute('position').count,0));
 for(const m of root.children){
  assert.equal(m.material.type,'MeshStandardMaterial');assert(m.material.vertexColors);
  assert(!m.material.transparent&&!m.material.alphaTest&&!m.material.alphaHash&&!m.material.map&&!m.material.envMap);
  assert(!m.castShadow&&!m.receiveShadow);assert(!m.geometry.index);
  for(const k of ['position','normal','color'])assert(m.geometry.getAttribute(k).array instanceof Float32Array);
  const a=m.geometry.attributes.position;
  for(let i=0;i<a.count;i++)assert(Math.abs(a.getX(i))<=.51&&Math.abs(a.getZ(i))<=.51&&a.getY(i)>=-.9550001&&a.getY(i)<=2.6470001);
 }
});
test('core 4 square rises and 4 solid corner broaches feed a closed 8-facet stage neck',()=>{
 const edges=new Map(),v=new Set();
 const id=p=>p.join(',');
 for(const t of core){
  const q=t.p.map(id);
  for(let i=0;i<3;i++){
   const x=q[i],y=q[(i+1)%3],s=x<y?1:-1,k=[x,y].sort().join(':');
   const a=edges.get(k)??[0,0];a[0]++;a[1]+=s;edges.set(k,a);v.add(x);
  }
 }
 assert.equal(core.length,36);
 assert.equal(core.filter(t=>t.role==='core:broach').length,4);
 assert.equal(core.filter(t=>t.role==='core:needle').length,16);
 assert.equal(v.size-edges.size+core.length,2);
 assert([...edges.values()].every(x=>x[0]===2&&x[1]===0));
 let triple=0;
 for(const {p} of core)triple+=new T.Vector3(...p[0]).dot(new T.Vector3(...p[1]).cross(new T.Vector3(...p[2])));
 assert(triple>0,'oriented outside volume');
 const rings=[0,DESIGN.skirtTop,DESIGN.needleTop].map(y=>Math.max(...core.flatMap(e=>e.p.filter(p=>p[1]===y).map(p=>Math.max(Math.abs(p[0]),Math.abs(p[2]))))));
 assert.deepEqual(rings,[.5,.269,.022]);
 assert(rings[0]>rings[1]&&rings[1]>rings[2]);
});
test('eave seats whole square underside, cornice, stage brick and independent small terminal overlap physically',()=>{
 const select=s=>tris.filter(t=>t.role===s).flatMap(t=>t.p);
 const lo=s=>Math.min(...select(s).map(p=>p[1])),hi=s=>Math.max(...select(s).map(p=>p[1]));
 assert.equal(lo('core:base'),hi('rolled lip'));assert.equal(lo('rolled lip'),hi('upper masonry cornice'));
 assert(hi('clipped belfry top')>lo('upper masonry cornice'));
 const base=select('core:base');
 for(const p of base)assert(Math.max(Math.abs(p[0]),Math.abs(p[2]))<=.502);
 assert(lo('terminal socket')<hi('core:top'));assert(lo('terminal shoulder')<hi('terminal socket'));
 assert(lo('terminal stem')<hi('terminal shoulder'));assert(lo('terminal cross arm')>lo('terminal stem'));
 assert(hi('terminal cross arm')<hi('terminal stem'));
});
test('three photographed role examples are genuine pointed recesses with pale trims and attached folded cheeks',()=>{
 const axes=[[0,0,1],[1,0,0],[0,0,-1],[-1,0,0]];
 assert.deepEqual(surveys.map(x=>x.face),[0,1,3]);
 for(const a of surveys){
  const n=axes[a.face],prefix='profile:'+a.face;
  assert(a.hostCover>.01);
  assert.deepEqual(ray(n,0,.37)?.r,prefix+':shadowed backstop');
  assert(close(ray(n,0,.37)?.d,.439556));
  assert.deepEqual(ray(n,.047,.37)?.r,prefix+':pale reveal');
  assert.deepEqual(ray(n,.071,.37)?.r,prefix+':hood face');
  const skinProbe=ray(n,.175,.37);assert(skinProbe?.r.startsWith('core:'));
 }
 const reverse=ray(axes[2],0,.37);
 assert(reverse.r.startsWith('core:'));assert(close(reverse.d,skinSeatN(.37)));
});
test('belfry’s solid pierced panel includes slatted depth, open intervals, pointed arch, and distinct unobserved closure',()=>{
 for(const [id,n] of [[0,[0,0,1]],[1,[1,0,0]],[3,[-1,0,0]]]){
  assert.equal(ray(n,.040,-.512).r,'bay:'+id+':tilted slat');
  assert.equal(ray(n,.040,-.495).r,'bay:'+id+':recess backstop');
  assert(close(ray(n,.040,-.495).d,.394));
  assert.equal(ray(n,.115,-.6).r,'bay:'+id+':timber arch');
  assert.equal(ray(n,.180,-.6).r,'bay:'+id+':brick face');
 }
 assert.equal(ray([0,0,-1],0,-.513).r,'unseen neutral section closure');
});

const F={0:[0,1],1:[1,0],2:[0,-1],3:[-1,0]};
const local=(p,id)=>{const [x,z]=F[id];return [Math.fround(p[0])*z-Math.fround(p[2])*x,Math.fround(p[1]),Math.fround(p[0])*x+Math.fround(p[2])*z];};
const included=(span)=>tris.slice(...span);
function seal(parts,description){
 const edges=new Map(),v=new Set();
 const id=p=>p.map(Math.fround).join(',');
 let volume=0;
 for(const {p} of parts){
  const q=p.map(id),a=p.map(v=>new T.Vector3(...v.map(Math.fround)));
  const n=a[1].clone().sub(a[0]).cross(a[2].clone().sub(a[0]));
  assert(n.lengthSq()>1e-15,description+' nondegenerate');
  volume+=a[0].dot(a[1].clone().cross(a[2]))/6;
  for(let i=0;i<3;i++){
   const x=q[i],y=q[(i+1)%3],s=x<y?1:-1,k=[x,y].sort().join(':');
   const record=edges.get(k)??[0,0];record[0]++;record[1]+=s;edges.set(k,record);v.add(x);
  }
 }
 assert([...edges.values()].every(x=>x[0]===2&&x[1]===0),description+' closed oriented edges');
 assert.equal(v.size-edges.size+parts.length,2,description+' spherical boundary');
 assert(volume>0,description+' finite volume');
 return {faces:parts.length,vertices:v.size,volume};
}
const range=(point)=>[0,1,2].map(j=>[Math.min(...point.map(p=>p[j])),Math.max(...point.map(p=>p[j]))]);
const pieces=(role,id)=>tris.filter(t=>t.role===role).flatMap(t=>t.p.map(p=>local(p,id)));
const collar=(t,x)=>Math.min(...t.map(([lo,hi],k)=>Math.min(x[k]-lo,hi-x[k])));
const overlap=(a,b)=>Math.min(...a.map(([l,h],k)=>Math.min(h,b[k][1])-Math.max(l,b[k][0])));

test('all 425 immutable original triangles including the primary shell, edge, wall cuts and terminal retained exactly',()=>{
 const held=tris.filter(t=>!(t.role.startsWith('bay:')||t.role.startsWith('profile:'))||t.role.endsWith(':brick face'));
 assert.equal(held.length,425);
 assert.equal(createHash('sha256').update(JSON.stringify(held)).digest('hex'),'934e38e9039088416961290a359e9a6b3bd982eae8255e3a0261153607b585f2');
});

test('all forty-eight pressed louvre bodies are individually closed and both actual end caps are buried',()=>{
 assert.equal(slats.length,48);let inner=Infinity,outer=Infinity;
 for(const s of slats){
  const q=included(s.span),name='bay:'+s.face+':';
  const count=seal(q,'slat '+s.face+' '+s.row+' '+s.side);
  assert.equal(count.faces,12);assert.equal(count.vertices,8);
  const caps=q.filter(t=>t.role===name+'slat end cap').flatMap(t=>t.p.map(p=>local(p,s.face)));
  assert.equal(caps.length,12);
  const m=range(pieces(name+'mullion',s.face)),l=range(pieces(name+'bearing liner:'+s.side,s.face));
  const inside=caps.filter(p=>Math.abs(p[0])<.01),outside=caps.filter(p=>Math.abs(p[0])>.09);
  assert.equal(inside.length,6);assert.equal(outside.length,6);
  inner=Math.min(inner,...inside.map(p=>collar(m,p)));
  outer=Math.min(outer,...outside.map(p=>collar(l,p)));
 }
 assert(inner>.0029&&outer>.0034,{inner,outer});
});

test('embedded side bearings connect continuous actual strip jamb plus both linked mullion/head/heel seats',()=>{
 for(const f of [0,1,3]){
  const pre='bay:'+f+':',heel=range(pieces(pre+'bearing heel',f)),head=range(pieces(pre+'bearing head',f));
  for(const id of ['mullion','bearing liner:-1','bearing liner:1']){
   const b=range(pieces(pre+id,f));
   assert(overlap(b,heel)>.010&&overlap(b,head)>.011,pre+id);
  }
  for(const s of [-1,1]){
   const b=range(pieces(pre+'bearing liner:'+s,f));
   const jambs=tris.filter(t=>t.role===pre+'inner reveal').map(t=>t.p.map(p=>local(p,f)))
    .filter(p=>p.every(x=>close(x[0],s*.095))&&Math.min(...p.map(x=>x[1]))<-.75299);
   assert.equal(jambs.length,2);
   const [u,y,n]=range(jambs.flat());
   assert(close(u[0],u[1])&&u[0]>b[0][0]&&u[0]<b[0][1]);
   assert(Math.min(b[1][1],y[1])-Math.max(b[1][0],y[0])>.30);
   assert(Math.min(b[2][1],n[1])-Math.max(b[2][0],n[0])>.038);
  }
 }
});

test('all three hood bodies and separate seated rake boards are closed, and entire packed cheek backs fit the real folded shell',()=>{
 const rows=[0,DESIGN.skirtTop,DESIGN.needleTop].map(y=>{
  const a=core.flatMap(t=>t.p).filter(p=>p[1]===y).map(p=>local(p,0));
  const A=Math.max(...a.map(p=>p[2]));
  const B=Math.max(...a.filter(p=>p[2]===A).map(p=>Math.abs(p[0])));
  return {y:Math.fround(y),A,B};
 });
 const skin=(y)=>{
  const j=y<rows[1].y?0:1,r=rows[j],s=rows[j+1],t=(y-r.y)/(s.y-r.y);
  return [r.A+(s.A-r.A)*t,r.B+(s.B-r.B)*t];
 };
 const crossing=(p)=>{
  const a=[...p];const h=rows[1].y;
  for(let i=0;i<3;i++){
   const s=p[i],t=p[(i+1)%3];
   if((s[1]<h)!==(t[1]<h)){
    const v=(h-s[1])/(t[1]-s[1]);
    a.push([s[0]+(t[0]-s[0])*v,h,s[2]+(t[2]-s[2])*v]);
   }
  }
  return a;
 };
 let embed=Infinity,clearance=Infinity;
 for(const h of hoods){
  const fig=seal(included(h.hoodSpan),'hood '+h.face),rake=seal(included(h.rakeSpan),'rake '+h.face);
  assert(fig.volume>rake.volume*25);
  const curves=t=>crossing(t.p.map(p=>local(p,h.face)));
  for(const p of included(h.hoodSpan).filter(t=>t.role.endsWith(':buried back')).flatMap(curves)){
   const [a,b]=skin(p[1]);
   embed=Math.min(embed,a-Math.abs(p[0]),a-Math.abs(p[2]),a+b-Math.abs(p[0])-Math.abs(p[2]));
  }
  for(const p of included(h.hoodSpan).filter(t=>t.role.endsWith(':shadowed backstop')).flatMap(curves)){
   const [a,b]=skin(p[1]);
   clearance=Math.min(clearance,p[2]-Math.min(a,a+b-Math.abs(p[0])));
  }
  const face=included(h.hoodSpan).filter(t=>t.role.endsWith(':hood face')).flatMap(t=>t.p.map(p=>local(p,h.face)));
  const extreme=(role,x)=>Math.max(...role.map(p=>p[2]+.066*(p[1]-.136)))+x;
  const support=extreme(face,0);
  const trim=included(h.rakeSpan).flatMap(t=>t.p.map(p=>local(p,h.face)));
  const n=trim.map(p=>p[2]+.066*(p[1]-.136));
  assert(close(Math.min(...n),support-.0045)&&close(Math.max(...n),support+.0025));
  // Entire trim lies inside the object's true original rectangular/peaked XY silhouette.
  assert(trim.every(p=>p[1]>=.565-1e-7&&p[1]<=.822&&Math.abs(p[0])<.087*(.822-p[1])/(.822-.565)-.0002));
 }
 assert(embed>.01799&&clearance>.0125,{embed,clearance});
});

test('emitted local color and positions are deterministic across independent Three.js actors',()=>{
 const other=detachedUpperSpire();
 const bytes=(m,k)=>Buffer.from(m.geometry.getAttribute(k).array.buffer);
 for(const [i,m] of root.children.entries())for(const k of ['position','color','normal']){
  assert.equal(createHash('sha256').update(bytes(m,k)).digest('hex'),
               createHash('sha256').update(bytes(other.root.children[i],k)).digest('hex'));
 }
 other.dispose();data.dispose();
});
