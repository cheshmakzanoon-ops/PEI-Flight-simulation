import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {
 ACESFilmicToneMapping,Group,PCFShadowMap,PerspectiveCamera,Scene,ShaderMaterial,SRGBColorSpace,Texture,
 type BufferGeometry,type Material,type Mesh,type WebGLRenderer
} from 'three';
import {Buildings} from '../src/render/buildings.ts';
import {TOWN_WALL_CORE_AREAS} from '../src/render/town-wall-optics.ts';
import {authenticatedOwnerCohort} from '../src/render/authenticated-owner-cohort.ts';
import {authenticatedOwnerVariant} from '../src/render/indian-river/authored-owner-variant.ts';
import {TERMINAL_PROFILES,TERMINAL_WIRE as P,terminalDrawAllows,terminalWireAllows,type TerminalAttr,type TerminalStream} from '../src/render/summerside-terminal/terminal-wall-owner.ts';
import {TerminalWallPreview} from '../src/render/summerside-terminal/wall-preview.ts';
import {Terrain} from '../src/sim/terrain.ts';

// Byte-exact real stock generator/atlas, but the renderer interface below only
// checks CPU lifecycle. Real WebGL shader and protected-pixel tests are separate.
const raw=(p:string)=>readFileSync(new URL('../public/world/'+p,import.meta.url));
const j=(p:string)=>JSON.parse(raw(p).toString());
const m=j('terrain.json'),d=gunzipSync(raw(m.file));
const t=new Terrain(m,new Int16Array(d.buffer,d.byteOffset,d.byteLength/2));
const a=j('buildings/index.json'),q=a.tiles.find((q:{id:string})=>q.id===P.id);
const data=raw('buildings/'+a.file).subarray(q.offset,q.offset+q.bytes), body=Uint8Array.from(data).buffer;
const rows=JSON.parse(gunzipSync(data).toString()).features;
function fixture(town=false){
 const scene=new Scene(),panorama=new Texture();scene.environment=panorama.clone();
 const Generator=Buildings as unknown as new(...args:unknown[])=>{generate(...a:unknown[]):Mesh;tiles:unknown[]};
 const b=new Generator(scene,t,[q],undefined,a.sha256,undefined,undefined,undefined,undefined,false,undefined,undefined,
  false,undefined,undefined,undefined,undefined,undefined,town?{panorama,gain:{value:1},mode:'core',areas:TOWN_WALL_CORE_AREAS}:undefined);
 const owner=b.generate(rows,b.tiles[0],false,P.ordinal,false,undefined,true,true);
 scene.add(owner);scene.updateMatrixWorld(true);
 const stock=owner.material;assert(stock instanceof ShaderMaterial);
 assert.deepEqual(owner.userData.beaconTriangles,[P.first,P.last]);
 assert.equal(owner.geometry.getAttribute('position').count,P.total);
 assert(TERMINAL_PROFILES.includes(owner.position.x as (typeof TERMINAL_PROFILES)[number]));
 const g=owner.geometry;
 const camera=new PerspectiveCamera();camera.position.set(-45207,42,12538);
 const prg={program:{},isReady:()=>!stub.hold};
 const props=new WeakMap<Material,unknown>(); let bound:unknown=prg.program;
 const gl={isProgram:(p:unknown)=>p===prg.program,isContextLost:()=>false,
  getProgramParameter:(p:unknown,k:number)=>p===prg.program&&k===0x8b82&&!stub.fail,
  getParameter:(k:number)=>k===0x8b8d?bound:undefined,LINK_STATUS:0x8b82,CURRENT_PROGRAM:0x8b8d};
 const stub={hold:false,fail:false,collected:0,clip:false};
 const r={getContext:()=>gl,getRenderTarget:()=>null,outputColorSpace:SRGBColorSpace,toneMapping:ACESFilmicToneMapping,
  shadowMap:{enabled:false,type:PCFShadowMap},get localClippingEnabled(){return stub.clip;},clippingPlanes:[],
  properties:{get:(k:Material)=>props.get(k)??{}},
  compile(p:Group){assert(!p.parent);stub.collected++;
   const s=new Set(p.children.map(x=>(x as Mesh).material as Material));
   s.forEach(m=>props.set(m,{currentProgram:prg}));return s;
  }};
 const renderer=r as unknown as WebGLRenderer;
 const hook=owner.onAfterRender;
 const actor=(current:()=>boolean=()=>owner.parent===scene)=>new TerminalWallPreview(owner,scene,current,{renderer,camera,trackDraw:true});
 const draw=(geo:BufferGeometry=owner.geometry,source=camera,boundProgram:unknown=prg.program)=>{
  const own=owner.material;assert(own instanceof ShaderMaterial);
  bound=boundProgram;
  owner.updateWorldMatrix(true,false);
  own.onBeforeRender(renderer,scene,source,geo,owner,null as never);
  owner.onAfterRender(renderer,scene,source,geo,own,null as never);
  return own.uniforms.terminalWallLive?.value??0;
 };
 return {owner,g,stock,scene,camera,stub,actor,draw,hook};
}
const boot=(p:TerminalWallPreview)=>p.verify(a.sha256,q.id,body,rows);

test('complete q032001 issued source hashes and six q68 owner subsets are exact',async()=>{
 const f=fixture(), streams=Object.fromEntries(Object.entries(f.g.attributes).map(([k,v])=>[k,v.array])) as Record<TerminalAttr,TerminalStream>;
 assert(await terminalWireAllows(a.sha256,q.id,body,rows,f.owner.position.x,streams));
 const other=TERMINAL_PROFILES.find(x=>x!==f.owner.position.x)!;
 assert(!await terminalWireAllows(a.sha256,q.id,body,rows,other,streams));
 const bad=Uint8Array.from(new Uint8Array(body));bad[bad.length-1]^=1;
 assert(!await terminalWireAllows(a.sha256,q.id,bad.buffer,rows,f.owner.position.x,streams));
 const normal=(streams.normal as Float32Array).slice();normal[P.first*3]=42;
 assert(!await terminalWireAllows(a.sha256,q.id,body,rows,f.owner.position.x,{...streams,normal}));
 const away=rows.slice();away[P.ordinal]={...away[P.ordinal],height:999};
 assert(!await terminalWireAllows(a.sha256,q.id,body,away,f.owner.position.x,streams));
});

test('the true submitted q68 actor works with stock, rail, wharf and composed indices, without taking their leases',async()=>{
 const f=fixture(),c=authenticatedOwnerCohort(f.owner)!;
 const rail=new Group(),wharf=new Group();f.scene.add(rail,wharf);
 const r=c.add(rail,[30618,30666],{vertices:P.total,start:30618,end:30666})!;
 const w=c.addMany(wharf,[[51228,51429],[65946,65988]].map(([start,end])=>({span:[start,end],proof:{vertices:P.total,start,end}})))!;
 const v=f.actor(()=>c.stockForProof()===f.g);
 await boot(v);
 assert.equal(f.stub.collected,1);assert.equal(v.active,false);
 for(const [one,two,count] of [[false,false,null],[true,false,69858],[false,true,69663],[true,true,69615],[false,false,null]] as const){
  r.sync(one);w.sync(two);v.sync();
  const g=f.owner.geometry, ix=g.index;
  assert.equal(ix?.count??null,count);
  assert(terminalDrawAllows(ix?.array as Uint32Array??null,g.getAttribute('topFlag').array as Float32Array));
  assert(Object.entries(f.g.attributes).every(([k,a])=>g.getAttribute(k)===a));
  assert(v.active);assert.equal(v.rendered,false);
  const m=f.owner.material as ShaderMaterial;
  assert.notEqual(m.uniforms,f.stock.uniforms);
  assert.equal(m.uniforms.waterStreetSky,f.stock.uniforms.waterStreetSky);
  assert.equal(m.uniforms.waterStreetSky.value,f.scene.environment);
  assert.equal(f.draw(),1);assert(v.rendered);
  assert.equal(f.owner.geometry,g);assert.equal(rail.visible,one);assert.equal(wharf.visible,two);
 }
 v.dispose();assert.equal(f.owner.material,f.stock);assert.equal(f.owner.onAfterRender,f.hook);
 c.dispose();assert.equal(f.owner.geometry,f.g);
});

test('production Standard core keeps the seventh stream and independent fitted-window sky binding',async()=>{
 const f=fixture(true),fit=f.g.getAttribute('townWallFit');
 assert.equal(fit.count,P.total);assert(fit.array instanceof Int16Array);
 assert.deepEqual(Object.keys(f.stock.uniforms),['waterStreetSky','townWallGain','townWallSky']);
 const c=authenticatedOwnerCohort(f.owner)!,rail=new Group(),wharf=new Group();f.scene.add(rail,wharf);
 const a=c.add(rail,[30618,30666],{vertices:P.total,start:30618,end:30666})!;
 const w=c.addMany(wharf,[[51228,51429],[65946,65988]].map(([start,end])=>({span:[start,end],proof:{vertices:P.total,start,end}})))!;
 const v=f.actor(()=>c.stockForProof()===f.g);
 await boot(v);assert.equal(f.stub.collected,1);
 a.sync(true);w.sync(true);v.sync();assert(v.active);
 assert.equal(f.owner.geometry.index?.count,69615);assert.equal(f.owner.geometry.getAttribute('townWallFit'),fit);
 const valid=f.owner.material as ShaderMaterial;
 for(const [key,wrapper] of Object.entries(f.stock.uniforms))assert.equal(valid.uniforms[key],wrapper);
 assert.equal(f.draw(),1);assert(v.rendered);
 assert(rail.visible&&wharf.visible);
 // A changed donor value or copied seventh stream cannot keep the touchup alive.
 f.stock.uniforms.townWallGain.value=.5;v.sync();
 assert.equal(f.owner.material,f.stock);assert(!v.rendered);
 assert(rail.visible&&wharf.visible);
 f.stock.uniforms.townWallGain.value=1;v.sync();assert.equal(f.draw(),1);
 fit.array[P.first*3]^=1;
 v.sync();assert.equal(f.owner.material,f.stock);
 v.dispose();c.dispose();
});

test('one unexpected word elsewhere in the Standard fitted stream fails the exact startup proof',async()=>{
 const f=fixture(true),fit=f.g.getAttribute('townWallFit');
 fit.array[0]^=1;
 const v=f.actor();await boot(v);v.sync();
 assert(!v.active);assert.equal(f.stub.collected,0);assert.equal(f.owner.material,f.stock);
 v.dispose();
});

test('standalone station with stock wharf has a read-only exact stock lease',async()=>{
 const f=fixture();const rail=new Group();f.scene.add(rail);
 const lease=authenticatedOwnerVariant(f.owner,rail,[30618,30666],{vertices:P.total,start:30618,end:30666})!;
 const a=f.actor(()=>lease.stockForProof()===f.g);
 await boot(a);lease.sync(true);a.sync();
 assert.equal(f.owner.geometry.index?.count,69858);assert.equal(f.draw(),1);assert(a.rendered);
 a.dispose();assert(rail.visible);lease.dispose();assert.equal(f.owner.geometry,f.g);
});

test('a bad link or stale async lease never installs a submitted variant and does not touch stock',async()=>{
 const f=fixture();
 f.stub.fail=true;
 const a=f.actor();await boot(a);a.sync();
 assert.equal(f.stub.collected,1);assert(!a.active&&!a.rendered);
 assert.equal(f.owner.material,f.stock);assert.equal(f.owner.onAfterRender,f.hook);
 const s=fixture();s.stub.hold=true;
 const b=s.actor();const pending=boot(b);
 for(let wait=0;wait<160&&!s.stub.collected;wait++)await new Promise<void>(done=>setTimeout(done,4));
 assert.equal(s.stub.collected,1);
 s.owner.removeFromParent();b.dispose();s.stub.hold=false;
 await pending;b.sync();
 assert(!b.active&&!b.rendered);assert.equal(s.owner.material,s.stock);assert.equal(s.owner.onAfterRender,s.hook);
});

test('a late nonselected render or raw foreign EBO edit reads neutral before any report is permitted',async()=>{
 const f=fixture(),c=authenticatedOwnerCohort(f.owner)!;
 const rail=new Group();f.scene.add(rail);
 const r=c.add(rail,[30618,30666],{vertices:P.total,start:30618,end:30666})!;
 const a=f.actor(()=>c.stockForProof()===f.g);
 await boot(a);r.sync(true);a.sync();
 assert(a.active);
 assert.equal(f.draw(f.owner.geometry,new PerspectiveCamera()),0);assert(!a.rendered);
 a.sync();assert.equal(f.draw(f.owner.geometry,f.camera,{}),1);assert(!a.rendered);
 a.sync();const g=f.owner.geometry,ix=g.index!,i=64500,old=ix.array[i],rev=ix.version;
 ix.array[i]=P.first; // Direct unversioned word mutation well outside q68 itself.
 assert.equal(ix.version,rev);assert.equal(f.draw(),0);assert(!a.rendered);
 a.sync();assert(!a.active);assert.equal(f.owner.material,f.stock);
 ix.array[i]=old;ix.needsUpdate=true;a.sync();assert.equal(f.draw(),1);assert(a.rendered);
 a.dispose();c.dispose();
});

test('unversioned variant material/hook state and effective model movement fail stock',async()=>{
 for(const k of ['colorWrite','depthWrite','wireframe','frag','before','ownerAfter','actualMatrix','skyBacking','skyWrapper'] as const){
  const f=fixture(),a=f.actor();await boot(a);a.sync();assert(a.active);
  const v=f.owner.material as ShaderMaterial;
  switch(k){
   case 'colorWrite':v.colorWrite=false;break;
   case 'depthWrite':v.depthWrite=false;break;
   case 'wireframe':v.wireframe=true;break;
   case 'frag':v.fragmentShader+='\n// incompatible';break;
   case 'before':v.onBeforeRender=()=>{};break;
   case 'ownerAfter':f.owner.onAfterRender=()=>{};break;
   case 'skyBacking':f.stock.uniforms.waterStreetSky.value=new Texture();break;
   case 'skyWrapper':v.uniforms.waterStreetSky={...v.uniforms.waterStreetSky};break;
   case 'actualMatrix':f.owner.matrixWorldAutoUpdate=false;f.owner.matrixWorld.elements[12]+=5;break;
  }
  a.sync();assert(!a.active&&!a.rendered,k);assert.equal(f.owner.material,f.stock);
  if(k!=='ownerAfter')assert.equal(f.owner.onAfterRender,f.hook);
  a.dispose();
 }
});
