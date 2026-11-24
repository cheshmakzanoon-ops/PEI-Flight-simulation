import * as T from 'three';
import assert from 'node:assert/strict';
import {readFileSync as read} from 'node:fs';
import {registerHooks} from 'node:module';
import {gunzipSync as gunzip} from 'node:zlib';
import {Terrain} from '../../src/sim/terrain.ts';
import {Cover} from '../../src/sim/cover.ts';
import {loadBoundedGrade} from '../../src/sim/bounded-grade.ts';
import {DUNE_RELIEF} from '../../src/sim/dune-relief.generated.ts';
// The app's standard base URL is normally provided by Vite.
const allowed=new URL('../../src/',import.meta.url).href;
registerHooks({load(url,ctx,next){
 if(url.startsWith(allowed)&&url.endsWith('.ts')){
  const s=read(new URL(url),'utf8');
  if(s.includes('import.meta.env'))return {format:'module-typescript',shortCircuit:true,
   source:s.replaceAll('import.meta.env','({BASE_URL:"./"})')};
 }
 return next(url,ctx);
}});
const {World}=await import('../../src/render/world.ts');
const root=new URL('../../public/world/',import.meta.url);
const worldData=file=>read(new URL(file,root));
const data=gunzip(worldData('height.bin.gz')),raw=gunzip(worldData('cover.bin.gz')),s=JSON.parse(worldData('cover.json'));
const dem=new Terrain(JSON.parse(worldData('terrain.json')),new Int16Array(data.buffer,data.byteOffset,data.byteLength/2));
const cover=new Cover(s.width,s.height,Uint8Array.from(raw),undefined,s.compressedSha256);
globalThis.document={createElement:()=>({getContext:()=>Object.fromEntries(['save','translate','fillRect','rotate','scale','fillText','restore'].map(x=>[x,()=>{}]))})};
T.TextureLoader.prototype.load=function(){return new T.Texture()};
function make(grade){
 const scene=new T.Scene();
 const world=new World(scene,dem,new T.Texture(),{capabilities:{maxTextureSize:4096}},cover,new T.Texture(),
  undefined,undefined,undefined,false,false,false,undefined,undefined,false,false,false,false,false,undefined,false,undefined,undefined,[],grade);
 world.details.load=async()=>undefined;
 return {world,scene};
}
const receipts=[];
for(const stamp of DUNE_RELIEF){
 const build=await loadBoundedGrade(stamp,'',async url=>new Response(Uint8Array.from(worldData(url))));
 const grade=build(dem,(x,z)=>dem.atlasElevation(x,z));
 assert(grade);
 const id=stamp.tileX+'-'+stamp.tileZ,dynamic=make(),manual=make(grade);
 const {x0,z0,x1,z1}=grade.grid,x=(x0+x1)*.5,z=(z0+z1)*.5;
 const point=new T.Vector3(x,60,z);
 for(const w of [dynamic,manual]){w.world.update(point,10);w.scene.updateMatrixWorld(true);}
 const a=dynamic.world.byId.get(id),b=manual.world.byId.get(id);
 assert(a?.fine&&b?.fine&&a.lod===112&&b.lod===112);
 const f=a.fine,indicesBefore=f.geometry.index.array.length;
 const retained=dynamic.world.tiles.filter(q=>q!==a).map(q=>[q,q.fine?.geometry,q.coarse.geometry]);
 assert(dynamic.world.mountStandardDuneGrade(grade));
 assert(dynamic.world.groundGradeInstalled(stamp.id));
 assert(a.fine!==f&&a.fine.material===f.material&&a.fine.visible===f.visible);
 assert.deepEqual(a.fine.geometry.index.array,b.fine.geometry.index.array);
 assert.deepEqual(a.fine.geometry.getAttribute('position').array,b.fine.geometry.getAttribute('position').array);
 assert(retained.every(([q,f,c])=>q.fine?.geometry===f&&q.coarse.geometry===c));
 assert(!dynamic.world.mountStandardDuneGrade(grade));
 dynamic.scene.updateMatrixWorld(true);
 const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0));
 let rays=0,core=0,maxVisual=0,maxCollision=0;
 for(let j=0;j<33;j++)for(let i=0;i<33;i++){
  const u=x0+(x1-x0)*(i+.17)/33,v=z0+(z1-z0)*(j+.33)/33;
  const real=dynamic.world.visualGroundHeight(u,v),physical=dynamic.world.groundHeight(u,v);
  assert.equal(real,manual.world.visualGroundHeight(u,v));assert.equal(physical,manual.world.groundHeight(u,v));
  ray.ray.origin.set(u,90,v);
  const hit=ray.intersectObject(a.fine,false)[0];
  if(hit){rays++;maxVisual=Math.max(maxVisual,Math.abs(real-hit.point.y));}
  if(hit&&grade.weight(u,v)>0.99999){core++;maxCollision=Math.max(maxCollision,Math.abs(hit.point.y-physical));}
 }
 assert(rays>1000&&core>20&&maxVisual<0.0001&&maxCollision<0.0001);
 const fine=a.fine.geometry.getAttribute('position').array.slice(),triangles=(a.fine.geometry.index.array.length-indicesBefore)/3;
 dynamic.world.update(new T.Vector3(x+18000,600,z),11);
 assert(!dynamic.world.groundGradeInstalled(stamp.id));
 dynamic.world.update(point,12);assert(dynamic.world.groundGradeInstalled(stamp.id));
 assert.deepEqual(a.fine.geometry.getAttribute('position').array,fine);
 receipts.push({id:stamp.id,atomicSwap:true,sameAsOriginalManualVariant:true,neighborMeshesUnchanged:true,triangles,groundRays:rays,contactRays:core,maxVisual,maxCollision,roundTripExact:true});
}
console.log(JSON.stringify(receipts,null,2));
