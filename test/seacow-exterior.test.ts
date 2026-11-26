import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync as read} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {MeshBasicMaterial,Mesh,BufferGeometry,Scene} from 'three';
import {Terrain} from '../src/sim/terrain.ts';
import {Buildings} from '../src/render/buildings.ts';
import {seacowExteriorRequested,basilicaExteriorRequested,standardSourisShoreline} from '../src/app/scenery-profile.ts';
import {SEACOW,seacowOwner} from '../src/render/seacow-exterior-seat.ts';
import {makeSeacowExterior} from '../src/render/seacow-exterior-art.ts';
import {regularRoadGround} from '../src/render/road-contact.ts';
const json=(f:string)=>JSON.parse(read('public/world/'+f,'utf8')),a=json('buildings/index.json'),spec=json('terrain.json');
const tile=a.tiles.find((q:any)=>q.id===SEACOW.id),pack=read('public/world/buildings/'+a.file),wire=pack.subarray(tile.offset,tile.offset+tile.bytes);
const ab=(b:Buffer)=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const terrain=new Terrain(spec,new Int16Array(ab(gunzipSync(read('public/world/'+spec.file))))),floor=regularRoadGround(terrain);
const within=(v:number,lo:number,hi:number)=>assert(v>=lo&&v<=hi,String(v));
test('Seacow is its own explicit, Standard-only art selection',()=>{
 for(const [query,want] of [['',false],['stockSeacowExterior',false],['seacowExteriorStudy',true],['seacowExteriorStudy&scenery=standard&qa',true],['seacowExteriorStudy&stockSeacowExterior',false],['seacowExteriorStudy&surveyRelief',false],['seacowExteriorStudy&scenery=detail',false],['seacowExteriorStudy&scenery=standard&scenery=detail',false],['seacowExteriorStudy&unknown',false]] as const)
  assert.equal(seacowExteriorRequested(new URLSearchParams(query)),want,query);
 assert(basilicaExteriorRequested(new URLSearchParams('basilicaExteriorStudy&stockSeacowExterior')));
 assert(standardSourisShoreline(new URLSearchParams('seacowExteriorStudy')));
 assert(seacowOwner(a.sha256,tile));assert(!seacowOwner(a.sha256,{...tile,offset:tile.offset+1}));
});
test('original physical geometry has the separately documented nominal base & 18.3m finial; all actual ground cuts are seated',()=>{
 const art=makeSeacowExterior(floor),g=art.group;assert.equal(g.children.length,4);assert.deepEqual([g.position.x,g.position.z],SEACOW.xz);
 const mat=g.children[0] as any,geo=(g.children[1] as any).geometry,pos=geo.attributes.position;
 assert(mat.geometry.attributes.position.count>0);
 let tallest=-Infinity;
 for(const m of g.children as any[]){const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++){tallest=Math.max(tallest,p.getY(i));assert(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));}}
 within(tallest,18.29997,18.30003);
 const foot=(j:number)=>[pos.getX(j),pos.getY(j),pos.getZ(j)];
 for(let i=0;i<8;i++){
  const a=foot(i*8*6),b=foot(((i+1)%8)*8*6);within(Math.hypot(a[0]-b[0],a[2]-b[2]),3.4289,3.4291);
  for(let s=0;s<8;s++){const start=(i*8+s)*6,first=foot(start),end=foot(start+5);
   for(let t=0;t<=4;t++){const f=t*.25,x=first[0]+f*(end[0]-first[0]),y=first[1]+f*(end[1]-first[1]),z=first[2]+f*(end[2]-first[2]);within(y+g.position.y-floor(x+g.position.x,z+g.position.z),-.085,-.010);}
  }
 }
 art.dispose();assert.throws(()=>makeSeacowExterior(()=>NaN));assert.throws(()=>makeSeacowExterior((x,z)=>(x-SEACOW.xz[0])*4));
});
test('actual 272-row original stock and mounted leases: only original 66 vertices omitted, full stock on rejected source / absent terrain / foreign or expired owner',async()=>{
 for(const mode of ['healthy','bad-wire','bad-cover','bad-index','bad-grade','withdraw-during-auth']){
  const scene=new Scene(),data=mode==='bad-wire'?gzipSync(gunzipSync(wire),{level:1}):wire,k=mode==='bad-index'?{...tile,count:tile.count+1}:tile;
  const b=new (Buildings as any)(scene,terrain,[k],{read:async()=>ab(data)},a.sha256);
  let ready=true,confirmed=0,unblock:(v:boolean)=>void=()=>{};
  const wait=new Promise<boolean>(res=>{unblock=res;});
  b.enableSeacowExterior({floor:mode==='bad-grade'?()=>NaN:floor,resident:()=>ready,verifiedCover:async()=>{confirmed++;return mode==='withdraw-during-auth'?wait:mode!=='bad-cover';}});
  const q=b.tiles[0];b.wanted.add(q.id);await b.load(q);
  const owner=b.meshes.get(q.id);assert(owner);const source=owner.geometry;
  for(let i=0;i<25;i++){await new Promise(r=>setTimeout(r,3));if(b.seacowExteriorActive||confirmed)break;}
  if(mode==='withdraw-during-auth'){b.update(1e7,1e7);unblock(true);}
  for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,2));if(b.seacowExteriorActive)break;}
  assert.equal(b.seacowExteriorActive,mode==='healthy',mode);
  if(mode==='healthy'){
   const v=owner.geometry;assert.notEqual(v,source);assert.equal(source.index,null);assert.equal(v.index.count,SEACOW.proof.vertices-66);
   for(let i=0;i<v.index.count;i++)assert.equal(v.index.getX(i),i<9348?i:i+66);
   for(const p of Object.keys(source.attributes))assert.equal(source.attributes[p],v.attributes[p]);
   ready=false;b.syncSeacow();assert.equal(owner.geometry,source);assert(!b.seacowExteriorActive);
   ready=true;b.syncSeacow();assert.equal(owner.geometry,v);assert(b.seacowExteriorActive);
   const original=owner.material,foreign=new MeshBasicMaterial();owner.material=foreign;b.syncSeacow();assert.equal(owner.geometry,source);assert(!b.seacowExteriorActive);owner.material=original;b.syncSeacow();assert(b.seacowExteriorActive);
   scene.overrideMaterial=foreign;b.syncSeacow();assert.equal(owner.geometry,source);assert(!b.seacowExteriorActive);scene.overrideMaterial=null;b.syncSeacow();assert(b.seacowExteriorActive);
   const art=b.seacow.art.group,child=art.children[2],originalChildMat=child.material;
   child.visible=false;b.syncSeacow();assert.equal(owner.geometry,source);assert(!art.visible);
   child.visible=true;b.syncSeacow();assert.equal(owner.geometry,v);assert(art.visible);
   child.material=foreign;b.syncSeacow();assert.equal(owner.geometry,source);child.material=originalChildMat;
   art.position.y+=.1;b.syncSeacow();assert(!b.seacowExteriorActive);art.position.y-=.1;
   child.position.y=2;b.syncSeacow();assert(!b.seacowExteriorActive);child.position.y=0;b.syncSeacow();assert(b.seacowExteriorActive);
   const final=art.children[3];art.remove(final);b.syncSeacow();assert(!b.seacowExteriorActive);assert.equal(owner.geometry,source);art.add(final);b.syncSeacow();assert(b.seacowExteriorActive);
   const replacement=new Mesh(new BufferGeometry(),new MeshBasicMaterial());let foreignDisposed=false;
   replacement.geometry.addEventListener('dispose',()=>{foreignDisposed=true;});replacement.material.addEventListener('dispose',()=>{foreignDisposed=true;});
   art.remove(final);art.add(replacement);b.syncSeacow();assert(!b.seacowExteriorActive);assert.equal(owner.geometry,source);
   b.update(1e7,1e7);assert(!b.seacowExteriorActive);assert.equal(scene.children.length,0);assert(!foreignDisposed);
   foreign.dispose();replacement.geometry.dispose();replacement.material.dispose();
  }else if(mode==='withdraw-during-auth')assert.equal(scene.children.length,0);
  else {assert.equal(owner.geometry,source);assert.equal(source.index,null);assert.equal(scene.children.length,1);}
 }
});

test('route-deferred Seacow shares the stock owner read and revokes or resumes its own cover and render lease',async()=>{
 const scene=new Scene();let reads=0,coverCalls=0,selected=false,resident=true;
 const b=new (Buildings as any)(scene,terrain,[tile],{read:async()=>{reads++;return ab(wire);}},a.sha256);
 let release:(v:boolean)=>void=()=>{};const waiting=new Promise<boolean>(r=>release=r);
 b.enableSeacowExterior({floor,prepare:()=>selected,resident:()=>resident,
  verifiedCover:async()=>{coverCalls++;return coverCalls===1?waiting:true;}});
 b.wanted.add(tile.id);await b.load(b.tiles[0]);const owner=b.meshes.get(tile.id),stock=owner.geometry;
 const until=async(f:()=>boolean)=>{for(let i=0;i<150&&!f();i++)await new Promise(r=>setTimeout(r,2));assert(f());};
 b.syncSeacow();assert.equal(reads,1);assert.equal(coverCalls,0);assert.equal(scene.children.length,1);
 selected=true;b.syncSeacow();await until(()=>coverCalls===1);
 selected=false;release(true);await until(()=>!b.queuedSeacow.running);
 assert.equal(scene.children.length,1);assert.equal(owner.geometry,stock);
 selected=true;b.syncSeacow();await until(()=>b.seacowExteriorActive);
 assert.equal(reads,1);assert.equal(coverCalls,2);
 const revised=owner.geometry;assert.notEqual(revised,stock);
 selected=false;b.syncSeacow();assert.equal(owner.geometry,stock);assert(!b.seacowExteriorActive);
 selected=true;resident=false;b.syncSeacow();assert.equal(owner.geometry,stock);
 resident=true;b.syncSeacow();assert.equal(owner.geometry,revised);
 const foreign=new BufferGeometry();owner.geometry=foreign;b.syncSeacow();
 assert.equal(owner.geometry,foreign);assert(!b.seacowExteriorActive);
 owner.geometry=stock;b.syncSeacow();assert.equal(owner.geometry,revised);
 assert.equal(coverCalls,2);assert.equal(reads,1);
});

test('original placement and buffer generations refuse drift before promotion, across awaits and while visible',async()=>{
 for(const mode of ['queued-move','cover-foreign','active-ebo']){
  const scene=new Scene(),b=new (Buildings as any)(scene,terrain,[tile],{read:async()=>ab(wire)},a.sha256);
  let selected=false,coverCalls=0,complete:(v:boolean)=>void=()=>{};
  const gate=new Promise<boolean>(r=>complete=r);
  b.enableSeacowExterior({floor,prepare:()=>selected,resident:()=>true,
   verifiedCover:async()=>{coverCalls++;return mode==='cover-foreign'?gate:true;}});
  b.wanted.add(tile.id);await b.load(b.tiles[0]);const q=b.meshes.get(tile.id),stock=q.geometry;
  const until=async(f:()=>boolean)=>{for(let i=0;i<150&&!f();i++)await new Promise(r=>setTimeout(r,2));assert(f(),mode);};
  if(mode==='queued-move')q.position.x+=1;
  selected=true;b.syncSeacow();
  if(mode==='cover-foreign'){
   await until(()=>coverCalls===1);
   const foreign=stock.clone();q.geometry=foreign;
   complete(true);await until(()=>!b.queuedSeacow);
   assert.equal(q.geometry,foreign);assert.equal(scene.children.length,1);
  }else if(mode==='active-ebo'){
   await until(()=>b.seacowExteriorActive);
   const alternate=q.geometry,index=alternate.getIndex();index.needsUpdate=true;b.syncSeacow();
   assert(!b.seacowExteriorActive);assert.equal(q.geometry,stock);
  }else{
   await until(()=>!b.queuedSeacow);assert.equal(q.geometry,stock);
   assert.equal(coverCalls,0);assert.equal(scene.children.length,1);
  }
  assert(!b.seacowExteriorActive,mode);
 }
});
