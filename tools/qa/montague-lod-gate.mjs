import * as THREE from 'three';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {Terrain} from '../../src/sim/terrain.ts';
import {loadMontagueFoundation} from '../../src/sim/montague-foundation.ts';
import {MONTAGUE_FOUNDATION as plan} from '../../src/sim/montague-foundation.generated.ts';
import {insertCoastalGrid} from '../../src/render/coastal-patch.ts';
import {GROUND_LIFT} from '../../src/sim/coastal-terrain.ts';
const file=name=>fs.readFileSync(new URL('../../public/world/'+name,import.meta.url));
const manifest=JSON.parse(file('terrain.json')),raw=gunzipSync(file(manifest.file));
const source=await loadMontagueFoundation('/',async()=>new Response(file(plan.asset)),500);
assert(source);
const t=new Terrain(manifest,new Int16Array(raw.buffer,raw.byteOffset,raw.byteLength/2),[source.ground]);
const grid=t.coastalGrids[0];
const w=(t.right-t.left)/32,d=(t.bottom-t.top)/22,
 x=t.left+w*grid.spec.tileX,z=t.top+d*grid.spec.tileZ,tx=x+w*.5,tz=z+d*.5;
const nx=grid.nx,nz=grid.nz;
const resolution=2,W=(nx-1)*resolution+1,H=(nz-1)*resolution+1;
function actual(n){
 const g=new THREE.PlaneGeometry(w,d,n,n);g.rotateX(-Math.PI/2);
 const p=g.getAttribute('position'),u=g.getAttribute('uv');
 for(let i=0;i<p.count;i++){
  const a=p.getX(i)+tx,b=p.getZ(i)+tz;
  p.setY(i,t.atlasElevation(a,b)+GROUND_LIFT);u.setXY(i,...t.uv(a,b));
 }
 const baseline=n===8?g.clone():undefined;
 insertCoastalGrid(g,n,{x,z,w,d},t,grid);
 if(baseline){
  assert.deepEqual(g.getIndex().array,baseline.getIndex().array);
  for(const key of ['position','normal','uv'])assert.deepEqual(g.getAttribute(key).array,baseline.getAttribute(key).array);
  return {lod:n,coarseAtlasUnmodified:true,allTileTriangles:g.getIndex().count/3,dryInsertTriangles:0};
 }
 const pos=g.getAttribute('position'),idx=g.getIndex(),nb=p.count;
 const sampleX=i=>(pos.getX(i)+tx-grid.x0)/grid.stepX,sampleZ=i=>(pos.getZ(i)+tz-grid.z0)/grid.stepZ;
 const visited=new Uint8Array(W*H),min=new Float64Array(W*H),max=new Float64Array(W*H);
 min.fill(Infinity);max.fill(-Infinity);
 let area=0,tris=0,inverted=0,continuousWorst=0,breakpoints=0;
 for(let k=0;k<idx.count;k+=3){
  const a=idx.getX(k),b=idx.getX(k+1),c=idx.getX(k+2);
  if(Math.min(a,b,c)<nb)continue;
  tris++;
  const X=[a,b,c].map(sampleX),Z=[a,b,c].map(sampleZ),Y=[a,b,c].map(i=>pos.getY(i));
  const det=(X[1]-X[0])*(Z[2]-Z[0])-(X[2]-X[0])*(Z[1]-Z[0]);
  if(det>=0)inverted++;
  // The two piecewise affine height fields achieve their extreme
  // difference at a vertex of a triangle intersection. Native vertices
  // are checked in the probe grid; add every actual LOD vertex and edge
  // crossing with a native vertical, horizontal, or NE–SW diagonal.
  for(let u=0;u<3;u++){
   const v=(u+1)%3,x=X[u],z=Z[u],dx=X[v]-x,dz=Z[v]-z;
   function test(t){
    if(t<0||t>1)return;
    const j=x+t*dx,i=z+t*dz;
    const h=grid.localHeight(j,i)+GROUND_LIFT,y=Y[u]+t*(Y[v]-Y[u]);
    continuousWorst=Math.max(continuousWorst,Math.abs(y-h));breakpoints++;
   }
   test(0);
   for(const [a,b]of [[x,dx],[z,dz],[x+z,dx+dz]])if(Math.abs(b)>1e-7){
    for(let k=Math.ceil(Math.min(a,a+b));k<=Math.floor(Math.max(a,a+b));k++)test((k-a)/b);
   }
  }
  area-=det*.5;
  for(let j=Math.max(0,Math.ceil(resolution*Math.min(...Z)-.001));j<=Math.min(H-1,Math.floor(resolution*Math.max(...Z)+.001));j++)
  for(let i=Math.max(0,Math.ceil(resolution*Math.min(...X)-.001));i<=Math.min(W-1,Math.floor(resolution*Math.max(...X)+.001));i++){
   const dx=i/resolution-X[0],dz=j/resolution-Z[0];
   const s=(dx*(Z[2]-Z[0])-dz*(X[2]-X[0]))/det,u=((X[1]-X[0])*dz-(Z[1]-Z[0])*dx)/det;
   if(Math.min(s,u,1-s-u)<-.001)continue;
   const y=Y[0]+s*(Y[1]-Y[0])+u*(Y[2]-Y[0]),id=j*W+i;visited[id]++;
   min[id]=Math.min(min[id],y);max[id]=Math.max(max[id],y);
  }
 }
 const nearest=5300-150-
  Math.max(...[grid.x0,grid.x1].flatMap(x=>[grid.z0,grid.z1].map(z=>Math.hypot(x-tx,z-tz))));
 assert.equal(inverted,0);
 assert(Math.abs(area-(nx-1)*(nz-1))<.03);
 let hole=0,worst=0,bound=0,tie=0;
 for(let j=0;j<H;j++)for(let i=0;i<W;i++){
  const k=j*W+i;if(!visited[k]){hole++;continue;}
  const h=grid.localHeight(i/resolution,j/resolution)+GROUND_LIFT,e=Math.max(Math.abs(max[k]-h),Math.abs(min[k]-h));
  worst=Math.max(worst,e);tie=Math.max(tie,max[k]-min[k]);
  if(i===0||i===W-1||j===0||j===H-1)bound=Math.max(bound,e);
 }
 assert.equal(hole,0);assert(bound<.001);
 const tangent=Math.tan(53*Math.PI/360),horizontal=tangent*1920/1080;
 // At the extreme visible FOV corners, perspective depth is smaller
 // than range. The camera may pitch; bound dy/dworldY through the norm
 // of the vertical perspective derivative, not just a centred camera.
 const offAxis=Math.sqrt(1+tangent*tangent)*Math.sqrt(1+tangent*tangent+horizontal*horizontal);
 const complete=Math.max(worst,continuousWorst);
 const projected=n===112?0:complete*(540/tangent)*offAxis/(nearest-3);
 assert(projected<.5);
 return {lod:n,innerTriangleCount:tris,allTileTriangles:idx.count/3,projectedAreaNativeCells:area,
  exactSharedOuterEdgeDifferenceM:bound,orientationFailures:inverted,probeHoles:hole,nativeHalfGridProbeCount:W*H,maxNativeHeightM:worst,exactEdgeIntersectionsTested:breakpoints,maxContinuousHeightM:complete,
  maxDuplicateNumericDifferenceM:tie,cameraMinimumM:n===112?null:nearest,
  conservativeProjectedHeightAt1080p:projected};
}
const out=[112,56,8].map(actual);
console.log(JSON.stringify(out,null,2));
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(out,null,2)+'\n');
