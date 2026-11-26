import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync as file} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {registerHooks} from 'node:module';
import {MeshBasicMaterial,Scene} from 'three';
import {Terrain} from '../../src/sim/terrain.ts';
import {Cover} from '../../src/sim/cover.ts';
import {WORLD_COLS,WORLD_ROWS} from '../../src/sim/coastal-terrain.ts';
import {verifiedPrinceOverview} from '../../src/render/prince-grassland/source.ts';
const src=new URL('../../src/',import.meta.url).href;
const hook=registerHooks({load(url,ctx,next){
 const out=next(url,ctx);
 return out.source&&url.startsWith(src)&&url.endsWith('.ts')?{...out,source:"import.meta.env={BASE_URL:'/'};\n"+out.source}:out;
}});
const {World}=await import('../../src/render/world.ts');hook.deregister();
const root=new URL('../../public/',import.meta.url);
const read=(name:string)=>file(new URL(name,root));

test('actual 7-8 licensed data install only measured contact and preserve legitimate native stitching',async()=>{
 const current=JSON.parse(read('world/terrain-adaptive/v1/index.json').toString()),t=JSON.parse(read('world/terrain.json').toString()),
  c=JSON.parse(read('world/cover.json').toString()),raw=gunzipSync(read('world/'+t.file));
 const terrain=new Terrain(t,new Int16Array(raw.buffer,raw.byteOffset,raw.length/2)),cover=new Cover(c.width,c.height,gunzipSync(read('world/'+c.file)));
 const src=await verifiedPrinceOverview('https://atlas.invalid/',current.pins,async(input,init)=>{
  const u=new URL(String(input)).pathname.slice(1),range=new Headers(init?.headers).get('range'),body=read(u);
  if(!range)return new Response(Uint8Array.from(body));
  const match=range.match(/^bytes=(\d+)-(\d+)$/);assert(match);
  const i=+match[1],j=+match[2];
  return new Response(Uint8Array.from(body.subarray(i,j+1)),{status:206,headers:{'content-range':`bytes ${i}-${j}/${body.length}`}});
 });
 assert(src);
 const scene=new Scene(),mat=new MeshBasicMaterial(),world:any=Object.assign(Object.create(World.prototype),{
  scene,terrain,cover,mat,byId:new Map(),grades:new Map(),pondMeshes:[],groundVersion:0,reliefActive:new Set(),shoreFaces:[],
 });
 const w=(terrain.right-terrain.left)/WORLD_COLS,d=(terrain.bottom-terrain.top)/WORLD_ROWS,
  x0=terrain.left+7*w,z0=terrain.top+8*d;
 const mesh=world.patch(x0,z0,w,d,112),coarse=world.patch(x0,z0,w,d,8);coarse.visible=false;
 const tile={id:'7-8',i:7,j:8,x0,z0,w,d,lod:112,fine:mesh,coarse,local:mat,seams:'112:112,112,112,112'};
 world.byId.set(tile.id,tile);scene.add(mesh,coarse);
 tile.seams=world.rebuildPreviewRim(tile,mesh);
 const original=mesh.geometry,spot=[-54223.89428026856,-16681.335701785214] as const,protectedPoint=[x0+12,z0+12] as const,
  old=world.groundHeight(...spot),outside=world.groundHeight(...protectedPoint);
 assert(world.preparePrinceLandscape(src));assert(world.princeLandscapeReady);assert(!world.princeLandscapeActive);
 assert.equal(world.groundHeight(...spot),old);assert.equal(mesh.geometry,original);
 world.armPrinceLandscape();assert(world.princeLandscapeActive);
 const measured=world.groundHeight(...spot);assert(measured>old+2);
 assert.equal(world.groundHeight(...protectedPoint),outside);
 const done=world.beginPrinceLandscapeDraw();assert(done);assert.notEqual(mesh.geometry,original);assert.equal(world.groundHeight(...spot),measured);
 done();assert.equal(mesh.geometry,original);
 // Changed known native neighbour resolution, not a forged position update.
 world.byId.set('7-7',{lod:56});tile.seams=world.rebuildPreviewRim(tile,mesh);
 world.checkPrinceLandscape();assert(world.princeLandscapeActive);assert.equal(world.groundHeight(...spot),measured);
 const vertex=56,stock=mesh.geometry.getAttribute('position'),base=stock.getY(vertex);
 stock.setY(vertex,base+10); // same token, unapproved source mutation
 world.checkPrinceLandscape();
 assert(!world.princeLandscapeActive);assert.equal(world.beginPrinceLandscapeDraw(),undefined);
 assert.equal(world.groundHeight(...spot),old);assert.equal(mesh.geometry,original);assert.equal(stock.getY(vertex),Math.fround(base+10));
 assert.equal(world.groundHeight(...protectedPoint),outside);
});
