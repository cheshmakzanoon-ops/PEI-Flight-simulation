import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import * as T from 'three';
import {MCLEAN_UPPER_HIP as upper} from '../tools/art/mclean-house-roof-study/mclean-upper-hip.generated.ts';
import {createMcLeanPrincipalHistoricStudy as create,MCLEAN_BODY_ROLES as R} from '../tools/art/mclean-house-roof-study/mclean-principal-body.ts';
const pin=(name,sha)=>assert.equal(createHash('sha256').update(readFileSync(new URL(name,new URL('../tools/art/mclean-house-roof-study/',import.meta.url)))).digest('hex'),sha);
const array=v=>v.toArray(),points=upper.vertices.slice(0,4).map(([x,y,z])=>new T.Vector2(x,z));
const edge=(i)=>{
 const a=points[i],b=points[(i+1)%4],direction=b.clone().sub(a).normalize();
 return {a,b,direction,n:new T.Vector2(direction.y,-direction.x)};
};
const radius=a=>Math.max(...points.map((_,i)=>{const e=edge(i);return (a.x-e.a.x)*e.n.x+(a.z-e.a.y)*e.n.y;}));
test('no mount or textures; exact isolated old roof dependency and two opaque draws',()=>{
 pin('mclean-historic-bell-study.ts','108373e3fa33ab0cbd85c4d8224fdd0aceb06c2bcde61b0fd075f6670335f18f');
 pin('mclean-upper-hip.generated.ts','40e5b8bb4f031cb06a1e7d7b1017aaf683225a1cbf15eb0db166b4df036f68d7');
 const [n,m]=['near','mid'].map(create),s=new T.Scene();
 assert(!n.group.parent&&!n.scope.mount&&n.scope.noImagePixels&&n.scope.noWesternAnnexOrGlazedPorch);
 assert(n.group.children.length===2&&n.group.children.includes(n.body)&&n.group.children.includes(n.roof));
 assert.equal(n.bodyTriangles,2464);assert.equal(n.roofTriangles,88);
 assert.equal(m.bodyTriangles,1972);assert.equal(m.roofTriangles,56);
 assert.equal(n.body.name,'McLean House Inn – detached two-storey principal shell');
 assert.throws(()=>create('unsupported'),/quality/);
 for(const obj of n.group.children){
  const mat=obj.material;assert(!Array.isArray(mat)&&mat.type==='MeshStandardMaterial'&&mat.side===T.FrontSide);
  assert(mat.depthWrite&&mat.depthTest&&mat.opacity===1&&!mat.transparent&&!mat.map&&!mat.roughnessMap&&!mat.normalMap&&!mat.envMap);
  assert(!obj.castShadow&&!obj.receiveShadow&&!obj.geometry.groups.length&&obj.geometry.index===null);
 }
 let events=0;n.group.children.forEach(x=>{x.geometry.addEventListener('dispose',()=>events++);x.material.addEventListener('dispose',()=>events++)});
 s.add(m.group,n.group);n.close();n.close();
 assert.deepEqual(s.children,[m.group]);assert.equal(events,4);m.close();assert.equal(s.children.length,0);
});
test('body is under the detached flare and exact roof underside, no floor or shape protrusion',()=>{
 const envelopes=[];
 for(const q of ['near','mid']){
  const a=create(q),meter=a.body.geometry,xyz=meter.attributes.position,n=meter.attributes.normal,tape=meter.attributes.mcHouseBoard,r=meter.attributes.mcHouseKind;
  assert.equal(xyz.count,a.bodyTriangles*3);
  assert.equal(n.count,xyz.count);assert.equal(r.count,xyz.count);assert.equal(tape.count,xyz.count);
  assert.deepEqual(Object.keys(meter.attributes).sort(),['color','mcHouseBoard','mcHouseKind','normal','position']);
  assert.strictEqual(meter.boundingBox.max.y,a.roof.geometry.boundingBox.min.y);
  assert.strictEqual(meter.boundingBox.min.y,Math.fround(a.loft.foot));
  const range=Array(10).fill(0);
  for(let i=0;i<xyz.count;i+=3){
   const p=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(xyz,i+j));
   const unit=new T.Vector3().subVectors(p[1],p[0]).cross(new T.Vector3().subVectors(p[2],p[0]));
   assert(unit.length()>.0001);
   assert(p.every(t=>radius(t)<1.2&&t.y<=a.loft.top&&t.y>=Math.fround(a.loft.foot)));
   assert(p.every((t,j)=>new T.Vector3().fromBufferAttribute(n,i+j).dot(unit.clone().normalize())>.99999));
   assert(r.getX(i)===r.getX(i+1)&&r.getX(i)===r.getX(i+2));range[r.getX(i)]++;
  }
  assert(range[R.opaqueGlass]>=30&&range[R.reveal]>=120&&range[R.cornice]>=100);
  const outer=new T.Box3().setFromObject(a.group);envelopes.push([...array(outer.min),...array(outer.max)]);
  a.close();
 }
 assert.deepEqual(envelopes[0],envelopes[1]);
});
function cast(f,sz,Y,body,out=true){
 const [x,z]=[f.a.x+f.direction.x*sz,f.a.y+f.direction.y*sz];
 const N=new T.Vector3(f.n.x,0,f.n.y),o=new T.Vector3(x,Y,z).addScaledVector(N,25);
 const rs=new T.Raycaster(o,N.negate());
 return rs.intersectObject(body,Object.assign(false),[]).map(hit=>({
   point:hit.point,normal:hit.face.normal,role:body.geometry.attributes.mcHouseKind.getX(hit.face.a),
   outward:radius(hit.point)
 }));
}
test('known front truly has recessed two-storey bays, centre door and distinct raised oriel',()=>{
 const q=create(),body=q.body,fl=q.loft.foot;body.updateWorldMatrix(true,false);
 const measured=[0,1,2,3].map(i=>edge(i)),F=measured[1];
 const L=F.a.distanceTo(F.b);
 for(const s0 of [.191,.781]){
  const s=L*s0;
  const gl1=cast(F,s,fl+2.13,body),gl2=cast(F,s,fl+5.77,body);
  assert(gl1.length&&gl2.length);
  assert(gl1[0].outward>.92&&gl2[0].outward>.92);
  assert(gl1[0].role===R.opaqueGlass&&gl2[0].role===R.opaqueGlass);
  const apron=cast(F,s,fl+3.94,body);
  assert(apron[0].outward>gl1[0].outward+.09&&apron[0].role===R.cornice);
 }
 const gate=cast(F,L*.52,fl+1.15,body),recess=cast(F,L*.52,fl+5.74,body);
 assert.equal(gate[0].role,R.door);assert(gate[0].outward<.40);
 assert.equal(recess[0].role,R.opaqueGlass);assert(recess[0].outward>.56&&recess[0].outward<.68);
 q.close();
});
test('non-vacuous opaque first hit from all principal sides, top plug and underside',()=>{
 for(const quality of ['near','mid']){
  const b=create(quality);b.group.updateMatrixWorld(true);let attempts=0;
  for(let i=0;i<4;i++){
   const f=edge(i),L=f.a.distanceTo(f.b);
   for(const hs of [.098,.17,.285,.393,.51,.593,.714,.82,.895]){
    for(const y of [.15,.62,1.45,2.17,3.14,4.20,5.47,6.72,7.96]){
     const hits=cast(f,L*hs,b.loft.foot+y,b.body);
     assert(hits.length,JSON.stringify([i,hs,y]));attempts++;
    }
   }
  }
  const path=new T.Vector3(...[(points[0].x+points[2].x)/2,b.loft.foot-2,(points[0].y+points[2].y)/2]);
  const h=new T.Raycaster(path,new T.Vector3(0,1,0)).intersectObject(b.body)[0];
  assert(h&&Math.abs(h.point.y-Math.fround(b.loft.foot))<1e-6);
  assert.equal(attempts,324);
  b.close();
 }
});

test('native principal exhibit is measured and unchanged outside the detached studio',()=>{
 const file=new URL('../docs/qa/mclean-house-inn/principal-receipt.json',import.meta.url);
 const p=JSON.parse(readFileSync(file,'utf8'));
 assert.equal(p.playableChanges,false);
 assert.equal(p.historicScope,'principal body and roof only');
 assert.deepEqual(p.studio.map(({phase,bodyTriangles,roofTriangles,error})=>[phase,bodyTriangles,roofTriangles,error]),
  [['front',2464,88,0],['oblique',2464,88,0],['mid',1972,56,0],['unshadowed',2464,88,0]]);
 const f=readFileSync(new URL('../src/render/buildings.ts',import.meta.url),'utf8');
 assert(!f.includes('mclean-principal-body')&&!f.includes('mcLeanPrivateQA'));
});
