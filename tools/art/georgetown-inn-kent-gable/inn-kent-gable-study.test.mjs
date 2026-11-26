import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Box3,FrontSide,MeshStandardMaterial,Raycaster,ShaderLib,Vector3} from 'three';
import {INN_KENT_STUDY,kentGableObservedOpenings,makeKentGableSpecimen} from './inn-kent-gable-study.ts';
import {makeKentGlass,patchKentGlass} from './inn-kent-glass.ts';

const close=(a,b,width=1e-6)=>assert.ok(Math.abs(a-b)<width,a+' vs '+b);
const find=(g,r)=>g.children.find(m=>m.userData.role===r);
const role=h=>h?.object.userData.role;
const bytes=a=>Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength);
function first(g,origin,ray=[0,0,-1]){
 return new Raycaster(new Vector3(...origin),new Vector3(...ray).normalize(),0,120).intersectObject(g,true)[0];
}
test('positive standalone archival gable source: exact 791 tris / 7 roles, no attachment or lower building',()=>{
 const g=makeKentGableSpecimen(), rows={blueLap:56,displaySlice:21,paintedCase:300,reveal:88,glass:10,friezeAccent:304,charcoalRoof:12};
 assert.equal(g.parent,null);assert.equal(g.userData.installAuthority,false);assert.equal(g.userData.placement,false);
 assert.deepEqual(Object.fromEntries(g.children.map(m=>[m.userData.role,m.geometry.attributes.position.count/3])),rows);
 assert.equal(Object.values(rows).reduce((a,b)=>a+b,0),791);
 assert.match(INN_KENT_STUDY.scope,/Ground floor, porch, lower annex/);
 const b=new Box3().setFromObject(g);
 close(b.min.x,-5.904);close(b.max.x,5.904);
 close(b.min.y,2.52);close(b.max.y,8.905);
 close(b.min.z,-.588);close(b.max.z,.316);
 assert.equal(first(g,[.25,2.37,15]),undefined);
 assert.equal(first(g,[5.8,4.6,15]),undefined);
 for(const c of g.children){
  const m=c.material;assert.equal(m.side,FrontSide);assert.equal(m.opacity,1);assert.equal(m.transparent,false);
  assert.equal(m.map,null);assert.equal(c.geometry.index,null);
  const {position:p,normal:n,uv:u}=c.geometry.attributes;
  assert.equal(p.count,n.count);assert.equal(n.count,u.count);assert.equal(p.count%3,0);
  for(const a of [p,n,u])assert.ok(a.array.every(Number.isFinite));
  const a=(f,j)=>new Vector3(f.getX(j),f.getY(j),f.getZ(j));
  for(let j=0;j<p.count;j+=3){
   const o=a(p,j),r=a(p,j+1),s=a(p,j+2),w=r.clone().sub(o).cross(s.clone().sub(o));
   assert.ok(w.length()>1e-7,c.name);
   assert.ok(w.normalize().dot(a(n,j))>1.-1e-6);
   if(c.userData.role==='charcoalRoof'){
    for(const [a,b] of [[j,j+1],[j+1,j+2],[j,j+2]]){
     const dp=Math.hypot(p.getX(a)-p.getX(b),p.getY(a)-p.getY(b),p.getZ(a)-p.getZ(b));
     const dq=Math.hypot(u.getX(a)-u.getX(b),u.getY(a)-u.getY(b));close(dp,dq,1.5e-6);
    }
   }
  }
 }
});

test('five corroborated sash groups have actual case relief and opaque glass behind',()=>{
 const g=makeKentGableSpecimen(), s=kentGableObservedOpenings();
 g.updateMatrixWorld(true);
 assert.deepEqual(s.map(x=>x.label),['middle-left','middle-center','middle-right','attic-left','attic-right']);
 for(const w of s){
  const x=(w.minX+w.maxX)/2,y=w.minY+(w.maxY-w.minY)*.28;
  const hit=first(g,[x,y,16]);
  assert.equal(role(hit),'glass');close(hit.point.z,-.143);
  const casing=first(g,[w.minX-.032,y,16]);
  assert.equal(role(casing),'paintedCase');close(casing.point.z,.044);
  const middle=first(g,[x,w.minY+(w.maxY-w.minY)*.509,16]);
  assert.equal(role(middle),'paintedCase');close(middle.point.z,-.108);
 }
 const oval=first(g,[-.292,6.67,12]);
 assert.equal(role(oval),'reveal');close(oval.point.z,.074);
 assert.ok(s.every(w=>w.minY>3.2));
 s[0].minX=99;assert.ok(kentGableObservedOpenings()[0].minX<0);
});

test('ordinary and near-edge rays hit opaque solid coupon, both roof planes and two eave returns',()=>{
 const g=makeKentGableSpecimen();g.updateMatrixWorld(true);
 const crease=3.05/5.65;
 for(const sign of [-1,1]){
  const x=sign*2.1, top=first(g,[x,10,-.18],[0,-1,0]);
  assert.equal(role(top),'charcoalRoof');
  close(top.point.y,8.905-crease*Math.abs(x));
  assert.equal(Math.sign(top.face.normal.x),sign);
  assert.ok(top.face.normal.y>.87);
  // Forward of original slope profile: the separate horizontal return
  // knee and weathering lip occupy real positive closure on each side.
  const ext=first(g,[5.25*sign,9,.302],[0,-1,0]);
  assert.equal(role(ext),'charcoalRoof');assert.ok(ext.point.y>5.67&&ext.point.y<5.75);
  const cornice=first(g,[5.26*sign,5.565,12]);
  assert.equal(role(cornice),'paintedCase');
 }
 let rays=0;
 for(let x=-5.52;x<5.53;x+=.169){
  for(let y=2.536;y<5.75+3.05*(1-Math.abs(x)/5.65)-.036;y+=.187){
   const h=first(g,[x,y,12]);
   assert.ok(h,[x,y]);
   assert.ok(h.point.z>=-.14300001,[x,y,h.point.z]);
   const rev=first(g,[x,y,-12],[0,0,1]);
   assert.equal(role(rev),'displaySlice');rays++;
  }
 }
 assert.ok(rays>1300);
});

test('all ordinary roles and renderer callbacks are independent of optional original ornaments',()=>{
 const on=makeKentGableSpecimen(), off=makeKentGableSpecimen({ornament:false});
 assert.equal(on.children.length,7);assert.equal(off.children.length,6);assert.equal(find(off,'friezeAccent'),undefined);
 for(const r of off.children){
  const o=find(on,r.userData.role);
  for(const name of ['position','normal','uv'])assert.deepEqual(bytes(o.geometry.attributes[name]),bytes(r.geometry.attributes[name]));
 }
 const token=new MeshStandardMaterial();
 const original=makeKentGableSpecimen({materialFor:role=>role==='paintedCase'?token:undefined});
 assert.equal(find(original,'paintedCase').material,token);assert.notEqual(find(original,'charcoalRoof').material,token);
});

test('glazing color only, pinned Three r187 source; unchanged alpha, sampler and geometry contract',()=>{
 const {fragmentShader:f}=ShaderLib.standard, q=patchKentGlass(f);
 assert.ok(q);assert.match(q,/reflect\(-e,n\)/);assert.match(q,/inverseTransformDirection/);
 assert.equal(q.split('outgoingLight=').length,f.split('outgoingLight=').length+1);
 assert.equal(patchKentGlass(q),undefined);assert.equal(patchKentGlass(f+'\n#include <opaque_fragment>'),undefined);
 for(const t of [/\buniform\b/g,/\bsampler(?:2D|Cube)\b/g,/diffuseColor\.a/g,/\bdiscard\b/g]){
  assert.equal((f.match(t)??[]).length,(q.match(t)??[]).length);
 }
 const u={owner:{value:1}}, shader={fragmentShader:f,uniforms:u};
 const m=makeKentGlass();m.onBeforeCompile(shader,{});
 assert.equal(shader.fragmentShader,q);assert.equal(shader.uniforms,u);
 assert.equal(m.transparent,false);assert.equal(m.map,null);assert.equal(m.side,FrontSide);
});
