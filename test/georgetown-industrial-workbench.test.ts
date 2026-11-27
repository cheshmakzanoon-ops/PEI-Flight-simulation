import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {Vector3} from 'three';
import {createDetachedGeorgetownPrincipalPlant} from '../tools/art/georgetown-marine-terminal-study/georgetown-plant-principal.ts';
import {createDetachedGeorgetownPlantWorkbenchAssembly} from '../tools/art/georgetown-marine-terminal-study/workbench-assembly/georgetown-plant-workbench.ts';
const sun=()=>new Vector3(-.6,.74,-.31).normalize();
const sha=(a:Float32Array)=>createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
type V=[number,number];
const cross=(a:V,b:V,c:V)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const area=(p:V[])=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0))*.5;
function intersect(a:V[], b:V[]){
 let q=a;
 const sign=Math.sign(cross(b[0],b[1],b[2]));
 for(let i=0;i<b.length&&q.length;i++){
  const c=b[i],d=b[(i+1)%b.length];
  const next:V[]=[];
  for(let j=0;j<q.length;j++){
   const x=q[j],y=q[(j+1)%q.length],p=sign*cross(c,d,x),r=sign*cross(c,d,y);
   if(p>=0)next.push(x);
   if((p>=0)!==(r>=0)){
    const t=p/(p-r);next.push([x[0]+t*(y[0]-x[0]),x[1]+t*(y[1]-x[1])]);
   }
  }
  q=next;
 }
 return area(q);
}
test('Georgetown industrial workbench has one detached, non-overlapping historical roof surface',()=>{
 const a=createDetachedGeorgetownPrincipalPlant(sun()), b=createDetachedGeorgetownPlantWorkbenchAssembly(sun());
 try{
   for(const m of [a,b]){
    assert.equal(m.visible,false);assert.equal(m.parent,null);assert.equal(m.castShadow,false);assert.equal(m.receiveShadow,false);
    assert.equal(m.geometry.index,null);assert.equal(m.geometry.groups.length,0);
    assert.equal(m.material.transparent,false);assert(m.material.depthWrite&&m.material.depthTest);
   }
   assert.deepEqual(a.position.toArray(),b.position.toArray());
   assert.equal(b.material.vertexShader,a.material.vertexShader);
   assert.equal(b.material.fragmentShader,a.material.fragmentShader);
   const original=a.geometry.attributes.position,p=b.geometry.attributes.position,t=b.geometry.attributes.plantPart;
   assert.equal(original.count,504);assert.equal(p.count,720);assert.equal(t.count,720);
   assert.equal(sha(original.array as Float32Array),'0e4b34d59607aa1c5beed48d9252e451b81ccfc47e30c6a5862c3224ebff1eea');
   assert.equal(sha(p.array as Float32Array),'9ea0a698bcd91e5f4c7a3eeb42519adcb87ec6f89cab7b7c1293ade7c3109847');
   const roof:V[][]=[],counts=[0,0,0,0];
   for(let i=0;i<p.count;i+=3){
    const r=t.getX(i);assert(Number.isInteger(r)&&r>=0&&r<=3);
    assert.equal(t.getX(i+1),r);assert.equal(t.getX(i+2),r);counts[r]++;
    if(r<2)roof.push([i,i+1,i+2].map(j=>[p.getX(j),p.getZ(j)]));
   }
   assert.deepEqual(counts,[40,53,37,110]);
   assert(roof.every(q=>area(q)>1e-5));
   for(let i=0;i<roof.length;i++)for(let j=0;j<i;j++){
     assert(intersect(roof[i],roof[j])<1e-10,'Historical rooftop sheets overlap');
   }
 }finally{for(const m of [a,b]){m.geometry.dispose();m.material.dispose();}}
});
