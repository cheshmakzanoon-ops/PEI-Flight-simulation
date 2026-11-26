import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync as file} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {registerHooks} from 'node:module';
import {MeshBasicMaterial,PerspectiveCamera,Scene,Vector3} from 'three';
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
const {World}=await import('../../src/render/world.ts');
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
