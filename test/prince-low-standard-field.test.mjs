import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync as read} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {registerHooks} from 'node:module';
import * as T from 'three';
import {OpticalDeparture} from '../src/app/optical-departure.ts';
import {standardPrinceLowFieldRequested,kingsFieldPassRequested,queensFieldPassRequested,princeFieldPassRequested,
 standardInlandOrtho,sceneryReviewBlock} from '../src/app/scenery-profile.ts';
import {PRINCE_LOW_FIELD_ROUTE,withinPrinceLowField} from '../src/render/prince-low-field-scope.ts';
import {SITES,runwayAt} from '../src/sim/places.ts';
import {Terrain} from '../src/sim/terrain.ts';
import {Cover} from '../src/sim/cover.ts';
import {FIXED_STEP,neutral,spawn,step} from '../src/sim/flight.ts';
import {OrthophotoSeams} from '../src/render/orthophoto-seams.ts';
import {preparePrinceLowField,princeLowFieldRaster} from '../src/render/prince-low-standard-field.ts';

const base=new URL('../public/world/',import.meta.url),real=new URL('../src/',import.meta.url).href;
const get=f=>read(new URL(f,base)),json=f=>JSON.parse(get(f));
const sha=a=>createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const testGL=new WeakSet(),ownerMaterial=new WeakMap();
let requests=[],fault='',closedBitmap=0;
const touch=new Set(['fields-province/v2/index.fcr.gz','fields-province/v2/crop-12.pack','furrow-relief.webp']);
globalThis.fetch=async(url,opt={})=>{
 assert.equal(typeof url,'string');assert(url.startsWith('world:'));
 const key=url.slice(6), range=new Headers(opt.headers).get('Range');assert(touch.has(key),key);
 requests.push([key,range]);if(opt.signal?.aborted)throw new Error('aborted');
 if(fault==='missing'&&key.endsWith('.fcr.gz'))return new Response(null,{status:404});
 if(fault==='badscan'&&key.endsWith('.webp'))return new Response(get(key).map((x,i)=>i===39?x^1:x));
 const b=get(key);
 if(!range||fault==='fullpack')return new Response(b,{status:200,headers:{'Content-Length':String(b.length)}});
 const [,a,z]=/^bytes=(\d+)-(\d+)$/.exec(range)??[];
 assert(a&&z);if(fault==='second'&&a==='26755')return new Response(b.subarray(+a,+z+1).map((x,i)=>i===10?x^1:x),
  {status:206,headers:{'Content-Range':'bytes '+a+'-'+z+'/'+b.length}});
 return new Response(b.subarray(+a,+z+1),{status:206,headers:{'Content-Range':'bytes '+a+'-'+z+'/'+b.length}});
};
globalThis.createImageBitmap=async(blob,options)=>{
 assert.equal(blob.size,150012);assert.deepEqual(options,{colorSpaceConversion:'none',imageOrientation:'none'});
 return {width:512,height:512,close(){closedBitmap++;}};
};
T.TextureLoader.prototype.load=()=>new T.Texture();
globalThis.document={createElement:()=>({getContext:()=>new Proxy({}, {get:()=>()=>{}})})};
const hook=registerHooks({load(u,c,next){const s=next(u,c);return s.source&&u.startsWith(real)&&u.endsWith('.ts')?{...s,
 source:"import.meta.env={BASE_URL:'/'};\n"+s.source}:s;}});
const {World}=await import('../src/render/world.ts');hook.deregister();
const ts=json('terrain.json'),cs=json('cover.json'),tb=gunzipSync(get(ts.file)),cb=gunzipSync(get(cs.file));
assert.equal(sha(tb),ts.sha256);
const terrain=new Terrain(ts,new Int16Array(tb.buffer,tb.byteOffset,tb.length/2)),cover=new Cover(cs.width,cs.height,cb);
const camera=new T.PerspectiveCamera(53,1.5,.08,350000);
const spanNames=['7-12','8-12'];
const route=SITES.find(s=>s.id===PRINCE_LOW_FIELD_ROUTE);assert(route);
const surface=(x,z)=>{const land=cover.distance(terrain,x,z)>=0;return {land,height:terrain.contactHeight(x,z,land),runway:!!runwayAt(x,z)};};

function model(ortho=true){
 let dpr=1,w=960,h=640;const scene=new T.Scene(),props=new WeakMap();
 const state={sort:null,extra:0,scissor:false,hiddenUpload:false,badProgram:false,noProgram:false,samples:4,draws:0,uploads:0,compile:0,handles:[]};
 const gl={SAMPLES:0x80A9,LINK_STATUS:0x8B82,drawingBufferWidth:w,drawingBufferHeight:h,
  getContextAttributes:()=>({alpha:true,depth:true,antialias:true}),getParameter:k=>k===0x80A9?state.samples:undefined,
  isContextLost:()=>false,isTexture:t=>testGL.has(t),isProgram:p=>!state.noProgram&&testGL.has(p),getProgramParameter:()=>!state.badProgram};
 const property=o=>{if(!props.has(o))props.set(o,{});return props.get(o);};
 const r={capabilities:{logarithmicDepthBuffer:true,maxTextureSize:4096,maxTextures:16},sortObjects:true,shadowMap:{enabled:false,type:1},
  xr:{isPresenting:false},clippingPlanes:[],localClippingEnabled:false,properties:{get:property},getContext:()=>gl,getRenderTarget:()=>null,
  getScissorTest:()=>state.scissor,getSize:v=>v.set(w,h),getViewport:v=>v.set(0,0,w,h),getPixelRatio:()=>dpr,
  getCurrentViewport:v=>v.set(0,0,Math.round(w*dpr)+state.extra,Math.round(h*dpr)),
  getDrawingBufferSize:v=>v.set(Math.floor(w*dpr),Math.floor(h*dpr)),setOpaqueSort:q=>{state.sort=q;},
  initTexture:t=>{state.uploads++;if(state.hiddenUpload)return;const h={};testGL.add(h);state.handles.push([t,h]);
   Object.assign(property(t),{__version:t.version,__webglTexture:h});},
  compile:(group,eye,target)=>{state.compile++;assert(!group.parent&&!group.visible);assert.equal(eye,camera);assert.equal(target,scene);
   const trial=group.children[0];assert.equal(group.children.length,1);assert.equal(trial.geometry,mesh.geometry);
   assert.equal(mesh.parent,scene);assert.equal(mesh.material,stock);assert.equal(peer.material,peerStock);
   assert(!state.sort);const program={};testGL.add(program);ownerMaterial.set(scene,trial.material);
   property(trial.material).currentProgram={program,isReady:()=>true};return new Set([trial.material]);},
 };
 const img=new T.Texture(),sky=new T.Texture(),seams=ortho?new OrthophotoSeams(r,img,{tracadie:false,counties:false,inland:['west']}):undefined;
 const wp=[scene,terrain,img,r,cover,sky];
 wp.length=38;wp[37]=seams;
 const world=new World(...wp);
 world.details.load=async()=>undefined;
 let craft=spawn(route,surface);const cameraAt=(q,time)=>{
  const x=Math.sin(q.heading),z=-Math.cos(q.heading);
  camera.position.set(q.x-16.8*x,q.y+4.2,q.z-16.8*z);
  camera.lookAt(q.x+7.8*x,q.y+1.18+Math.sin(q.pitch)*4.5,q.z+7.8*z);camera.updateMatrixWorld(true);
  world.update(camera.position,20+time);
 };
 cameraAt(craft,0);
 const map=new Map(),owner=()=>world.mappedFieldGround(map,spanNames[0],true)?.[0];
 const op=owner();assert(op);const {mesh,stock}=op;
 const other=world.tiles.find(t=>t.id===spanNames[1]),peer=other.fine??other.coarse;
 const peerStock=peer.material;
 if(ortho){
  assert(stock.uniforms.orthoRowsGain&&stock.uniforms.orthoSharedRows);
  assert.equal(stock.uniforms.orthoRowsGain,peerStock.uniforms.orthoRowsGain);
  assert.equal(stock.uniforms.orthoSharedRows,peerStock.uniforms.orthoSharedRows);
 }else assert(!stock.uniforms.orthoRowsGain);
 const q={base:'world:',renderer:r,scene,camera,owner,preparing:()=>true};
 return {state,world,q,scene,mesh,stock,peer,peerStock,props,craft,gl,img,sky,
  cameraAt,renderer:r,physical:[mesh.geometry.getAttribute('position'),mesh.geometry.getAttribute('uv'),mesh.geometry.index],
  mode(x,y,d){w=x;h=y;dpr=d;gl.drawingBufferWidth=Math.floor(w*dpr);gl.drawingBufferHeight=Math.floor(h*dpr);}};
}
const next=()=>new Promise(a=>setTimeout(a,0));
const fields=()=>requests.filter(([k])=>k.endsWith('.pack')).map(r=>r[1]);
const takes=['bytes=28186-29442','bytes=26755-28185'];
const newSignal=()=>new AbortController().signal;

test('one raw standard request gate preserves old mapped profiles, reviews and imagery',()=>{
 const Q=s=>new URLSearchParams(s);
 for(const q of ['','?diagnostics','?departure=prince-fields&scenery=standard','?stockPrinceFieldPass&stockInlandOrtho'])
  assert(standardPrinceLowFieldRequested(Q(q)),q);
 for(const q of ['?stockPrinceLowFieldPass','?unknown','?provinceFieldsReview','?cropRowsReview','?orthophotoSeamStudy',
  '?scenery=detail','?qa','?scenery=standard&scenery=standard','?departure=a&departure=b'])assert(!standardPrinceLowFieldRequested(Q(q)),q);
 for(const fn of [kingsFieldPassRequested,queensFieldPassRequested,princeFieldPassRequested,standardInlandOrtho])assert(fn(Q('?stockPrinceLowFieldPass')));
 assert.equal(sceneryReviewBlock('provinceFieldsReview',Q('?provinceFieldsReview&stockPrinceLowFieldPass')),undefined);
});

test('original actual N112 draw, shared active ortho wrappers, two signed assets and same-frame restore',async()=>{
 requests=[];fault='';const p=model(),versions=[p.sky.source.version,p.img.source.version];
 const cohort=await preparePrinceLowField(p.q,newSignal());assert(cohort?.ready());
 assert.deepEqual(fields(),takes);assert.equal(p.state.uploads,2);assert.equal(p.state.compile,1);
 assert.equal(p.mesh.material,p.stock);assert.equal(p.peer.material,p.peerStock);assert(!p.state.sort);
 const orig=p.physical.map(a=>sha(a.array)),oldHours=p.craft.time;
 const look=ownerMaterial.get(p.scene),ground=p.world.surface(-51660,5070);
 const gain=p.stock.uniforms.orthoRowsGain,image=p.stock.uniforms.orthoSharedRows;
 // The real old q7/q8 wrappers remain live and shared. A dynamic old gain,
 // sampler or imagery load doesn't rebuild the candidate material.
 const originalImage=image.value,deck=new T.Texture();gain.value=.78;image.value=deck;
 const end=cohort.begin();assert(end);
 assert.equal(p.peer.material,p.peerStock);assert.equal(p.mesh.material,look);
 assert.equal(look.uniforms.orthoRowsGain,gain);assert.equal(look.uniforms.orthoSharedRows,image);
 assert.equal(look.uniforms.orthoRowsGain.value,.78);assert.equal(p.peerStock.uniforms.orthoSharedRows.value,image.value);
 assert.equal(p.mesh.geometry.index,p.physical[2]);
 const sort=p.state.sort;
 const a=(material,id,materialVariant=0,z=0)=>({material:{id:material},id,materialVariant,z,groupOrder:0,renderOrder:0});
 assert(p.stock.id+1<look.id);assert(sort(a(look.id,1),a(p.stock.id+1,2))<0);
 assert(sort(a(look.id,9),a(p.stock.id,8))>0);assert(sort(a(look.id,9,0,99),a(p.stock.id,8,1,-99))<0);
 try{throw new Error('injected ordinary draw fault');}catch{}finally{end();}
 assert.equal(p.mesh.material,p.stock);assert(!p.state.sort);assert(cohort.ready());
 assert.deepEqual(p.world.surface(-51660,5070),ground);assert.equal(p.craft.time,oldHours);
 const real=()=>cohort.ready();
 for(let i=1;i<=180;i++){
  step(p.craft,neutral,surface);
  if(i%10===0){p.cameraAt(p.craft,i/90);assert(withinPrinceLowField(camera.position,camera.position.y-terrain.atlasElevation(camera.position.x,camera.position.z)));assert(real(),'tick '+i);}
 }
 assert.deepEqual(p.physical.map(a=>sha(a.array)),orig);
 assert.deepEqual([p.sky.source.version,p.img.source.version],versions);
 let disposed=0;look.addEventListener('dispose',()=>disposed++);
 cohort.dispose();cohort.dispose();image.value=originalImage;deck.dispose();
 assert.equal(disposed,1);assert.equal(p.mesh.material,p.stock);assert.equal(p.peer.material,p.peerStock);
});

test('source and raster faults never alter stock and an admitted route retires on changed native owner',async()=>{
 for(const caseName of ['badscan','missing','second','upload','link','scissor','zero','foreign','defaultProfile']){
  requests=[];fault=caseName;const p=model(caseName!=='defaultProfile');
  if(caseName==='upload')p.state.hiddenUpload=true;
  if(caseName==='link')p.state.badProgram=true;
  if(caseName==='scissor')p.state.scissor=true;
  if(caseName==='zero')p.state.samples=0;
  if(caseName==='foreign')p.mesh.material=new T.ShaderMaterial();
  const stock=p.mesh.material,q=await preparePrinceLowField(p.q,newSignal());
  if(caseName==='defaultProfile'){assert(q?.ready());q.dispose();continue;}
  assert(!q,caseName);assert.equal(p.mesh.material,stock);assert(!p.state.sort);
  if(['scissor','zero','foreign'].includes(caseName))assert.equal(requests.length,0);
  if(['missing','badscan'].includes(caseName))assert.equal(fields().length,0);
  if(caseName==='second')assert.deepEqual(fields(),takes);
 }
 fault='';requests=[];const p=model(),q=await preparePrinceLowField(p.q,newSignal());assert(q?.ready());
 p.mesh.geometry.getAttribute('position').needsUpdate=true;
 assert(!q.ready());assert(!q.begin());q.dispose();assert.equal(p.mesh.material,p.stock);
});

test('renderer rounds odd HiDPI viewport exactly and revocation cannot paint next frame',async()=>{
 fault='';requests=[];const p=model();p.mode(471,311,1.5);
 const r=princeLowFieldRaster(p.renderer,camera,p.scene);assert(r());
 p.state.extra=1;assert(!r());p.state.extra=0;assert(r());
 const q=await preparePrinceLowField(p.q,newSignal());assert(q?.ready());
 const end=q.begin();assert(end);end();
 p.state.extra=1;assert(!q.ready()&&!q.begin());
 q.dispose();assert.equal(p.mesh.material,p.stock);assert(!p.state.sort);
});

test('authenticated 200 pack fallback and an interrupted draw installation preserve the original',async()=>{
 fault='fullpack';requests=[];const p=model(),q=await preparePrinceLowField(p.q,newSignal());assert(q?.ready());
 assert.deepEqual(fields(),takes.slice(0,1));
 const original=p.renderer.setOpaqueSort;
 p.renderer.setOpaqueSort=sort=>{original(sort);if(sort)throw Error('injected setup loss');};
 assert(!q.begin());assert.equal(p.mesh.material,p.stock);assert(!p.state.sort);
 p.renderer.setOpaqueSort=original;q.dispose();fault='';
});

test('real two-packet Dispatch preparation and an immediate Begin cannot introduce field later',async()=>{
 let dispatch=true;fault='';requests=[];const p=model();
 const gate=new OpticalDeparture(()=>dispatch),flight={};
 let release,complete;const task=new Promise(a=>release=a),done=new Promise(a=>complete=a);
 gate.prepare(async signal=>{await task;try{return await preparePrinceLowField(p.q,signal);}finally{complete();}});
 assert(!gate.beginFlight(flight,true));dispatch=false;release();await done;await next();
 assert.equal(requests.length,0);assert.equal(gate.beginDraw(flight,true),undefined);assert.equal(p.mesh.material,p.stock);
 dispatch=true;gate.reset();let full;const proof=new Promise(a=>full=a);
 gate.prepare(async signal=>{const q=await preparePrinceLowField(p.q,signal);full();return q;});
 await proof;await next();assert(gate.ready);assert.equal(p.mesh.material,p.stock);
 assert(gate.beginFlight(flight,true));dispatch=false;const end=gate.beginDraw(flight,true);assert(end);end();
 assert(!gate.beginDraw(flight,false));assert(!gate.beginDraw(flight,true));assert(!p.state.sort);
 p.mesh.material=p.stock;gate.reset();
});
