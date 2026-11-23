/** Read the actual GPU-bound terrain buffers with the same height index World uses. */
import * as THREE from 'three';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {Terrain} from '../../src/sim/terrain.ts';
import {loadMontagueFoundation} from '../../src/sim/montague-foundation.ts';
import {MONTAGUE_FOUNDATION as plan} from '../../src/sim/montague-foundation.generated.ts';
import {insertCoastalGrid} from '../../src/render/coastal-patch.ts';
import {alteredPatchHeight} from '../../src/render/render-patch-height.ts';
import {facet,GROUND_LIFT} from '../../src/sim/coastal-terrain.ts';
const file=f=>fs.readFileSync(new URL('../../public/world/'+f,import.meta.url));
const tm=JSON.parse(file('terrain.json')),buf=gunzipSync(file(tm.file));
const source=await loadMontagueFoundation('/',async()=>new Response(file(plan.asset)),500);
assert(source);
const terrain=new Terrain(tm,new Int16Array(buf.buffer,buf.byteOffset,buf.byteLength/2),[source.ground]),q=terrain.coastalGrids[0],s=q.spec;
const w=(terrain.right-terrain.left)/32,d=(terrain.bottom-terrain.top)/22,
 x=terrain.left+w*s.tileX,z=terrain.top+d*s.tileZ,cx=x+w/2,cz=z+d/2;
function actual(n){
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
 const g=new THREE.PlaneGeometry(w,d,n,n);g.rotateX(-Math.PI/2);
 const p=g.getAttribute('position'),uv=g.getAttribute('uv'),regular=p.count;
 for(let i=0;i<regular;i++){
  const X=p.getX(i)+cx,Z=p.getZ(i)+cz;
  p.setY(i,terrain.atlasElevation(X,Z)+GROUND_LIFT);uv.setXY(i,...terrain.uv(X,Z));
 }
 const old=g.clone(),before=old.getAttribute('position');
 insertCoastalGrid(g,n,{x,z,w,d},terrain,q);
 if(n===8){
  const index=g.getIndex();assert.deepEqual(index.array,old.getIndex().array);
  for(const key of ['position','normal','uv'])assert.deepEqual(g.getAttribute(key).array,old.getAttribute(key).array);
  assert.equal(g.getAttribute('surveyWeight'),undefined);
  const leftMesh=new THREE.Mesh(old,material),rightMesh=new THREE.Mesh(g,material),r=new THREE.Raycaster(),o=new THREE.Vector3(),down=new THREE.Vector3(0,-1,0);
  let checked=0;
  for(let j=0;j<29;j++)for(let i=0;i<31;i++){
   const a=w*((i+.371)/31-.5),b=d*((j+.627)/29-.5);
   r.set(o.set(a,300,b),down);
   const initial=r.intersectObject(leftMesh)[0],current=r.intersectObject(rightMesh)[0];
   assert(current&&initial);assert.equal(current.point.y,initial.point.y);
   assert.equal(alteredPatchHeight(g,a,b),undefined);checked++;
  }
  return {lod:n,stockMeshAttributesAndIndicesExact:true,raysExact:checked,physicalContactSourceUntouched:true};
 }
 const after=g.getAttribute('position'),index=g.getIndex(),mesh=new THREE.Mesh(g,material),ray=new THREE.Raycaster();
 const dir=new THREE.Vector3(0,-1,0),gnd=new THREE.Vector3();
 let regularChecks=0,localChecks=0,edgeChecks=0,miss=0,maxError=0,liveTest=false;
 const altered=[];
 for(let k=0;k<index.count;k+=3){
  const ids=[index.getX(k),index.getX(k+1),index.getX(k+2)];
  if(Math.max(...ids)>=regular)altered.push(ids);
 }
 let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
 for(const triangle of altered)for(const i of triangle){
  const a=after.getX(i),b=after.getZ(i);
  left=Math.min(left,a);right=Math.max(right,a);top=Math.min(top,b);bottom=Math.max(bottom,b);
 }
 for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){
  const k=j*(n+1)+i;
  assert.equal(after.getY(k),before.getY(k));
 }
 for(let j=0;j<289;j++)for(let i=0;i<337;i++){
  const sx=(i+.371)/337*n,sz=(j+.627)/289*n,a=w*(sx/n-.5),b=d*(sz/n-.5);
  const k=Math.floor(sz)*(n+1)+Math.floor(sx),p=sx-Math.floor(sx),u=sz-Math.floor(sz);
  if(a>=left&&a<=right&&b>=top&&b<=bottom)continue;
  const valley=alteredPatchHeight(g,a,b);
  assert.equal(valley,undefined);
  const sample=buffer=>facet(p,u,buffer.getY(k),buffer.getY(k+1),buffer.getY(k+n+1),buffer.getY(k+n+2));
  assert.equal(sample(after),sample(before));regularChecks++;
 }
 for(let i=0;i<altered.length;i+=Math.max(1,Math.round(altered.length/350))){
  const [a,b,c]=altered[i];
  const X=.19*after.getX(a)+.37*after.getX(b)+.44*after.getX(c),
   Z=.19*after.getZ(a)+.37*after.getZ(b)+.44*after.getZ(c);
  const h=alteredPatchHeight(g,X,Z);
  ray.set(gnd.set(X,300,Z),dir);const hits=ray.intersectObject(mesh);
  if(h===undefined||!hits.length){miss++;continue;}
  maxError=Math.max(maxError,Math.abs(h-hits[0].point.y));
  if(Math.min(a,b,c)<regular)edgeChecks++;
  if(!liveTest){
   const y=after.getY(a);after.setY(a,y+.25);
   assert(Math.abs(alteredPatchHeight(g,X,Z)-h-.19*.25)<1e-6);
   after.setY(a,y);liveTest=true;
  }
  localChecks++;
 }
 assert.equal(miss,0);assert(maxError<1e-5);assert(regularChecks>70000);assert(localChecks>320&&edgeChecks>0&&liveTest);
 return {lod:n,exactUnchangedRegularProbes:regularChecks,raysOnActualPatch:localChecks,rayProbesOnSewing:edgeChecks,
   meshAttachmentMaxM:maxError,passedLiveBufferSew:true};
}
const out=[8,56,112].map(actual);console.log(JSON.stringify(out,null,2));
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(out,null,2)+'\n');
