import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Buildings} from '../src/render/buildings.ts';
import {PackedBytes} from '../src/sim/packed-bytes.ts';
import {Terrain} from '../src/sim/terrain.ts';
import * as T from 'three';
import {standardSeawardRoof,SEAWARD_STOCK,SeawardRoofLease} from '../src/render/quartermaster-seaward/lease.ts';
import {QUARTERMASTER_SEAWARD as P} from '../src/render/quartermaster-seaward/seaward-roof-pins.ts';
import {foundersWestRequested,standardDispatchWoodlandRequested} from '../src/app/scenery-profile.ts';
import {queensDispatchStandProfile} from '../src/render/queens-dispatch-contract.ts';

const world=(name)=>new URL('../public/world/'+name,import.meta.url);
const index=Uint8Array.from(readFileSync(world('buildings/index.json'))).buffer;
const atlas=JSON.parse(new TextDecoder().decode(index));
const tile=atlas.tiles.find(t=>t.id===P.source.tile);assert(tile);
const raw=readFileSync(world('buildings/tiles.pack'));
const range='bytes='+P.source.offset+'-'+(P.source.offset+P.source.wireBytes-1);
const readWire=()=>Uint8Array.from(raw.subarray(P.source.offset,P.source.offset+P.source.wireBytes));
const dem=gunzipSync(readFileSync(world('height.bin.gz')));
const terrain=new Terrain(JSON.parse(readFileSync(world('terrain.json'),'utf8')),new Int16Array(dem.buffer,dem.byteOffset,dem.byteLength/2));
const dispatch={route:'harbour-low',mode:'dispatch',selected:true,view:0,status:'flying',peers:true,
 x:5081.683668329011,y:114.945,z:31236.264534841965,heading:34*Math.PI/180,flight:{}};
const flight={...dispatch,mode:'flight'};
async function fixture(corrupt=false){
 const scene=new T.Scene(),env=scene.environment=new T.Texture(),requests=[];
 const pack=new PackedBytes('https://fixture.invalid/tiles.pack',atlas.bytes,async(_,init)=>{
  const request=new Headers(init?.headers).get('Range');assert.equal(request,range);requests.push(request);
  const data=readWire();if(corrupt)data[4]^=1; // gzip timestamp doesn't change decoded stock geometry.
  return new Response(data,{status:206,headers:{'Content-Range':range.replace('=',' ')+'/'+atlas.bytes}});
 });
 const prepared={atlas:[tile],pack,atlasHash:atlas.sha256,residentProofIndex:index};
 const b=await Buildings.create(scene,terrain,undefined,undefined,undefined,Promise.resolve(prepared));
 const receive=b.observeQuartermasterSeawardRoof();
 const bound=b.tiles[0];b.wanted.add(bound.id);await b.load(bound);scene.updateMatrixWorld(true);
 const exact=receive();assert(exact);assert.deepEqual(requests,[range]);
 const owner=exact.mesh,geometry=owner.geometry,stock=owner.material;
 const camera=new T.PerspectiveCamera(53,1200/760,.08,350000);camera.position.set(5800,125,30122);
 const values={alpha:true,antialias:true,depth:true,samples:4,depthBits:24,alphaBits:8,scissor:false,target:null,lost:false,viewport:[0,0,1200,760],currentViewport:[0,0,1200,760]};
 const gl={getContextAttributes:()=>values,getParameter:k=>values[k],isContextLost:()=>values.lost,
  SAMPLES:'samples',VIEWPORT:'viewport',DEPTH_BITS:'depthBits',ALPHA_BITS:'alphaBits',SCISSOR_TEST:'scissor',isEnabled:k=>values[k],
  DRAW_FRAMEBUFFER_BINDING:'target',READ_FRAMEBUFFER_BINDING:'target',drawingBufferWidth:1200,drawingBufferHeight:760};
 let calls=[],fail=false;
 const renderer={getContext:()=>gl,renderBufferDirect(...a){calls.push(a);if(fail)throw Error('native render raised');},getRenderTarget:()=>values.target,
  getScissorTest:()=>values.scissor,getSize:v=>v.set(1200,760),getDrawingBufferSize:v=>v.set(1200,760),
  getCurrentViewport:v=>v.fromArray(values.currentViewport),
  outputColorSpace:T.SRGBColorSpace,toneMapping:T.ACESFilmicToneMapping,toneMappingExposure:1,xr:{enabled:false,isPresenting:false},
  capabilities:{isWebGL2:true,logarithmicDepthBuffer:true,reversedDepthBuffer:false},
  autoClear:true,autoClearColor:true,autoClearDepth:true,autoClearStencil:true,info:{autoReset:true},
  sortObjects:true,shadowMap:{enabled:false},clippingPlanes:[],localClippingEnabled:false};
 const trueRaw=renderer.renderBufferDirect;
 let available=true;
 const draws=()=>renderer.renderBufferDirect(camera,scene,geometry,stock,owner,null);
 const knownDraw=()=>renderer.renderBufferDirect(camera,scene,geometry,stock,{foreign:true},null);
 return {scene,geometry,env,stock,owner,camera,gl,values,renderer,trueRaw,draws,knownDraw,
  clear:()=>{calls=[]},calls:()=>calls,setFail(x){fail=x},receive:()=>available?receive():undefined,deny(){available=false}};
}
async function wait(check){for(let i=0;i<140&&!check();i++)await delay(3);assert(check());}
function seat(f,{verify=async()=>true,link=async()=>()=>true,frame=()=>dispatch}={}){
 const q=new SeawardRoofLease(f.renderer,f.scene,f.camera,verify,link,()=>true,frame);
 q.setObserver(f.receive);return q;
}
test('ordinary profile arms only known default or Standard URLs without blocking current Founders under a roof stock opt-out',()=>{
 for(const q of ['', 'diagnostics', 'departure=harbour-low','scenery=standard&diagnostics'])assert(standardSeawardRoof(new URLSearchParams(q)));
 for(const q of [SEAWARD_STOCK,'scenery=detail','scenery=standard&scenery=standard','scenery=preview','mystery','stockTownWalls','quartermasterQuayStudy','diagnostics&diagnostics'])
  assert(!standardSeawardRoof(new URLSearchParams(q)),q);
 assert(foundersWestRequested(new URLSearchParams('departure=harbour-low&diagnostics&'+SEAWARD_STOCK)));
 const woods=new URLSearchParams('departure=queens-woodland-view&diagnostics&'+SEAWARD_STOCK);
 assert(standardDispatchWoodlandRequested(woods)&&queensDispatchStandProfile(woods));
 woods.append(SEAWARD_STOCK,'');assert(!queensDispatchStandProfile(woods));
});
test('exact owner and signed source allow only a ready Begin, with one post-sort substitution and complete hook restoration',async()=>{
 const f=await fixture(); let accepted;
 const q=seat(f,{link:async(g)=>{assert.equal(g.children[0].geometry,f.geometry);accepted=g.children[0].material;return ()=>true;}});
 q.render(dispatch,f.draws);
 assert.equal(f.calls()[0][3],f.stock);await wait(()=>q.state.phase==='ready');
 assert(accepted);assert.equal(f.env.source.version,0);assert.equal(accepted.uniforms.victoriaSky,f.stock.uniforms.victoriaSky);
 q.begin(dispatch,true);f.clear();
 q.render(flight,()=>{f.knownDraw();f.draws();f.knownDraw();});
 assert.equal(f.calls().length,3);assert.deepEqual(f.calls().map(a=>a[3]),[f.stock,accepted,f.stock]);
 assert.deepEqual(q.state,{phase:'active',submitted:true});assert.equal(f.renderer.renderBufferDirect,f.trueRaw);
 assert.equal(f.owner.material,f.stock);assert.equal(f.owner.geometry,f.geometry);
 f.setFail(true);
 assert.throws(()=>q.render(flight,f.draws),/native render raised/);
 assert.equal(f.renderer.renderBufferDirect,f.trueRaw);
 f.setFail(false);q.dispose();
});
test('Start before the same exact validated receiver is ready is permanent that flight; no late compile or render',async()=>{
 const f=await fixture();let release,submitted=0;
 const q=seat(f,{verify:()=>new Promise(r=>release=r),link:async()=>{submitted++;return ()=>true;}});
 q.render(dispatch,f.draws);assert(release);q.begin(dispatch,true);release(true);await delay(10);
 f.clear();q.render(flight,f.draws);assert.equal(f.calls()[0][3],f.stock);assert.equal(submitted,0);
 assert.deepEqual(q.state,{phase:'held',submitted:false});q.dispose();
});
test('lost old owner and unqualified raster preserve original; known foreign wrapper is never replaced',async()=>{
 const f=await fixture(),q=seat(f);q.render(dispatch,f.draws);await wait(()=>q.state.phase==='ready');
 q.begin(dispatch,true);const foreign=(...a)=>f.trueRaw(...a);f.renderer.renderBufferDirect=foreign;
 f.clear();q.render(flight,f.draws);assert.equal(f.calls()[0][3],f.stock);assert.equal(f.renderer.renderBufferDirect,foreign);
 f.renderer.renderBufferDirect=f.trueRaw;f.values.samples=0;
 f.clear();q.render(flight,f.draws);assert.equal(f.calls()[0][3],f.stock);assert.equal(q.state.submitted,false);
 f.values.samples=4;f.deny();q.render(flight,f.draws);assert.equal(f.calls().at(-1)[3],f.stock);assert.equal(q.state.phase,'held');q.dispose();
});

test('leaving Dispatch before async evidence resolves cannot compile or become ready even without another frame',async()=>{
 const f=await fixture();let finish,linked=0,current=dispatch;
 const q=seat(f,{verify:()=>new Promise(r=>finish=r),link:async()=>{linked++;return ()=>true;},frame:()=>current});
 q.render(dispatch,f.draws);assert(finish);
 current={...dispatch,mode:'help'};finish(true);await wait(()=>q.state.phase==='held');
 assert.equal(linked,0);q.render(current,f.draws);assert.equal(f.calls().at(-1)[3],f.stock);q.dispose();
});
test('foreign captured wrapper remains installed but cannot invoke an expired roof callback',async()=>{
 const f=await fixture(),q=seat(f);q.render(dispatch,f.draws);await wait(()=>q.state.phase==='ready');q.begin(dispatch,true);
 let foreign;
 q.render(flight,()=>{
  const captured=f.renderer.renderBufferDirect;assert.notEqual(captured,f.trueRaw);
  foreign=(...args)=>captured(...args);
  f.renderer.renderBufferDirect=foreign;
 });
 assert.equal(f.renderer.renderBufferDirect,foreign);
 f.clear();f.draws();assert.equal(f.calls()[0][3],f.stock);
 q.dispose();
});

test('valid gzip with the wrong signed wire keeps the actual stock building and never links',async()=>{
 const f=await fixture(true);let links=0;
 const q=seat(f,{link:async()=>{links++;return ()=>true;}});
 q.render(dispatch,f.draws);await wait(()=>q.state.phase==='held');q.begin(dispatch,true);
 f.clear();q.render(flight,f.draws);assert.equal(f.calls()[0][3],f.stock);
 assert.equal(links,0);assert.equal(q.state.phase,'held');q.dispose();
});
test('the live draw cannot inherit a viewport changed mid-traversal, a foreign scene hook or a broken camera',async()=>{
 const f=await fixture(),q=seat(f);q.render(dispatch,f.draws);await wait(()=>q.state.phase==='ready');q.begin(dispatch,true);
 f.clear();q.render(flight,()=>{f.values.currentViewport=[12,0,1188,760];f.draws();});
 assert.equal(f.calls()[0][3],f.stock);assert(!q.state.submitted);f.values.currentViewport=[0,0,1200,760];
 f.clear();f.scene.onBeforeRender=()=>{};q.render(flight,f.draws);
 assert.equal(f.calls()[0][3],f.stock);assert(!q.state.submitted);
 f.scene.onBeforeRender=T.Object3D.prototype.onBeforeRender;
 f.clear();f.camera.position.x=NaN;q.render(flight,f.draws);assert.equal(f.calls()[0][3],f.stock);assert(!q.state.submitted);
 f.camera.position.x=5800;
 f.clear();q.render(flight,()=>{f.camera.matrixWorldInverse.elements[0]=NaN;f.draws();});
 assert.equal(f.calls()[0][3],f.stock);assert(!q.state.submitted);f.camera.matrixWorldInverse.identity();
 const previous=f.renderer.getCurrentViewport;
 f.clear();q.render(flight,()=>{f.renderer.getCurrentViewport=()=>{throw Error('inspect only');};f.draws();});
 assert.equal(f.calls()[0][3],f.stock);assert(!q.state.submitted);f.renderer.getCurrentViewport=previous;
 f.clear();q.render(flight,f.draws);assert.notEqual(f.calls()[0][3],f.stock);assert(q.state.submitted);
 q.dispose();
});
test('new geometry or shader authority that does not change source text retires the exact resident',async()=>{
 for(const alter of [f=>f.geometry.setIndirect(new T.BufferAttribute(new Uint32Array([1]),1)),
   f=>f.geometry.getAttribute('position').setUsage(T.DynamicDrawUsage),f=>f.stock.alphaHash=true]){
  const f=await fixture(),q=seat(f);q.render(dispatch,f.draws);await wait(()=>q.state.phase==='ready');q.begin(dispatch,true);
  alter(f);f.clear();q.render(flight,f.draws);assert.equal(f.calls()[0][3],f.stock);assert.equal(q.state.phase,'held');q.dispose();
 }
});
