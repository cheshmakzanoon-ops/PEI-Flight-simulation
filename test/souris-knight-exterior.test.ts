import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync as read} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {MeshBasicMaterial,Scene} from 'three';
import {sourisKnightRequested,standardSourisShoreline,seacowExteriorRequested} from '../src/app/scenery-profile.ts';
import {Buildings} from '../src/render/buildings.ts';
import {regularRoadGround} from '../src/render/road-contact.ts';
import {drawKnightTower} from '../src/render/souris-knight-art.ts';
import {KNIGHT_SEAT as K,knightGroundSupports,knightOwns} from '../src/render/souris-knight-seat.ts';
import {Cover} from '../src/sim/cover.ts';
import {Terrain} from '../src/sim/terrain.ts';

const root=new URL('../public/world/',import.meta.url),src=(p:string)=>read(new URL(p,root)),json=(f:string)=>JSON.parse(src(f).toString());
const atlas=json('buildings/index.json'),t=json('terrain.json'),cv=json('cover.json');
const Q=atlas.tiles.find((q:{id:string})=>q.id===K.id),wire=src('buildings/'+atlas.file).subarray(Q.offset,Q.offset+Q.bytes);
const buf=(q:Buffer)=>q.buffer.slice(q.byteOffset,q.byteOffset+q.byteLength) as ArrayBuffer;
const terrain=new Terrain(t,new Int16Array(buf(gunzipSync(src(t.file))))),cover=new Cover(cv.width,cv.height,gunzipSync(src(cv.file)),undefined,cv.compressedSha256);
const floor=regularRoadGround(terrain);

test('Knight Point occupies one authenticated dry owner and is opt-in Standard only',()=>{
 for(const s of ['', 'stockSourisKnight','sourisKnightExterior&stockSourisKnight','sourisKnightExterior&scenery=detail','sourisKnightExterior&unknown'])
  assert.equal(sourisKnightRequested(new URLSearchParams(s)),false,s);
 const a=new URLSearchParams('sourisKnightExterior&seacowExteriorStudy&departure=souris-waterfront-pass');
 assert(sourisKnightRequested(a));assert(standardSourisShoreline(a));assert(seacowExteriorRequested(a));
 assert(knightOwns(atlas.sha256,Q));assert(!knightOwns(atlas.sha256,{...Q,offset:Q.offset+1}));
 assert(knightGroundSupports(terrain,t.sha256,cover));assert(!knightGroundSupports(terrain,'replaced-cover-owner',cover));
});
test('Nominal historic tower stands over the real original game footing while keeping glass separate',()=>{
 const art=drawKnightTower(floor);assert.equal(art.children.length,4);
 const [x,z]=K.xz;assert.deepEqual(art.position.toArray(),[x,floor(x,z),z]);
 const rolesOnWalls=art.userData.knightFacadeFamilies as {cap:string;door:boolean;bottom:number;top:number}[][];
 const entry=rolesOnWalls[K.entrySide];
 assert.deepEqual(entry.map(q=>[q.door,q.cap]),[[true,'gable'],[false,'gable'],[false,'plain']]);
 assert(entry.every((q,i)=>i===0||entry[i-1].top<q.bottom));
 assert(rolesOnWalls.some((q,i)=>i!==K.entrySide&&q.length===2&&q.every(f=>!f.door&&f.cap==='gable')));
 assert(rolesOnWalls.some(q=>q.length===1&&!q[0].door));
 let highest=-Infinity;
 for(const m of art.children as any[]){
  const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++){assert(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));highest=Math.max(highest,p.getY(i));}
 }
 assert(Math.abs(highest-14.3)<.00001);
 const roles=art.children as any[];assert(roles[3].material.transparent);assert(!roles[3].material.depthWrite);
 assert(roles.slice(0,3).every(q=>!q.material.transparent));
 const p=roles[1].geometry.attributes.position;
 for(let j=0;j<64;j++)for(const i of [j*12,j*12+5]){
  const a=p.getX(i)+x,b=p.getZ(i)+z,y=p.getY(i)+art.position.y;
  assert(Math.abs(y-floor(a,b)+.04)<1e-6);assert(cover.distance(terrain,a,b)>.75);
 }
 for(const m of roles){m.geometry.dispose();m.material.dispose();}
 assert.throws(()=>drawKnightTower(()=>NaN));
});
test('Exactly 39 original vertices stay omitted only while every authentic draw and the terrain are present',async()=>{
 for(const mode of ['healthy','bad-wire','no-cover','bad-grade']){
  const scene=new Scene(),data=mode==='bad-wire'?gzipSync(gunzipSync(wire),{level:1}):wire;
  const stream=new (Buildings as any)(scene,terrain,[Q],{read:async()=>buf(data)},atlas.sha256);
  let resident=true;
  stream.enableKnightExterior({floor:mode==='bad-grade'?()=>NaN:floor,resident:()=>resident,verifiedCover:async()=>mode!=='no-cover'});
  const t=stream.tiles[0];stream.wanted.add(t.id);await stream.load(t);
  const mesh=stream.meshes.get(K.id);assert(mesh);const stock=mesh.geometry;
  for(let i=0;i<35&&!stream.knightExteriorActive;i++)await new Promise(r=>setTimeout(r,4));
  assert.equal(stream.knightExteriorActive,mode==='healthy');
  if(mode!=='healthy'){assert.equal(mesh.geometry,stock);assert.equal(stock.index,null);assert.equal(scene.children.length,1);continue;}
  const choice=mesh.geometry,art=stream.knight.art,child=art.children[3];
  const {start,end,vertices}=K.proof;assert.equal(choice.index.count,vertices-(end-start));
  for(let i=0;i<choice.index.count;i++)assert.equal(choice.index.getX(i),i<start?i:i+(end-start));
  assert.equal(Object.keys(stock.attributes).length,6);
  for(const key of Object.keys(stock.attributes))assert.equal(stock.attributes[key],choice.attributes[key]);
  child.visible=false;stream.syncKnight();assert.equal(mesh.geometry,stock);
  child.visible=true;stream.syncKnight();assert.equal(mesh.geometry,choice);
  resident=false;stream.syncKnight();assert.equal(mesh.geometry,stock);
  resident=true;stream.syncKnight();assert.equal(mesh.geometry,choice);
  const mat=new MeshBasicMaterial();scene.overrideMaterial=mat;stream.syncKnight();assert.equal(mesh.geometry,stock);
  scene.overrideMaterial=null;stream.syncKnight();assert.equal(mesh.geometry,choice);
  stream.update(1e7,1e7);assert(!stream.knightExteriorActive);assert.equal(scene.children.length,0);mat.dispose();
 }
});
