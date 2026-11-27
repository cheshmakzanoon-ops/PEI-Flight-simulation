import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync as read} from 'node:fs';
import {gunzipSync as gunzip} from 'node:zlib';
import * as T from 'three';
import {sceneryOptions,dalvayExteriorRequested,dalvayGlazingRequested,dalvayWaterRequested,standardDalvayExteriorRequested,dalvayDefaultFlight,DALVAY_STANDARD_ROUTE} from '../src/app/scenery-profile.ts';
import {DALVAY,DALVAY_STANDARD_RANGE,type DalvaySeat} from '../src/render/dalvay-exterior-seat.ts';
import {Buildings} from '../src/render/buildings.ts';
import {DalvaySocket} from '../src/render/dalvay-exterior-socket.ts';
import {DALVAY_PACKET} from '../src/render/dalvay-manor.generated.ts';
import {decodeDalvay} from '../src/render/dalvay-art-packet.ts';
import {Terrain} from '../src/sim/terrain.ts';
const ab=(b:Buffer)=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer;
const j=(f:string)=>JSON.parse(read('public/world/'+f,'utf8'));
const spec=j('terrain.json'),atlas=j('buildings/index.json'),tile=atlas.tiles.find((x:{id:string})=>x.id===DALVAY.id);
const terrain=new Terrain(spec,new Int16Array(ab(gunzip(read('public/world/'+spec.file)))));
const bytes=ab(read('public/world/buildings/'+atlas.file).subarray(tile.offset,tile.offset+tile.bytes));
const rows=JSON.parse(gunzip(bytes).toString()).features;
const word=ab(gunzip(read('public/art/'+DALVAY_PACKET.file)));
const decode=()=>decodeDalvay(word)!;
const make=()=>{
 const scene=new T.Scene(),gen:any=new (Buildings as any)(scene,terrain,[tile],{},atlas.sha256);
 const mesh=gen.generate(rows,gen.tiles[0],false,DALVAY.ordinal) as T.Mesh;scene.add(mesh);
 return {scene,mesh,stock:mesh.geometry};
};
const ready=async(when:()=>boolean)=>{
 for(let i=0;i<100;i++){if(when())return;await new Promise(done=>setTimeout(done,5));}
 assert(when(),'timed out waiting for real crypto and mock step');
};
const turn=()=>new Promise(done=>setTimeout(done,15));
const deferred=<V>()=>{let set!:(x:V)=>void;return {p:new Promise<V>(r=>{set=r;}),set};};
test('Standard is a separate real-route gate; stock, Detail, mixed profiles and old optical comparisons do not acquire it',()=>{
 const q=(s:string)=>new URLSearchParams(s);
 for(const s of ['', 'scenery=standard','departure=harbour-low&diagnostics','stockDalvayWaterOptics','stockDalvayGlazing','stockQueensFieldPass']){
  assert(standardDalvayExteriorRequested(q(s)),s);
  assert(!dalvayExteriorRequested(q(s)),s);
 }
 for(const s of ['scenery=detail','scenery=foo','scenery=standard&scenery=standard','departure=a&departure=b','qa',
  'stockDalvayExterior','dalvayExteriorStudy','dalvayWaterOptics','dalvayWaterOptics&stockDalvayWaterOptics',
  'dalvayGlazingStudy','w=0','surveyRelief','inlandRelief','buildingShadows','princeLandscapePreview','sceneryObserver']){
  assert(!standardDalvayExteriorRequested(q(s)),s);
 }
 assert(!standardDalvayExteriorRequested(sceneryOptions('?scenery=detail')));
 const explicit=q('dalvayExteriorStudy&dalvayGlazingStudy&dalvayWaterOptics');
 assert(dalvayExteriorRequested(explicit)&&dalvayGlazingRequested(explicit)&&dalvayWaterRequested(explicit));
 assert(!dalvayExteriorRequested(q('dalvayExteriorStudy&stockDalvayExterior')));
 assert(dalvayWaterRequested(q('dalvayWaterOptics'))&&!dalvayGlazingRequested(q('dalvayGlazingStudy')));
 assert.deepEqual(DALVAY_STANDARD_RANGE,{near:1800,prepare:1000,maxY:435});
 const modes=['flight','paused','dispatch','crash','map','help','credits'];
 for(const current of modes)for(const prior of modes){
  const eligible=['flight','paused'].includes(current)||
   ['map','help','credits'].includes(current)&&['flight','paused'].includes(prior);
  assert.equal(dalvayDefaultFlight(DALVAY_STANDARD_ROUTE,current,prior),eligible);
  assert(!dalvayDefaultFlight('harbour-low',current,prior));
 }
});

test('Cold missing route/receiver and the near late window retain the exact original owner without proof or load',async()=>{
 const x=make();let scope=false,early=true,supported=true,proof=0,load=0;
 const seat:DalvaySeat={resident:()=>supported,verifiedCover:async()=>{proof++;return true;},
  standard:{scope:()=>scope,early:()=>early,link:async()=>()=>true}};
 const socket=new DalvaySocket(x.scene,x.mesh,bytes,rows.length,rows[DALVAY.ordinal],seat,async()=>{load++;return decode();});
 socket.sync();await turn();scope=true;supported=false;socket.sync();await turn();
 supported=true;early=false;socket.sync();await turn();
 assert.deepEqual([proof,load,socket.active,x.mesh.geometry,x.scene.children.length],[0,0,false,x.stock,1]);socket.dispose();
});

test('A still-owned range/cover await cannot request art after departing; actual new route can request once',async()=>{
 const x=make();let scope=true,calls=0,loads=0;const hold=deferred<boolean>();
 const seat:DalvaySeat={resident:()=>true,verifiedCover:()=>++calls===1?hold.p:Promise.resolve(true),
  standard:{scope:()=>scope,early:()=>true,link:async()=>()=>true}};
 const socket=new DalvaySocket(x.scene,x.mesh,bytes,rows.length,rows[DALVAY.ordinal],seat,async()=>{loads++;return decode();});
 socket.sync();await ready(()=>calls===1);scope=false;socket.sync();hold.set(true);
 await turn();assert.equal(loads,0);assert.equal(x.mesh.geometry,x.stock);
 scope=true;socket.sync();await ready(()=>socket.active);assert.equal(loads,1);socket.dispose();assert.equal(x.mesh.geometry,x.stock);
});

test('Active one-copy V2 appears only after linked programs and restores exact six original attributes/stock on gate loss',async()=>{
 const x=make();let scope=true,early=true,supported=true,program=true,requests=0,links=0;const hold=deferred<()=>boolean>();
 const seat:DalvaySeat={resident:()=>supported,verifiedCover:async()=>true,
  standard:{scope:()=>scope,early:()=>early,link:async(group)=>{
   assert.equal(group.parent,null);assert.equal(group.children.length,5);links++;return hold.p;
  }}};
 const socket=new DalvaySocket(x.scene,x.mesh,bytes,rows.length,rows[DALVAY.ordinal],seat,async(signal,eligible)=>{
  assert(!signal.aborted&&eligible?.());requests++;return decode();
 });
 socket.sync();await ready(()=>links===1);assert.equal(x.mesh.geometry,x.stock);assert.equal(x.scene.children.length,1);
 hold.set(()=>program);await ready(()=>socket.active);
 const v=x.mesh.geometry,idx=v.index!;assert.equal(idx.count,13497);
 for(let i=0;i<idx.count;i++)assert.equal(idx.getX(i),i<4533?i:i+111);
 for(const [n,b] of Object.entries(x.stock.attributes))assert.equal(v.getAttribute(n),b);
 early=false;socket.sync();assert(socket.active);supported=false;socket.sync();
 assert(!socket.active);assert.equal(x.mesh.geometry,x.stock);
 supported=true;socket.sync();assert(!socket.active,'never reacquire near');
 early=true;socket.sync();assert(socket.active);assert.equal(x.mesh.geometry,v);
 scope=false;socket.sync();assert(!socket.active);assert.equal(x.mesh.geometry,x.stock);
 scope=true;socket.sync();assert(socket.active);program=false;socket.sync();
 assert(!socket.active);assert.equal(x.mesh.geometry,x.stock);
 assert.equal(links,1);assert.equal(requests,1);socket.dispose();assert.equal(x.scene.children.length,1);
});

test('Late/failed shader or canceled body never leaves the old 37 triangles hidden, even if mock work ignores abort',async()=>{
 for(const problem of ['route','near','gpu','missing','badCover','retired'] as const){
  const x=make();let scope=true,early=true,load=0,link=0,gone=0,cover=0,signal:AbortSignal|undefined;
  const hold=deferred<(()=>boolean)|undefined>();
  const good=decode();good.group.children.forEach(c=>(c as T.Mesh).geometry.addEventListener('dispose',()=>gone++));
  const seat:DalvaySeat={resident:()=>true,verifiedCover:async()=>{cover++;return problem!=='badCover';},
   standard:{scope:()=>scope,early:()=>early,link:async()=>{link++;return hold.p;}}};
  const socket=new DalvaySocket(x.scene,x.mesh,bytes,rows.length,rows[DALVAY.ordinal],seat,async s=>{
   signal=s;load++;return problem==='missing'?undefined:good;
  });
  socket.sync();await ready(()=>cover===1);
  if(problem==='badCover'||problem==='missing'){await turn();assert.equal(link,0);assert.equal(load,problem==='missing'?1:0);good.dispose();}
  else {
   await ready(()=>link===1);
   if(problem==='retired')socket.dispose();
   if(problem==='route'){scope=false;socket.sync();}
   if(problem==='near'){early=false;socket.sync();}
   if(problem!=='gpu')assert(signal?.aborted,problem);
   hold.set(problem==='gpu'?undefined:()=>true);
  }
  await ready(()=>gone===5);
  assert(!socket.active,problem);assert.equal(x.mesh.geometry,x.stock,problem);assert.equal(x.scene.children.length,1);
  socket.dispose();
 }
});
