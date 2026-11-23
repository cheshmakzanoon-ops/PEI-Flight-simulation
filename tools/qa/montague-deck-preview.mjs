/** Ray/footprint witness for the opt-in feasibility model; not a release approval. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {Terrain,OCEAN_Y} from '../../src/sim/terrain.ts';
import {Cover} from '../../src/sim/cover.ts';
import {project} from '../../src/sim/geo.ts';
import {GROUND_LIFT} from '../../src/sim/coastal-terrain.ts';
import {decodeRoads} from '../../src/render/roads.ts';
import {buildMontagueBridge} from '../../src/render/montague-bridge.ts';
import {APPROACH_START,APPROACH_STOP,BRIDGE_STOP,MONTAGUE_PIER,montagueBridgeRows,montagueSection,roadEdges}from '../../src/sim/montague-bridge.ts';
import {loadMontagueFoundation} from '../../src/sim/montague-foundation.ts';
import {MONTAGUE_FOUNDATION as f} from '../../src/sim/montague-foundation.generated.ts';
const asset=name=>fs.readFileSync(new URL('../../public/world/'+name,import.meta.url));
const tm=JSON.parse(asset('terrain.json')),cm=JSON.parse(asset('cover.json'));
const g=gunzipSync(asset(tm.file)),c=gunzipSync(asset(cm.file)),r=gunzipSync(asset('roads.bin.gz'));
const raw=r.buffer.slice(r.byteOffset,r.byteOffset+r.byteLength),decode=decodeRoads(raw),hash=createHash('sha256').update(r).digest('hex');
assert(montagueBridgeRows(hash,decode));
assert(!montagueBridgeRows('bad',decode));
assert(!montagueBridgeRows(hash,decode.map((a,i)=>i===15171?{...a,flags:26}:a)));
assert(!montagueBridgeRows(hash,decode.map((a,i)=>i===15263?{...a,points:a.points.slice(0,1)}:a)));
const soil=await loadMontagueFoundation('/',async()=>new Response(asset(f.asset)),500);
assert(soil);
const old=new Terrain(tm,new Int16Array(g.buffer,g.byteOffset,g.byteLength/2));
const next=new Terrain(tm,old.samples,[soil.ground]);
const cover=new Cover(cm.width,cm.height,c,undefined,cm.compressedSha256,undefined,soil.water);
const model=buildMontagueBridge(new THREE.MeshStandardMaterial({side:THREE.DoubleSide}),(x,z)=>next.meshElevation(x,z),(x,z)=>cover.distance(next,x,z));
model.updateMatrixWorld();
const top=model.children[0],walk=model.children[1],pier=model.children[4],skirt=model.children[5];
const ray=new THREE.Raycaster(),origin=new THREE.Vector3(),down=new THREE.Vector3(0,-1,0);
const archive=process.argv[2]??new URL('../../data/montague-bridge/witness/bridge-deck-spatial-holdout.csv.gz',import.meta.url);
const physical=fs.readFileSync(archive);
const csv=physical[0]===0x1f&&physical[1]===0x8b?gunzipSync(physical):physical;
const positions=csv.toString().trim().split('\n').map(s=>s.split(',').map(Number));
// Exact former generic Three ribbon, including the packed 3-node alignment.
const oldVerts=[];
for(let i=1;i<decode[15171].points.length;i++){
 const a=decode[15171].points[i-1],b=decode[15171].points[i],dx=b.x-a.x,dz=b.z-a.z;
 const len=Math.hypot(dx,dz),rx=dz*4.8/len,rz=-dx*4.8/len;
 const n=Math.ceil(len/28);
 for(let j=0;j<n;j++){
  const x=a.x+j*dx/n,z=a.z+j*dz/n,u=a.x+(j+1)*dx/n,v=a.z+(j+1)*dz/n;
  const py=old.meshElevation(x,z)+3,qy=old.meshElevation(u,v)+3;
  oldVerts.push(x+rx-42500,py,z+rz-37500,x-rx-42500,py,z-rz-37500,u+rx-42500,qy,v+rz-37500,
                u+rx-42500,qy,v+rz-37500,x-rx-42500,py,z-rz-37500,u-rx-42500,qy,v-rz-37500);
 }
}
const oldG=new THREE.BufferGeometry();
oldG.setAttribute('position',new THREE.Float32BufferAttribute(oldVerts,3));
const oldRibbon=new THREE.Mesh(oldG,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
oldRibbon.position.set(42500,0,37500);oldRibbon.updateMatrixWorld();
let misses=0,dup=0,skirtWet=0,bridgeDeckClearances=[],seats=[];
const prev=[],nextY=[],nextAbsolute=[],allDirect=[],allDatum=[];
for(const [lon,lat,s,d,z0] of positions){
 const {x,z}=project(lon,lat);
 ray.set(origin.set(x,50,z),down);
 const roof=ray.intersectObjects([top,walk]).filter(q=>q.face.normal.y>.25);
 if(!roof.length){misses++;continue;}
 if(roof.length>1&&Math.abs(roof.at(-1).point.y-roof[0].point.y)>.04)dup++;
 const v=roof[0].point.y,datum=v-GROUND_LIFT-.012;
 allDirect.push(Math.abs(v-z0));allDatum.push(Math.abs(datum-z0));
 if(Math.abs(d)<4.3){
  const original=ray.intersectObject(oldRibbon)[0]?.point.y;
  if(original!==undefined){prev.push(Math.abs(original-z0));nextY.push(Math.abs(datum-z0));nextAbsolute.push(Math.abs(v-z0));}
 }
 if(cover.distance(next,x,z)<0){
  assert.equal(next.contactHeight(x,z,false),OCEAN_Y);
  bridgeDeckClearances.push(v-OCEAN_Y);
 }
}
const p=new THREE.Vector3();
function wetIntrusions(object,ranges){
 let wet=0;
 const buf=object.geometry.getAttribute('position');
 for(const [start,end]of ranges)for(let i=start;i<end;i+=3){
  for(const k of [0,.25,.5,.75,1.])for(const l of [0,.25,.5,.75,1-k]){
   if(k+l>1)continue;
   const x=buf.getX(i)*(1-k-l)+buf.getX(i+1)*k+buf.getX(i+2)*l,z=buf.getZ(i)*(1-k-l)+buf.getZ(i+1)*k+buf.getZ(i+2)*l;
   p.set(x,0,z).applyMatrix4(object.matrixWorld);
   if(cover.distance(next,p.x,p.z)<0)wet++;
  }
 }
 return wet;
}
skirtWet=wetIntrusions(skirt,[[0,skirt.geometry.getAttribute('position').count]]);
const dryWalkRanges=model.userData.dryApproachWalkRanges;
const walkwayWet=wetIntrusions(walk,dryWalkRanges);
assert.equal(walkwayWet,0);
for(const [s,id,point] of [[APPROACH_START,15316,0],[APPROACH_STOP,15263,1]]){
 const a=decode[id].points[point],b=montagueSection(s);
 assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<1e-8);
 const core=top.geometry.getAttribute('position');
 for(const offset of roadEdges(s)){
  const x=a.x+b.nx*offset,z=a.z+b.nz*offset;
  const y=next.meshElevation(a.x,a.z)+.55;
  let best=Infinity;
  for(let i=0;i<core.count;i++){
   p.set(core.getX(i),core.getY(i),core.getZ(i)).applyMatrix4(top.matrixWorld);
   best=Math.min(best,Math.hypot(p.x-x,p.y-y,p.z-z));
  }
  seats.push(best);assert(best<.001);
 }
}
const s=montagueSection(MONTAGUE_PIER.station);
assert(cover.distance(next,s.x,s.z)<0);
assert.equal(model.children.filter(a=>a.name.startsWith('single visible pier')).length,1);
assert.equal(skirtWet,0);assert.equal(dup,0);
function p90(x){x.sort((a,b)=>a-b);return x[Math.floor(.90*(x.length-1))];}
const out={rays:positions.length,misses,distinctOverlaps:dup,nearDeckDatumP90:p90(allDatum),nearDeckRawP90:p90(allDirect),
 oldSharedCoreP90:p90(prev),newSharedCoreDatumP90:p90(nextY),newSharedCoreRawP90:p90(nextAbsolute),coreRows:prev.length,openWaterDeckRayCount:bridgeDeckClearances.length,
 nearestRealDeckAboveDrawnSeaM:Math.min(...bridgeDeckClearances),roadJointM:Math.max(...seats),skirtWaterIntrusions:skirtWet,walkWaterIntrusions:walkwayWet,dryWalkRuns:dryWalkRanges.length,
 actualTriangles:Object.fromEntries(model.children.map(a=>[a.name,a.geometry.getAttribute('position').count/3])),
 support:{station:MONTAGUE_PIER.station,aboveWaterTriangles:pier.geometry.getAttribute('position').count/3,engineeringSurvey:false}};
console.log(JSON.stringify(out,null,2));
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(out,null,2)+'\n');
