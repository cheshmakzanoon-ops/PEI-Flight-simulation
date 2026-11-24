import fs from 'node:fs';
import * as T from 'three';
import {buildCityHall} from './src/cityhall-model.ts';
const {model,count}=buildCityHall(false);model.updateMatrixWorld(true);
const box=new T.Box3().setFromObject(model,true),A=new T.Vector3(),B=new T.Vector3(),C=new T.Vector3(),D=new T.Vector3();
let triangles=0,nonFinite=0,zeroArea=0,nonUnit=0,uvNonFinite=0;
const units={};
for(const m of model.children){
 if(m.name.startsWith('historical'))throw new Error('Annex must not be in default art');
 const g=m.geometry,p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=g.getAttribute('uv');
 if(p.count%3||p.count!==n.count||p.count!==uv.count)throw new Error('inconsistent typed attributes');
 triangles+=p.count/3;units[m.name]=p.count/3;
 for(let i=0;i<p.count;i+=3){
  A.fromBufferAttribute(p,i);B.fromBufferAttribute(p,i+1);C.fromBufferAttribute(p,i+2);
  const a=B.sub(A).cross(C.sub(A)).lengthSq();if(!Number.isFinite(a))nonFinite++;
  if(a<1e-19)zeroArea++;
  for(let j=0;j<3;j++){
   D.fromBufferAttribute(n,i+j);
   if(Math.abs(D.lengthSq()-1)>.000025)nonUnit++;
   if(!Number.isFinite(uv.getX(i+j)+uv.getY(i+j)))uvNonFinite++;
  }
 }
}
const acceptance=Object.values(count).reduce((a,b)=>a+b,0)===triangles && !nonFinite && !zeroArea && !nonUnit && !uvNonFinite;
const data={detached:true,modelBatches:model.children.length,triangleCount:triangles,normalVectorsOffUnit:nonUnit,zeroArea,nonFinite,nonFiniteUV:uvNonFinite,localExtents:[box.min.toArray(),box.max.toArray()],regions:count,acceptance};
fs.mkdirSync('proof',{recursive:true});fs.writeFileSync('proof/structural-check.json',JSON.stringify(data,null,2)+'\n');console.log(data);
if(!acceptance)process.exitCode=1;
