import fs from 'node:fs';
import crypto from 'node:crypto';
import {Mesh,Raycaster,Vector3} from 'three';
import {makeRoofWitness} from './roof-witness.ts';
const target=fs.readFileSync(new URL('./fit-sealed.json',import.meta.url));
const hash=(s)=>crypto.createHash('sha256').update(s).digest('hex');
const {group,roleUv,skipped,minUpNormal}=makeRoofWitness(JSON.parse(target.toString()));
const emitterHash=hash(fs.readFileSync(new URL('./roof-witness.ts',import.meta.url)));
const meshes=group.children.map(m=>{
 const p=m,geo=p.geometry;
 const pa=geo.getAttribute('position'),na=geo.getAttribute('normal'),ua=geo.getAttribute('uv');
 if(pa.count%3||ua.count!==pa.count||na.count!==pa.count)throw new Error('Bad emitted attributes');
 return {role:m.name,vertexCount:pa.count,positions:Array.from(pa.array),normal:Array.from(na.array),uv:Array.from(ua.array)};
});
const witnesses={emitterHash,fitRecipeHash:hash(target),matrixColumnMajorF64:group.matrixWorld.toArray(),minUpNormal,roleUv,skipped,meshes};
const save=(name,o)=>{const bytes=JSON.stringify(o)+'\n';fs.writeFileSync(name,bytes);return hash(bytes);};
const meshReceipt=save('emitted-roof-proof.json',witnesses);
if(!process.stdin.isTTY){
 const a=fs.readFileSync(0,'utf8').trim();
 if(a){
   const data=JSON.parse(a);
   const rc=new Raycaster();
   const stat={};
   const percentile=(nums,p)=>{
    if(nums.length===0)return null;
    const r=nums.slice().sort((a,b)=>a-b),i=(r.length-1)*p,l=Math.floor(i),f=i-l;
    return +((1-f)*r[l]+f*r[Math.min(l+1,r.length-1)]).toFixed(5);
   };
   for(const [name,rows] of Object.entries(data)){
     let misses=0;const hits={},err=[];
     for(const p of rows){
       rc.set(new Vector3(p[2],80,p[4]),new Vector3(0,-1,0));
       const top=rc.intersectObject(group,true)[0];
       if(!top){misses++;continue;}
       const t=top.object.name;hits[t]=(hits[t]??0)+1;
       err.push(top.point.y-p[3]);
     }
     stat[name]={n:rows.length,misses,hits,absP50:percentile(err.map(Math.abs),.5),absP90:percentile(err.map(Math.abs),.9),bias:percentile(err,.5)};
   }
   save('emitted-training-ray-summary.json',{emitterHash,meshReceipt,heldRead:false,roles:stat});
 }
}
console.log(JSON.stringify({emitterHash,fitRecipeHash:hash(target),meshReceipt,meshes:meshes.map(({role,vertexCount})=>[role,vertexCount]),minUpNormal},null,2));
