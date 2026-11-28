import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync as read} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Camera, MeshBasicMaterial, Scene, Texture, EquirectangularReflectionMapping} from 'three';
import {Terrain} from '../src/sim/terrain.ts';
import {Buildings} from '../src/render/buildings.ts';
import {foundersWestRequested} from '../src/app/scenery-profile.ts';
import {FOUNDERS_WEST,foundersOwnerCustody,foundersWestTile,foundersWestWire} from '../src/render/founders-west/authority.ts';
import {FoundersWestLease} from '../src/render/founders-west/lease.ts';
import {patchFoundersWestWall} from '../src/render/founders-west/shader.ts';
import {TOWN_WALL_CORE_AREAS} from '../src/render/town-wall-optics.ts';

const file=(f:string)=>read('public/world/'+f),json=(f:string)=>JSON.parse(file(f).toString());
const atlas=json('buildings/index.json'),spec=json('terrain.json'),terrainFile=gunzipSync(file(spec.file));
const terrain=new Terrain(spec,new Int16Array(terrainFile.buffer,terrainFile.byteOffset,terrainFile.length/2));
const p=atlas.tiles.find((x:any)=>x.id===FOUNDERS_WEST.id),pack=file('buildings/'+atlas.file);
const wire=Uint8Array.from(pack.subarray(p.offset,p.offset+p.bytes)).buffer;
const rows=JSON.parse(gunzipSync(new Uint8Array(wire)).toString()).features;
const until=async(f:()=>boolean)=>{for(let i=0;i<150&&!f();i++)await new Promise(r=>setTimeout(r,3));assert(f());};
function stock(){
 const scene=new Scene(),sky=new Texture();
 sky.mapping=EquirectangularReflectionMapping;scene.environment=sky.clone();
 const b=new (Buildings as any)(scene,terrain,atlas.tiles,{},atlas.sha256,undefined,undefined,undefined,undefined,false,undefined,undefined,false,undefined,undefined,undefined,undefined,undefined,
  {panorama:sky,gain:{value:1},mode:'core',areas:TOWN_WALL_CORE_AREAS});
 const tile=b.tiles.find((x:any)=>x.id===FOUNDERS_WEST.id);
 const owner=b.generate(rows,tile,false);
 scene.add(owner);
 return {scene,owner,geometry:owner.geometry,stock:owner.material};
}

test('Founders requires the current Standard nonindexed receiver and exact seven signed streams',async()=>{
 const seed=stock(),custody=foundersOwnerCustody(seed);
 assert(custody?.live());assert(await custody.authenticate());
 assert.equal(seed.geometry.attributes.townWallFit.array.length,41007*3);
 assert.equal(seed.geometry.index,null);assert.equal(seed.geometry.groups.length,0);
 assert(foundersWestTile(atlas.sha256,p));assert(!foundersWestTile(atlas.sha256,{...p,offset:p.offset+1}));
 assert(await foundersWestWire(wire,rows));
 assert(!await foundersWestWire(wire,[...rows.slice(0,313),rows[314],...rows.slice(314)]));
 assert(foundersWestRequested(new URLSearchParams('departure=harbour-low&diagnostics')));
 for(const q of ['stockFoundersWestWall','scenery=detail','unknown','scenery=standard&scenery=standard'])
  assert(!foundersWestRequested(new URLSearchParams(q)));
 seed.geometry.addGroup(0,41007);
 assert(!custody.live());assert(!foundersOwnerCustody(seed));
 seed.geometry.clearGroups();assert(custody.live());
 seed.geometry.getAttribute('townWallFit').needsUpdate=true;
 assert(!custody.live());
});
test('replace only materials; source uniforms shared and failed/withdrawn proof preserves the actual stock and foreign draw',async()=>{
 const seed=stock(),{owner,scene}=seed,camera=new Camera(), geometry=owner.geometry;
 const sky=seed.stock.uniforms.townWallSky.value as Texture;
 const borrowedSource=sky.source,sourceVersion=borrowedSource.version,textureVersion=sky.version;
 assert.equal(scene.environment!.source,borrowedSource);
 const skyIntact=()=>{
  assert.equal(sky.source,borrowedSource);
  assert.equal(borrowedSource.version,sourceVersion);
  assert.equal(sky.version,textureVersion);
  assert.equal(scene.environment!.source,borrowedSource);
 };
 const authored=patchFoundersWestWall(seed.stock.vertexShader,seed.stock.fragmentShader);
 assert(authored);
 const residentImage=borrowedSource.data;
 let enabled=false,linkCalls=0,live=true;
 let unlock:(q:()=>boolean)=>void=()=>{};
 let linkAnswer=new Promise<()=>boolean>(r=>unlock=r);
 const lease=new FoundersWestLease({...seed,wire,rows,camera,render:{} as any,
  eligible:()=>enabled,local:()=>true,owned:()=>owner.parent===scene,
  paint:async(v,f)=>patchFoundersWestWall(v,f),preflight:async(g)=>{linkCalls++;assert.equal(g.children.length,1);return linkAnswer;}});
 const before=owner.onBeforeRender;
 lease.sync();assert.equal(linkCalls,0);assert.equal(owner.material,seed.stock);
 enabled=true;lease.sync();await until(()=>linkCalls===1);assert.equal(owner.material,seed.stock);skyIntact();
 unlock(()=>live);await until(()=>{lease.sync();return lease.active;});
 assert.equal(owner.geometry,geometry);
 assert.equal(owner.material.uniforms.townWallGain,seed.stock.uniforms.townWallGain);
 assert.equal(owner.material.uniforms.townWallSky,seed.stock.uniforms.townWallSky);
 skyIntact();
 assert.match(owner.material.vertexShader,/gl_VertexID>=23004/);
 assert.equal(owner.material.vertexShader,authored.vertexShader);
 assert.equal(owner.material.fragmentShader,authored.fragmentShader);
 assert.equal(sky.source.data,residentImage);
 for(const key of ['side','toneMapped','vertexColors','depthTest','depthWrite','depthFunc','transparent','blending'] as const)
  assert.equal(owner.material[key],seed.stock[key],key);
 const after=owner.material;enabled=false;lease.sync();
 assert.equal(owner.material,seed.stock);assert.equal(owner.onBeforeRender,before);
 enabled=true;lease.sync();assert.equal(owner.material,after);
 const foreign=new MeshBasicMaterial();owner.material=foreign;lease.sync();
 assert(!lease.active);assert.equal(owner.material,foreign);assert.equal(owner.onBeforeRender,before);
 owner.material=seed.stock;live=false;lease.sync();assert.equal(owner.material,seed.stock);
 lease.dispose();foreign.dispose();skyIntact();
});

test('a late linked result or source mismatch cannot replace stock when the unit loses its exact lease',async()=>{
 for(const mode of ['wrong-wire','cover-owner','link-refusal','mid-program-leave']){
  const seed=stock(),{owner,scene}=seed;
  let entered=0,selected=true;
  let release:((v:(()=>boolean)|undefined)=>void)|undefined;
  const original=owner.onBeforeRender;
  const candidate=wire.slice(0);if(mode==='wrong-wire')new Uint8Array(candidate)[4]^=1;
  const lease=new FoundersWestLease({...seed,wire:candidate,rows,camera:new Camera(),render:{} as any,
   eligible:()=>selected,local:()=>true,owned:()=>owner.parent===scene,
   paint:async(v,f)=>patchFoundersWestWall(v,f),
   preflight:async()=>{entered++;return await new Promise(r=>release=r);} });
  if(mode==='cover-owner')owner.position.z+=1;
  lease.sync();
  if(mode==='link-refusal'||mode==='mid-program-leave'){
   await until(()=>entered===1);
   if(mode==='mid-program-leave'){selected=false;lease.sync();}
   release?.(mode==='link-refusal'?undefined:()=>true);
   await new Promise(r=>setTimeout(r,10));
  }else{
   await new Promise(r=>setTimeout(r,25));assert.equal(entered,0);
  }
  lease.sync();
  assert.equal(owner.material,seed.stock);assert.equal(owner.onBeforeRender,original);
  lease.dispose();
 }
});
