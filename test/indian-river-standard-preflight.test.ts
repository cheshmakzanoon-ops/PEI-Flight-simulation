import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync as read} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {AmbientLight,Mesh,PerspectiveCamera,Scene,type Material,type WebGLRenderer} from 'three';
import {prepareChurchArt} from '../src/render/indian-river/runtime.ts';
import {linkChurchOpaquePrograms} from '../src/render/indian-river/church-opaque-programs.ts';
import {loadStandardIndianRiverSource} from '../src/render/indian-river/standard-source.ts';
import {INDIAN_RIVER_SOURCE as S} from '../src/render/indian-river/indian-river-source.generated.ts';
import {INDIAN_RIVER_GRADE as G} from '../src/sim/indian-river-grade.generated.ts';
import {CHURCH_SUN_MASK as M} from '../src/render/indian-river/church-sun.generated.ts';
import {Cover} from '../src/sim/cover.ts';
import {Terrain} from '../src/sim/terrain.ts';

test('the detached church cannot borrow a mixed render path, and linked owned art survives the pending deadline',async()=>{
 const art=prepareChurchArt(),scene=new Scene(),camera=new PerspectiveCamera(),signal=new AbortController();
 const records=new Map<Material,{currentProgram:{program:object;isReady:()=>boolean}}>();
 const gl={isContextLost:()=>false,getContextAttributes:()=>({alpha:true,antialias:true}),SAMPLES:9,LINK_STATUS:10,
  getParameter:()=>4,isProgram:()=>true,getProgramParameter:()=>true};
 const renderer={getContext:()=>gl,getRenderTarget:()=>null,shadowMap:{enabled:false},xr:{isPresenting:false},
  clippingPlanes:[],localClippingEnabled:false,properties:{get:(m:Material)=>records.get(m)},
  compile(group:typeof art.group){
   assert.equal(group,art.group);assert(!group.parent);
   group.traverse(o=>{if(o instanceof Mesh){assert(!Array.isArray(o.material));records.set(o.material,{currentProgram:{program:{},isReady:()=>true}});}});
   return new Set(records.keys());
  }} as unknown as WebGLRenderer;
 const proof=await linkChurchOpaquePrograms(renderer,camera,scene,art.group,signal.signal,12);
 assert(proof);assert.equal(records.size,14);assert(proof());
 await new Promise(r=>setTimeout(r,24));assert(proof());
 scene.add(art.group);assert(proof());
 const change=new AmbientLight();scene.add(change);assert(!proof());scene.remove(change);assert(proof());
 signal.abort();assert(!proof());
 const own=Array.from(records.keys())[0];let disposals=0;own.addEventListener('dispose',()=>disposals++);
 art.dispose();art.dispose();assert.equal(disposals,1);assert(!art.group.parent);assert(!art.active());
});

test('only a currently selected Dispatch loads the two signed local Indian River buffers',async()=>{
 const file=(n:string)=>read(new URL('../public/world/'+n,import.meta.url));
 const spec=JSON.parse(file('terrain.json').toString()),meta=JSON.parse(file('cover.json').toString());
 const h=gunzipSync(file(spec.file)),terrain=new Terrain(spec,new Int16Array(h.buffer,h.byteOffset,h.byteLength/2));
 const cover=new Cover(meta.width,meta.height,Uint8Array.from(gunzipSync(file(meta.file))),undefined,meta.compressedSha256);
 const controller=new AbortController();let selected=true;
 const requests:string[]=[];
 const get:typeof fetch=async(url,init)=>{
  assert(init?.signal&&!init.signal.aborted);
  const name=String(url).replace(/^\/world\//,'');requests.push(name);return new Response(Uint8Array.from(file(name)));
 };
 const context={terrain,terrainSHA:spec.sha256,cover,roadsSHA:S.road,accept:()=>selected,signal:controller.signal};
 const result=await loadStandardIndianRiverSource('/world/',context,get);
 assert(result);assert.deepEqual(requests.sort(),[G.file,M.file].sort());
 assert.equal(result.grade.grid.spec,G);
 assert.equal(result.sun.live.value,0);result.sun.uniforms.churchSunMask.value.dispose();
 selected=false;
 assert.equal(await loadStandardIndianRiverSource('/world/',context,get),undefined);
 selected=true;
 assert.equal(await loadStandardIndianRiverSource('/world/',{...context,roadsSHA:undefined},get),undefined);
 assert.equal(requests.length,2);
 const interrupted=new AbortController();
 const stopping:typeof fetch=async(_url,init)=>{
  assert(init?.signal);
  interrupted.abort();
  assert(init.signal.aborted);
  return new Response(null,{status:404});
 };
 assert.equal(await loadStandardIndianRiverSource('/world/',{...context,signal:interrupted.signal},stopping),undefined);
});
