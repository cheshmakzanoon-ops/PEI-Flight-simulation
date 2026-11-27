import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync as file} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {registerHooks} from 'node:module';
import {MeshBasicMaterial,PerspectiveCamera,Scene,Texture,TextureLoader,Vector3} from 'three';
import {Terrain} from '../../src/sim/terrain.ts';
import {Cover} from '../../src/sim/cover.ts';
import {WORLD_COLS,WORLD_ROWS} from '../../src/sim/coastal-terrain.ts';
import {KINGS_DRY_CROWN as G} from '../../src/sim/kings-dry-crown.generated.ts';
import {loadBoundedGrade} from '../../src/sim/bounded-grade.ts';
import {FIXED_STEP,neutral,spawn,step} from '../../src/sim/flight.ts';
import {SITES} from '../../src/sim/places.ts';

const src=new URL('../../src/',import.meta.url).href;
const hook=registerHooks({load(url,context,next){
 const out=next(url,context);
 return out.source&&url.startsWith(src)&&url.endsWith('.ts')?{...out,source:"import.meta.env={BASE_URL:'/'};\n"+out.source}:out;
}});
const {World,loadAtlas}=await import('../../src/render/world.ts');
hook.deregister();

async function exactFixture(){
 const read=(n:string)=>file(new URL('../../public/world/'+n,import.meta.url));
 const t=JSON.parse(read('terrain.json').toString()),c=JSON.parse(read('cover.json').toString()),raw=gunzipSync(read(t.file));
 const terrain=new Terrain(t,new Int16Array(raw.buffer,raw.byteOffset,raw.length/2));
 const load=await loadBoundedGrade(G,'https://unused.invalid/',async()=>new Response(Uint8Array.from(read(G.file))));
 assert(load);
 const grade=load(terrain,(x,z)=>terrain.atlasElevation(x,z));assert(grade);
 const cover=new Cover(c.width,c.height,new Uint8Array(gunzipSync(read(c.file)))),scene=new Scene(),mat=new MeshBasicMaterial();
 const world:any=Object.assign(Object.create(World.prototype),{scene,terrain,cover,mat,byId:new Map(),grades:new Map(),pondMeshes:[],
  groundVersion:0,reliefActive:new Set(),shoreFaces:[],kingsRidgeDrawing:false});
 const w=(terrain.right-terrain.left)/WORLD_COLS,d=(terrain.bottom-terrain.top)/WORLD_ROWS,
  x0=terrain.left+G.tileX*w,z0=terrain.top+G.tileZ*d;
 const owner=world.patch(x0,z0,w,d,112),coarse=world.patch(x0,z0,w,d,8);coarse.visible=false;
 const tile={id:'21-12',i:G.tileX,j:G.tileZ,x0,z0,w,d,lod:112,fine:owner,coarse,local:mat,seams:'112:112,112,112,112'};
 world.byId.set(tile.id,tile);scene.add(owner,coarse);
 return {world,scene,mat,owner,tile,grade};
}

test('certified ridge contact is identical in visible and out-of-view brackets and changes a genuine low contact step',async()=>{
 const {world,scene,mat,owner,grade}=await exactFixture(),stock=owner.geometry,
  peak=[32183.919282,6930.029637] as const,off=[32084,6525] as const;
 const query=(x:number,z:number)=>world.surface(x,z);
 world.rebuildPreviewRim(world.byId.get('21-12'),owner);
 const old=query(...peak),wet=query(...off);assert(old.land&&!old.runway&&!wet.land);
 const site=SITES.find(s=>s.id==='kings-coastal-ridge');assert(site);
 const start=spawn(site,query),low={...start,x:peak[0],z:peak[1],y:17.43,heading:Math.PI,speed:52};
 const lowOff={...low};step(lowOff,neutral,query,FIXED_STEP);assert.equal(lowOff.status,'flying');
 assert(world.installKingsRidge(grade));assert(world.maintainKingsRidge());
 const measured=query(...peak);assert(measured.height>old.height+11);assert.deepEqual(query(...off),wet);
 assert.equal(owner.geometry,stock);assert.equal(owner.material,mat);
 const camera=new PerspectiveCamera(45,1200/760,.08,100000);
 camera.position.set(32130,120,6600);camera.lookAt(new Vector3(32170,14,6910));
 const active=world.beginKingsRidgeDraw(camera);assert(active);assert.notEqual(owner.geometry,stock);
 assert.equal(owner.material,mat);assert.equal(owner.parent,scene);
 assert.deepEqual(query(...peak),measured);active();assert.equal(owner.geometry,stock);
 camera.lookAt(new Vector3(32130,190,7100));assert.equal(world.beginKingsRidgeDraw(camera),undefined);
 assert.deepEqual(query(...peak),measured);assert(world.kingsRidgeContactActive);
 const lowOn={...low};step(lowOn,neutral,query,FIXED_STEP);
 assert.equal(lowOn.status,'stopped');assert.match(lowOn.notice,/Terrain contact/);
 world.clearKingsRidge();assert.equal(owner.geometry,stock);assert.deepEqual(query(...peak),old);
});

test('ridge refuses an altered source receiver and revokes corrupt candidate without touching foreign stock',async()=>{
 const {world,owner,grade}=await exactFixture(),stock=owner.geometry;
 const p=stock.getAttribute('position'),i=G.firstX+(G.firstZ+1)*113,y=p.getY(i);
 p.setY(i,y+2);assert(!world.installKingsRidge(grade));p.setY(i,y);
 world.rebuildPreviewRim(world.byId.get('21-12'),owner);
 const outside=300,yOutside=p.getY(outside);p.setY(outside,yOutside+2);
 assert(!world.installKingsRidge(grade));p.setY(outside,yOutside);p.needsUpdate=true;
 const parentIndex=stock.index!,old=parentIndex.getX(11);parentIndex.setX(11,old+1);
 assert(!world.installKingsRidge(grade));parentIndex.setX(11,old);parentIndex.needsUpdate=true;
 assert(world.installKingsRidge(grade));
 const c=world.kingsRidge.raised,idx=c.geometry.index!,first=idx.getX(0);
 idx.setX(0,first+1);assert.equal(world.maintainKingsRidge(),false);assert.equal(owner.geometry,stock);
 assert(world.installKingsRidge(grade));
 const foreign=stock.clone();owner.geometry=foreign;assert.equal(world.maintainKingsRidge(),false);
 assert.equal(owner.geometry,foreign);
});

test('ordinary World sews both ridge surfaces across real neighbor LOD transitions without dropping contact',async()=>{
 const worldFiles=new URL('../../public/',import.meta.url);
 const localFetch:typeof fetch=async url=>{
  try{return new Response(Uint8Array.from(file(new URL(String(url).replace(/^\//,''),worldFiles))));}
  catch{return new Response(null,{status:404});}
 };
 const original=[globalThis.fetch,globalThis.document,TextureLoader.prototype.load,TextureLoader.prototype.loadAsync] as const;
 let atlas:Awaited<ReturnType<typeof loadAtlas>>,world:any;
 const scene=new Scene();
 try{
  globalThis.fetch=localFetch;
  (globalThis as any).document={createElement:()=>({getContext:()=>new Proxy({}, {get:()=>()=>{}})})};
  TextureLoader.prototype.load=()=>new Texture();TextureLoader.prototype.loadAsync=async()=>new Texture();
  atlas=await loadAtlas(()=>{},false,false,false,undefined,false,undefined,undefined,true);
  const {terrain,cover,img,sky,bench,southLake,sourisLighting}=atlas;
  world=new World(scene,terrain,img,{capabilities:{maxTextureSize:4096}} as any,cover,sky,bench,southLake,sourisLighting);
 }finally{
  [globalThis.fetch,globalThis.document,TextureLoader.prototype.load,TextureLoader.prototype.loadAsync]=original;
 }
 const {terrain,terrainSha,cover}=atlas;
 assert.equal(terrainSha,G.terrainSha256);assert.equal(cover.sourceDecodedSha,G.coverDecodedSha256);
 const signed=await loadBoundedGrade(G,'/world/',localFetch,3000);assert(signed);
 const grade=signed(terrain,(x,z)=>terrain.atlasElevation(x,z));
 world.details.load=async()=>undefined;
 const tile=world.byId.get('21-12'),east=world.byId.get('22-12'),E=east.x0+east.w/2;
 const camera=new PerspectiveCamera(53,1200/760,.08,350000);
 let clock=0;
 const advance=(x:number,visible:boolean)=>{
  camera.position.set(x,24,6935.5);
  camera.lookAt(visible?new Vector3(32170,11,6936):camera.position.clone().add(new Vector3(0,85,185)));
  camera.updateMatrixWorld();world.update(camera.position,++clock);scene.updateMatrixWorld(true);
 };
 advance(E-5100,true);assert.equal(tile.lod,112);assert.equal(east.lod,112);
 const mesh=tile.fine,base=mesh.geometry,material=mesh.material,peak=[32170,6936] as const;
 const points=[peak,[32130.321058664347,6941.866852017043],[32131.05555833078,6947.082420288748],[32114,6925],[32120,6868],[32000,6800]] as const;
 const heights=()=>points.map(([x,z])=>world.groundHeight(x,z));
 const stock=heights();assert(world.installKingsRidge(grade));
 const raised=world.kingsRidge.raised.geometry,heightsWithRidge=heights();
 assert(Math.abs(heightsWithRidge[0]-stock[0]-9.4284469904)<0.002);
 const streams=(g:any)=>Object.fromEntries([['index',g.index.array.slice()],...Object.entries(g.attributes).map(([k,v]:[string,any])=>[k,v.array.slice()])]);
 const a=streams(base),b=streams(raised);
 const diff=(before:any,g:any)=>{
  const after=streams(g),start=before.position,end=after.position;
  assert.equal(start.length,end.length);
  for(const k of Object.keys(before))if(k!=='position')assert.deepEqual(after[k],before[k],k);
  const rows=[];
  for(let i=0;i<start.length;i++)if(start[i]!==end[i]){
   assert.equal(i%3,1);assert.equal(Math.floor(i/3)%113,112);
   rows.push([i,end[i]]);
  }
  return rows;
 };
 for(const [x,lod,visible] of [[E-6204,56,true],[E-5250,112,false],[E-6204,56,false],[E-5260,112,true]] as const){
  assert(world.maintainKingsRidge());advance(x,visible);assert.equal(east.lod,lod);assert.equal(tile.lod,112);
  assert.equal(tile.fine,mesh);
  const end=world.beginKingsRidgeDraw(camera);assert.equal(!!end,visible);
  try{assert.equal(mesh.geometry,visible?raised:base);assert.equal(mesh.material,material);}
  finally{end?.();}
  assert.equal(mesh.geometry,base);assert(world.maintainKingsRidge());
  const old=diff(a,base),measured=diff(b,raised);
  assert.deepEqual(measured,old);assert.equal(old.length,lod===56?24:0);
  assert.deepEqual(heights(),heightsWithRidge);
 }
 const rim=77*113+112,p=base.getAttribute('position');
 p.setY(rim,p.getY(rim)+0.0625);
 assert(!world.maintainKingsRidge());
 assert.equal(mesh.geometry,base);assert.deepEqual(heights(),stock);
});
