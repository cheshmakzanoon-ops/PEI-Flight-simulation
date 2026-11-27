import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DoubleSide,PerspectiveCamera,Scene,type Material,type Mesh} from 'three';
import {drawKnightTower} from '../src/render/souris-knight-art.ts';
import {knightExteriorMaterials,linkKnightPrograms} from '../src/render/souris-knight-program-gate.ts';

function fixture(){
 const art=drawKnightTower(()=>11),scene=new Scene(),camera=new PerspectiveCamera();
 const programs=new WeakMap<Material,object>(),gl={LINK_STATUS:1,isContextLost:()=>false,isProgram:()=>true,getProgramParameter:()=>true};
 const r={getContext:()=>gl,getRenderTarget:()=>null,xr:{isPresenting:false},localClippingEnabled:false,clippingPlanes:[],
  outputColorSpace:'srgb',toneMapping:0,shadowMap:{enabled:false,type:0},
  properties:{get:(m:Material)=>programs.get(m)},
  compile(){
   const set=new Set();
   for(const p of art.children as Mesh[]){
    const m=p.material as Material;set.add(m);programs.set(m,{currentProgram:{program:{},isReady:()=>true}});
   }
   return set;
  }};
 return {r,art,scene,camera,programs,dispose(){for(const p of art.children as Mesh[]){p.geometry.dispose();(p.material as Material).dispose();}}};
}
test('only the authentic four exterior batches, including one single-sided lantern pane, are admissible',()=>{
 const v=fixture(),m=knightExteriorMaterials(v.art);
 assert.equal(m?.length,4);assert(m?.[3].transparent);
 m[3].side=DoubleSide;assert.equal(knightExteriorMaterials(v.art),undefined);
 v.dispose();
});
test('preflight leaves the actual scene detached and restores stock on program invalidation or cancellation',async()=>{
 const v=fixture(),ctl=new AbortController();
 const g=await linkKnightPrograms(v.r as never,v.camera,v.scene,v.art,ctl.signal,()=>true);
 assert(g?.());assert.equal(v.art.parent,null);
 v.scene.add(v.art);assert(g?.());
 const m=knightExteriorMaterials(v.art)!;v.programs.set(m[3],{currentProgram:{}});
 assert(!g?.());
 ctl.abort();assert(!g?.());v.art.removeFromParent();
 assert.equal(await linkKnightPrograms(v.r as never,v.camera,v.scene,v.art,ctl.signal,()=>true),undefined);
 v.dispose();
});

import {standardSourisKnightRequested,sourisKnightRequested,standardSourisShoreline} from '../src/app/scenery-profile.ts';
test('automatic and legacy lighthouse controls keep the verified Souris shoreline independent',()=>{
 const q=(v:string)=>new URLSearchParams('departure=souris-waterfront-pass&diagnostics'+v);
 assert(standardSourisKnightRequested(q('')));
 assert(sourisKnightRequested(q('&sourisKnightExterior')));
 assert(!standardSourisKnightRequested(q('&sourisKnightExterior')));
 assert(!standardSourisKnightRequested(q('&stockSourisKnight')));
 assert(!sourisKnightRequested(q('&sourisKnightExterior&stockSourisKnight')));
 for(const v of ['&scenery=detail','&scenery=standard&scenery=standard','&qa','&surveyRelief','&departure=other']){
  assert(!standardSourisKnightRequested(q(v)),v);
 }
 for(const v of ['', '&sourisKnightExterior','&stockSourisKnight'])assert(standardSourisShoreline(q(v)));
});

import {Buildings} from '../src/render/buildings.ts';
test('a failed preparation does not re-arm during a transient stream wobble in the same Dispatch',async()=>{
 const g={},owner={geometry:g};let selected=true,settled=true,attempts=0;
 const b=Object.assign(Object.create(Buildings.prototype),{
  queuedKnight:{owner,bytes:new ArrayBuffer(0),rows:0,row:null,checked:false,pin:{stock:g,baseOwner:()=>true}},
  knightSeat:{resident:()=>true,standard:{dispatch:()=>selected,prepare:()=>settled,flight:()=>false}},
  async promoteKnight(){attempts++;},
 }) as {syncKnight:()=>void};
 const drain=()=>new Promise(r=>setImmediate(r));
 b.syncKnight();await drain();assert.equal(attempts,1);
 settled=false;b.syncKnight();
 settled=true;b.syncKnight();await drain();assert.equal(attempts,1);
 selected=false;b.syncKnight();selected=true;b.syncKnight();await drain();assert.equal(attempts,2);
});
