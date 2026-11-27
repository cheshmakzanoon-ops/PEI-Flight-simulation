import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {createHash} from 'node:crypto';
import {standardCavendishWaterRequested as wants,standardGreenGablesHouseRequested as gables,
 sceneryReviewBlock} from '../../src/app/scenery-profile.ts';
import {CAVENDISH_WATER_CORE as CORE} from '../../src/sim/cavendish-water-core.generated.ts';
import {loadCavendishWaterCore} from '../../src/sim/cavendish-water-core.ts';
import {BOWLEY_POND} from '../../src/sim/bowley-pond.generated.ts';
import {loadBowleyPond} from '../../src/sim/bowley-pond.ts';
import {IndianRiverDeparture} from '../../src/app/indian-river-departure.ts';
import {project} from '../../src/sim/geo.ts';
import {spawn,step,neutral,FIXED_STEP} from '../../src/sim/flight.ts';
import {SITES} from '../../src/sim/places.ts';

const src=new URL('../../src/',import.meta.url).href,pub=new URL('../../public/',import.meta.url);
const load=(url)=>{try{return new Response(readFileSync(new URL(String(url).slice(1),pub)));}catch{return new Response(null,{status:404});}};
const hook=registerHooks({load(u,c,next){const q=next(u,c);return q.source&&u.startsWith(src)&&u.endsWith('.ts')?{
 ...q,source:"import.meta.env={BASE_URL:'/'};\n"+q.source}:q;}});
const {World,loadAtlas}=await import('../../src/render/world.ts');hook.deregister();
T.TextureLoader.prototype.load=()=>new T.Texture();T.TextureLoader.prototype.loadAsync=async()=>new T.Texture();
globalThis.document={createElement:()=>({getContext:()=>new Proxy({}, {get:()=>()=>{}})})};
globalThis.fetch=load; // every read is restricted to this local stock directory
const bowley=await loadBowleyPond('/world/',load),pond=await loadCavendishWaterCore(CORE,'/world/',load);
assert(pond);assert(bowley);
const packed=await loadAtlas(()=>{},false,false,false,undefined,false,undefined,undefined,true);
const a=packed.terrain;
const app=(extras=[])=>{
 const scene=new T.Scene(),renderState={w:1200,h:760,vw:1200,vh:760,sort:null,scissor:false,rt:null};
 const renderer={capabilities:{maxTextureSize:4096},sortObjects:true,
  getScissorTest:()=>renderState.scissor,getRenderTarget:()=>renderState.rt,
  getCurrentViewport:v=>v.set(0,0,renderState.vw,renderState.vh),getDrawingBufferSize:v=>v.set(renderState.w,renderState.h),
  setOpaqueSort:sort=>{renderState.sort=sort;}};

 const {terrain,img,cover,sky,bench,southLake,sourisLighting}=packed;
 const world=new World(scene,terrain,img,renderer,cover,sky,bench,southLake,sourisLighting,false,false,false,undefined,undefined,
  false,false,false,false,false,bowley,false,undefined,undefined,extras);
 world.details.load=async()=>undefined;
 const site=SITES.find(q=>q.id==='cavendish-dunelands-low');
 const f=spawn(site,(x,z)=>world.surface(x,z)),heading=f.heading;
 const camera=new T.PerspectiveCamera(53,1200/760,.08,350000);
 const lookAt=(f)=>{
  camera.position.set(f.x-16.8*Math.sin(heading),f.y+4.2,f.z+16.8*Math.cos(heading));
  camera.lookAt(f.x+7.8*Math.sin(heading),f.y+1.18,f.z-7.8*Math.cos(heading));
  camera.updateMatrixWorld(true);world.update(camera.position,30+f.time);
 };
 lookAt(f);
 const t=world.tiles.find(q=>q.id==='13-11'),mesh=t.fine;
 assert(mesh);assert.equal(t.lod,112);assert.equal(mesh.parent,scene);
 return {world,scene,camera,renderer,renderState,mesh,t,f,lookAt};
};
const bsha=b=>createHash('sha256').update(b).digest('hex');
const ac=(g,k)=>g.getAttribute(k);
const hash=p=>bsha(new Uint8Array(p.array.buffer,p.array.byteOffset,p.array.byteLength));
const point=[-14285.852658799366,581.369648260724],dry=[-14375.867540870138,331.8203212139678],offshore=[-14555,-166];
assert(pond.water(...point));assert(!pond.water(...dry));
const names=[CORE.id+' 2020 water plane',CORE.id+' seated bank curtain'];
const knownLocal=new Set([CORE.id,BOWLEY_POND.id]);
const hashes=mesh=>[hash(ac(mesh.geometry,'position')),hash(ac(mesh.geometry,'uv')),hash(mesh.geometry.index)];
const ignore=()=>true;

test('ordinary profile is separate, site-owner test independent of existing House and historical option',()=>{
 for(const k of ['', '?departure=cavendish-dunelands-low','?diagnostics&scenery=standard'])assert(wants(new URLSearchParams(k)));
 for(const k of ['qa','scenery=detail','scenery=standard&scenery=standard','departure=a&departure=b','cavendishWaterReview',
  'cavendishDetail','stockCavendishWater','surveyRelief','inlandRelief','buildingShadows','gablesGradeReview','bowleySurveyPreview',
  'woodland3D','seatedForestShadows','noMadeUpStudy'])assert(!wants(new URLSearchParams(k)),k);
 assert(gables(new URLSearchParams('stockCavendishWater')));
 assert.equal(sceneryReviewBlock('cavendishWaterReview',new URLSearchParams('cavendishWaterReview')),undefined);
});

test('actual World owner, Bowley and stock arrays unchanged; one linked carve and two exact drafts commit together',async()=>{
 const {world,scene,camera,mesh,t,f,lookAt,renderState}=app(),m=mesh.material,b0=hashes(mesh);
 assert(world.cavendishWaterReceiverReady);assert(!world.hasFreshwaterSource(CORE.id));
 assert(world.hasFreshwaterSource(BOWLEY_POND.id));
 const original=world.surface(...point),edge=world.surface(...dry),sea=world.surface(...offshore);
 assert(original.land);const called=[],ctl=new AbortController();
 const sky=m.uniforms.skyMap.value,originalSource=sky.source.version,C=m.version;
 let tris=[],linked=0,allow=true;
 const prep=await world.prepareCavendishWater(pond,camera,async group=>{
  assert(!group.parent&&!group.visible);assert.deepEqual(group.children.map(q=>q.parent),[group,group,group]);
  assert.equal(group.children.length,3);assert.equal(group.children[0].geometry,mesh.geometry);
  assert.equal(group.children[0].material.vertexShader,m.vertexShader);assert.equal(mesh.material,m);
  assert.equal(group.children[0].material.uniforms.skyMap,m.uniforms.skyMap);
  assert.equal(group.children[1].material.uniforms.rippleMap,m.uniforms.rippleMap);
  assert.equal(group.children[2].material.uniforms.imageMap,m.uniforms.imageMap);
  const [land,water,rim]=group.children;called.push(land.material,water.material,rim.material);
  assert.notEqual(land.material,m);
  assert(land.material.fragmentShader.includes('if(bowleyDistance(p.xz)<0.&&bowleyRasterDistance()<0.)discard;'));
  assert.equal(land.material.uniforms.bowleyMask,water.material.uniforms.bowleyMask);
  assert.equal(land.material.uniforms.bowleyMask,rim.material.uniforms.bowleyMask);
  assert.equal(water.position.y,1.468);
  tris=[water.geometry.index.count/3,ac(rim.geometry,'position').count/3];linked++;
  assert(!names.some(n=>scene.getObjectByName(n)));
  return ()=>allow;
 },ctl.signal,()=>allow);
 assert(prep?.ready());assert.deepEqual(tris,[2,23680]);
 assert.equal(C,m.version);assert.equal(originalSource,sky.source.version);
 assert.deepEqual(hashes(mesh),b0);assert.deepEqual(world.surface(...point),original);
 assert(prep.commit());assert(!prep.ready());assert(!names.some(n=>scene.getObjectByName(n)));
 assert.deepEqual(world.surface(...point),{height:1.468,land:false,runway:false});
 assert.deepEqual(world.surface(...dry),edge);assert.deepEqual(world.surface(...offshore),sea);assert.equal(world.groundHeight(...point),1.468);
 const end=prep.beginDraw();assert(end);assert.equal(mesh.material,called[0]);
 assert(names.every((n,i)=>scene.getObjectByName(n).material===called[i+1]));
 const alias=renderState.sort;assert.equal(typeof alias,'function');
 const id=q=>Object.getOwnPropertyDescriptor(q,'id').value;
 const Item=(material,id,materialVariant=0,z=0)=>({groupOrder:0,renderOrder:0,material:{id:material},materialVariant,z,id});
 const k=id(m),z=id(called[0]);assert(z>k+1);
 assert(alias(Item(z,4),Item(k+1,3))<0); // the borrowed terrain must sort in exactly the old position
 assert(alias(Item(z,4,0),Item(k,3,1))<0); // unchanged secondary r187 variant order
 assert(alias(Item(z,4),Item(k,3))>0); // unchanged final stable object tie breaker
 try{throw Error('simulated dynamic exterior draw error');}catch{/** opaque call failed */}finally{end();}
 assert.equal(mesh.material,m);assert.equal(renderState.sort,null);assert(!names.some(n=>scene.getObjectByName(n)));assert.equal(prep.state().draws,1);
 assert.deepEqual(hashes(mesh),b0);assert.equal(linked,1);
 // Real flight progression: the ordinary eastern seam moves to 112/112,
 // changing the same untouched source geometry's perimeter only.
 const ear=t.seams,originalPosition=mesh.geometry.getAttribute('position'),index=mesh.geometry.index;
 for(let i=0;i<900;i++)step(f,neutral,(x,z)=>world.surface(x,z),FIXED_STEP);
 lookAt(f);
 assert.notEqual(t.seams,ear);assert.match(t.seams,/^112:112,112,/);
 assert.equal(mesh.geometry.getAttribute('position'),originalPosition);assert.equal(mesh.geometry.index,index);
 assert.notEqual(hash(originalPosition),b0[0]);assert.deepEqual(hashes(mesh).slice(1),b0.slice(1));
 assert(prep.maintain());const close=prep.beginDraw();assert(close);close();assert.equal(linked,1);
 const oldSky=sky.source.version;
 let retiredStock=0;mesh.geometry.addEventListener('dispose',()=>retiredStock++);
 allow=false;assert(!prep.maintain());assert.equal(prep.beginDraw(),undefined);
 prep.dispose();prep.dispose();assert.equal(retiredStock,0);assert.equal(sky.source.version,oldSky);
 assert.equal(mesh.material,m);assert.deepEqual(world.surface(...point),original);
 assert(world.hasFreshwaterSource(BOWLEY_POND.id));
});

test('same-size wrong resident mask, refused link and new non-rim data preserve stock before physics',async()=>{
 const {world,mesh,camera}=app(),ctl=new AbortController(),old=world.surface(...point),stock=mesh.material;
 const deny=await world.prepareCavendishWater(pond,camera,async()=>undefined,ctl.signal,ignore);
 assert.equal(deny,undefined);assert.equal(mesh.material,stock);assert.deepEqual(world.surface(...point),old);
 const forged=new (pond.constructor)(CORE,pond.bytes.slice());forged.bytes[746]^=1;
 let links=0;const link=async()=>{links++;return ignore;};
 assert.equal(await world.prepareCavendishWater(forged,camera,link,ctl.signal,ignore),undefined);assert.equal(links,0);
 const p=await world.prepareCavendishWater(pond,camera,link,ctl.signal,ignore);assert(p?.ready());
 const position=mesh.geometry.getAttribute('position'),at=7*113+7;
 position.setY(at,position.getY(at)+.20);position.needsUpdate=true;
 assert(!p.ready());assert(!p.commit());assert.deepEqual(world.surface(...point),old);p.dispose();
 assert.equal(mesh.material,stock);assert(!world.hasFreshwaterSource(CORE.id));
});

test('checked Begin uses pending latch exactly once; delayed proof may not install on existing flight',async()=>{
 const {world,camera}=app(),a=new IndianRiverDeparture(()=>true);
 let release;const wait=new Promise(resolve=>release=resolve);let hooks=0;
 const old=world.surface(...point),flight={};
 a.prepare(async signal=>{
  await wait;return world.prepareCavendishWater(pond,camera,async()=>{hooks++;return ignore;},signal,ignore);
 });
 assert(!a.begin(flight,true));release();await new Promise(resolve=>setTimeout(resolve,50));
 assert(!a.beforeStep(flight,true,true));assert.equal(hooks,0);assert.deepEqual(world.surface(...point),old);
 a.resetDispatch();
 let p;const prep=await new Promise(resolve=>{
  a.prepare(async signal=>{p=await world.prepareCavendishWater(pond,camera,async()=>ignore,signal,ignore);resolve(p);return p;});
 });
 await Promise.resolve();assert(prep?.ready()&&a.ready);
 assert(a.begin(flight,true));assert.deepEqual(world.surface(...point),old);
 assert(a.beforeStep(flight,true,true));assert.equal(world.groundHeight(...point),1.468);
 assert(!a.beforeStep({},true,true));assert.deepEqual(world.surface(...point),old);
});

test('unsafe viewport/scissor/target is rejected before first and later contact',async()=>{
 const {world,camera,renderState,mesh}=app(),a=new IndianRiverDeparture(()=>true);
 const old=world.surface(...point),ctl=new AbortController();
 const attempt=()=>world.prepareCavendishWater(pond,camera,async()=>ignore,ctl.signal,ignore);
 for(const state of [{vw:0},{vh:720},{scissor:true},{rt:{shadow:true}}]){
  Object.assign(renderState,state);
  assert.equal(await attempt(),undefined);assert.deepEqual(world.surface(...point),old);
  Object.assign(renderState,{vw:1200,vh:760,scissor:false,rt:null});
 }
 let next;
 for(let i=0;i<2;i++){
  a.resetDispatch();
  await new Promise(done=>a.prepare(async signal=>{
   next=await world.prepareCavendishWater(pond,camera,async()=>ignore,signal,ignore);
   done();return next;
  }));
  await Promise.resolve();assert(a.ready);const flight={};assert(a.begin(flight,true));
  if(i===1){assert(a.beforeStep(flight,true,true));assert.equal(world.groundHeight(...point),1.468);}
  renderState.vh=720;
  assert(!a.beforeStep(flight,true,true));
  assert.deepEqual(world.surface(...point),old);assert.equal(renderState.sort,null);
  assert.equal(next.beginDraw(),undefined);assert.equal(mesh.parent,world.scene);
  renderState.vh=760;
 }
});

test('historical explicit constructor still owns both of its registered freshwater sources',()=>{
 const {world,scene}=app([pond]);
 assert.equal(world.groundHeight(...point),1.468);assert(world.hasFreshwaterSource(BOWLEY_POND.id));
 assert(world.hasFreshwaterSource(CORE.id));assert(names.every(n=>scene.getObjectByName(n)));
 assert(!world.cavendishWaterReceiverReady);
});
