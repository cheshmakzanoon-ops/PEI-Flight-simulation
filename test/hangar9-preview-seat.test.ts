import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync as read} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Scene,PerspectiveCamera} from 'three';
import {Buildings} from '../src/render/buildings.ts';
import {Terrain} from '../src/sim/terrain.ts';
import {Hangar9Preview} from '../src/render/hangar9-preview.ts';
const f=n=>read(new URL('../public/world/'+n,import.meta.url));
const data=f=>JSON.parse(f);
const atlas=data(f('buildings/index.json')),spec=data(f('terrain.json')),bytes0=gunzipSync(f(spec.file)),base=f('buildings/'+atlas.file),t=atlas.tiles.find(q=>q.id==='q0322');
const wire=base.subarray(t.offset,t.offset+t.bytes);
const terrain=new Terrain(spec,new Int16Array(bytes0.buffer,bytes0.byteOffset,bytes0.byteLength/2));
const wait=async fn=>{for(let i=0;i<120;i++){if(fn())return;await new Promise(r=>setTimeout(r,2));}assert.fail('detached lease preparation did not resolve');};
async function fixture(link=async g=>{assert.equal(g.children.length,1);return ()=>true;}){
 const scene=new Scene(),camera=new PerspectiveCamera(53,1200/760,.08,350000),b=new Buildings(scene,terrain,[t],{read:async()=>
  wire.buffer.slice(wire.byteOffset,wire.byteOffset+wire.byteLength)},atlas.sha256);
 b.enablePrinceSurveyRoof(true);
 const source=b.observeHangar9Owner();
 b.wanted.add(t.id);await b.load(b.tiles[0]);
 const actor=b.meshes.get(t.id);assert.ok(actor&&source());
 const gl={SAMPLES:1,ALPHA_BITS:2,DEPTH_BITS:3,VIEWPORT:4,SAMPLE_COVERAGE:5,SCISSOR_TEST:6,drawingBufferWidth:1200,drawingBufferHeight:760,
  getParameter:n=>[0,4,8,24,[0,0,1200,760]][n],isEnabled:()=>false,isContextLost:()=>false};
 const seen=[];
 const r={getContext:()=>gl,xr:{isPresenting:false},getRenderTarget:()=>null,getScissorTest:()=>false,getPixelRatio:()=>1,
  getViewport:v=>v.set(0,0,1200,760),renderBufferDirect:(...arr)=>seen.push(arr[3])};
 camera.position.set(-48045,108,5931);scene.updateMatrixWorld(true);
 const seat=new Hangar9Preview(r,scene,camera,link);
 seat.setReader(source);
 const stock=actor.material,draw=()=>r.renderBufferDirect(camera,scene,actor.geometry,stock,actor,null);
 return {seat,stock,actor,r,draw,seen,camera,source,gl};
}
test('a genuine ready eligibility snapshot affects only one draw and restores even after a throw',async()=>{
 const {seat,stock,actor,r,draw,seen,camera}=await fixture();
 seat.dispatch(true);await wait(()=>seat.phase!=='waiting');
 assert.equal(seat.phase,'ready');
 const original=r.renderBufferDirect;
 seat.start(false);seat.render(true,draw);assert.equal(seen.pop(),stock);
 seat.start(true);seat.render(true,draw);assert.equal(seat.active,true);assert.notEqual(seen.pop(),stock);
 assert.equal(r.renderBufferDirect,original);assert.equal(actor.material,stock);
 assert.throws(()=>seat.render(true,()=>{draw();throw Error('renderer test');}),/renderer test/);
 assert.equal(r.renderBufferDirect,original);assert.equal(seen.pop().uniforms.h9StudyGain.value,0);
 camera.position.x=NaN;seat.render(true,draw);assert.equal(seat.active,false);assert.equal(seen.pop(),stock);
 seat.dispatch(false);assert.equal(seat.phase,'waiting');
});
test('starting early cannot admit a finished link later; changed borrowed wrapper refuses stock art',async()=>{
 let resolve,linkedStarted=false;const q=await fixture(async ()=>{linkedStarted=true;return new Promise(r=>resolve=r);});
 q.seat.dispatch(true);await wait(()=>linkedStarted);
 q.seat.start(true);resolve(()=>true);await new Promise(r=>setTimeout(r,15));
 q.seat.render(true,q.draw);assert.equal(q.seen.pop(),q.stock);
 const p=await fixture();
 p.seat.dispatch(true);await wait(()=>p.seat.phase==='ready');p.seat.start(true);
 p.stock.uniforms.princeSkyWords={...p.stock.uniforms.princeSkyWords};
 p.seat.render(true,p.draw);assert.equal(p.seen.pop(),p.stock);assert.equal(p.seat.active,false);
 assert.equal(p.seat.phase,'stock');
});

test('exact schema changes revoke the already-admitted source for the entire flight',async()=>{
 const q=await fixture();
 q.seat.dispatch(true);await wait(()=>q.seat.phase==='ready');q.seat.start(true);
 q.actor.geometry.attributes.normal.needsUpdate=true;
 q.seat.render(true,q.draw);assert.equal(q.seen.pop(),q.stock);assert.equal(q.seat.phase,'stock');
 q.actor.geometry.attributes.normal.version--;
 q.seat.render(true,q.draw);assert.equal(q.seen.pop(),q.stock);assert.equal(q.seat.active,false);
});

test('exact range tamper, unready surveyed peer, or unavailable samples fail closed',async()=>{
 const p=await fixture();
 const known=p.source();
 const dirty=known.wire.slice(0),w=new Uint8Array(dirty);w[4]^=0x01;
 p.seat.setReader(()=>({...known,wire:dirty}));
 p.seat.dispatch(true);await wait(()=>p.seat.phase==='stock');p.seat.start(true);
 p.seat.render(true,p.draw);assert.equal(p.seen.pop(),p.stock);
 const q=await fixture();
 q.seat.setReader(q.source,()=>false);
 q.seat.dispatch(true);assert.equal(q.seat.phase,'stock');q.seat.start(true);
 q.seat.render(true,q.draw);assert.equal(q.seen.pop(),q.stock);
 const r=await fixture();
 r.seat.dispatch(true);await wait(()=>r.seat.phase==='ready');r.seat.start(true);
 const baseline=r.gl.getParameter;r.gl.getParameter=k=>k===r.gl.SAMPLES?0:baseline(k);
 assert.equal(r.seat.canPrepare(),false);
 r.seat.render(true,r.draw);assert.equal(r.seen.pop(),r.stock);
});
