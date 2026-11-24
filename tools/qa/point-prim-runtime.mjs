/**
 * Actual render-geometry and collider integration without a browser.
 * See docs/point-prim-study.md for the scratch-only esbuild command.
 * Real repository terrain/roads' bound cover and one q100 range; no fixture writes
 * to the world or playback state. Stub DOM/canvas context is only for Three setup.
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as T from 'three';
import {World} from '../../src/render/world.ts';
import {Buildings} from '../../src/render/buildings.ts';
import {Terrain} from '../../src/sim/terrain.ts';
import {Cover} from '../../src/sim/cover.ts';
import {PackedBytes} from '../../src/sim/packed-bytes.ts';
import {PointPrimFlight} from '../../src/render/point-prim/flight.ts';
import {POINT_PRIM,pointPrimBase} from '../../src/render/point-prim/admit.ts';
import {POINT_PRIM_GRADE} from '../../src/render/point-prim/stamp.ts';
const read=file=>readFileSync('public/world/'+file),load=file=>JSON.parse(read(file));
const t0=gunzipSync(read('height.bin.gz')),c0=gunzipSync(read('cover.bin.gz'));
const crev=load('cover.json'),trev=load('terrain.json');
const terrain=new Terrain(trev,new Int16Array(t0.buffer,t0.byteOffset,t0.length/2));
const cover=new Cover(crev.width,crev.height,Uint8Array.from(c0),undefined,crev.compressedSha256);
assert(pointPrimBase(terrain,cover,trev.sha256));
const index=load('buildings/index.json'),pack=read('buildings/tiles.pack'),roofPin=index.tiles.find(t=>t.id==='q100');
const raw=Uint8Array.from(pack.subarray(roofPin.offset,roofPin.offset+roofPin.bytes));
const gradeBytes=Uint8Array.from(read('point-prim-grade.bin.gz'));
const target=POINT_PRIM.origin,near=new T.Vector3(target[0]-75,76,target[1]+40),far=new T.Vector3(target[0]-8800,85,target[1]);
const pHigh={x:target[0]-75,y:72,z:target[1]+40};
const pLow={x:target[0],y:4.05,z:target[1]};
const pFar={x:far.x,y:72,z:far.z};
const stubs=['save','translate','fillRect','rotate','scale','fillText','restore'];
globalThis.document={createElement:()=>({getContext:()=>Object.fromEntries(stubs.map(k=>[k,()=>{}]))})};
T.TextureLoader.prototype.load=function(){return new T.Texture();};
function makeWorld(){
 const scene=new T.Scene(),sky=new T.Texture();sky.mapping=T.EquirectangularReflectionMapping;scene.environment=sky;
 const world=new World(scene,terrain,new T.Texture(),{capabilities:{maxTextureSize:4096}},cover,sky);
 world.details.load=async()=>undefined;world.update(near,6);
 return {scene,world};
}
async function open(mode,enable=true){
 const {scene,world}=makeWorld();
 let ownerReads=0,gradeReads=0,aborted=false;
 const rope=new PackedBytes('bounded-atlas',pack.length,async(_path,init)=>{
  ownerReads++;assert.equal(init.headers.Range,'bytes='+roofPin.offset+'-'+(roofPin.offset+roofPin.bytes-1));
  const part=raw.slice();
  // GZIP OS header byte is ignored by the stock decompressor. Exactly the
  // same decoded original rows, but wrong compressed checksum for the study.
  if(mode==='owner')part[9]^=32;
  return new Response(part,{status:206,headers:{'Content-Range':`bytes ${roofPin.offset}-${roofPin.offset+roofPin.bytes-1}/${pack.length}`}});
 });
 globalThis.fetch=async(path,init)=>{
  assert.equal(path,'diagnostic/point-prim-grade.bin.gz');gradeReads++;
  if(mode==='missing')return new Response(null,{status:404});
  if(mode==='late'){
   init.signal.addEventListener('abort',()=>aborted=true);
   await new Promise(r=>setTimeout(r,1700));
  }
  const bits=gradeBytes.slice();if(mode==='corrupt')bits[115]^=16;
  return new Response(bits,{headers:{'Content-Length':'1465'}});
 };
 const town={panorama:new T.Texture(),gain:{value:1},mode:'core'};
 const b=new Buildings(scene,terrain,index.tiles,rope,index.sha256,undefined,undefined,undefined,undefined,false,
  undefined,undefined,false,undefined,undefined,undefined,undefined,undefined,town);
 if(enable)b.enablePointPrim();
 const tile=b.tiles.find(q=>q.id==='q100');b.wanted=new Set([tile.id]);await b.load(tile);
 const q=b.meshes.get(tile.id),stock=q.geometry;
 assert.equal(ownerReads,1);assert.equal(stock.attributes.position.count,29745);
 assert.equal(q.geometry.index,null);assert(q.parent===scene);
 const controller=enable?new PointPrimFlight(world,'diagnostic/'):null;
 controller?.qualifyLayers(true);
 return {world,scene,b,controller,q,stock,counts:()=>({ownerReads,gradeReads,aborted})};
}
const stockFixture=await open('valid',false);
const registered=await open('valid');
const {world,b,scene,controller,c,counts,q,stock}=registered;
assert.equal(stockFixture.b.pointPrimSource,undefined);
assert.deepEqual(stockFixture.stock.attributes.position.array,stock.attributes.position.array);
const ground0=world.byId.get('18-19').fine;
const firstWorldY=world.groundHeight(...target),firstVisual=world.visualGroundHeight(...target);
assert(!world.groundGradeInstalled(POINT_PRIM_GRADE.id));
for(let j=0;j<6;j++)controller.before(b,pHigh,near,false,false);
assert.equal(controller.state.requests,0);assert.equal(counts().gradeReads,0);assert.equal(q.geometry,stock);
for(let j=0;j<4;j++)controller.before(b,pFar,far,true,true);
assert.equal(controller.state.requests,0);
const wait=async(check,ms=2300)=>{
 const then=performance.now();
 while(!check()&&performance.now()-then<ms)await new Promise(r=>setTimeout(r,10));
 assert(check(),'Point Prim tick exceeded timeout');
};
controller.before(b,pHigh,near,true,true);
assert.equal(controller.state.owner,'checking');assert.equal(q.geometry,stock);
await wait(()=>controller.state.owner==='verified');
controller.before(b,pHigh,near,true,true);
assert.equal(controller.state.data,'loading');assert.equal(q.geometry,stock);assert.equal(world.groundHeight(...target),firstWorldY);
await wait(()=>controller.state.data==='ready');
assert.equal(q.geometry,stock);assert.equal(world.byId.get('18-19').fine,ground0);assert.equal(controller.state.active,false);
controller.before(b,pLow,near,true,true);
assert.equal(controller.state.deferredClearance,true);assert.equal(q.geometry,stock);assert.equal(world.groundHeight(...target),firstWorldY);
controller.before(b,pHigh,near,true,true);
assert(controller.active);assert(controller.state.grade&&controller.state.draw);
assert.equal(counts().gradeReads,1);
assert.notEqual(q.geometry,stock);assert.equal(q.geometry.index.count,29688);
assert(q.geometry.index.array.every((x,i)=>x===(i<17820?i:i+57)));
assert(Object.entries(stock.attributes).every(([k,a])=>q.geometry.attributes[k]===a));
let sampled=0,changed=0,protectedCount=0,radialClear=99,rayMax=0;
const rc=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0)),wFine=world.byId.get('18-19').fine;
const surveyedBase=stockFixture.world;scene.updateMatrixWorld(true);
for(let i=-33;i<=33;i++)for(let j=-33;j<=33;j++){
 const x=target[0]+i*1.3+.0313,z=target[1]+j*1.3+.037,r=Math.hypot(x-target[0],z-target[1]);
 const P=world.surface(x,z),S=surveyedBase.surface(x,z),y=world.visualGroundHeight(x,z),old=surveyedBase.visualGroundHeight(x,z);
 assert.equal(P.land,S.land);assert.equal(P.runway,S.runway);
 if(Math.abs(y-old)<1e-8){protectedCount++;assert(Math.abs(P.height-S.height)<1e-8);continue;}
 changed++;assert(P.land);assert(cover.distance(terrain,x,z)>37);
 if((i+j)%4===0){
  rc.ray.origin.set(x,80,z);
  const h=rc.intersectObject(wFine,false)[0];assert(h);rayMax=Math.max(rayMax,Math.abs(h.point.y-y));sampled++;
 }
 if(r<4){assert(Math.abs(y-P.height)<1e-8);radialClear=Math.min(radialClear,y-(POINT_PRIM.datum-.255));}
}
assert(changed>1300&&protectedCount>3000&&radialClear>.23&&rayMax<.00011);
controller.before(b,pLow,near,true,true);assert(controller.active,'Once admitted, descent does not revert ground');
controller.after(pFar,far,true);
assert(!controller.state.grade&&!controller.state.draw);assert.equal(q.geometry,stock);
assert.equal(world.byId.get('18-19').fine,ground0);assert.equal(world.groundHeight(...target),firstWorldY);assert.equal(world.visualGroundHeight(...target),firstVisual);
controller.before(b,pHigh,near,true,true);assert(controller.active);assert.equal(counts().gradeReads,1);assert.equal(world.byId.get('18-19').fine,wFine);
world.update(far,7);controller.after(pHigh,near,true);assert.equal(q.geometry,stock);assert(!controller.state.grade&&!controller.state.draw);
world.update(near,8);controller.before(b,pHigh,near,true,true);assert(controller.active);assert.equal(counts().gradeReads,1);
controller.clear();assert.equal(q.geometry,stock);assert(!controller.state.grade&&!controller.state.draw);
const faults={};
for(const failure of ['owner','missing','corrupt','late']){
 const b0=await open(failure);const a=b0.controller;
 a.before(b0.b,pHigh,near,true,true);
 await wait(()=>a.state.owner!=='checking');
 if(failure!=='owner'){
  a.before(b0.b,pHigh,near,true,true);
  await wait(()=>a.state.data==='failed');
 }
 for(let j=0;j<5;j++)a.before(b0.b,pHigh,near,true,true);
 assert(!a.state.grade&&!a.state.draw);assert.equal(b0.q.geometry,b0.stock);
 assert.equal(b0.world.groundHeight(...target),firstWorldY);
 assert.equal(b0.counts().gradeReads,failure==='owner'?0:1);
 if(failure==='late'){
  await new Promise(r=>setTimeout(r,250));a.before(b0.b,pHigh,near,true,true);
  assert.equal(a.state.data,'failed');assert(b0.counts().aborted);assert.equal(b0.world.groundHeight(...target),firstWorldY);
 }
 faults[failure]={...a.state,...b0.counts()};
}
const result={sourceBase:process.env.HEAD,changed,protectedCount,sampled,rayMax,radialClear,stockVertices:29745,retainedVertices:29688,
 legacyGround:firstWorldY,legacyVisual:firstVisual,cleanTransitions:{firstCommitDeferredAtGear:true,
 beforePhysics:true,clearBeforePaint:true,warmReentry:true,coarseExact:true},counts:counts(),faults};
if(process.env.PROOF)writeFileSync(process.env.PROOF,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
