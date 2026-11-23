/** Rebuild exact streamed building batches against a predecessor; cast real Three rays. */
import * as THREE from 'three';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {Terrain} from '../../src/sim/terrain.ts';
import {project} from '../../src/sim/geo.ts';
import {Buildings} from '../../src/render/buildings.ts';
import {SOURIS_MCLEAN as M} from '../../src/render/souris-mclean.generated.ts';
import {MCLEAN_ROLES as R,MCLEAN_STYLE} from '../../src/render/souris-mclean.ts';

const [predecessor,report,exported]=process.argv.slice(2);
assert(predecessor&&report,'usage: node --experimental-strip-types souris-mclean-mesh.mjs PREDECESSOR_ROOT REPORT [PROJECTION]');
const old=await import(pathToFileURL(resolve(predecessor,'src/render/buildings.ts')));
const read=p=>readFileSync(new URL('../../'+p,import.meta.url));
const manifest=JSON.parse(read('public/world/terrain.json'));
const base=gunzipSync(read('public/world/'+manifest.file));
const land=new Terrain(manifest,new Int16Array(base.buffer,base.byteOffset,base.byteLength/2));
const index=JSON.parse(read('public/world/buildings/index.json'));
const tile=index.tiles.find(t=>t.id===M.tile),raw=read('public/world/buildings/tiles.pack');
const rows=JSON.parse(gunzipSync(raw.subarray(tile.offset,tile.offset+tile.bytes))).features;
const hide=(row,i,f)=>f(i)?{...row,footprint:[]}:row;
const stock=rows.map((r,i)=>hide(r,i,k=>k===M.ordinal));
const removed=rows.map((r,i)=>hide(r,i,k=>k!==M.ordinal));
const build=(C,R,hash=index.sha256)=>{
 const scene=new THREE.Scene();scene.environment=new THREE.Texture();
 const b=new C(scene,land,index.tiles,undefined,hash);
 const mesh=b.generate(R,b.tiles.find(t=>t.id===tile.id));mesh.updateMatrixWorld();
 return mesh;
};
const before=build(old.Buildings,stock),prev=build(old.Buildings,removed),candidate=build(Buildings,rows);
const attrs=candidate.geometry.attributes,A=attrs.facadeStyle,F=attrs.topFlag,P=attrs.position;
const unchanged=Array.from(A.array).flatMap((s,i)=>s!==MCLEAN_STYLE?[i]:[]);
assert.equal(unchanged.length,before.geometry.attributes.position.count);
const attrNames=Object.keys(attrs);
for(const key of attrNames){
 const src=before.geometry.attributes[key],out=attrs[key];
 for(let i=0;i<src.count;i++)for(let j=0;j<src.itemSize;j++)
  assert.equal(out.array[unchanged[i]*src.itemSize+j],src.array[i*src.itemSize+j],`unrelated attribute ${key} changed`);
}
const f=build(Buildings,rows,'not matching');
assert.ok(!Array.from(f.geometry.attributes.facadeStyle.array).includes(MCLEAN_STYLE));
const vert=(i)=>[P.getX(i)+candidate.position.x,P.getY(i),P.getZ(i)+candidate.position.z];
const ring=M.source.map(([x,z])=>project(x,z));const roof=[];
function scope(x,z){
 let b=false,d=Infinity;
 for(let k=0;k<ring.length;k++){
  const u=ring[k],v=ring[(k+1)%ring.length],q=v.x-u.x,s=v.z-u.z;
  if((u.z>z)!==(v.z>z)&&x<u.x+q*(z-u.z)/s)b=!b;
  const f=Math.max(0,Math.min(1,((x-u.x)*q+(z-u.z)*s)/(q*q+s*s)));
  d=Math.min(d,Math.hypot(x-u.x-f*q,z-u.z-f*s));
 }
 return b?d:-d;
}
const counts={};let ext=0;
for(let k=0;k<P.count;k+=3){
 if(A.getX(k)!==MCLEAN_STYLE)continue;
 const role=F.getX(k);assert.equal(F.getX(k+1),role);assert.equal(F.getX(k+2),role);
 counts[role]=(counts[role]??0)+1;
 const q=[vert(k),vert(k+1),vert(k+2)];
 for(const [x,y,z] of q){assert.ok(Number.isFinite(y));ext=Math.max(ext,-scope(x,z));}
 if(role>=R.roof&&role<=R.annexRoof)roof.push(q);
}
assert.ok(ext<.0003,ext);
const ray=new THREE.Raycaster(),v=new THREE.Vector3(),direction=new THREE.Vector3(0,-1,0);
const hold=JSON.parse(read('data/souris-main/mclean-native-holdout.json'));
const legacy=[],now=[];
for(const [x,z,y] of hold){
 ray.set(v.set(x,80,z),direction);
 const b=ray.intersectObject(prev).filter(h=>prev.geometry.attributes.topFlag.getX(h.face.a)===1);
 const a=ray.intersectObject(candidate).filter(h=>A.getX(h.face.a)===MCLEAN_STYLE&&F.getX(h.face.a)>=R.roof&&F.getX(h.face.a)<=R.annexRoof);
 assert.equal(b.length,1);assert.equal(a.length,1);
 legacy.push(Math.abs(b[0].point.y-y));now.push(Math.abs(a[0].point.y-y));
}
function values(a){
 const s=a.slice().sort((x,y)=>x-y);
 return [.5,.9,.95,1.].map(k=>{const p=(s.length-1)*k,i=Math.floor(p);return s[i]+(p-i)*(s[Math.min(i+1,s.length-1)]-s[i]);});
}
const [a,b]=[ring[15],ring[14]],L=Math.hypot(b.x-a.x,b.z-a.z),ex=(b.x-a.x)/L,ez=(b.z-a.z)/L;
const n=new THREE.Vector3(ez,0,-ex); // actual inward direction
const mid={x:(a.x+b.x)*.5,z:(a.z+b.z)*.5},seat=land.meshElevation(mid.x,mid.z)+.53;
const entry=[];
for(const u of [1.20,9.91,13.42]){
 const marks=[];
 for(const d of [.083,.325,.559,.752]){
  const x=a.x+ex*u+d*n.x,z=a.z+ez*u+d*n.z;
  ray.set(v.set(x,seat+.19,z),direction);
  const hit=ray.intersectObject(candidate).find(h=>A.getX(h.face.a)===MCLEAN_STYLE&&F.getX(h.face.a)===R.foundation);
  assert.ok(hit,`Missing seated inboard entry ${u}/${d}`);
  marks.push({d,y:hit.point.y,lift:hit.point.y-land.meshElevation(x,z)});
 }
 assert.ok(marks.every(p=>p.lift>.11)&&marks.every((p,i)=>i===0||p.y>marks[i-1].y));
 entry.push({u,marks});
}
const results={
 owner:tile.id,ordinal:M.ordinal,features:rows.length,unchangedOtherVertices:unchanged.length,
 attributes:attrNames,outsidePlanMm:ext*1000,
 oldTriangles:prev.geometry.attributes.position.count/3,
 newTriangles:Object.values(counts).reduce((v,n)=>v+n,0),
 roofTriangles:roof.length,pinMismatchUsesStock:true,
 heldOutActualRoofRays:hold.length,errorQuantilesMetres:[.50,.90,.95,1.0],
 oldErrors:values(legacy),newErrors:values(now),explicitInboardEntryRays:entry,trianglesByArtRole:counts,
};
assert.ok(results.newErrors[1]<.20&&results.newErrors[1]<.1*results.oldErrors[1]);
writeFileSync(report,JSON.stringify(results,null,2)+'\n');
if(exported)writeFileSync(exported,JSON.stringify({outline:ring.map(p=>[p.x,p.z]),roof})+'\n');
console.log(JSON.stringify(results,null,2));
