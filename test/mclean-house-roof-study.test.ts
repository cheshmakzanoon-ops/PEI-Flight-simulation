import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import * as T from 'three';
import {MCLEAN_UPPER_HIP as data} from '../tools/art/mclean-house-roof-study/mclean-upper-hip.generated.ts';
import {createMcLeanHistoricBellStudy as create,MCLEAN_BELL_ROLE as named} from '../tools/art/mclean-house-roof-study/mclean-historic-bell-study.ts';
const byte=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength),sum=a=>createHash('sha256').update(a).digest('hex');
const P=(g,i)=>new T.Vector3().fromBufferAttribute(g.getAttribute('position'),i);
const key=v=>byte(new Float32Array(v.toArray())).toString('hex');
const files=new URL('../tools/art/mclean-house-roof-study/',import.meta.url);
test('exact licensed upper F32 retained, historic only thereafter',()=>{
 assert.equal(sum(readFileSync(new URL('mclean-upper-hip.generated.ts',files))),'40e5b8bb4f031cb06a1e7d7b1017aaf683225a1cbf15eb0db166b4df036f68d7');
 const E=new Float32Array(data.indices.slice(6).flatMap(i=>[data.vertices[i][0],data.vertices[i][1]-data.baseY,data.vertices[i][2]]));
 for(const tune of ['near','mid']){
  const a=create(tune),g=a.mesh.geometry;assert(!a.mesh.parent&&!a.scope.worldPlacement&&!a.scope.currentConditionClaim);
  assert(!a.scope.hasFoundationOrAnnex&&!a.scope.physicalOrLegalPlanAuthority&&Object.isFrozen(a.scope));
  const p=g.getAttribute('position').array;
  assert.deepEqual(byte(p.slice(0,E.length)),byte(E));
  assert.equal(Math.max(...Array.from(p).filter((_,i)=>i%3===1)),Math.fround(25.94363817444785-23.8));
  assert(g.boundingBox.min.y<0 && g.boundingBox.min.y>-2.00);
  a.close();
 }
});
test('closed edge oriented, all Float32 triangle roles outward, fixed maximum enlarged silhouette',()=>{
 const clos=[];
 for(const [quality,n,wantBell] of [['near',88,72],['mid',56,40]]){
  const a=create(quality),g=a.mesh.geometry,verts=g.getAttribute('position'),nrm=g.getAttribute('normal'),p=new Map(),map=new Map(),counts=[0,0,0,0];
  let signedVolume=0,tops=0;
  const role=g.getAttribute('mcBRole'),outside=1.20044;
  const sq=Array.from({length:4},(_,i)=>new T.Vector2(data.vertices[i][0],data.vertices[i][2]));
  function signedOutside(v){
   return Math.max(...sq.map((a,i)=>{
    const t=sq[(i+1)%4].clone().sub(a).normalize();
    return (v.x-a.x)*t.y-(v.z-a.y)*t.x;
   }));
  }
  for(let i=0;i<verts.count;i+=3){
   const pp=[P(g,i),P(g,i+1),P(g,i+2)], [a,b,c]=pp;
   const normal=new T.Vector3().subVectors(b,a).cross(new T.Vector3().subVectors(c,a)),rr=role.getX(i);
   assert(Number.isInteger(rr)&&rr>=0&&rr<=3);
   assert.equal(rr,role.getX(i+1));assert.equal(rr,role.getX(i+2));
   assert(normal.length()>.005);
   for(let j=0;j<3;j++){
    const given=new T.Vector3().fromBufferAttribute(nrm,i+j);
    assert(Math.abs(given.length()-1)<1e-6);
    assert(given.dot(normal.clone().normalize())>.90);
    assert(signedOutside(pp[j])<=outside);
    const aa=key(pp[j]),bb=key(pp[(j+1)%3]);p.set(aa,pp[j]);p.set(bb,pp[(j+1)%3]);
    const edge=[aa,bb].sort().join('|');map.set(edge,[...(map.get(edge)??[]),aa<bb]);
   }
   counts[rr]++;
   if(rr===named.hip || rr===named.bell){assert(normal.y>0);tops+=normal.y/2;}
   else if(rr===named.shadowEdge)assert(Math.abs(normal.y)<1e-7);
   else assert(normal.y<0);
   signedVolume+=a.dot(b.clone().cross(c))/6;
  }
  assert.equal(a.triangles,n);assert.deepEqual(counts,[6,wantBell,8,2]);
  assert.equal(verts.count/3,n);
  assert.equal(p.size-map.size+n,2);
  assert([...map.values()].every(x=>x.length===2 && x[0]!==x[1]));
  assert(signedVolume>160&&signedVolume<205);
  const baseRingArea=[...Array(4)].map((_,i)=>sq[i].cross(sq[(i+1)%4])).reduce((a,b)=>a+b)*.5;
  assert(tops>baseRingArea+25);
  clos.push([g.boundingBox.min.toArray(),g.boundingBox.max.toArray(),tops]);
  a.close();
 }
 assert.deepEqual(clos[0].slice(0,2),clos[1].slice(0,2));
 assert(Math.abs(clos[0][2]-clos[1][2])<1e-10); // different Float64 summation orders for identical F32 plan
});
test('one opaque front-sided draw, owned non-indexed attributes, no images or scene touches',()=>{
 const a=create(),b=create('mid'),m=a.mesh.material,g=a.mesh.geometry;
 assert.equal(a.mesh.material.type,'MeshStandardMaterial');
 assert(!Array.isArray(m)&&g.groups.length===0&&g.index===null);
 assert(m.side===T.FrontSide&&m.depthTest&&m.depthWrite&&!m.transparent&&m.opacity===1&&!m.alphaToCoverage);
 assert(!m.map&&!m.normalMap&&!m.roughnessMap&&!m.envMap&&!m.alphaMap&&!a.mesh.castShadow&&!a.mesh.receiveShadow);
 assert.deepEqual(Object.keys(g.attributes).sort(),['color','mcBCourse','mcBRole','normal','position']);
 for(const p of Object.values(g.attributes)){assert.equal(p.count,88*3);assert(p.array.every(Number.isFinite));}
 assert.notEqual(a.mesh.material,b.mesh.material);
 assert.throws(()=>create('imagined'),/quality/);
 const scene=new T.Scene();scene.add(a.mesh,b.mesh);
 let n=0;a.mesh.geometry.addEventListener('dispose',()=>n++);m.addEventListener('dispose',()=>n++);
 a.close();a.close();
 assert.equal(n,2);assert.deepEqual(scene.children,[b.mesh]);b.close();assert.equal(scene.children.length,0);
});
test('CPU Three outside-front rays hit actual hip and continuously curved bell, closed from below',()=>{
 const a=create(),mesh=a.mesh;mesh.updateMatrixWorld(true);
 const ray=(x,z,down=true)=>{
  const rr=new T.Raycaster(new T.Vector3(x,down?7:-7,z),new T.Vector3(0,down?-1:1,0));
  return rr.intersectObject(mesh).map(h=>[h.point.y,mesh.geometry.getAttribute('mcBRole').getX(h.face.a)]);
 };
 const center=ray(1.2,3.4);
 assert(center.length>=1&&center[0][0]>0&&center[0][1]===named.hip);
 for(const [x,z] of [[-.95,3.0],[5.89,2.4],[2,-1.36],[2,8.51]]){
  const hits=ray(x,z);assert(hits.length>=1&&hits[0][0]<-.12&&hits[0][1]===named.bell);
  const hits2=ray(x,z,false);assert(hits2.length>=1&&hits2[0][0]<-1.98&&hits2[0][1]===named.artificialClosure);
 }
 assert.deepEqual(ray(-2.25,3.4),[]);a.close();
});
test('shader edits only exact role insertion, derivative precedes role branch',()=>{
 const a=create(),m=a.mesh.material;
 const candidate={vertexShader:'void main(){\n#include <color_vertex>\n}',fragmentShader:'void main(){\n#include <color_fragment>\n}'};
 m.onBeforeCompile(candidate,undefined);
 assert.equal(candidate.fragmentShader.split('fwidth(micro)').length,2);
 assert(candidate.fragmentShader.indexOf('float mcBFilter=mcBRoofResponse')<candidate.fragmentShader.indexOf('if(mcBvRole<1.5)'));
 assert.equal(candidate.fragmentShader.split('#include <color_fragment>').length,2);
 const refuse={vertexShader:'// unsupported',fragmentShader:'#include <color_fragment>'};const a0={...refuse};
 m.onBeforeCompile(refuse,undefined);assert.deepEqual(refuse,a0);a.close();
});

import {createMcLeanUpperHipWitness} from '../tools/art/mclean-house-roof-study/mclean-upper-hip.ts';
test('upper hip has an eight-triangle closed witness, not an inferred eave',()=>{
 const scene=createMcLeanUpperHipWitness();
 try{
  assert.equal(scene.triangles,8);
  assert.equal(scene.mesh.parent,null);
  const {geometry:g,material:m}=scene.mesh;
  assert.equal(g.getAttribute('position').count,24);
  assert.equal(g.getAttribute('hipRoof').array.reduce((a,b)=>a+b,0),18);
  assert.equal(m.side,T.FrontSide);assert.equal(m.transparent,false);
  assert.equal(g.boundingBox!.min.y,0);
  assert(g.boundingBox!.max.y>2.14&&g.boundingBox!.max.y<2.15);
 }finally{scene.close();}
});

test('McLean workbench preserves actual stock roles and is detached from the app',()=>{
 const file=new URL('../docs/qa/mclean-house-inn/native-receipt.json',import.meta.url);
 const r=JSON.parse(readFileSync(file,'utf8'));
 assert.equal(r.gameChanges,false);
 assert.deepEqual(r.realStockFlight.map(({metres,roofFull,wallFull,restoredRGBA})=>[metres,roofFull,wallFull,restoredRGBA]),
  [[215,330,1859,true],[315,1290,4369,true],[405,0,0,true]]);
 assert.deepEqual(r.closedRoofStudy.map(({triangles,calls,error})=>[triangles,calls,error]),[[88,1,0],[88,1,0],[56,1,0]]);
 const f=readFileSync(new URL('../src/render/buildings.ts',import.meta.url),'utf8');
 assert(!f.includes('mclean-house-roof-study')&&!f.includes('peiMatthewQAWho'));
});
