import {test} from 'node:test';
import A from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setTimeout as sleep} from 'node:timers/promises';
import * as T from 'three';
import {eastRimConsent,eastRimStockSearch} from '../src/app/east-roof-rim-option.ts';
import {eastPointWallOption} from '../src/render/east-wall-preview.ts';
import {northCapeLightOption} from '../src/app/north-cape-light-option.ts';
import {basinCanneryFinishConsent} from '../src/app/basin-cannery-option.ts';
import {EastRimPreview,type EastRimFrame} from '../src/render/east-roof-rim-preview.ts';
import {eastRoofRimWire as q} from '../src/render/east-roof-rim-wire.generated.ts';
import {shapes} from '../tools/art/east-point-measured-roofs/rim/stock-owner.mjs';

const normal='?departure=east-light',opt=normal+'&eastPointRimPreview=1';
const wire=readFileSync(new URL('../public/world/buildings/tiles.pack',import.meta.url)).subarray(3260377,3260377+9073);
test('own roof option never enables wall, other districts or legacy flags',()=>{
 A.ok(eastRimConsent(opt));A.ok(eastRimConsent(opt+'&scenery=standard&diagnostics'));
 for(const query of ['',normal,opt+'&eastPointRimPreview=1',normal+'&eastPointRimPreview=%31',
  opt.replace('east-light','northcape-wind-low'),opt+'&eastPointWallPreview=1',
  opt+'&northCapeLightPreview',opt+'&basinChannel&basinCanneryFinish=1',opt+'&scenery=detail',
  opt+'&stockEastPointWalls'])A.equal(eastRimConsent(query),false,query);
 A.equal(eastPointWallOption(opt+'&eastPointWallPreview=1').requested,false);
 A.equal(northCapeLightOption(opt+'&northCapeLightPreview').route,false);
 A.equal(basinCanneryFinishConsent(opt+'&basinChannel&basinCanneryFinish=1'),false);
 const old=normal+'&?eastPointRimPreview=foreign&survey=%20red+clay';
 A.equal(eastRimStockSearch(old+'&eastPointRimPreview=1'),old);
});
const K={SAMPLES:1,DEPTH_BITS:2,ALPHA_BITS:3,DRAW_FRAMEBUFFER_BINDING:4,READ_FRAMEBUFFER_BINDING:5,VIEWPORT:6,SCISSOR_TEST:7,SAMPLE_COVERAGE:8};
function sample({badBytes=false,aa=4}={}){
 const scene=new T.Scene(),cam=new T.PerspectiveCamera(53,1200/760,.08,350000),g=new T.BufferGeometry(),mat=new T.ShaderMaterial();
 for(const name of ['position','uv','color','topFlag','normal','facadeStyle'])g.setAttribute(name,shapes[name].clone());
 const mesh=new T.Mesh(g,mat);mesh.position.set(...q.owner);scene.add(mesh);scene.updateMatrixWorld(true);
 let rx:unknown=null,warm=0,id=true;
 let f:EastRimFrame={route:'east-light',mode:'dispatch',time:0,status:'flying',view:0,selected:true,flight:{}};
 const source=Uint8Array.from(wire);
 if(badBytes)source[20]^=4;
 const gl={...K,getParameter:(p:number)=>({[K.SAMPLES]:aa,[K.ALPHA_BITS]:8,[K.DEPTH_BITS]:24,
  [K.VIEWPORT]:[0,0,1200,760],[K.DRAW_FRAMEBUFFER_BINDING]:null,[K.READ_FRAMEBUFFER_BINDING]:null})[p],
  isContextLost:()=>false,isEnabled:()=>false,drawingBufferWidth:1200,drawingBufferHeight:760};
 const seen:T.BufferGeometry[]=[];
 const raw=(c:T.Camera,s:T.Scene,g0:T.BufferGeometry,m:T.Material,o:T.Object3D,z:unknown)=>{
  A.equal(c,cam);A.equal(s,scene);A.equal(m,mat);A.equal(o,mesh);A.equal(z,null);seen.push(g0);
 };
 const fixture={renderBufferDirect:raw,getContext:()=>gl,getRenderTarget:()=>rx,setRenderTarget:(x:unknown)=>{rx=x;},
  render:(s:T.Scene,c:T.Camera)=>{A.notEqual(s,scene);A.notEqual(c,cam);A.ok(rx);warm++;},xr:{},getScissorTest:()=>false,
  getScissor:(p:T.Vector4)=>p.set(0,0,1200,760),getViewport:(p:T.Vector4)=>p.set(0,0,1200,760),
  getCurrentViewport:(p:T.Vector4)=>p.set(0,0,1200,760),getDrawingBufferSize:(p:T.Vector2)=>p.set(1200,760),
  setViewport:()=>{},setScissor:()=>{},getPixelRatio:()=>1,shadowMap:{enabled:false},
  clippingPlanes:[],localClippingEnabled:false,autoClear:true,autoClearColor:true,autoClearDepth:true,sortObjects:true,
  capabilities:{isWebGL2:true,logarithmicDepthBuffer:true}};
 const ctl=new EastRimPreview(fixture as unknown as T.WebGLRenderer,scene,cam,
  ()=>({wire:source.buffer,mesh,current:()=>id}),()=>f,()=>true);
 let wrong=false;
 const render=()=>ctl.draw(f,()=>{
  fixture.renderBufferDirect(cam,scene,wrong?new T.BufferGeometry():g,mat,mesh,null);
 });
 return {ctl,seen,fixture,raw,mesh,g,mat,draw:render,get coldUploads(){return warm;},get frame(){return f;},
  set:(a:Partial<EastRimFrame>)=>{f={...f,...a};},stop:()=>{id=false;},wrong:()=>{wrong=true;},dispose:()=>{ctl.dispose();g.dispose();mat.dispose();}};
}
async function wait(f:()=>boolean){
 for(let i=0;i<120&&!f();i++)await sleep(4);
 A.ok(f());
}
test('verified exact private alternate adds 78 triangles at original sorted draw, with no stock replacement',async()=>{
 const s=sample(),{ctl,seen,g,mesh,mat}=s;
 try{
  s.draw();await wait(()=>ctl.dispatchPhase==='ready');A.equal(s.coldUploads,1);A.deepEqual(seen,[g]);
  ctl.begin(s.frame,true);s.set({mode:'flight'});s.draw();A.ok(ctl.state.submitted);
  const alternate=seen.at(-1)!;
  A.notEqual(alternate,g);A.equal(alternate.getAttribute('position').count,12222);
  A.equal(g.getAttribute('position').count,11988);
  A.equal(mesh.geometry,g);A.equal(mesh.material,mat);A.equal(s.fixture.renderBufferDirect,s.raw);
  s.set({view:1});s.draw();A.equal(seen.at(-1),g);A.equal(ctl.state.submitted,false);
  s.stop();s.set({view:0});s.draw();A.equal(ctl.state.phase,'held');A.equal(seen.at(-1),g);
 }finally{s.dispose();}
});
test('late/corrupt/no-AA sources stay stock; signed fresh Dispatch can rearm',async()=>{
 const s=sample(),bad=sample({badBytes:true}),no=sample({aa:0});
 try{
  s.draw();s.ctl.begin(s.frame,true);s.set({mode:'flight'});await sleep(35);
  s.draw();A.equal(s.ctl.state.phase,'held');A.equal(s.coldUploads,0);
  s.ctl.reset();s.set({mode:'dispatch',flight:{}});s.draw();await wait(()=>s.ctl.dispatchPhase==='ready');
  s.ctl.begin(s.frame,false);s.set({mode:'flight'});s.draw();A.equal(s.ctl.state.phase,'held');
  bad.draw();await wait(()=>bad.ctl.state.phase==='held');A.equal(bad.coldUploads,0);
  no.draw();A.equal(no.ctl.dispatchPhase,'waiting');A.equal(no.coldUploads,0);
 }finally{s.dispose();bad.dispose();no.dispose();}
});
