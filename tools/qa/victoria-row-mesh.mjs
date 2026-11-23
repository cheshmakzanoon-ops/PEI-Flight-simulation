/** Raw native height cells run through the actual Three.js building batch. */
import * as THREE from 'three';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Terrain} from '../../src/sim/terrain.ts';
import {Buildings} from '../../src/render/buildings.ts';
import {VICTORIA_ROW as plan} from '../../src/render/victoria-row.generated.ts';
import {VICTORIA_ROLES as roles} from '../../src/render/victoria-row.ts';

const bin=url=>readFileSync(new URL('../../public/world/'+url,import.meta.url));
const manifest=url=>JSON.parse(bin(url));
const t=manifest('terrain.json'),dem=gunzipSync(bin(t.file));
const terrain=new Terrain(t,new Int16Array(dem.buffer.slice(dem.byteOffset,dem.byteOffset+dem.byteLength)));
const index=manifest('buildings/index.json'),tile=index.tiles.find(x=>x.id===plan.tile);
const raw=bin('buildings/tiles.pack'),features=JSON.parse(gunzipSync(raw.subarray(tile.offset,tile.offset+tile.bytes))).features;
const without=features.map((v,i)=>i===plan.ordinal?{...v,footprint:[]}:v);
const get=(f,enabled)=>{
 const scene=new THREE.Scene();scene.environment=new THREE.Texture();
 const b=new Buildings(scene,terrain,index.tiles,undefined,index.sha256);
 if(!enabled)b.victoriaMat=undefined;
 const m=b.generate(f,b.tiles.find(p=>p.id===tile.id));m.updateMatrixWorld();
 return m;
};
const mesh=get(features,true),old=get(features,false);
const before=get(without,false),target=get(features.map((v,i)=>i===plan.ordinal?v:{...v,footprint:[]}),false);
const styles=mesh.geometry.getAttribute('facadeStyle'),P=mesh.geometry.getAttribute('position');
const flags=mesh.geometry.getAttribute('topFlag'),positions=before.geometry.getAttribute('position');
const all=Array.from(styles.array);
const protectedVertices=all.flatMap((s,i)=>s<32?[i]:[]);
assert.equal(protectedVertices.length,positions.count);
const attributes=Object.keys(before.geometry.attributes);
for(const name of attributes){
 const a=mesh.geometry.getAttribute(name),b=before.geometry.getAttribute(name);
 for(let i=0;i<positions.count;i++)for(let j=0;j<b.itemSize;j++){
  assert.equal(a.array[protectedVertices[i]*a.itemSize+j],b.array[i*b.itemSize+j],
   `Unaffected geometry mismatch in ${name}: ${i},${j}`);
 }
}
const rad=6378137*Math.PI/180,f=1-.00669437999014*Math.sin(46.5*Math.PI/180)**2;
const s=[rad*Math.cos(46.5*Math.PI/180)/Math.sqrt(f),-rad*(1-.00669437999014)/f**1.5];
const r=plan.source.map(([x,z])=>[(x+63.2)*s[0],(z-46.5)*s[1]]);
function margin(x,z){
 let inside=false,near=Infinity;
 for(let i=0;i<r.length;i++){
  const [a,b]=r[i],[c,d]=r[(i+1)%r.length];const m=c-a,n=d-b;
  if((b>z)!==(d>z))inside=inside!==(x<(z-b)*m/n+a);
  const u=Math.max(0,Math.min(1,((x-a)*m+(z-b)*n)/(m*m+n*n)));
  near=Math.min(near,Math.hypot(x-a-u*m,z-b-u*n));
 }
 return inside?near:-near;
}
const counts={},labs=new Set();let outside=0,minimum=0;
const witness={roof:[],walls:[]};
for(let i=0;i<P.count;i+=3)if(all[i]>=32){
 assert(all[i]===all[i+1]&&all[i]===all[i+2]);
 const role=flags.getX(i);
 assert(role===flags.getX(i+1)&&role===flags.getX(i+2));
 counts[role]=(counts[role]||0)+1;
 if(role===roles.reveal)labs.add(all[i]-32);
 const q=Array.from({length:3},(_,j)=>[P.getX(i+j)+mesh.position.x,P.getY(i+j),P.getZ(i+j)+mesh.position.z]);
 if(role===roles.roof)witness.roof.push(q);else if(role===roles.riser)witness.walls.push(q);
 const samples=[...q, [q.reduce((s,p)=>s+p[0],0)/3,0,q.reduce((s,p)=>s+p[2],0)/3],
  ...q.map((a,i)=>{const b=q[(i+1)%3];return [(a[0]+b[0])*.5,0,(a[2]+b[2])*.5];})];
 for(const [x,y,z] of samples){
  const v=margin(x,z);
  if(v<-.001)outside++;
  minimum=Math.min(minimum,v);
  assert(Number.isFinite(x)&&Number.isFinite(z)&&Number.isFinite(y));
 }
}
assert.equal(outside,0);
assert.equal(labs.size,10);
const ray=new THREE.Raycaster(),a=new THREE.Vector3(),down=new THREE.Vector3(0,-1,0);
const oldRole=target.geometry.getAttribute('topFlag');
const csv=readFileSync(process.argv[2],'utf8').trim().split('\n').slice(1).map(x=>x.split(',').map(Number));
const errorsOld=[],errorsNew=[],ties=[];
let missing=0,maxModelDelta=0;
for(const [e,n,x,z,y,model] of csv){
 ray.set(a.set(x,60,z),down);
 const o=ray.intersectObject(target).filter(q=>oldRole.getX(q.face.a)===1);
 const h=ray.intersectObject(mesh).filter(q=>flags.getX(q.face.a)===roles.roof);
 if(!o.length||!h.length){missing++;continue;}
 if(h.some(q=>Math.abs(q.point.y-h[0].point.y)>.00018))ties.push([e,n]);
 maxModelDelta=Math.max(maxModelDelta,Math.abs(h[0].point.y-model));
 errorsOld.push(Math.abs(o[0].point.y-y));errorsNew.push(Math.abs(h[0].point.y-y));
}
const quantile=(x,q)=>{
 const s=x.slice().sort((a,b)=>a-b);
 const p=(s.length-1)*q,i=Math.floor(p);
 return s[i]+(p-i)*(s[Math.min(i+1,s.length-1)]-s[i]);
};
const e=x=>({p50:quantile(x,.5),p90:quantile(x,.9),p95:quantile(x,.95)});
const report={
 tile:tile.id,ordinal:plan.ordinal,neighborVertices:positions.count,protectedAttributes:attributes,
 roleTriangles:counts,artTypesWithModeledOpenings:[...labs].sort((a,b)=>a-b),
 furthestOutsideMillimeters:-minimum*1000,tests:csv.length,missing,ties,old:e(errorsOld),candidate:e(errorsNew),maxModelDelta,
 oldSceneTileTriangles:old.geometry.getAttribute('position').count/3,newSceneTileTriangles:P.count/3
};
console.log(JSON.stringify(report,null,2));
if(process.argv[3])writeFileSync(process.argv[3],JSON.stringify(report,null,2)+'\n');
if(process.argv[4])writeFileSync(process.argv[4],JSON.stringify(witness)+'\n');
assert.equal(missing,0);
assert.equal(ties.length,0);
assert(maxModelDelta<.001);
assert(report.candidate.p90<1.2&&report.candidate.p90<report.old.p90*.25);
