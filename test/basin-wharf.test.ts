import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {project} from '../src/sim/geo.ts';
import {BASIN_WHARF_SECTIONS as S} from '../src/render/basin-wharf.generated.ts';
import {BASIN_WHARF_RENDER_LIFT as lift,createBasinWharf} from '../src/render/basin-wharf.ts';

function sample(i:number,s:number,t:number){
 const a=S[i],b=S[i+1],p=project(a[2][0],a[2][1]),q=project(a[3][0],a[3][1]);
 const r=project(b[2][0],b[2][1]),w=project(b[3][0],b[3][1]);
 const at=(k:'x'|'z')=>(p[k]*(1-t)+q[k]*t)*(1-s)+(r[k]*(1-t)+w[k]*t)*s;
 return {x:at('x'),z:at('z'),y:a[1]*(1-s)+b[1]*s};
}

test('Basin Head outer deck follows the scoped surveyed sections with no open tops',()=>{
 const group=createBasinWharf(()=>1,()=>true,-.055);
 group.updateMatrixWorld(true);
 assert.equal(group.children.length,2);
 assert.equal(S.at(-1)?.[0]-S[0][0],47.1);
 const deck=group.children[0],ray=new THREE.Raycaster();
 let checks=0;
 for(let i=0;i<S.length-1;i++)for(let j=1;j<=9;j++)for(let k=1;k<=9;k++){
  const {x,y,z}=sample(i,j/10,k/10);
  ray.set(new THREE.Vector3(x,10,z),new THREE.Vector3(0,-1,0));
  const h=ray.intersectObject(deck,false)[0]?.point.y;
  assert.ok(Math.abs(h-y-lift)<.0008,`open or mis-seated deck at ${i}/${j}/${k}`);
  checks++;
 }
 assert.equal(checks,(S.length-1)*81);
});

test('Basin Head timber face reaches grade or below water without guessing its depth',()=>{
 const grade=.88,water=-.055;
 const d=createBasinWharf(()=>grade,()=>true,water),w=createBasinWharf(()=>water,()=>false,water);
 const low=(o:THREE.Group)=>new THREE.Box3().setFromObject(o).min.y;
 d.updateMatrixWorld(true);w.updateMatrixWorld(true);
 assert.ok(Math.abs(low(d)-(water-.27))<.0003);
 assert.ok(Math.abs(low(w)-(water-.27))<.0003);
 const buried=createBasinWharf(()=>4,()=>true,water);
 buried.updateMatrixWorld(true);
 assert.ok(Math.abs(low(buried)-(water-.27))<.0003,'Frontage low limit is visual, not raw underwater support');
 const count=(o:THREE.Group)=>(o.children[1] as THREE.Mesh).geometry.getAttribute('position').count;
 assert.equal(count(d),count(w));
 assert.ok(count(w)<1800);
});
