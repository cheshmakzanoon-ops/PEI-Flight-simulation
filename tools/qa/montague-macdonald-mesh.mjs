/** Read exact old/current building batches; cast native roof and recess rays through Three.js. */
import * as THREE from 'three';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {Terrain} from '../../src/sim/terrain.ts';
import {Buildings} from '../../src/render/buildings.ts';
import {MONTAGUE_MACDONALD as plan} from '../../src/render/montague-macdonald.generated.ts';
import {MACDONALD_ROLES as R,MACDONALD_STYLE} from '../../src/render/montague-macdonald.ts';

const args=process.argv.slice(2);
assert(args.length>=3,'usage: node montague-macdonald-mesh.mjs PREDECESSOR_ROOT HELDOUT_CSV OUT_JSON [ACTUAL_JSON]');
const prev=await import(pathToFileURL(resolve(args[0],'src/render/buildings.ts')).href);
const bin=name=>readFileSync(new URL('../../public/world/'+name,import.meta.url));
const m=JSON.parse(bin('terrain.json')),z=gunzipSync(bin(m.file));
const terrain=new Terrain(m,new Int16Array(z.buffer,z.byteOffset,z.byteLength/2));
const index=JSON.parse(bin('buildings/index.json')),tile=index.tiles.find(t=>t.id===plan.tile);
assert(index.sha256===plan.atlasSha256);
const raw=bin('buildings/tiles.pack'),features=JSON.parse(gunzipSync(raw.subarray(tile.offset,tile.offset+tile.bytes))).features;
const alone=features.map((f,i)=>i===plan.ordinal?f:{...f,footprint:[]});
const without=features.map((f,i)=>i===plan.ordinal?{...f,footprint:[]}:f);
const get=(Constructor,feat)=>{
 const scene=new THREE.Scene();scene.environment=new THREE.Texture();
 const b=new Constructor(scene,terrain,index.tiles,undefined,index.sha256);
 const mesh=b.generate(feat,b.tiles.find(t=>t.id===tile.id));mesh.updateMatrixWorld();
 return mesh;
};
const old=get(prev.Buildings,alone),before=get(prev.Buildings,without);
const mesh=get(Buildings,features);
const attrs=mesh.geometry.attributes,A=attrs.facadeStyle,F=attrs.topFlag,X=attrs.position;
const other=Array.from(A.array).flatMap((q,i)=>q!==MACDONALD_STYLE?[i]:[]);
const attributes=Object.keys(attrs);
assert.equal(other.length,before.geometry.attributes.position.count);
for(const name of attributes){
 const src=before.geometry.attributes[name],newer=attrs[name];
 for(let i=0;i<src.count;i++)for(let j=0;j<src.itemSize;j++){
  if(src.array[i*src.itemSize+j]!==newer.array[other[i]*src.itemSize+j]){
   assert.fail(`${name} neighbor mismatch at ${i},${j}`);
  }
 }
}
const surface=new Set([R.roof,R.lean,R.annex]);
const count={},P=(i)=>[X.getX(i)+mesh.position.x,X.getY(i),X.getZ(i)+mesh.position.z];
const p=plan.outline.map(([x,z])=>[x+plan.originXZ[0],z+plan.originXZ[1]]);
const guard=(q)=>{
 const values=p.map((a,i)=>{
  const b=p[(i+1)%p.length],u=b[0]-a[0],v=b[1]-a[1];
  return (u*(q[1]-a[1])-v*(q[0]-a[0]))/Math.hypot(u,v);
 });
 return Math.min(...values);
};
let min=0;
const envelope={outline:p,roof:[],walls:[]};
for(let k=0;k<X.count;k+=3){
 assert.equal(A.getX(k),A.getX(k+1));assert.equal(A.getX(k+1),A.getX(k+2));
 if(A.getX(k)!==MACDONALD_STYLE)continue;
 const role=F.getX(k);assert.equal(F.getX(k+1),role);assert.equal(F.getX(k+2),role);
 count[role]=(count[role]||0)+1;
 const Q=[P(k),P(k+1),P(k+2)];
 for(const [x,y,z] of Q){
  assert(Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(z));
  min=Math.min(min,guard([x,z]));
 }
 if(surface.has(role))envelope.roof.push(Q);
 else if(role===R.siding)envelope.walls.push(Q);
}
assert(min>=-.0003,`Geometry went beyond original exact outline by ${-min} metres`);
const ray=new THREE.Raycaster(),origin=new THREE.Vector3(),direction=new THREE.Vector3(0,-1,0);
const csv=readFileSync(args[1],'utf8').trim().split('\n').slice(1).map(row=>row.split(',').map(Number));
const O=[],N=[],maxModelDelta=[];
for(const [e,n,x,z,h,fitted] of csv){
 ray.set(origin.set(x,48,z),direction);
 const ave=ray.intersectObject(old).filter(q=>old.geometry.attributes.topFlag.getX(q.face.a)===1);
 assert(ave.length>=1,`The old roof misses native location ${[e,n]}`);
 const hit=ray.intersectObject(mesh).filter(q=>A.getX(q.face.a)===MACDONALD_STYLE&&surface.has(F.getX(q.face.a)));
 assert(hit.length>=1,`The surveyed roof misses native location ${[e,n]}`);
 assert(hit.every(q=>Math.abs(q.point.y-hit[0].point.y)<.00016));
 O.push(Math.abs(ave[0].point.y-h));N.push(Math.abs(hit[0].point.y-h));
 maxModelDelta.push(Math.abs(hit[0].point.y-fitted));
}
function quantile(a,p){
 const s=a.slice().sort((a,b)=>a-b),u=(s.length-1)*p,i=Math.floor(u);
 return s[i]+(u-i)*(s[Math.min(i+1,s.length-1)]-s[i]);
}
function error(a){return Object.fromEntries([.5,.9,.95,1.].map((p,i)=>[['median','p90','p95','maximum'][i],quantile(a,p)]));}
const [a,b]=p.slice(2),L=Math.hypot(b[0]-a[0],b[1]-a[1]);
const t=[(b[0]-a[0])/L,(b[1]-a[1])/L],n=new THREE.Vector3(-t[1],0,t[0]);
const ground=p.map(([x,z])=>terrain.meshElevation(x,z)).sort((a,b)=>a-b);
const seat=Math.max((ground[1]+ground[2])*.5+.43,ground[3]-.21);
const depth=[];
for(const u of [4.35,6.56,8.85,11.52,12.03]){
 ray.set(origin.set(a[0]+t[0]*u,seat+1.16,a[1]+t[1]*u).addScaledVector(n,-.30),n);
 const h=ray.intersectObject(mesh).find(q=>A.getX(q.face.a)===MACDONALD_STYLE);
 assert(h,'Interior verandah should be struck in one of the retracted wall or glaze planes.');
 depth.push({u,depth:h.distance-.30,role:F.getX(h.face.a)});
}
assert(depth.filter(q=>q.depth>1).length>=4);
const result={features:features.length,unaffectedVertices:other.length,attributes,outsidePlanMillimeters:-min*1000,
 roofRays:csv.length,oldAbsolute:error(O),candidateAbsolute:error(N),maxMeshHeightDeltaMetres:Math.max(...maxModelDelta),
 newBuildingTriangles:Object.values(count).reduce((s,v)=>s+v,0),oldBuildingTriangles:old.geometry.attributes.position.count/3,
 candidateRoles:count,verandahRays:depth};
assert(result.candidateAbsolute.p90<.17&&result.candidateAbsolute.p90<result.oldAbsolute.p90*.25);
assert(result.maxMeshHeightDeltaMetres<.0015);
console.log(JSON.stringify(result,null,2));writeFileSync(args[2],JSON.stringify(result,null,2)+'\n');
if(args[3])writeFileSync(args[3],JSON.stringify(envelope)+'\n');
