import {test} from 'node:test';
import A from 'node:assert/strict';
import * as T from 'three';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {setTimeout as sleep} from 'node:timers/promises';
import {railShingleConsent,railShingleStockSearch} from '../src/app/rail-shingle-option.ts';
import {railRequested,railStandardRequested} from '../src/render/summerside-station/admit.ts';
import {decodeRailArtwork} from '../src/render/summerside-station/rail-art.ts';
import {RAIL_ART} from '../src/render/summerside-station/art.generated.ts';
import {SUMMERSIDE_STATION as RAIL} from '../src/render/summerside-station/source.generated.ts';
import {RailShinglePreview,type RailShingleFrame} from '../src/render/rail-shingle-preview.ts';
import {project,RAD} from '../src/sim/geo.ts';

const route='spinnakers-low',base='?departure='+route,offer='railShinglePreview=1';
const wire=gunzipSync(readFileSync(new URL('../public/art/'+RAIL_ART.file,import.meta.url)));
test('literal consent is scoped to one ordinary departure and does not disturb old controls',()=>{
 A.equal(railShingleConsent(base+'&'+offer),true);
 A.equal(railShingleConsent(base+'&scenery=standard&'+offer+'&diagnostics'),true);
 for(const raw of ['',base,base+'&railShinglePreview=%31',base+'&railShinglePre%76iew=1',
  base+'&'+offer+'&'+offer,base+'&'+offer+'&stockStationExterior',base+'&'+offer+'&buildingShadows&summersideStationReview',
  base+'&'+offer+'&scenery=detail',base+'&'+offer+'&eastPointWallPreview=1',base+'&'+offer+'&northCapeLightPreview',
  base+'&'+offer+'&basinCanneryFinish=1','?departure=cysu&'+offer])A.equal(railShingleConsent(raw),false,raw);
 for(const old of [base,base+'&stockStationExterior',base+'&buildingShadows&summersideStationReview',
  base+'&scenery=detail',base+'&?railShinglePreview=legacy',base+'&x=%20y&x=%26']) {
  const mixed=old+'&'+offer;
  A.equal(railShingleStockSearch(mixed),old);
  const p=new URLSearchParams(old),q=new URLSearchParams(railShingleStockSearch(mixed));
  A.equal(railRequested(q),railRequested(p));A.equal(railStandardRequested(q),railStandardRequested(p));
 }
});
const profile={SAMPLES:1,DEPTH_BITS:2,DRAW_FRAMEBUFFER_BINDING:3,READ_FRAMEBUFFER_BINDING:4,SCISSOR_TEST:5,SAMPLE_COVERAGE:6,VIEWPORT:7};
function trial({samples=4,hold=false,interrupt=false}={}){
 const art=decodeRailArtwork(wire.buffer.slice(wire.byteOffset,wire.byteOffset+wire.byteLength));
 if(!art)throw Error('No signed C fixture');
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(53,1200/760,.08,350000);
 const light=new T.Texture();light.mapping=T.EquirectangularReflectionMapping;
 scene.environment=light;scene.environmentIntensity=.77;scene.environmentRotation.y=-.512*Math.PI*2;
 scene.add(art.group);
 camera.position.set(RAIL.originXZ[0]+220,90,RAIL.originXZ[1]);
 const roof=art.group.getObjectByName('roof') as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>,stock=roof.material;
 const source=project(-63.7813,46.3849);
 let frame:RailShingleFrame={route,selected:true,mode:'dispatch',view:0,flight:{},...source,heading:314*RAD,time:0,status:'flying'};
 let program=true,owner=true,calls=0,permit:(()=>void)|undefined,updated=0,once=interrupt;
 const seen:T.Material[]=[];
 const gl={...profile,getContextAttributes:()=>({antialias:samples===4,depth:true}),isContextLost:()=>false,
  getParameter:(v:number)=>({[profile.SAMPLES]:samples,[profile.DEPTH_BITS]:24,[profile.DRAW_FRAMEBUFFER_BINDING]:null,
   [profile.READ_FRAMEBUFFER_BINDING]:null,[profile.VIEWPORT]:[0,0,1200,760]})[v],isEnabled:()=>false,
  drawingBufferWidth:1200,drawingBufferHeight:760};
 const raw=(c:unknown,s:unknown,g:unknown,m:T.Material,o:unknown,z:unknown)=>{
  A.equal(c,camera);A.equal(s,scene);A.equal(g,roof.geometry);A.equal(o,roof);A.equal(z,null);seen.push(m);
  if(m!==stock&&once){once=false;program=false;}
 };
 const r={renderBufferDirect:raw,getContext:()=>gl,getRenderTarget:()=>null,capabilities:{isWebGL2:true,logarithmicDepthBuffer:true},
  getPixelRatio:()=>1,getDrawingBufferSize:(p:T.Vector2)=>p.set(1200,760),getCurrentViewport:(p:T.Vector4)=>p.set(0,0,1200,760),
  xr:{},getScissorTest:()=>false,sortObjects:true,autoClear:true,autoClearColor:true,autoClearDepth:true,shadowMap:{enabled:false},
  localClippingEnabled:false,clippingPlanes:[],outputColorSpace:T.SRGBColorSpace,toneMapping:T.ACESFilmicToneMapping,toneMappingExposure:1};
 const c=new RailShinglePreview(r as unknown as T.WebGLRenderer,scene,camera,()=>({group:art.group,current:()=>owner}),
  async(g,signal)=>{
   calls++;
   A.equal(g.parent,null);A.equal(g.children.length,1);
   const part=g.children[0] as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
   A.equal(part.geometry,roof.geometry);A.notEqual(part.material,stock);A.equal(part.material.map,stock.map);
   A.equal(part.material.customProgramCacheKey(),'summ-rail-base/registered-lapped-roof-v1');
   if(hold)await new Promise<void>(done=>permit=done);
   return ()=>program&&!signal.aborted;
  },()=>frame);
 Object.assign(c,{exactProgram:async()=>{updated++;return true;}});
 const draw=()=>r.renderBufferDirect(camera,scene,roof.geometry,stock,roof,null);
 return {c,roof,stock,scene,camera,seen,raw,r,get calls(){return calls;},get updated(){return updated;},finish:()=>permit?.(),
  set:(v:Partial<RailShingleFrame>)=>{frame={...frame,...v};},get frame(){return frame;},draw:()=>c.render(frame,draw),
  retire:()=>{owner=false;},dispose:()=>{c.dispose();art.dispose();}};
}
async function until(f:()=>boolean){
 for(let i=0;i<100&&!f();i++)await sleep(4);
 A.ok(f());
}
test('preflight borrows exact geometry and map, keeps Dispatch stock, and draws only the active near Chase',async()=>{
 const q=trial();
 try{
  const {c,roof,stock,seen}=q; const cb=stock.onBeforeCompile;
  q.draw();await until(()=>c.dispatchPhase==='ready');
  A.equal(q.updated,1);A.equal(c.state.submitted,0);A.deepEqual(seen,[stock]);
  c.begin(q.frame,true);q.set({mode:'flight',view:1});q.draw();A.equal(c.state.submitted,0);A.equal(seen.at(-1),stock);
  q.set({view:0});q.draw();A.equal(c.state.submitted,1);A.notEqual(seen.at(-1),stock);
  A.equal(roof.material,stock);A.equal(stock.onBeforeCompile,cb);A.equal(q.r.renderBufferDirect,q.raw);
  q.camera.position.x+=600;q.draw();A.equal(c.state.submitted,0);A.equal(seen.at(-1),stock);
  q.retire();q.draw();A.equal(c.state.phase,'held');A.equal(seen.at(-1),stock);
 }finally{q.dispose();}
});
test('Begin during pending prelink stays stock until a genuinely fresh ready Dispatch; forged Begin never arms',async()=>{
 const q=trial({hold:true});
 try{
  q.draw();await until(()=>q.calls===1);
  q.c.begin(q.frame,true);q.set({mode:'flight'});q.finish();await sleep(20);
  q.draw();A.equal(q.c.state.phase,'held');A.equal(q.c.state.submitted,0);
  q.c.reset();q.set({mode:'dispatch',flight:{}});q.draw();await until(()=>q.calls===2);q.finish();await until(()=>q.c.dispatchPhase==='ready');
  q.c.begin(q.frame,false);q.set({mode:'flight'});q.draw();A.equal(q.c.state.phase,'held');
  A.ok(q.seen.every(x=>x===q.stock));
 }finally{q.dispose();}
});
test('zero AA cannot prepare; losing linked handle within draw immediately repaints the exact original frame',async()=>{
 const no=trial({samples:0}),q=trial({interrupt:true});
 try{
  no.draw();A.equal(no.calls,0);
  q.draw();await until(()=>q.c.dispatchPhase==='ready');
  q.seen.length=0;q.c.begin(q.frame,true);q.set({mode:'flight'});q.draw();
  A.equal(q.seen.length,2);A.notEqual(q.seen[0],q.stock);A.equal(q.seen[1],q.stock);
  A.equal(q.c.state.phase,'held');A.equal(q.c.state.submitted,0);A.equal(q.r.renderBufferDirect,q.raw);
 }finally{no.dispose();q.dispose();}
});
