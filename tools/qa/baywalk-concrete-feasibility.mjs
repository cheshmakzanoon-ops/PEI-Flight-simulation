import * as T3 from 'three';import assert from 'node:assert/strict';
import{readFileSync as f}from'node:fs';import{gunzipSync as gz}from'node:zlib';
import{decodeRoads}from'../../src/render/roads.ts';
import{Cover}from'../../src/sim/cover.ts';import{Terrain}from'../../src/sim/terrain.ts';import{loadBaywalkCourt,BaywalkNative,BAYWALK_ANCHOR}from'../../src/sim/baywalk-native.ts';
import{verifiedBaywalkRoadSupport}from'../../src/render/baywalk-road.ts';
import{BaywalkGround}from'../../src/render/baywalk-land.ts';
import{GROUND_LIFT,WORLD_COLS,WORLD_ROWS,facet}from'../../src/sim/coastal-terrain.ts';import{regularRoadGround}from'../../src/render/road-contact.ts';
import{loadSpinnakersDeck,spinnakersDeckSurface,verifiedBaywalkDeckClearance,buildSpinnakersDeck}from'../../src/render/spinnakers-deck.ts';
import{buildNorthBaywalk}from'../../src/render/north-baywalk.ts';
import{surveyedConcretePlan}from'../../src/render/north-baywalk-sidewalk.ts';
const W='public/world/',j=n=>JSON.parse(f(W+n)),m=j('terrain.json'),c=j('cover.json'),data=gz(f(W+m.file)),t=new Terrain(m,new Int16Array(data.buffer,data.byteOffset,data.byteLength/2));
const bytes=gz(f(W+c.file)),old=new Cover(c.width,c.height,bytes,undefined,c.compressedSha256);
const req=async u=>new Response(f(u)),B=new BaywalkNative(await loadBaywalkCourt(W,req));
const cover=new Cover(c.width,c.height,bytes,undefined,c.compressedSha256,undefined,undefined,undefined,false,B);
const p=gz(f(W+'roads.bin.gz')),row=decodeRoads(p.buffer.slice(p.byteOffset,p.byteOffset+p.byteLength))[2803];
const deck=await loadSpinnakersDeck(W,req);
const checks={road:verifiedBaywalkRoadSupport(row.points,old,t,B),deck:verifiedBaywalkDeckClearance(deck,old,t,B)};
assert(checks.road,JSON.stringify(checks));assert(checks.deck,JSON.stringify(checks));
const g=buildSpinnakersDeck(deck,cover,t);assert(g,'C deck preserved');
const tier=Number(process.env.BAYWALK_TEST_TIER??112);
assert([8,56,112].includes(tier),'Use one of the three submitted ordinary terrain tiers.');
const w=(t.right-t.left)/WORLD_COLS,d=(t.bottom-t.top)/WORLD_ROWS;
const inherited=tier===112?regularRoadGround(t):(x,z)=>{
 const u=(x-t.left)/w,v=(z-t.top)/d,i=Math.floor(u),j=Math.floor(v),n=tier;
 const s=(u-i)*n,q=(v-j)*n,a=Math.floor(s),b=Math.floor(q);
 const px=t.left+w*i+w*.5,pz=t.top+d*j+d*.5;
 const at=(ox,oz)=>{
  const sx=Math.fround((a+ox)*w/n-w*.5),sz=Math.fround((b+oz)*d/n-d*.5);
  return Math.fround(t.atlasElevation(px+sx,pz+sz)+GROUND_LIFT);
 };
 return facet(s-a,q-b,at(0,0),at(1,0),at(0,1),at(1,1));
};
const mat=new T3.MeshBasicMaterial();
const court=new BaywalkGround(B,cover,t,mat,inherited);
const stock=(x,z)=>inherited(x,z);
const world={terrain:t,cover,baywalkActive:true,baywalkBounds:B.bounds,visualGroundSignature:()=>'',restoredBaywalkY:(x,z)=>B.restored(old.distance(t,x,z),x,z)?court.height(x,z):undefined,
 visualGroundHeight(x,z){return this.restoredBaywalkY(x,z)??stock(x,z);}};
const before=buildNorthBaywalk(spinnakersDeckSurface(deck),world);
const after=buildNorthBaywalk(spinnakersDeckSurface(deck),world,true);
assert(before&&after&&after.sidewalk);
before.group.updateMatrixWorld(true);after.group.updateMatrixWorld(true);
assert.deepEqual(before.surface.geometry.getAttribute('position').array,after.surface.geometry.getAttribute('position').array);
const plane=after.sidewalk.mesh,mesh=plane.geometry.getAttribute('position'),a=after.surface.geometry.getAttribute('position');
const points=surveyedConcretePlan(),L=points.stations.at(-1);
const rays=new T3.Raycaster(),orig=new T3.Vector3(),dir=new T3.Vector3(0,-1,0);
const A=BAYWALK_ANCHOR;
let hits=0,miss=0,wet=0,aboveMin=Infinity,aboveMax=-Infinity,afterStockJunction=0,footMin=Infinity,footMax=-Infinity;
for(let j=1;j<points.centres.length;j++){
 const p=points.left[j-1],q=points.right[j-1],u=points.left[j],v=points.right[j];
 const N=Math.ceil((points.stations[j]-points.stations[j-1])/.072);
 for(let j=1;j<N;j++){
  const n=j/N,hx=p.x*(1-n)+u.x*n,hz=p.z*(1-n)+u.z*n;
  const tx=q.x*(1-n)+v.x*n,tz=q.z*(1-n)+v.z*n;
  for(let k=1;k<=8;k++){
   const f=k/9,x=hx+f*(tx-hx),z=hz+f*(tz-hz);
   if(cover.distance(t,x,z)<0)wet++;
   if(old.distance(t,x,z)>=0)afterStockJunction++;
   rays.set(orig.set(x,10,z),dir);
   const pt=rays.intersectObject(plane,false)[0];if(!pt){miss++;continue;}
   const offset=pt.point.y-world.visualGroundHeight(x,z);
   aboveMin=Math.min(offset,aboveMin);aboveMax=Math.max(offset,aboveMax);
   hits++;
  }
 }
}
for(let i=a.count-8;i<a.count;i++){
 const x=A.x+a.getX(i),z=A.z+a.getZ(i);
 rays.set(orig.set(x,10,z),dir);
 const hit=rays.intersectObject(plane,false)[0];
 assert(hit,'No concrete cap beneath some of the true ramp threshold');
 const y=hit.point.y-a.getY(i);
 footMin=Math.min(footMin,y);footMax=Math.max(footMax,y);
}
let area=0;const tris=[];
for(let i=0;i<mesh.count;i+=3){
 const x=mesh.getX(i),z=mesh.getZ(i);
 const a=mesh.getX(i+1)-x,b=mesh.getZ(i+1)-z,c=mesh.getX(i+2)-x,d=mesh.getZ(i+2)-z;
 assert(a*d-b*c<1e-7);area-=(a*d-b*c)*.5;
 tris.push([[x,z],[x+a,z+b],[x+c,z+d]]);
}
const end=points.centres.at(-1);
assert(old.distance(t,end.x,end.z)>.25);
assert(hits>3900&&miss<=3&&wet===0&&aboveMin>.010&&aboveMax<.048&&footMax<.048&&footMin>=0);
const out={tier,pathLocalLengthM:L,triangles:mesh.count/3,areaGameM2:area,seated3DRays:{hits,miss,wet,aboveGroundM:[aboveMin,aboveMax],endsOnStockLand:afterStockJunction,rampFootLipM:[footMin,footMax]},retainedRampGeometryExact:true,surfaceOnly:true};
console.log(JSON.stringify(out,null,2));
if(process.argv[2]){
 const {writeFileSync}=await import('node:fs');
 writeFileSync(process.argv[2],JSON.stringify({summary:out,triangles:tris},null,2));
}
