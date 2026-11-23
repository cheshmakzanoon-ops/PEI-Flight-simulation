import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {Cover} from '../src/sim/cover.ts';
import {loadCoastalSurveys,GROUND_LIFT} from '../src/sim/coastal-terrain.ts';
import {EAST_CLIFF} from '../src/sim/east-cliff.generated.ts';
import {Terrain,OCEAN_Y} from '../src/sim/terrain.ts';
import {cliffLayout,CLIFF_UNITS} from '../src/render/coastal-cliff-patch.ts';
import {insertCoastalGrid} from '../src/render/coastal-patch.ts';
import type {CoastalGrid} from '../src/sim/coastal-terrain.ts';

const world=new URL('../public/world/',import.meta.url);
const raw=(p:string)=>Uint8Array.from(readFileSync(new URL(p,world)));
const meta=(p:string)=>JSON.parse(readFileSync(new URL(p,world),'utf8'));
const load=async(u:RequestInfo|URL)=>new Response(raw(String(u).split('/world/').pop()!));
const packs=await loadCoastalSurveys('/world/',load);
const bare=gunzipSync(raw('height.bin.gz')),height=Int16Array.from({length:bare.length/2},(_,i)=>bare.readInt16LE(2*i));
const t=new Terrain(meta('terrain.json'),height,packs);
const baseline=new Terrain(t.spec,height,packs.map(p=>({spec:p.spec,samples:p.samples})));
const g=t.coastalGrids[0],old=baseline.coastalGrids[0],coverMeta=meta('cover.json');
const cover=new Cover(coverMeta.width,coverMeta.height,gunzipSync(raw('cover.bin.gz')));

test('verified East Point cliff installs only when the matching base survey is installed',async()=>{
 assert.deepEqual(t.coastalSurveys,['east-point','west-point']);
 assert.deepEqual(t.coastalRefinements,['east-cliff-v1']);
 assert.equal(g.cliff?.source.cells.length,EAST_CLIFF.cells);
 assert.equal(t.coastalGrids[1].cliff,undefined);
 const unmatched=await loadCoastalSurveys('/world/',(u)=>
    String(u).endsWith('/v1/east-point.i16.gz')?Promise.resolve(new Response(null,{status:410})):load(u));
 assert.deepEqual(unmatched.map(p=>p.spec.id),['west-point']);
 assert.ok(unmatched.every(p=>p.cliff===undefined));
});
test('missing, corrupt, partial or slow refinement leaves both existing surveys installed',async()=>{
 const bytes=gunzipSync(raw('coastal/v2/east-point-cliff.i16.gz')),broken=Uint8Array.from(bytes);broken[50]^=14;
 const attempts=[
  ()=>Promise.resolve(new Response(null,{status:404})),
  ()=>Promise.resolve(new Response('drops',{status:206})),
  ()=>Promise.resolve(new Response(broken)),
  ()=>new Promise<Response>(()=>{})
 ];
 for(const error of attempts){
   const failed=await loadCoastalSurveys('/world/',(u)=>String(u).includes('/v2/')?error():load(u),300);
   assert.equal(failed.length,2);assert.ok(failed.every(p=>p.cliff===undefined));
   const fallback=new Terrain(t.spec,height,failed);
   assert.deepEqual(fallback.coastalRefinements,[]);
   assert.equal(ground(fallback.coastalGrids[0],93.2,90.7),ground(old,93.2,90.7));
 }
});
function ground(q:CoastalGrid,i:number,j:number){
 const x=q.x0+i*q.stepX,z=q.z0+j*q.stepZ;
 return q.height(x,z)!;
}
test('outside the sparse quarter-grid collar, both signed height and water contact remain unchanged',()=>{
 let changed=0,unchanged=0;
 for(let j=0;j<g.nz-1;j++)for(let i=0;i<g.nx-1;i++){
  const x=g.x0+(i+.33)*g.stepX,z=g.z0+(j+.71)*g.stepZ,land=cover.distance(t,x,z)>=0;
  if(!land)assert.equal(t.contactHeight(x,z,land),OCEAN_Y);
  const delta=Math.abs(ground(g,i+.33,j+.71)-ground(old,i+.33,j+.71));
  if(!g.cliff!.active(i,j)){assert.equal(delta,0);unchanged++;}
  else if(delta>.01)changed++;
 }
 assert.ok(changed>400&&unchanged>17_700);
});
function meshFor(terrain:Terrain,grid:CoastalGrid,n:number){
 const w=(terrain.right-terrain.left)/32,d=(terrain.bottom-terrain.top)/22,x=terrain.left+grid.spec.tileX*w,z=terrain.top+grid.spec.tileZ*d,cx=x+w/2,cz=z+d/2;
 const geo=new THREE.PlaneGeometry(w,d,n,n);geo.rotateX(-Math.PI/2);
 const pos=geo.getAttribute('position'),uv=geo.getAttribute('uv');
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i)+cx,z=pos.getZ(i)+cz;
  pos.setY(i,terrain.atlasElevation(x,z)+GROUND_LIFT);
  uv.setXY(i,...terrain.uv(x,z));
 }
 insertCoastalGrid(geo,n,{x,z,w,d},terrain,grid);
 const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial());mesh.position.set(cx,0,cz);mesh.updateMatrixWorld(true);
 return {mesh,w,d};
}
test('complete West Point geometry and both base-site assets survive the East-only patch',()=>{
 for(const n of [8,56,112]){
  const a=meshFor(t,t.coastalGrids[1],n).mesh,b=meshFor(baseline,baseline.coastalGrids[1],n).mesh;
  for(const key of ['position','uv','normal','surveyWeight'])
   assert.deepEqual(a.geometry.getAttribute(key).array,b.geometry.getAttribute(key).array);
  assert.deepEqual(a.geometry.index!.array,b.geometry.index!.array);
  a.geometry.dispose();b.geometry.dispose();a.material.dispose();b.material.dispose();
 }
});
test('actual Three terrain covers one tile exactly and raycasts share the signed contact in each tier',ctx=>{
 const points=g.cliff!.source.cells.filter((_,i)=>i%17===7);
 for(const n of [8,56,112]){
  const {mesh,w,d}=meshFor(t,g,n),geometry=mesh.geometry,positions=geometry.getAttribute('position'),index=geometry.index!.array;
  assert.ok(index.length/3<({8:24_000,56:30_000,112:80_000})[n as 8|56|112]);
  let area=0;
  for(let k=0;k<index.length;k+=3){
   const [a,b,c]=[index[k],index[k+1],index[k+2]];
   const face=(positions.getZ(b)-positions.getZ(a))*(positions.getX(c)-positions.getX(a))-
              (positions.getX(b)-positions.getX(a))*(positions.getZ(c)-positions.getZ(a));
   assert.ok(face>0);area+=face*.5;
  }
  assert.ok(Math.abs(area-w*d)/(w*d)<5e-7);
  const ray=new THREE.Raycaster();ray.ray.direction.set(0,-1,0);
  let residual=0;
  for(const k of points){
   const xx=k%(g.nx-1),zz=Math.floor(k/(g.nx-1)),x=g.x0+(xx+.4382)*g.stepX,z=g.z0+(zz+.7189)*g.stepZ;
   ray.ray.origin.set(x,100,z);
   const hits=ray.intersectObject(mesh);
   assert.equal(hits.length,1);
   const e=Math.abs(hits[0].point.y-ground(g,xx+.4382,zz+.7189)-GROUND_LIFT);residual=Math.max(residual,e);
   assert.ok(e<(n===112?.001:.097),`${n}-LOD: unexpected actual triangle mismatch ${e} m`);
  }
  ctx.diagnostic(`${n}-LOD: ${index.length/3} faces, sampled contact mesh discrepancy ${residual.toFixed(5)} m`);
  geometry.dispose();mesh.material.dispose();
 }
});
for(const near of [true,false])test((near?'near':'distant')+' cliff topology is manifold and honors the entire continuous surface',ctx=>{
 const layout=cliffLayout(g,near),{points:p,indices}=layout,edges=new Map<number,number>();
 const right=(g.nx-1)*CLIFF_UNITS,bottom=(g.nz-1)*CLIFF_UNITS,count=p.length/2;
 const reference=(x:number,z:number)=>g.localHeight(x/CLIFF_UNITS,z/CLIFF_UNITS);
 const fine=Float32Array.from({length:(right+1)*(bottom+1)},(_,i)=>reference(i%(right+1),Math.floor(i/(right+1))));
 const h=(x:number,z:number)=>fine[z*(right+1)+x];
 let probes=0,max=0;
 for(let k=0;k<indices.length;k+=3){
  const a=indices[k],b=indices[k+1],c=indices[k+2],ax=p[2*a],az=p[2*a+1],bx=p[2*b],bz=p[2*b+1],cx=p[2*c],cz=p[2*c+1];
  const sx=bx-ax,sz=bz-az,tx=cx-ax,tz=cz-az,det=sx*tz-sz*tx;
  assert.ok(det<0);
  for(const [l,r] of [[a,b],[b,c],[c,a]]){
   const id=Math.min(l,r)*count+Math.max(l,r);edges.set(id,(edges.get(id)??0)+1);
  }
  for(let z=Math.min(az,bz,cz);z<=Math.max(az,bz,cz);z++)for(let x=Math.min(ax,bx,cx);x<=Math.max(ax,bx,cx);x++){
   if((z&1)!==(x&1))continue;
   const dx=x-ax,dz=z-az,u=(dx*tz-dz*tx)/det,v=(sx*dz-sz*dx)/det;
   if(u<0||v<0||u+v>1)continue;
   const plane=h(ax,az)+u*(h(bx,bz)-h(ax,az))+v*(h(cx,cz)-h(ax,az));
   max=Math.max(max,Math.abs(plane-h(x,z)));probes++;
  }
 }
 for(const [key,deg] of edges){
  const a=Math.floor(key/count),b=key%count,ax=p[2*a],az=p[2*a+1],bx=p[2*b],bz=p[2*b+1];
  assert.equal(deg,(ax===bx&&(ax===0||ax===right))||(az===bz&&(az===0||az===bottom))?1:2,'nonmanifold East Point interior');
 }
 assert.ok(probes>0.5*right*bottom);assert.ok(max<(near?.00001:.097),`Unexpected error ${max}`);
 ctx.diagnostic(`${probes} overlay-vertex trials, maximum ${max.toFixed(5)} m`);
});
