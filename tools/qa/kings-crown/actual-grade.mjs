/* Detached composition of the exact installed Three World, terrain, collider,
   and bounded optional loader. Camera/pixel witnesses are a separate GLES job. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {loadAtlas,World} from '../../../src/render/world.ts';
import {loadBoundedGrade,BoundedGrade} from '../../../src/sim/bounded-grade.ts';
import {KINGS_DRY_CROWN as S} from '../../../src/sim/kings-dry-crown.generated.ts';
import {kingsDryCrownSources,kingsDryCrownHedges,kingsDryCrownInterior,kingsDryCrownRequested} from '../../../src/sim/kings-dry-crown.ts';
const pub=process.env.PEI_PUBLIC,here=process.env.SCOUT;
assert(pub&&here);const sha=x=>createHash('sha256').update(x).digest('hex');
const read=(name)=>fs.readFileSync(path.join(pub,String(name).replace(/^\//,'')));
const request=async url=>{try{return new Response(read(url));}catch{return new Response(null,{status:404});}};
globalThis.fetch=request;
T.TextureLoader.prototype.load=()=>new T.Texture();T.TextureLoader.prototype.loadAsync=async()=>new T.Texture();
globalThis.document={createElement:()=>({getContext:()=>new Proxy({}, {get:()=>()=>{}})})};
const {terrain,img,cover,sky,bench,southLake,sourisLighting,terrainSha}=await loadAtlas(()=>{},false,false,false,undefined,false,undefined,undefined,true);
assert.equal(cover.sourceDecodedSha,S.coverDecodedSha256);assert.equal(terrainSha,S.terrainSha256);
const pack=fs.readFileSync(path.join(pub,'world',S.file)),readPack=async()=>new Response(pack);
const source=(...pins)=>kingsDryCrownSources(terrain,cover,terrainSha,...pins);
const pins=[S.roadsSha256,S.sidewalksSha256,S.parkingSha256,true,await kingsDryCrownHedges('/world/',request)];
assert(source(...pins));
assert([0,1,2,3,4].every(i=>!source(...pins.map((v,j)=>i===j?undefined:v))));
assert(!kingsDryCrownRequested(new URLSearchParams(''))&&kingsDryCrownRequested(new URLSearchParams('kingsDryCrownStudy')));
assert(['scenery=detail','inlandRelief','surveyRelief','buildingShadows','woodland3D','sourceGrassStudy'].every(f=>!kingsDryCrownRequested(new URLSearchParams('kingsDryCrownStudy&'+f))));
const install=await loadBoundedGrade(S,'/world/',readPack);assert(install);
assert.throws(()=>new BoundedGrade(terrain,S,new Int16Array(129**2),new Uint8Array(129**2),(x,z)=>terrain.atlasElevation(x,z)),/ceiling/);
const grade=install(terrain,(x,z)=>terrain.atlasElevation(x,z));
assert(kingsDryCrownInterior(terrain,cover,grade));
const worlds=[undefined,grade].map(g=>{
 const scene=new T.Scene(),r={capabilities:{maxTextureSize:4096}};
 const w=new World(scene,terrain,img,r,cover,sky,bench,southLake,sourisLighting,false,false,false,undefined,undefined,
  false,false,false,false,false,undefined,false,undefined,undefined,[],g);
 w.details.load=async()=>undefined;return w;
});
const eye=new T.Vector3(32122.8438480168,15,6820.018148314436);
const up=position=>worlds.forEach((w,i)=>{w.update(position,20+step);w.scene.updateMatrixWorld(true);}),key='21-12';
let step=0;up(eye);
const [stock,art]=worlds;
const owner=w=>w.byId.get(key), near=w=>owner(w).fine, geometry=w=>(owner(w).lod>8?near(w):owner(w).coarse).geometry;
assert.equal(stock.activeGroundGrade,null);assert.deepEqual(art.activeGroundGrades,[S.id]);
assert.equal(owner(art).lod,112);assert.equal(owner(stock).lod,112);
const exactGeometry=(a,b)=>{
 for(const o of ['index',...Object.keys(a.attributes)]){
  const A=o==='index'?a.index:a.attributes[o],B=o==='index'?b.index:b.attributes[o];
  if(!A||!B){if(A!==B)return false;continue;}
  const buffer=q=>Buffer.from(q.array.buffer,q.array.byteOffset,q.array.byteLength);
  if(!buffer(A).equals(buffer(B)))return false;
 }
 return Object.keys(a.attributes).length===Object.keys(b.attributes).length;
};
const f=fs.readFileSync(path.join(here,'dry-2112-world-centres.f64')),xz=new Float64Array(f.buffer,f.byteOffset,f.byteLength/8);
const newV=new Float64Array(xz.length/2*4),diag={count:xz.length/2,changes:0,wet:0,outside:0,physical:0,core:0,nearRays:0,offRays:0,
 maxNearRayErrorM:0,maxCoreContactErrorM:0,maxCollarResidualM:0,minimumChangedCoverM:254,
 triangles:[geometry(stock).index.count/3,geometry(art).index.count/3]};
const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0)), p0=near(stock),p1=near(art);
const n0=p0.geometry.getAttribute('position'),n1=p1.geometry.getAttribute('position');
const orig=Buffer.from(n0.array.buffer,n0.array.byteOffset,n0.array.byteLength);
assert(orig.equals(Buffer.from(n1.array.buffer,n1.array.byteOffset,n0.array.byteLength)),'no old vertex positions changed');
assert.deepEqual(stock.shoreFaces.map(o=>o.geometry.index?.count??o.geometry.getAttribute('position').count),art.shoreFaces.map(o=>o.geometry.index?.count??o.geometry.getAttribute('position').count));
assert(stock.shoreFaces.every((o,i)=>exactGeometry(o.geometry,art.shoreFaces[i].geometry)),'coastal curtains exact');
for(let i=0;i<xz.length;i+=2){
 const x=xz[i],z=xz[i+1],signed=cover.distance(terrain,x,z),w=grade.weight(x,z),gOld=stock.surface(x,z),gNew=art.surface(x,z);
 const oldY=stock.visualGroundHeight(x,z),newY=art.visualGroundHeight(x,z);
 newV.set([newY,gNew.height,w,signed],i*2);
 assert.equal(gOld.land,gNew.land);assert.equal(gOld.runway,gNew.runway);
 if(signed<0){diag.wet++;assert.equal(gNew.height,gOld.height);assert.equal(gNew.height,-.055);}
 if(w>0){
  assert(signed>69&&gNew.land&&!gNew.runway);
  diag.minimumChangedCoverM=Math.min(diag.minimumChangedCoverM,signed);
  diag.changes+=+(Math.abs(newY-oldY)>.004);
  diag.physical+=+(Math.abs(gNew.height-gOld.height)>.004);
  if(w>1-1e-9){diag.core++;diag.maxCoreContactErrorM=Math.max(diag.maxCoreContactErrorM,Math.abs(newY-gNew.height));}
  else diag.maxCollarResidualM=Math.max(diag.maxCollarResidualM,Math.abs(newY-gNew.height-(1-w)*(oldY-gOld.height)));
 }else{diag.outside++;assert.equal(newY,oldY);assert.equal(gNew.height,gOld.height);}
 const nearPick=w>0&&i%46===0,offPick=!w&&i%142===0;
 if(nearPick||offPick){
  ray.ray.origin.set(x,90,z);
  const pair=[ray.intersectObject(p0,false),ray.intersectObject(p1,false)];
  assert(pair.every(h=>h.length===1),[x,z,pair.map(h=>h.length)]);
  const delta=Math.abs(pair[1][0].point.y-newY);
  if(nearPick){diag.nearRays++;diag.maxNearRayErrorM=Math.max(diag.maxNearRayErrorM,delta);assert(delta<.00012,[x,z,delta]);}
  else{diag.offRays++;assert(Math.abs(pair[0][0].point.y-pair[1][0].point.y)<.000010,[x,z]);}
 }
}
assert(diag.core>2500&&diag.nearRays>300&&diag.wet>5000&&diag.maxCoreContactErrorM<.00001);
assert(diag.maxCollarResidualM<.00001);
const states=[];
for(const [wanted,forward] of [[56,8600],[8,15000],[56,8100],[112,0]]){
 step++;
 up(new T.Vector3(eye.x,eye.y,owner(stock).z0+owner(stock).d/2+forward));
 assert.equal(owner(art).lod,wanted);assert.equal(owner(stock).lod,wanted);
 assert.equal(art.activeGroundGrade,wanted===112?S.id:null);
 if(wanted!==112){assert(exactGeometry(geometry(stock),geometry(art)));assert.deepEqual(stock.surface(32169,6934),art.surface(32169,6934));}
 else assert(!exactGeometry(geometry(stock),geometry(art)));
 const t=owner(art),v0=(wanted!==8?near(stock).geometry:owner(stock).coarse.geometry).attributes.position;
 const v1=(wanted!==8?near(art).geometry:t.coarse.geometry).attributes.position;
 const n=wanted,stride=n+1;
 for(let i=0;i<=n;i++)for(const q of [i,i+n*stride,i*stride,i*stride+n])assert.equal(v0.getY(q),v1.getY(q));
 states.push({wanted,install:art.activeGroundGrade,seams:t.seams??null});
}
fs.writeFileSync(path.join(here,'native-after.f64'),Buffer.from(newV.buffer));
fs.writeFileSync(path.join(here,'actual-crown.json'),JSON.stringify({diag,states,uncoveredDownwardRaySamples:0},null,2)+'\n');
console.log({diag,states});
if(process.env.CROWN_ROLLOVER){
 const tile=owner(art),normal=new T.Vector2(27522.92946-tile.x0-tile.w/2,8173.28757-tile.z0-tile.d/2).normalize();
 const oy=22,focus=new T.Vector3(32170,9.2,6936), camera=new T.PerspectiveCamera(53,960/680,.08,350000);
 const samples=[];
 for(let i=0;i<xz.length;i+=22){
  const x=xz[i],z=xz[i+1],w=grade.weight(x,z);if(w<.02)continue;
  samples.push({x,z,w,full:art.visualGroundHeight(x,z),old:stock.visualGroundHeight(x,z),p0:stock.groundHeight(x,z),p1:art.groundHeight(x,z)});
 }
 const report=[];let kept,keptZero,lastGain=1,maxDeltaPx=0,check=0,liveCompare=0;
 let maxY=0,maxAbsoluteCollisionModel=0,stockLease=0,physicalOutsideChecks=0,zeroMeshComparisons=0,retainedStageUse=0;
 for(const d of [4300,...Array.from({length:30},(_,i)=>4475+25*i),5199.99,5200,5210,5199.99,5200,5280,5299,5500,6199,6201,6330,9600,14990,5280,5200,5175,...Array.from({length:27},(_,i)=>5150-25*i),4250]){
  step++;const worldEye=new T.Vector3(tile.x0+tile.w/2+normal.x*d,oy,tile.z0+tile.d/2+normal.y*d);
  up(worldEye);
  const amount=(r)=>{if(r<=4500)return 1;if(r>=5200)return 0;const t=(5200-r)/700;return t*t*(3-2*t);};
  const a=amount(d),keyGain=art.kingsDryCrownBlend;
  assert(Math.abs(a-keyGain)<1e-11&&stock.kingsDryCrownBlend===0);
  assert.equal(owner(stock).lod,owner(art).lod);
  if(a>0){
   assert(art.activeGroundGrade===S.id&&near(art).material.uniforms.kingsCrownGain.value===keyGain);
   if(kept)assert.equal(near(art),kept);else kept=near(art);
   retainedStageUse++;
  }else{
   assert.equal(art.activeGroundGrade,null);assert(exactGeometry(geometry(stock),geometry(art)));
   zeroMeshComparisons++;
   if(owner(art).lod===112){
    if(keptZero)assert.equal(keptZero,near(art));else keptZero=near(art);
    stockLease++;
   }else{kept=undefined;keptZero=undefined;}
  }
  camera.position.copy(worldEye);camera.lookAt(focus);camera.updateMatrixWorld(true);
  for(const [j,s] of samples.entries()){
   const {x,z,old,full,p0,p1}=s;
   const s0=stock.surface(x,z),s1=art.surface(x,z),x0=stock.visualGroundHeight(x,z),x1=art.visualGroundHeight(x,z);
   if(a===0){assert.deepEqual(s0,s1);assert.equal(x0,x1);check++;continue;}
   assert(s0.land&&s1.land&&s0.runway===s1.runway);
   maxY=Math.max(maxY,Math.abs(old+(full-old)*a-x1));
   maxAbsoluteCollisionModel=Math.max(maxAbsoluteCollisionModel,Math.abs(p0+(p1-p0)*a-s1.height));
   if(j%17===0){
    ray.ray.origin.set(x,220,z);const hit=ray.intersectObject(near(art),false);
    assert(hit.length===1&&Math.abs(hit[0].point.y-x1)<.00012,[d,x,z,hit.length,hit[0]?.point.y,x1]);liveCompare++;
   }
   // Camera is held within this probe; isolate artist gain motion from
   // ordinary camera parallax and the stock N112/N56 switch.
   if(Math.abs(lastGain-a)<=.06){
    const p=new T.Vector3(x,x1,z).project(camera),b=new T.Vector3(x,old+(full-old)*lastGain,z).project(camera);
    maxDeltaPx=Math.max(maxDeltaPx,Math.abs(p.y-b.y)*540);
   }
  }
  for(const [x,z] of [[32122.84,6820.01],[32170,6810],[32500,7040],[32050,7120]]){
   assert.deepEqual(art.surface(x,z),stock.surface(x,z));
   assert.equal(art.visualGroundHeight(x,z),stock.visualGroundHeight(x,z));physicalOutsideChecks++;
  }
  report.push({m:d,tier:owner(art).lod,gain:keyGain,active:art.activeGroundGrade,
    y:art.visualGroundHeight(32170,6936),h:art.groundHeight(32170,6936),meshId:near(art)?.uuid});
  lastGain=a;
 }
 assert(maxY<.000006&&maxAbsoluteCollisionModel<.000006&&maxDeltaPx<.3);
 const receipt={checkedStates:report.length,verticesPerPose:samples.length,zeroMeshComparisons,retainedStageUse,stockLease,
  actualDirectThreeTransitionRays:liveCompare,exactUnchangedOutside:physicalOutsideChecks,exactUnloadHeightChecks:check,
  maxVisualAlgebraDisagreementM:maxY,maxPhysicalAlgebraDisagreementM:maxAbsoluteCollisionModel,worstCrownStepVsSameCameraPixels1080:maxDeltaPx,states:report};
 fs.writeFileSync(path.join(here,'rollover-C.json'),JSON.stringify(receipt,null,2)+'\n');
 console.log(Object.fromEntries(Object.entries(receipt).filter(([k])=>k!=='states')));
}

if(process.env.CROWN_ROLLOVER){
 // Simulate two visible camera cuts at exactly the preceding World tick.
 // At zero the authoritative old object returns *without* waiting for 250ms.
 const t=owner(art),reentry=new T.Vector3(32122.84385,15,6820.01815);
 step++;up(reentry);assert.equal(art.kingsDryCrownBlend,1);
 const installed=near(art),surface=(w,x=32170,z=6936)=>[w.visualGroundHeight(x,z),w.groundHeight(x,z),w.surface(x,z).land];
 const full=surface(art),old=surface(stock);assert.notDeepEqual(full,old);
 const zero=[];
 for(const d of [5200,6180]){
  const outward=new T.Vector3(t.x0+t.w/2+d,22,t.z0+t.d/2),epoch=art.visualGroundEpoch;
  up(outward); // identical clock; handoff must happen ahead of the sweep early-return
  assert.equal(art.kingsDryCrownBlend,0);assert.equal(art.activeGroundGrade,null);
  assert.equal(owner(art).lod,112);assert(exactGeometry(geometry(art),geometry(stock)));
  assert.deepEqual(surface(art),old);assert.equal(art.visualGroundEpoch,epoch+1);
  const fallback=near(art);
  up(reentry); // expected not to build/re-arm while the larger normal sweep is held
  assert.equal(art.kingsDryCrownBlend,0);assert.equal(near(art),fallback);
  step++;up(reentry);assert.equal(art.kingsDryCrownBlend,1);assert.equal(near(art),installed);
  assert.deepEqual(surface(art),full);
  zero.push({outwardOwnerDistanceM:d,stockExactAtPreviousClock:true,noRearmBeforeSweep:true,exactMeasuredLeaseReused:true});
 }
 fs.writeFileSync(path.join(here,'rollover-C1-same-clock.json'),JSON.stringify({zero},null,2)+'\n');
 console.log(zero);
}
