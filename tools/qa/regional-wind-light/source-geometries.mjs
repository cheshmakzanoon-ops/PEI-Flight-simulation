import * as fs from 'node:fs';import {resolve}from'node:path';import {pathToFileURL}from'node:url';import crypto from'node:crypto';
const [repo,out]=process.argv.slice(2);const imp=x=>import(pathToFileURL(resolve(repo,x)).href);const{RegionalWind}=await imp('src/render/regional-wind.ts'),{WIND_PROFILE}=await imp('src/render/regional-wind-geometry.ts'),T=await imp('node_modules/three/build/three.module.js');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');const three=new T.Scene(),ids={'west-cape':'WCW27','east-point-i':'EKW6','hermanville':'HCS3'};const cases={};fs.mkdirSync(out,{recursive:true});
for(const[f,id]of Object.entries(ids)){
 const ground={visualGroundEpoch:0,visualGroundHeight:()=>0,surface:()=>({land:true})};const g=new RegionalWind(f,three,ground),s=g.sites.find(r=>r.id===id);g.update({x:s.x+15,y:28,z:s.z+35},12);
 const b=g.batches[0],real=b.mast.geometry,v=real.getAttribute('position'),ix=real.getIndex();let M=null;
 for(let i=0;i<b.mast.count;i++){const m=new T.Matrix4();b.mast.getMatrixAt(i,m);if(Math.hypot(m.elements[12]-s.x,m.elements[14]-s.z)<.02)M=m;}
 if(!M||!b.mast.visible||!ix)throw Error('Missing selected submitted geometry');const pos=Float64Array.from({length:v.count*3},(_,i)=>{const j=Math.floor(i/3),p=new T.Vector3().fromBufferAttribute(v,j).applyMatrix4(M);return [p.x-M.elements[12],p.y-M.elements[13],p.z-M.elements[14]][i%3];});const ixv=new Uint32Array(ix.array),bp=Buffer.from(pos.buffer),bi=Buffer.from(ixv.buffer);fs.writeFileSync(resolve(out,id+'.f64'),bp);fs.writeFileSync(resolve(out,id+'.u32'),bi);
 cases[id]={farm:f,hub:WIND_PROFILE[f].hub,localVbo:sha(bp),index:sha(bi),vertices:v.count,triangles:ix.count/3,matrix:M.elements,sourceName:b.mast.name,excluded:b.rotor.name};g.dispose();}
fs.writeFileSync(resolve(out,'source.json'),JSON.stringify(cases,null,2));console.log(Object.fromEntries(Object.entries(cases).map(([k,v])=>[k,[v.triangles,v.localVbo.slice(0,10)]])));
