/** Feasibility only: exercise installed pack, CPU cover/contact and real Three patch. */
import * as THREE from 'three';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync,gzipSync} from 'node:zlib';
import {Terrain,OCEAN_Y} from '../../src/sim/terrain.ts';
import {Cover} from '../../src/sim/cover.ts';
import {project} from '../../src/sim/geo.ts';
import {coastSegments} from '../../src/sim/shoreline.ts';
import {GROUND_LIFT} from '../../src/sim/coastal-terrain.ts';
import {loadMontagueFoundation} from '../../src/sim/montague-foundation.ts';
import {MONTAGUE_FOUNDATION as q} from '../../src/sim/montague-foundation.generated.ts';
import {insertCoastalGrid} from '../../src/render/coastal-patch.ts';
const file=name=>fs.readFileSync(new URL('../../public/world/'+name,import.meta.url));
const tm=JSON.parse(file('terrain.json')),c0=JSON.parse(file('cover.json'));
const a=gunzipSync(file(tm.file)),b=gunzipSync(file(c0.file)),p=file(q.asset);
const U=loadMontagueFoundation,yes=await U('atlas/',async()=>new Response(p),500);
assert(yes);
assert.equal(await U('atlas/',async()=>new Response(null,{status:404}),500),undefined);
const corrupt=gunzipSync(p);corrupt[12]^=0x07;
assert.equal(await U('atlas/',async()=>new Response(gzipSync(corrupt)),500),undefined);
const base=new Terrain(tm,new Int16Array(a.buffer,a.byteOffset,a.byteLength/2));
const next=new Terrain(tm,base.samples,[yes.ground]);
const old=new Cover(c0.width,c0.height,b,undefined,c0.compressedSha256);
const nw=new Cover(c0.width,c0.height,b,undefined,c0.compressedSha256,undefined,yes.water);
const ground=(terrain,cover,x,z)=>{
 const land=cover.distance(terrain,x,z)>=0;
 return {land,height:terrain.contactHeight(x,z,land)};
};
const part=next.coastalGrids[0],w=(next.right-next.left)/32,d=(next.bottom-next.top)/22,
 i=part.spec.tileX,j=part.spec.tileZ,l=next.left+i*w,z0=next.top+j*d,Q={x:l,z:z0,w,d};
const g=new THREE.PlaneGeometry(w,d,112,112);g.rotateX(-Math.PI/2);
const pp=g.getAttribute('position'),uv=g.getAttribute('uv');
for(let i=0;i<pp.count;i++){
 const x=pp.getX(i)+l+w/2,z=pp.getZ(i)+z0+d/2;
 pp.setY(i,next.atlasElevation(x,z)+GROUND_LIFT);uv.setXY(i,...next.uv(x,z));
}
insertCoastalGrid(g,112,Q,next,part);
const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
mesh.position.set(l+w/2,0,z0+d/2);mesh.updateMatrixWorld();mesh.geometry.computeBoundingSphere();
const ray=new THREE.Raycaster(),up=new THREE.Vector3(),down=new THREE.Vector3(0,-1,0);
const archive=process.argv[2]??new URL('../../data/montague-bridge/witness/foundation-copc-probes.csv.gz',import.meta.url);
const physical=fs.readFileSync(archive);
const csv=physical[0]===0x1f&&physical[1]===0x8b?gunzipSync(physical):physical;
const data=csv.toString().trim().split('\n').map(x=>x.split(',').map(Number));
let wet=0,protectedDry=0,noNewLand=0,falls=0,miss=0,gap=0;
const oldD=[],newD=[];
for(const [lon,lat,truth,cl] of data){
 const {x,z}=project(lon,lat);
 const o=ground(base,old,x,z),n=ground(next,nw,x,z);
 if(!o.land&&n.land)falls++;
 if(!n.land)assert.equal(n.height,OCEAN_Y);
 if(cl===2){
  if(o.land&&!n.land)protectedDry++;
  if(!n.land)continue;
  ray.set(up.set(x,50,z),down);
  const hit=ray.intersectObject(mesh)[0];
  if(!hit){miss++;continue;}
  gap=Math.max(gap,Math.abs(hit.point.y-n.height));
  oldD.push(Math.abs(o.height-GROUND_LIFT-truth));newD.push(Math.abs(hit.point.y-GROUND_LIFT-truth));
 }else{
  if(o.land&&!n.land)wet++;
  if(!o.land&&n.land)noNewLand++;
 }
}
assert.equal(falls,0);
assert.equal(noNewLand,0);
assert.equal(protectedDry,0);
assert.equal(miss,0);
const n0=coastSegments(old,base),n1=coastSegments(nw,next);
function p90(x){x.sort((a,b)=>a-b);return x[Math.floor(.90*(x.length-1))];}
const out={directSurveyRows:data.length,newWaterSourceReturns:wet,dryApproachActualRayCount:oldD.length,
 maxRenderContactDeltaM:gap,oldDryP90:p90(oldD),prototypeDryP90:p90(newD),newLand:falls,misclassifiedDry:protectedDry,
 priorFullProvinceCoastSegments:n0.length,previewFullProvinceCoastSegments:n1.length,
 fitTerrainTile:`${i}-${j}`,correctCoverAndTerrainOptIn:true};
console.log(JSON.stringify(out,null,2));
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(out,null,2)+'\n');
