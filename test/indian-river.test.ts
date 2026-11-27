import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,Float32BufferAttribute,Group,Mesh} from 'three';
import {sceneryOptions,sceneryReviewBlock} from '../src/app/scenery-profile.ts';
import {INDIAN_RIVER_SOURCE as S} from '../src/render/indian-river/indian-river-source.generated.ts';
import {churchOwnerBytes,churchOwnerSource,churchLandSource} from '../src/render/indian-river/indian-river-guard.ts';
import {authenticatedOwnerVariant} from '../src/render/indian-river/authored-owner-variant.ts';
import {INDIAN_RIVER_GRADE as G} from '../src/sim/indian-river-grade.generated.ts';
import {loadBoundedGrade} from '../src/sim/bounded-grade.ts';
const read=(file:string)=>readFileSync(new URL('../public/world/'+file,import.meta.url));
const body=(bytes:Uint8Array)=>new Response(Uint8Array.from(bytes));

test('St Mary’s exact owner, optional terrain and exclusions fail closed on malformed input',async()=>{
 const atlas=JSON.parse(read('buildings/index.json').toString());
 const tile=atlas.tiles.find((r:{id:string})=>r.id===S.tile);
 const source=Uint8Array.from(read('buildings/tiles.pack').subarray(tile.offset,tile.offset+tile.bytes));
 const rows=JSON.parse(gunzipSync(source).toString()).features;
 assert(churchOwnerSource(atlas.sha256,tile,rows));assert(await churchOwnerBytes(source.buffer));
 assert(churchLandSource(G.terrainSha256,G.coverCompressedSha256,G.coverDecodedSha256,S.road));
 assert(!churchLandSource(S.terrain,S.cover,undefined,S.road));
 assert(!churchOwnerSource(atlas.sha256,{...tile,offset:tile.offset+1},rows));
 assert(!churchOwnerSource(atlas.sha256,tile,rows.filter((_r:unknown,i:number)=>i!==S.ordinal)));
 source[source.length-1]^=1;assert(!(await churchOwnerBytes(source.buffer)));
 const grade=read(G.file);
 assert(await loadBoundedGrade(G,'https://fixture.invalid/',async()=>body(grade)));
 grade[grade.length-1]^=1;
 assert(!(await loadBoundedGrade(G,'https://fixture.invalid/',async()=>body(grade))));
 assert(!sceneryOptions('').has('indianRiverReview'));
 assert(!sceneryReviewBlock('indianRiverReview',sceneryOptions('?indianRiverReview')));
 for(const flag of ['surveyRelief','inlandRelief','buildingShadows','woodland3D','canopyLight','northBaywalkPreview','scenery=detail'])
  assert(sceneryReviewBlock('indianRiverReview',sceneryOptions('?indianRiverReview&'+flag)));
});

test('one optional owner uses precisely its original span and returns stock on withdrawal',()=>{
 const stock=new BufferGeometry();
 const pos=new Float32BufferAttribute(new Float32Array(S.owner.vertices*3),3);
 stock.setAttribute('position',pos);
 const old=new Mesh(stock),art=new Group(),resident=new Group();
 assert.equal(authenticatedOwnerVariant(old,art,[S.owner.start+3,S.owner.end],S.owner),undefined);
 const view=authenticatedOwnerVariant(old,art,[S.owner.start,S.owner.end],S.owner);
 assert(view);
 view.sync(true);assert.equal(old.geometry,stock);assert(!art.visible);
 resident.add(old,art);
 view.sync(true);assert(art.visible);assert.notEqual(old.geometry,stock);
 assert.equal(old.geometry.getAttribute('position'),pos);
 const n=old.geometry.index!;
 assert.equal(n.count,S.owner.vertices-S.expectedFaceCount*3);
 assert.equal(n.array[S.owner.start-1],S.owner.start-1);
 assert.equal(n.array[S.owner.start],S.owner.end);
 view.sync(false);assert.equal(old.geometry,stock);assert(!art.visible);
 view.sync(true);old.removeFromParent();view.sync(true);
 assert.equal(old.geometry,stock);assert(!art.visible);
 const removed=view.alternateForProof();assert(removed);
 const foreignIndex=n.clone();removed.setIndex(foreignIndex);
 let disposal=0;
 removed.addEventListener('dispose',()=>{
  assert.deepEqual(Object.keys(removed.attributes),[]);
  assert.equal(removed.index,n);assert.equal(stock.getAttribute('position'),pos);
  disposal++;
 });
 view.dispose();view.dispose();view.sync(true);assert(!art.visible);assert.equal(old.geometry,stock);assert.equal(disposal,1);
});

test('the ground-only church cast requires the paired raw bytes and black interpolation border',async()=>{
 const {CHURCH_SUN_MASK:M}=await import('../src/render/indian-river/church-sun.generated.ts');
 const {loadChurchGroundSun}=await import('../src/render/indian-river/church-ground-sun.ts');
 assert.equal(M.gradeSha,G.sha256);
 const bytes=read(M.file);
 const cast=await loadChurchGroundSun(M,'https://fixture.invalid/',async()=>body(bytes));
 assert(cast);assert.equal(cast.live.value,0);
 const t=cast.uniforms.churchSunMask.value;
 try{
  assert.equal(t.image.width,241);assert.equal(t.image.height,261);
  assert.equal(t.generateMipmaps,false);assert.equal(t.flipY,false);
  assert.deepEqual(cast.tile,[10,11]);
 }finally{t.dispose();}
 bytes[bytes.length-1]^=1;
 assert(!(await loadChurchGroundSun(M,'https://fixture.invalid/',async()=>body(bytes))));
});

import {Scene} from 'three';
import {Buildings} from '../src/render/buildings.ts';
import {Terrain} from '../src/sim/terrain.ts';
import {prepareChurchArt} from '../src/render/indian-river/runtime.ts';
test('the real ordinary Indian River stream qualifies its loaded mesh with no render or duplicate range',async()=>{
 const index=Uint8Array.from(read('buildings/index.json')).buffer,atlas=JSON.parse(new TextDecoder().decode(index));
 const tile=atlas.tiles.find((x:{id:string})=>x.id===S.tile),spec=JSON.parse(read('terrain.json').toString());
 const height=gunzipSync(read(spec.file)),terrain=new Terrain(spec,new Int16Array(height.buffer,height.byteOffset,height.byteLength/2));
 const scene=new Scene();let reads=0;
 const pack={read:async(offset:number,length:number)=>{
  assert.equal(offset,S.offset);assert.equal(length,S.size);reads++;
  return Uint8Array.from(read('buildings/tiles.pack').subarray(offset,offset+length)).buffer;
 }};
 const ready={atlas:[tile],pack,atlasHash:atlas.sha256,residentProofIndex:index};
 const buildings=await Buildings.create(scene,terrain,undefined,undefined,undefined,Promise.resolve(ready as any));
 buildings.enableStandardIndianRiver();
 const b=buildings as any;b.wanted.add(tile.id);await b.load(b.tiles[0]);
 const owner=b.meshes.get(tile.id) as Mesh,stock=owner.geometry,art=prepareChurchArt();
 assert.deepEqual(owner.userData.beaconTriangles,[S.owner.start,S.owner.end]);
 assert.equal(stock.getAttribute('position').count,S.owner.vertices);
 assert(buildings.standardIndianRiverSourceReady);assert.equal(reads,1);
 assert.equal(await buildings.prepareStandardIndianRiver(art,()=>false),false);
 assert(await buildings.prepareStandardIndianRiver(art,()=>true));assert.equal(reads,1);
 assert(buildings.indianRiverLensDrawReady&&buildings.indianRiverPrepared);
 assert.equal(owner.geometry,stock);assert.equal(art.group.parent,scene);assert(!art.group.visible);
 buildings.dropStandardIndianRiver();
 assert.equal(art.group.parent,null);assert.equal(owner.geometry,stock);assert.equal(stock.index,null);
 assert(!buildings.indianRiverLensDrawReady);assert.equal(reads,1);
});
