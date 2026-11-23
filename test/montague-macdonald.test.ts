import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {emitMacdonaldShell,MACDONALD_ROLES,MACDONALD_STYLE,montagueMacdonaldModel} from '../src/render/montague-macdonald.ts';
import {MONTAGUE_MACDONALD as model} from '../src/render/montague-macdonald.generated.ts';

test('Macdonald shell selection is locked to the one original footprint, not the former Hall',()=>{
 const select=(hash=model.atlasSha256 as string,tile=model.tile as string,ordinal=model.ordinal as number)=>
  montagueMacdonaldModel(hash,tile,ordinal,model.source);
 assert.equal(select(),model);
 assert.equal(select('unknown atlas'),undefined);
 assert.equal(select(model.atlasSha256,'q1033'),undefined);
 assert.equal(select(model.atlasSha256,model.tile,232),undefined);
 assert.equal(montagueMacdonaldModel(model.atlasSha256,model.tile,350,[...model.source].reverse()),undefined);
 assert.equal(montagueMacdonaldModel(model.atlasSha256,model.tile,350,model.source,[model.source]),undefined);
});

test('viewed through the actual open verandah, returning timber and glass lie inside the original plan',()=>{
 const near: number[]=[],type:number[]=[];
 const [X,Z]=model.originXZ,P=model.outline;
 emitMacdonaldShell(model,(_x,z)=>12.48+.06*(z-Z),(p,y,_c,_u,_v,r,s)=>{
  assert.equal(s,MACDONALD_STYLE);
  for(let j=0;j<P.length;j++){
   const a=P[j],b=P[(j+1)%P.length];
   const margin=(b[0]-a[0])*(p.z-Z-a[1])-(b[1]-a[1])*(p.x-X-a[0]);
   assert(margin>-.000001);
  }
  assert(Number.isFinite(y));
  near.push(p.x-X,y,p.z-Z);type.push(r);
 });
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(near,3));
 const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
 const [a,b]=P.slice(2),u=b[0]-a[0],v=b[1]-a[1],length=Math.hypot(u,v);
 const tangent=new THREE.Vector3(u/length,0,v/length),inward=new THREE.Vector3(-v/length,0,u/length);
 const from=new THREE.Vector3(a[0],14.14,a[1]).addScaledVector(inward,-.25);
 let hits=0;
 const ray=new THREE.Raycaster();
 for(const along of [4.32,6.56,8.85,11.52,12.03]){
  ray.set(from.clone().addScaledVector(tangent,along),inward);
  const h=ray.intersectObject(m)[0];
  assert(h?.face&&h.distance>1.25);
  assert([MACDONALD_ROLES.siding,MACDONALD_ROLES.glass].some(k=>k===type[h.face?.a??-1]));
  hits++;
 }
 assert.equal(hits,5);
 g.dispose();m.material.dispose();
});
