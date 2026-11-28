import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync as read} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {makeWoodIslandsDetached,woodDimensions as K,woodStudioGround} from './wood-islands.ts';
const x=makeWoodIslandsDetached(),g=x.geometry,P=g.attributes.position,N=g.attributes.normal,Tints=g.attributes.pigment,R=g.attributes.paintRole;
const st=i=>new T.Vector3(P.getX(i),P.getY(i),P.getZ(i)),nt=i=>new T.Vector3(N.getX(i),N.getY(i),N.getZ(i));
const raw=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength),sha=a=>createHash('sha256').update(a).digest('hex');
test('real meters, no world or additional seat, literal valid F32 role geometry and siding normals',()=>{
 assert.equal(P.count/3,4160);assert(P.array.every(Number.isFinite)&&N.array.every(Number.isFinite)&&Tints.array.every(Number.isFinite));
 assert(g.index===null&&x.mesh.parent===null&&x.mesh.children.length===0&&g.groups.length===0);
 assert.equal(x.mesh.position.lengthSq(),0);
 assert.equal(K.towerBaseM,6.3);assert.equal(K.houseWidth,4.8);assert.equal(K.houseRidge,7.6);
 assert(Math.abs(g.boundingBox.min.x+3.15)<1e-6);assert.equal(g.boundingBox.min.y,0);
 assert(Math.abs(g.boundingBox.max.y-K.overallY)<1e-6);
 let min=Infinity,minW=Infinity;
 for(let i=0;i<P.count;i+=3){
  const U=st(i+1).sub(st(i)),V=st(i+2).sub(st(i)),n=U.cross(V);
  const area=n.length();min=Math.min(min,area);
  assert.equal(R.getX(i),R.getX(i+1));assert.equal(R.getX(i),R.getX(i+2));
  n.normalize();
  for(let j=0;j<3;j++){const p=nt(i+j);assert(Math.abs(p.length()-1)<1e-6);minW=Math.min(minW,n.dot(p));}
 }
 assert(min>1e-8);assert(minW>.70);
 const floor=woodStudioGround();assert.equal(floor.attributes.position.count,6);floor.dispose();
});
test('actual cut sashes, glazing set back 113mm without mirrored wall cuts',()=>{
 assert.equal(x.apertures.length,15);assert(x.apertures.every(q=>q.recess===.113));
 assert.equal(x.apertures.filter(a=>a.face==='tower-3').length,0,'do not transplant openings to the unobserved upper north face');
 assert.equal(x.apertures.filter(a=>a.face==='wing-road').length,3);
 const a=x.apertures.find(r=>r.face==='tower-0'&&r.kind==='sash'&&r.y>8);
 const y=a.y+a.h*.53,z=-(a.u+.18*a.w),r=new T.Raycaster(new T.Vector3(14,y,z),new T.Vector3(-1,0,0));
 x.mesh.updateMatrixWorld(true);const hit=r.intersectObject(x.mesh,false)[0];assert(hit);
 assert.equal(R.getX(hit.face.a),4,'ray does not hit fake paint over old opaque flank');
 const end=3.15+(2.01-3.15)*(y-K.skirt)/(K.towerTopY-K.skirt)-.113;
 assert(Math.abs(hit.point.x-end)<4e-7);
 const rear=new T.Raycaster(new T.Vector3(0,10,-21),new T.Vector3(0,0,1)).intersectObject(x.mesh,false)[0];
 assert(rear&&R.getX(rear.face.a)===0);
});
test('eight real lantern faces and physical cornice contact; no duplicate overlay on the lower gable',()=>{
 const levels=new Set(),panes=[];
 for(let c=0;c<P.count;c+=3){
  if(R.getX(c)===4&&[0,1,2].every(q=>P.getY(c+q)>13.21)){
   assert([0,1,2].every(q=>Math.abs(N.getY(c+q))<1e-6));panes.push(c);
   levels.add([N.getX(c).toFixed(4),N.getZ(c).toFixed(4)].join(':'));
  }
 }
 assert.equal(panes.length,16);assert.equal(levels.size,8);
 const h=K.towerTopY;
 for(const s of [-1,1])for(const t of [-1,1]){
  const at=[];for(let i=0;i<P.count;i++)if(Math.abs(P.getY(i)-h)<1.e-6&&Math.abs(P.getX(i)-2.01*s)<1.e-6&&Math.abs(P.getZ(i)-2.01*t)<1.e-6)at.push(R.getX(i));
  assert(at.includes(0)&&at.includes(5),'tower and coved cornice do not meet');
 }
});
test('sealed reciprocal device pixels: exact geometry/markers through the lighting polish',()=>{
 const ev=n=>read(new URL('./evidence/'+n,import.meta.url));
 const prior=JSON.parse(ev('first-light-receipt.json'));
 const cur=JSON.parse(ev('receipt.json'));
 assert.deepEqual(prior.actualSubmissionDigests,cur.actualSubmissionDigests);
 assert.equal(prior.planSHA,cur.planSHA);
 assert.notEqual(prior.shaderSHA.fragment,cur.shaderSHA.fragment);
 assert.equal(sha(read(new URL('./POSE-PRELOCK.json',import.meta.url))),cur.planSHA);
 for(const a of Object.keys(g.attributes))
  assert.equal(sha(raw(g.attributes[a].array)),cur.actualSubmissionDigests.subject[a]);
 assert.deepEqual(cur.frame,[1200,760]);assert.equal(cur.sampleCount,4);assert.equal(cur.artTextureCount,0);
 assert.equal(cur.modelDraws,1);assert.equal(cur.sceneDraws,2);assert.equal(cur.r187,T.REVISION);
 for(const [i,v] of cur.views.entries()){
  assert.equal(v.markerSHA256,prior.views[i].markerSHA256);
  assert(v.exactColorRepeat&&v.actualModelSilhouettePixels>5000);
  if(i<2){
   assert(v.view.rangeM>110&&v.view.rangeM<145);
   assert.equal(sha(ev(v.image)),v.imageSHA256);
  }
  if(i<2||i===3){
   assert.equal(sha(ev(v.oneToOneCrop)),v.oneToOneCropSHA256);
   assert.equal(sha(ev(v.view.id+'-role.png')),v.markerSHA256);
  }
 }
 assert.equal(sha(ev('wood-islands-two-reciprocal-native-scale.webp')),
  'eaf0319eeddda480ecbf10d4063438132d7e840fe51ea59f2925dc5556cde706');
 assert(!x.material.uniforms.woodSunLocal.value.isTexture);
 x.dispose();x.dispose();
});
