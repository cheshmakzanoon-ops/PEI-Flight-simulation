import * as T3 from 'three';import assert from 'node:assert/strict';
import{readFileSync as f}from'node:fs';import{gunzipSync as gz}from'node:zlib';
import{decodeRoads}from'../../src/render/roads.ts';
import{Cover}from'../../src/sim/cover.ts';import{Terrain}from'../../src/sim/terrain.ts';import{loadBaywalkCourt,BaywalkNative,BAYWALK_ANCHOR}from'../../src/sim/baywalk-native.ts';
import{coastSegments}from'../../src/sim/shoreline.ts';
import{verifiedBaywalkRoadSupport,buildBaywalkRoad}from'../../src/render/baywalk-road.ts';
import{BaywalkGround}from'../../src/render/baywalk-land.ts';import{regularRoadGround}from'../../src/render/road-contact.ts';
import{loadSpinnakersDeck,spinnakersDeckSurface,verifiedBaywalkDeckClearance,buildSpinnakersDeck}from'../../src/render/spinnakers-deck.ts';
import{buildNorthBaywalk}from'../../src/render/north-baywalk.ts';
const W='public/world/',j=n=>JSON.parse(f(W+n)),m=j('terrain.json'),c=j('cover.json'),data=gz(f(W+m.file)),t=new Terrain(m,new Int16Array(data.buffer,data.byteOffset,data.byteLength/2));
const bytes=gz(f(W+c.file)),old=new Cover(c.width,c.height,bytes,undefined,c.compressedSha256);
const req=async u=>new Response(f(u)),B=new BaywalkNative(await loadBaywalkCourt(W,req));
const cover=new Cover(c.width,c.height,bytes,undefined,c.compressedSha256,undefined,undefined,undefined,false,B);
const p=gz(f(W+'roads.bin.gz')),row=decodeRoads(p.buffer.slice(p.byteOffset,p.byteOffset+p.byteLength))[2803];
const deck=await loadSpinnakersDeck(W,req);
const checks={road:verifiedBaywalkRoadSupport(row.points,old,t,B),deck:verifiedBaywalkDeckClearance(deck,old,t,B)};
assert(checks.road,JSON.stringify(checks));assert(checks.deck,JSON.stringify(checks));
const g=buildSpinnakersDeck(deck,cover,t);assert(g,'C deck preserved');
const inherited=regularRoadGround(t),mat=new T3.MeshBasicMaterial();
const court=new BaywalkGround(B,cover,t,mat,inherited);
const stock=(x,z)=>inherited(x,z);
const world={terrain:t,baywalkActive:true,baywalkBounds:B.bounds,visualGroundSignature:()=>'',restoredBaywalkY:(x,z)=>B.restored(old.distance(t,x,z),x,z)?court.height(x,z):undefined,
 visualGroundHeight(x,z){return this.restoredBaywalkY(x,z)??stock(x,z);}};
const gate=buildNorthBaywalk(spinnakersDeckSurface(deck),world);
const road=buildBaywalkRoad(row.points,world,mat,new T3.Color(0x5e5b52));
assert(gate,'direct ramp did not seat at full width');assert(road);
gate.group.updateMatrixWorld(true);court.mesh.updateMatrixWorld(true);road.mesh.updateMatrixWorld(true);
const arr=gate.surface.geometry.getAttribute('position'),roadPos=road.mesh.geometry.getAttribute('position');
let maxSlope=0,maxCross=0,footGap=0,wetR=0,crownMin=Infinity,crownMax=-Infinity;
for(let i=0;i<arr.count;i++){
 if(i>=8){
  const d=Math.hypot(arr.getX(i)-arr.getX(i-8),arr.getZ(i)-arr.getZ(i-8));
  maxSlope=Math.max(maxSlope,Math.abs(arr.getY(i)-arr.getY(i-8))/d);
 }
 if(i%8){
  const d=Math.hypot(arr.getX(i)-arr.getX(i-1),arr.getZ(i)-arr.getZ(i-1));
  maxCross=Math.max(maxCross,Math.abs(arr.getY(i)-arr.getY(i-1))/d);
 }
 if(i>=arr.count-8){
  const floor=world.restoredBaywalkY(BAYWALK_ANCHOR.x+arr.getX(i),BAYWALK_ANCHOR.z+arr.getZ(i));
  footGap=Math.max(footGap,Math.abs(floor-arr.getY(i)));
 }
}
for(let i=0;i<roadPos.count;i++){
 const x=roadPos.getX(i)+road.mesh.position.x,z=roadPos.getZ(i)+road.mesh.position.z;
 if(cover.distance(t,x,z)<0)wetR++;
 const y=roadPos.getY(i)-world.visualGroundHeight(x,z);
 crownMin=Math.min(crownMin,y);crownMax=Math.max(crownMax,y);
}
const cfg=coastSegments(cover,t),oldCfg=coastSegments(old,t);
const shore=cfg.filter(r=>r.baywalk);
checks.ramp={maxSlope,maxCross,footGap,triangles:gate.surface.geometry.index.count/3};
checks.road={wetR,crownMin,crownMax,triangles:roadPos.count/3};
checks.coast={oldSegments:oldCfg.length,newSegments:cfg.length,registered:shore.length};
assert(wetR===0&&maxSlope<.155&&footGap<.005);
console.log(JSON.stringify(checks,null,2));
