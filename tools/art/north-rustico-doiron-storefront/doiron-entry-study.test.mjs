import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Box3, FrontSide, MeshStandardMaterial, Raycaster, ShaderLib, Vector3} from 'three';
import {DOIRON_ENTRY_STUDY, doironEntryOpeningCue, makeDoironEntryStudy, patchDoironEntryFinish} from './doiron-entry-study.ts';

const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t, a+' != '+b);
const asBytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const find=(group,name)=>group.children.find(m=>m.userData.role===name);
function hit(group,origin,ray=[0,0,-1]){
 group.updateMatrixWorld(true);
 return new Raycaster(new Vector3(...origin),new Vector3(...ray),0,30).intersectObject(group,true)[0];
}
test('detached positive metric source; exact 217 triangles and nine material roles',()=>{
 const g=makeDoironEntryStudy();
 assert.equal(g.userData.mountAuthority,false);
 assert.equal(g.userData.depth,'detached display only');
 const roles={back:10,trim:98,sill:42,lap:22,shingle:18,glass:6,door:10,canopy:3,soffit:8};
 assert.deepEqual(Object.fromEntries(g.children.map(m=>[m.userData.role,m.geometry.getAttribute('position').count/3])),roles);
 assert.equal(g.geometry,undefined);
 const b=new Box3().setFromObject(g);
 const size=b.getSize(new Vector3()).toArray();
 for(const [i,l] of DOIRON_ENTRY_STUDY.dimensionsM.entries())near(size[i],l,5e-7);
 for(const c of g.children){
  const m=c.material;
  assert.equal(m.side,FrontSide);
  assert.equal(m.transparent,false);
  assert.equal(m.opacity,1);
  assert.equal(m.map,null);
  assert.equal(m.normalMap,null);
  assert.equal(m.displacementMap,null);
  assert.equal(m.envMap,null);
  const {position:p,normal:n,uv:u}=c.geometry.attributes;
  const get=(q,j)=>new Vector3(q.getX(j),q.getY(j),q.getZ(j));
  assert.equal(p.count,n.count);assert.equal(n.count,u.count);assert.equal(p.count%3,0);
  assert.equal(c.geometry.index,null);
  for(const a of [p,n,u])assert.ok(a.array.every(Number.isFinite));
  for(let i=0;i<p.count;i+=3){
   const p0=get(p,i);const p1=get(p,i+1);const p2=get(p,i+2);
   const outward=new Vector3().crossVectors(p1.clone().sub(p0),p2.clone().sub(p0));
   assert.ok(outward.length()>1e-7,c.name+' zero area');
   near(outward.normalize().dot(get(n,i)),1,2e-7);
   assert.ok(get(n,i).equals(get(n,i+1))&&get(n,i).equals(get(n,i+2)));
  }
 }
});
test('only bounded window / glazed leaf / window: real first hits, depth, opaque infills, trim',()=>{
 const c=doironEntryOpeningCue();assert.deepEqual(c.map(x=>x.role),['window','door','window']);
 const g=makeDoironEntryStudy();
 for(const i of [0,2]){
  const w=c[i],x=w.x0+.24,y=w.y0+.37;
  const sample=hit(g,[x,y,4]);
  assert.equal(sample.object.userData.role,'glass');near(sample.point.z,-.135);
  const revealedFrame=hit(g,[w.x0-.026,y,4]);
  assert.equal(revealedFrame.object.userData.role,'trim');near(revealedFrame.point.z,.038);
 }
 const door=c[1];
 const leaf=hit(g,[door.x0+.36,door.y0+.59,4]);
 assert.equal(leaf.object.userData.role,'door');near(leaf.point.z,-.135);
 const glazing=hit(g,[door.x0+.36,door.y0+1.47,4]);
 assert.equal(glazing.object.userData.role,'glass');near(glazing.point.z,-.135);
 const around=hit(g,[3.32,1.45,4]);assert.equal(around.object.userData.role,'shingle');near(around.point.z,0);
 const outside=hit(g,[3.87,1.45,4]);assert.equal(outside.object.userData.role,'lap');near(outside.point.z,0);
 const above=hit(g,[.27,3.35,4]);assert.equal(above.object.userData.role,'lap');near(above.point.z,0);
 const reverse=hit(g,[.27,1.3,-4],[0,0,1]);assert.equal(reverse.object.userData.role,'back');near(reverse.point.z,-.252);
 c[1].role='window';assert.equal(doironEntryOpeningCue()[1].role,'door');
});
test('hood: closed underside, plan slope plus single true hip, no measured stock shell change',()=>{
 const g=makeDoironEntryStudy(), h=makeDoironEntryStudy({hood:false});
 const on=hit(g,[1,4,.45],[0,-1,0]), off=hit(h,[1,4,.45],[0,-1,0]);
 assert.equal(on.object.userData.role,'canopy');assert.equal(off,undefined);assert.ok(on.point.y>2.54&&on.point.y<2.994);
 const below=hit(g,[1,1.9,.45],[0,1,0]);assert.equal(below.object.userData.role,'soffit');near(below.point.y,2.459,2e-7);
 const overHip=hit(g,[3.900,4,.1],[0,-1,0]);assert.equal(overHip.object.userData.role,'canopy');
 assert.ok(Math.abs(overHip.face.normal.x)>.1&&overHip.face.normal.y>.05);
 assert.ok(Math.abs(on.face.normal.x)<1e-7&&on.face.normal.y>.1);
 // Every common frontage byte is unchanged, even on trim which appends fascia only.
 for(const c of h.children){
  for(const name of ['position','normal','uv']){
   const b=asBytes(c.geometry.getAttribute(name).array);
   assert.deepEqual(asBytes(find(g,c.userData.role).geometry.getAttribute(name).array).subarray(0,b.length),b);
  }
 }
});
test('display front is opaque and closed through three aperture cuts, roles stop at isolated panel',()=>{
 const g=makeDoironEntryStudy({hood:false});
 for(let r=0;r<45;r++){
  for(let c=0;c<64;c++){
   const x=-4.06+c*.128,y=.0251+r*.1215;
   const f=hit(g,[x,y,3]);assert.ok(f,'open daylight '+x+','+y);
   assert.ok(f.point.z>=-.135000007,'perforated display '+x+','+y);
  }
 }
 assert.equal(hit(g,[4.12,1.5,3]),undefined);
 assert.equal(hit(g,[-4.12,1.5,3]),undefined);
});
test('canopy UV metric in both planes; shader finish and controls use original Three structures only',()=>{
 const g=makeDoironEntryStudy(),h=makeDoironEntryStudy({finish:false});
 const {position:p,uv:u}=find(g,'canopy').geometry.attributes;
 const pDist=(a,b)=>Math.hypot(p.getX(a)-p.getX(b),p.getY(a)-p.getY(b),p.getZ(a)-p.getZ(b));
 const uDist=(a,b)=>Math.hypot(u.getX(a)-u.getX(b),u.getY(a)-u.getY(b));
 for(let i=0;i<p.count;i+=3)for(const [a,b] of [[0,1],[0,2],[1,2]])near(pDist(i+a,i+b),uDist(i+a,i+b),7e-7);
 const {vertexShader:v,fragmentShader:f}=ShaderLib.standard;
 for(const c of g.children){
  const r=c.userData.role,b=find(h,r);
  for(const name of ['position','normal','uv'])assert.deepEqual(asBytes(c.geometry.getAttribute(name).array),asBytes(b.geometry.getAttribute(name).array));
  const q={vertexShader:v,fragmentShader:f,uniforms:{seen:1}},u=q.uniforms;
  const active=patchDoironEntryFinish(v,f,r);
  c.material.onBeforeCompile(q,{});
  assert.equal(q.uniforms,u);
  if(['lap','shingle','canopy'].includes(r)){
   assert.ok(active);assert.equal(q.vertexShader,active.vertex);assert.equal(q.fragmentShader,active.fragment);
   assert.ok(active.fragment.includes('fwidth('));
   assert.ok(active.vertex.includes('vDoironEntryUV=uv;'));
   assert.ok(active.fragment.includes('diffuseColor.rgb=max'));
   assert.equal(patchDoironEntryFinish(v,active.fragment,r),undefined);
   assert.equal(patchDoironEntryFinish(active.vertex,f,r),undefined);
   assert.equal(patchDoironEntryFinish(v,f+'\n#include <common>',r),undefined);
   assert.notEqual(c.material.customProgramCacheKey(),b.material.customProgramCacheKey());
  }else{
   assert.equal(active,undefined);assert.equal(q.vertexShader,v);assert.equal(q.fragmentShader,f);
  }
  b.material.onBeforeCompile({vertexShader:v,fragmentShader:f,uniforms:{}},{});
 }
 const substitute=new MeshStandardMaterial();const w=makeDoironEntryStudy({materialFor:r=>r==='glass'?substitute:undefined});
 assert.equal(find(w,'glass').material,substitute);assert.notEqual(find(w,'lap').material,substitute);
});

test('neutral display edge and ash control keep all physical shell, casing and optical input positions exact',()=>{
 const base=makeDoironEntryStudy(), neutral=makeDoironEntryStudy({neutralCut:true}), ash=makeDoironEntryStudy({neutralCut:true,ashShingles:true});
 // A material role reassignment only. SHA each exact Float32 triangle record including UVs.
 const raw=g=>g.children.flatMap(m=>{
  const a=m.geometry.attributes;
  return Array.from({length:a.position.count/3},(_,k)=>Array.from(
   {length:3},(_,j)=>['position','normal','uv'].map(name=>{
    const attr=a[name],first=(3*k+j)*attr.itemSize;
    return asBytes(attr.array.subarray(first,first+attr.itemSize)).toString('hex');
   }).join('')
  ).join(''));
 }).sort();
 assert.deepEqual(raw(neutral),raw(base));
 assert.deepEqual(raw(ash),raw(base));
 assert.equal(base.userData.displayCut,'legacy comparison edge');
 assert.equal(neutral.userData.displayCut,'neutral display edge');
 const reclass=find(base,'trim').geometry.getAttribute('position').count/3-find(neutral,'trim').geometry.getAttribute('position').count/3;
 assert.equal(reclass,find(neutral,'back').geometry.getAttribute('position').count/3-find(base,'back').geometry.getAttribute('position').count/3);
 assert.ok(reclass>0);
 const outer=[4.06,1.42,4], top=[.57,5.40,4];
 for(const coord of [outer,top]){
  assert.equal(hit(base,coord).object.userData.role,'trim');
  assert.equal(hit(neutral,coord).object.userData.role,'back');
 }
 for(const w of doironEntryOpeningCue()){
  const coord=[w.x0-.026,(w.y0+w.y1)*.5,4];
  const before=hit(base,coord),after=hit(neutral,coord);
  assert.equal(before.object.userData.role,'trim');assert.equal(after.object.userData.role,'trim');
  assert.deepEqual(before.point,after.point);
 }
 for(const m of ash.children){
  const r=m.userData.role,n=find(neutral,r);
  if(r==='shingle')assert.equal(m.material.color.getHex(),0x747570);
  else assert.ok(m.material.color.equals(n.material.color),r);
 }
});
