import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {emitMontagueHall,HALL_ROLES,MONTAGUE_HALL_STYLE,montagueHallModel} from '../src/render/montague-hall.ts';
import {MONTAGUE_HALL as q} from '../src/render/montague-hall.generated.ts';

test('Montague replaces only the exact, unchanged Hall atlas feature',()=>{
 const lookup=(hash=q.atlasSha256 as string,tile=q.tile as string,ordinal=q.ordinal as number,ring=q.source as readonly (readonly [number,number])[])=>
  montagueHallModel(hash,tile,ordinal,ring);
 assert.equal(lookup(),q);
 assert.equal(lookup('different-atlas'),undefined);
 assert.equal(lookup(q.atlasSha256,'q10330'),undefined);
 assert.equal(lookup(q.atlasSha256,q.tile,350),undefined);
 assert.equal(lookup(q.atlasSha256,q.tile,q.ordinal,[...q.source].reverse()),undefined);
 assert.equal(montagueHallModel(q.atlasSha256,q.tile,q.ordinal,q.source,[q.source]),undefined);
});

test('three former fire bays have real near-plane openings on sloping ground',()=>{
 const [v,w]=[q.ring[q.frontEdge],q.ring[0]],a=new THREE.Vector2(...v),b=new THREE.Vector2(...w);
 const tangent=new THREE.Vector2().subVectors(b,a).normalize(),inward=new THREE.Vector3(-tangent.y,0,tangent.x);
 const length=a.distanceTo(b),P:number[]=[],role:number[]=[];
 const slope=([x,z]:[number,number])=>9.05+.07*tangent.dot(new THREE.Vector2(x-v[0],z-v[1]));
 emitMontagueHall(q,(x,z)=>slope([x-q.originXZ[0],z-q.originXZ[1]]),(p,y,_c,_u,_v,r,s)=>{
  assert.equal(s,MONTAGUE_HALL_STYLE);
  assert(Number.isFinite(y));
  P.push(p.x-q.originXZ[0],y,p.z-q.originXZ[1]);role.push(r);
 });
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));
 const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
 const ray=new THREE.Raycaster();
 for(let i=0;i<3;i++){
  const d=.63+(length-1.26)*(i+.5)/3+.19;
  const o=new THREE.Vector3(v[0]+d*tangent.x,11.37,v[1]+d*tangent.y).addScaledVector(inward,-1);
  ray.set(o,inward);
  const hit=ray.intersectObject(m)[0];
  assert(hit?.face,'A bay must have a real visible inside surface');
  assert.equal(role[hit.face.a],HALL_ROLES.glass);
  assert(Math.abs(hit.distance-1.29)<.00005);
 }
 const x=0.52,z=-0.23;
 ray.set(new THREE.Vector3(x,60,z),new THREE.Vector3(0,-1,0));
 const hits=ray.intersectObject(m).filter(h=>h.face&&role[h.face.a]===HALL_ROLES.roof);
 assert(hits.length>=1);
 assert(hits.every(h=>Math.abs(h.point.y-(q.plane[0]+x*q.plane[1]+z*q.plane[2]))<.00001));
 g.dispose();m.material.dispose();
});
