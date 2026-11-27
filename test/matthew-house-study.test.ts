/** CPU-only detached structural, topology, depth, bounds and budget checks. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createMatthewSouthCraftStudy} from '../tools/art/matthew-house-study/matthew-house-south-craft.ts';
const s=new T.Vector3(.35,.82,.27);
const e=Object.freeze({width:11.055,bottom:0,eave:6.35,depthLimit:.94});
const packed=(geom,v)=>geom.attributes.matthewRole.getX(v);
const roleSet=g=>new Set(g.getAttribute('matthewRole').array);
const ps=(g,k)=>new T.Vector3().fromBufferAttribute(g.getAttribute('position'),k);
const hy=(b,w)=>b+(w-b)*.335;
function checkMesh(b,e,limit){
 const m=b.mesh,g=m.geometry;
 assert(!m.parent&&m.isMesh&&m.material.isShaderMaterial);
 assert.equal(m.material.depthWrite,true);
 assert.equal(m.material.transparent,false);
 assert.equal(m.material.side,T.FrontSide);
 assert.deepEqual(Object.keys(m.material.uniforms),['matthewSun']);
 assert.equal(g.index,null);
 assert.equal(g.groups.length,0);
 assert.equal(g.attributes.position.count/3,b.triangles);assert(b.triangles<=limit);
 assert(g.boundingBox.min.x>=-e.width/2-1e-6&&g.boundingBox.max.x<=e.width/2+1e-6);
 assert(g.boundingBox.min.z>=-.00401&&g.boundingBox.max.z<=e.depthLimit+1e-6);
 assert(g.boundingBox.min.y>=e.bottom-1e-6&&g.boundingBox.max.y<=(e.measuredGableEnd?.peakY??e.eave)+1e-6);
 assert([...Object.values(g.attributes)].every(a=>a.array.every(Number.isFinite)));
 for(let k=0;k<g.attributes.position.count;k+=3){
  const a=ps(g,k),p=ps(g,k+1),q=ps(g,k+2),r=p.sub(a).cross(q.sub(a));
  const n=new T.Vector3().fromBufferAttribute(g.attributes.normal,k);
  assert(r.lengthSq()>1e-13&&r.normalize().dot(n)>.9999,'winding '+k);
  assert.equal(packed(g,k),packed(g,k+1));assert.equal(packed(g,k),packed(g,k+2));
 }
}
test('single opaque owner; physically modeled both bays and cheaper handoff geometry',()=>{
 const a=createMatthewSouthCraftStudy(e,s,'near'),b=createMatthewSouthCraftStudy(e,s,'mid');
 try{
  checkMesh(a,e,6000);checkMesh(b,e,2400);
  assert(b.triangles<a.triangles*.62);
  assert.deepEqual([...roleSet(a.mesh.geometry)].sort(),[0,1,2,3,4,6]);
  assert.deepEqual([...roleSet(b.mesh.geometry)].sort(),[0,1,2,3,4]);
  assert(Math.abs(a.mesh.geometry.boundingBox.max.z-b.mesh.geometry.boundingBox.max.z)<.09);
  assert.deepEqual(s.toArray(),[.35,.82,.27]);
 }finally{a.dispose();b.dispose();}
});
test('cast into each authentic pair of deep opaque glass openings, not through wall',()=>{
 const b=createMatthewSouthCraftStudy(e,s);
 try {
  for(const x of [-e.width*.217,+e.width*.217])for(const y of [hy(e.bottom,e.eave),e.eave*.801]){
   const start=new T.Vector3(x+.23,y,3),R=new T.Raycaster(start,new T.Vector3(0,0,-1));
   const hit=R.intersectObject(b.mesh,false)[0];
   assert(hit&&hit.point.z>.35&&hit.point.z<e.depthLimit,JSON.stringify({x,y,hit:!!hit}));
   assert.equal(packed(b.mesh.geometry,hit.face.a),3);
  }
  const muntin=new T.Raycaster(new T.Vector3(e.width*.217+.23,e.eave*.76,3),new T.Vector3(0,0,-1)).intersectObject(b.mesh,false)[0];
  assert(muntin&&packed(b.mesh.geometry,muntin.face.a)===2);
 }finally{b.dispose();}
});
test('no automatic opposite roof; explicit measured/gable inputs strictly separate',()=>{
 const f={id:'synthetic-test-triangle',sourceEvidence:'CPU fixture only',triangle:[[-.5,7,-.01],[.5,6,0],[.0,6,1]]};
 const a=createMatthewSouthCraftStudy(e,s,'near'),b=createMatthewSouthCraftStudy(e,s,'near',[f]);
 const env={...e,measuredGableEnd:{left:-4.8,right:5.3,peakX:.18,peakY:10.8}};
 const c=createMatthewSouthCraftStudy(env,s,'near');
 try{
  assert.equal(b.triangles-a.triangles,1);
  assert(roleSet(b.mesh.geometry).has(5));
  assert(!roleSet(a.mesh.geometry).has(5)&&!roleSet(c.mesh.geometry).has(5));
  checkMesh(c,env,6000);
  assert.throws(()=>createMatthewSouthCraftStudy({...e,depthLimit:.03},s));
  assert.throws(()=>createMatthewSouthCraftStudy({...e,eave:1},s));
  assert.throws(()=>createMatthewSouthCraftStudy(e,new T.Vector3()));
  assert.throws(()=>createMatthewSouthCraftStudy(e,s,'near',[f,f]));
 }finally{a.dispose();b.dispose();c.dispose();}
});
test('bounds hold across narrower measurement envelopes without enlarging depth',()=>{
 for(const env of [{width:6.8,bottom:.2,eave:5.17,depthLimit:.32},{width:16,bottom:.2,eave:8.07,depthLimit:1.4}]){
  const a=createMatthewSouthCraftStudy(env,s,'near');
  try{checkMesh(a,env,6000);}finally{a.dispose();}
 }
});

import {readFileSync} from 'node:fs';
import {MATTHEW_REGISTERED_FRONT,createMatthewRegisteredFrontStudy} from '../tools/art/matthew-house-study/matthew-house-registered-front-study.ts';

test('registered front has a fenced plan, exact old-owner identity and no scene or roof closure',()=>{
 const c=MATTHEW_REGISTERED_FRONT,a=createMatthewRegisteredFrontStudy(s,'near'),b=createMatthewRegisteredFrontStudy(s,'mid');
 try{
  assert.equal(c.owner,'q130331/0');
  assert.deepEqual(c.stockPreserve,[130,34,60]);
  assert.equal(c.signedOwnerUV.length,7);assert(c.minWholeStudyRectangleToOriginalBoundary>.24);
  assert(Math.abs(c.U[0]*c.V[0]+c.U[1]*c.V[1])<1e-12);
  assert.deepEqual(a.mesh.position.toArray(),[0,0,0]); assert(!a.mesh.parent);
  assert.equal(a.sourceRelation.fullRoof,false);assert.equal(a.mesh.userData.partsNotSurveyed,true);
  assert.equal(a.triangles,2385);assert.equal(b.triangles,1221);
  const x=a.mesh.geometry.boundingBox!;
  assert(x.max.z<c.stageDepthLimit&&x.min.z>=-.0041&&x.max.y<=Math.fround(c.observedC6TopAbsY-c.receiverNominalDisplayY));
  assert(!a.mesh.material.transparent);
 }finally{a.dispose();b.dispose();}
});

test('published native Matthew QA receipt keeps the two stock owners separate',()=>{
 const file=new URL('../docs/qa/matthew-house/native-receipt.json',import.meta.url);
 const j=JSON.parse(readFileSync(file,'utf8'));
 assert.equal(j.playableChange,false);
 assert.deepEqual(j.flightOwnerChecks.map(({frame,mainFullPixels,adjacentFullPixels,restoredRGBA})=>
  [frame,mainFullPixels,adjacentFullPixels,restoredRGBA]),[[149,1145,93,true],[180,1823,192,true],[239,0,0,true]]);
 assert.deepEqual(j.studio.map(({tris,calls,error})=>[tris,calls,error]),[[2387,2,0],[2387,2,0],[1223,2,0]]);
 const r=readFileSync(new URL('../src/render/buildings.ts',import.meta.url),'utf8');
 assert(!r.includes('matthew-house-study')&&!r.includes('peiMatthewQAWho'));
});
