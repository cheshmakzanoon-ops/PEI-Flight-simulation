import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {BufferAttribute,Group,Mesh,Scene,Raycaster,Vector3} from 'three';
import {Buildings} from '../src/render/buildings.ts';
import {CavendishBarnViews} from '../src/render/cavendish-owner-views.ts';
import {GREEN_GABLES_BARN as S} from '../src/render/green-gables-barn-spec.ts';
import {GREEN_GABLES_BARN_ASSET as A} from '../src/render/green-gables-barn-asset.ts';
import {decodeBarnReview,loadBarnReview,disposeBarnReview} from '../src/render/green-gables-barn-review.ts';
import {greenGablesBarnRequested,greenGablesBarnAtlasMatches,greenGablesBarnGate,greenGablesBarnStandardRequested} from '../src/render/green-gables-barn-gate.ts';
import {Terrain} from '../src/sim/terrain.ts';
import {PackedBytes} from '../src/sim/packed-bytes.ts';

const archive=await readFile(new URL('../public/art/'+A.asset,import.meta.url)),raw=gunzipSync(archive);
const exact=(u:Uint8Array)=>Uint8Array.from(u).buffer;
const json=await readFile(new URL('../public/world/terrain.json',import.meta.url),'utf8');
const heights=gunzipSync(await readFile(new URL('../public/world/height.bin.gz',import.meta.url)));
const terrain=new Terrain(JSON.parse(json),new Int16Array(exact(heights)));
const atlas=JSON.parse(await readFile(new URL('../public/world/buildings/index.json',import.meta.url),'utf8'));
const tile=atlas.tiles.find((x:{id:string})=>x.id===S.tile);
const {open}=await import('node:fs/promises');
const f=await open(new URL('../public/world/buildings/tiles.pack',import.meta.url),'r'),source=Buffer.alloc(S.bytes);
try{assert.equal((await f.read(source,0,S.bytes,S.offset)).bytesRead,S.bytes);}finally{await f.close();}
const c=Buildings as unknown as {new(...a:unknown[]):any};
const pause=(ms=0)=>new Promise(r=>setTimeout(r,ms));
async function until(f:()=>boolean){
 for(let i=0;i<200;i++){if(f())return;await pause(5);}
 assert.ok(f(),'expected streamed scene state');
}
const reveal=(owner:Mesh)=>Array.from(owner.geometry.index?.array??[]);
const recognized=()=>new Response(exact(archive));

test('only ordinary dry N112 with all original grade knots is eligible',()=>{
 assert.equal(greenGablesBarnRequested(new URLSearchParams('greenGablesBarnReview&greenGablesReview')),true);
 for(const c of ['surveyRelief','inlandRelief','buildingShadows'])assert.equal(greenGablesBarnRequested(new URLSearchParams('greenGablesBarnReview&'+c)),false);
 assert.equal(greenGablesBarnAtlasMatches(S.terrain,S.cover,S.coverDecoded),true);
 assert.equal(greenGablesBarnAtlasMatches(S.terrain,S.cover,'altered'),false);
 let visualGroundEpoch=0,extra=0,dry=true,signature='112/112:112,56,56,56;';
 const listed=new Map(S.gradeProbes.map(([x,z,h])=>[x+','+z,h]));
 let queried=0;
 const w={get visualGroundEpoch(){return visualGroundEpoch;},visualGroundSignature:()=>signature,
  visualGroundHeight(x:number,z:number){queried++;return listed.get(x+','+z)!+extra;},surface:()=>({land:dry})};
 const g=greenGablesBarnGate(w);
 assert.equal(g(),true);assert.equal(g(),true);assert.equal(queried,S.gradeProbes.length);
 for(const next of ['56/56:56,56,56,8;','8/;','112/112:112,56,56,56*;','112/112:112,56,56,56;112/112:112,56,56,56;']){
  visualGroundEpoch++;signature=next;assert.equal(g(),false);
 }
 signature='112/112:112,56,56,56;';visualGroundEpoch++;extra=.051;assert.equal(g(),false);
 extra=0;visualGroundEpoch++;dry=false;assert.equal(g(),false);
 dry=true;visualGroundEpoch++;assert.equal(g(),true);
});

test('v1 body parser protects the exact fitted original exterior and handles host transcoding',async()=>{
 for(const native of [archive,raw]){
  const g=await loadBarnReview('./art/',async url=>{assert.equal(url,'./art/'+A.asset);return new Response(exact(native));});
  assert.ok(g);g.updateMatrixWorld(true);
  assert.equal(g.userData.seatY,S.modelSeatY);assert.equal(g.userData.triangles,A.triangles);
  assert.equal(g.children.length,11);
  const ray=new Raycaster(),q=g.localToWorld(new Vector3(6.6,40,10.2));
  ray.set(q,new Vector3(0,-1,0));assert.equal(ray.intersectObject(g,true)[0]?.object.name,'roof');
  disposeBarnReview(g);
 }
 const wrong=Buffer.from(raw);wrong[wrong.length-95]^=8;
 assert.equal(await loadBarnReview('./',async()=>new Response(exact(wrong))),undefined);
 const wrongIndex=Buffer.from(raw);const n=wrongIndex.readUInt16LE(20);
 wrongIndex.writeUInt16LE(n,28+32*n);
 assert.equal(decodeBarnReview(exact(wrongIndex)),undefined);
 assert.equal(await loadBarnReview('./',async()=>new Response(exact(archive),{status:206})),undefined);
 assert.equal(await loadBarnReview('./',async()=>new Response(exact(archive.subarray(0,400)))),undefined);
 let aborted=false;
 assert.equal(await loadBarnReview('./',async(_u,init)=>{
  init?.signal?.addEventListener('abort',()=>{aborted=true;});await pause(26);return recognized();
 },4),undefined);
 assert.ok(aborted);
});

function streamer(bin:Buffer,gate:()=>boolean){
 const read:string[]=[];
 const pack=new PackedBytes('https://example.test/tiles.pack',atlas.bytes,async(_u,init)=>{
  const range=new Headers(init?.headers).get('range')!;read.push(range);
  assert.equal(range,'bytes='+S.offset+'-'+(S.offset+S.bytes-1));
  return new Response(exact(bin),{status:206,headers:{'Content-Range':'bytes '+S.offset+'-'+(S.offset+S.bytes-1)+'/'+atlas.bytes}});
 });
 let house=false;
 const b=new c(new Scene(),terrain,[tile],pack,S.pack,undefined,undefined,undefined,undefined,false,()=>house,gate);
 return {b,read,setHouse:(v:boolean)=>{house=v;},owner:()=>b.meshes.get(S.tile) as Mesh,
  approach:()=>b.update(S.gameXZ[0],S.gameXZ[1])};
}
function seedHouse(b:any,owner:Mesh){
 const n=S.stockVertices,begin=6747,end=6831;
 const index=new BufferAttribute(Uint16Array.from(Array.from({length:n},(_,k)=>k).filter(k=>k<begin||k>=end)),1);
 const group=new Group();group.visible=false;b.greenGables={group,owner,index,dispose:()=>{}};
 return index;
}

test('actual Buildings streams one complete tile before Barn, then four independent visibility masks',async()=>{
 const originalFetch=globalThis.fetch;
 let wanted=true,requested=0,unblock:((r:Response)=>void)|undefined;
 const r=streamer(source,()=>wanted);
 globalThis.fetch=async url=>{
  assert.equal(url,'./art/'+A.asset);requested++;
  return new Promise<Response>(resolve=>{unblock=resolve;});
 };
 try{
  r.approach();await until(()=>!!unblock);
  const owner=r.owner(),stock=owner.geometry,attrs={...stock.attributes};
  assert.equal(owner.geometry.index,null);assert.equal(r.b.greenGablesBarnPreviewActive,false);
  assert.deepEqual(owner.userData.barnTriangles,S.span);
  const house=seedHouse(r.b,owner);r.setHouse(true);r.approach();assert.equal(stock.index,house);
  unblock!(recognized());await until(()=>r.b.greenGablesBarnPreviewActive);
  assert.equal(r.b.greenGablesPreviewActive,true);
  const both=owner.geometry;assert.notEqual(both,stock);
  assert.deepEqual(reveal(owner),Array.from(house.array).filter(k=>k<S.span[0]||k>=S.span[1]));
  for(const [k,a] of Object.entries(attrs))assert.equal(both.getAttribute(k),a);
  wanted=false;r.approach();assert.equal(owner.geometry,stock);assert.equal(owner.geometry.index,house);
  r.setHouse(false);r.approach();assert.equal(owner.geometry.index,null);
  wanted=true;r.approach();const barnOnly=owner.geometry;
  assert.deepEqual(reveal(owner),Array.from({length:S.stockVertices},(_,k)=>k).filter(k=>k<S.span[0]||k>=S.span[1]));
  r.setHouse(true);r.approach();assert.equal(owner.geometry,both);
  assert.equal(r.read.length,1);assert.equal(requested,1);
  let freed=0;for(const g of [stock,both,barnOnly])g.addEventListener('dispose',()=>freed++);
  r.b.update(S.gameXZ[0]-18000,S.gameXZ[1]);assert.equal(freed,3);
  assert.equal(r.owner(),undefined);assert.equal(r.b.greenGablesBarnPreviewActive,false);assert.equal(r.b.greenGablesPreviewActive,false);
 }finally{globalThis.fetch=originalFetch;}
});

test('a different but decodable owner file or failed Barn asset leaves ready, unsuppressed stock',async()=>{
 const originalFetch=globalThis.fetch;
 const variant=Buffer.from(source);variant[9]^=1;assert.deepEqual(gunzipSync(variant),gunzipSync(source));
 let calls=0;
 globalThis.fetch=async()=>{calls++;return new Response('',{status:404});};
 try{
  for(const data of [variant,source]){
   const r=streamer(data,()=>true);
   r.approach();await until(()=>!!r.owner());
   if(data===source)await until(()=>calls===1);else await pause(45);
   assert.equal(r.owner().geometry.index,null);assert.equal(r.b.greenGablesBarnPreviewActive,false);
   assert.equal(r.read.length,1);
   if(data===variant)assert.equal(calls,0);
  }
 }finally{globalThis.fetch=originalFetch;}
});

test('the published dry-rise grade cannot change any Barn seat or stamp',async()=>{
 const {loadBoundedGrade}=await import('../src/sim/bounded-grade.ts');
 const {GABLES_GRADE}=await import('../src/sim/gables-grade.generated.ts');
 const {project}=await import('../src/sim/geo.ts');
 const packed=await readFile(new URL('../public/world/'+GABLES_GRADE.file,import.meta.url));
 const load=await loadBoundedGrade(GABLES_GRADE,'/world/',async()=>new Response(new Uint8Array(packed)));
 assert(load);
 const grade=load(terrain,(x,z)=>terrain.atlasElevation(x,z));
 const {x,z}=project(-63.382612,46.487148);
 assert(grade.affectsBounds([x-4,z-4,x+4,z+4]));
 assert(!grade.affectsBounds(S.boundsXZ));
 for(const [x,z]of S.gradeProbes){
  assert.equal(grade.weight(x,z),0);
  const stock=terrain.contactHeight(x,z,true);
  assert.equal(grade.contactY(x,z,stock),stock);
 }
});

test('Standard gates art on current near flight, not an old asynchronous completion',async()=>{
 const oldFetch=globalThis.fetch;
 const [x,z]=S.gameXZ,r=streamer(source,()=>true);r.b.enableNearBarn();
 let requests=0,finish:(r:Response)=>void=()=>{};
 globalThis.fetch=async url=>{
  assert.equal(url,'./art/'+A.asset);requests++;
  return new Promise<Response>(resolve=>{finish=resolve;});
 };
 try{
  r.b.update(x+2500,z,70);await until(()=>!!r.owner());
  const stock=r.owner().geometry;
  r.b.update(x,z,575);await pause(12);assert.equal(requests,0);
  r.b.update(x,z,70);await until(()=>requests===1);
  r.b.update(x+2400,z,70);finish(recognized());await until(()=>!!r.b.barn);
  r.b.update(x+2400,z,70);assert(!r.b.greenGablesBarnPreviewActive&&r.owner().geometry===stock);
  r.b.update(x,z,70);assert(r.b.greenGablesBarnPreviewActive);
  r.b.update(x+2400,z,650);assert(r.b.greenGablesBarnPreviewActive);
  const house=seedHouse(r.b,r.owner());r.setHouse(true);
  r.b.syncCavendish();assert(r.b.greenGablesBarnPreviewActive);
  r.b.update(x+2400,z,650);assert(r.b.greenGablesBarnPreviewActive&&r.b.greenGablesPreviewActive);
  r.b.update(x+2400,z,735);assert(!r.b.greenGablesBarnPreviewActive&&r.owner().geometry.index===house);
  assert.equal(requests,1);assert.equal(r.read.length,1);
 }finally{globalThis.fetch=oldFetch;}
});
test('Standard keeps the complete Barn in explicitly protected terrain modes',()=>{
 const q=(s:string)=>greenGablesBarnStandardRequested(new URLSearchParams(s));
 assert(q(''));assert(q('departure=cavendish-dunelands-low'));assert(q('greenGablesReview'));
 for(const f of ['stockGreenGablesBarn','greenGablesBarnReview','scenery=detail','buildingShadows','surveyRelief',
  'inlandRelief','seatedRoads','seatedForestShadows','woodlandView','orthophotoSeamStudy'])assert(!q(f),f);
 assert(!greenGablesBarnRequested(new URLSearchParams('stockGreenGablesBarn&greenGablesBarnReview')));
});
