import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as T from 'three';
import {AircraftRunwayDepth,makeExteriorCaster} from '../src/render/runway-aircraft-depth.ts';

function rig(){
 const root=new T.Group(),hinge=new T.Group();
 root.position.set(-49_331.2,14.52,7542.2);root.add(hinge);
 const skin=new T.Mesh(new T.BoxGeometry(2,1,5),new T.MeshBasicMaterial());
 const wing=new T.Mesh(new T.BoxGeometry(5,.24,1.1),new T.MeshBasicMaterial());
 root.add(skin);hinge.add(wing);wing.position.y=1.2;
 return {root,hinge,skin,wing};
}

function renderer(){
 const domElement=new EventTarget(),viewport=new T.Vector4(0,0,830,554),scissor=viewport.clone();
 let target:T.WebGLRenderTarget|null=null,drawThrows=false,depthLost=false,samples=4,error=0,clear=true;
 let calls=0,checks=0,clips=0,clipping=false;
 const info={render:{calls:0,triangles:0}};
 const gl={SAMPLES:32937,NO_ERROR:0,isContextLost:()=>depthLost,getParameter(k:number){
  assert.equal(k,gl.SAMPLES);assert.equal(target,null);checks++;return samples;
 },getError:()=>error};
 const r={domElement,info,xr:{isPresenting:false},capabilities:{maxTextureSize:8192},
  localClippingEnabled:false,clippingPlanes:[],autoClear:true,
  getRenderTarget:()=>target,getContext:()=>gl,getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,
  getScissorTest:()=>clipping,getViewport:(a:T.Vector4)=>a.copy(viewport),getScissor:(a:T.Vector4)=>a.copy(scissor),
  setRenderTarget: (a:T.WebGLRenderTarget|null)=>{target=a;},
  setViewport: (a:T.Vector4)=>viewport.copy(a),setScissor:(a:T.Vector4)=>scissor.copy(a),
  setScissorTest:(b:boolean)=>{clipping=b;clips++;},
  clear(white:boolean,depth:boolean,stencil:boolean){assert(!white&&depth&&!stencil&&target);},
  render(scene:T.Scene){
   assert(target&&!r.autoClear&&scene.children.length===1);
   calls++;
   if(drawThrows)throw Error('auxiliary renderer failed');
   const g=(scene.children[0] as T.Mesh).geometry;
   info.render={calls:1,triangles:g.index!.count/3};
  }};
 return {r:r as unknown as T.WebGLRenderer,domElement,counts:()=>({calls,checks,clips}),
  lose(a:boolean){depthLost=a;}, samples(a:number){samples=a;},fail(a:boolean){drawThrows=a;},
  error(a:number){error=a;},setClear(a:boolean){clear=a;r.autoClear=clear;}};
}
const sun=new T.Vector3(-.60,.74,-.31).normalize();

test('aircraft cast keeps rigid source buffers intact and follows one admitted hinge',()=>{
 const a=rig(),source=a.wing.geometry.attributes.position.array.slice();
 const caster=makeExteriorCaster(a.root,[a.skin,a.wing]);assert(caster);
 const p=caster.geometry.getAttribute('position') as T.BufferAttribute;
 const v=p.version,first=p.array.slice();
 a.root.position.x+=390;a.root.rotation.y=-.75;
 assert(caster.advance());assert.equal(p.version,v);assert.deepEqual(p.array,first);
 a.hinge.rotation.x=.3;
 assert(caster.advance());assert.equal(p.version,v+1);assert.notDeepEqual(p.array,first);
 assert.deepEqual(a.wing.geometry.attributes.position.array,source);
 a.wing.geometry.attributes.position.needsUpdate=true;
 assert.equal(caster.advance(),false);
 assert.equal(makeExteriorCaster(a.root,[a.skin,a.skin]),undefined);
});

test('aircraft depth target follows real source state, static pause, and context epochs',()=>{
 const a=rig(),f=renderer();const c=new AircraftRunwayDepth(f.r,a.root,[a.skin,a.wing]);
 assert(c.render(sun,13.12,1));assert.equal(c.state.refreshes,1);assert.equal(f.counts().checks,1);
 assert(c.render(sun,13.12,.75));assert.equal(c.state.refreshes,1);assert.equal(c.state.gain,.75);
 assert.equal(f.counts().calls,1);
 f.lose(true);f.domElement.dispatchEvent(new Event('webglcontextlost'));
 assert(!c.state.active);assert(!c.render(sun,13.12,1));assert.equal(f.counts().calls,1);
 f.lose(false);f.samples(0);f.domElement.dispatchEvent(new Event('webglcontextrestored'));
 assert(!c.render(sun,13.12,1));assert(!c.render(sun,13.12,1));assert.equal(f.counts().checks,2);
 f.samples(4);f.domElement.dispatchEvent(new Event('webglcontextrestored'));
 assert(c.render(sun,13.12,1));assert.equal(c.state.refreshes,2);assert.equal(f.counts().checks,3);
 c.dispose();assert(!c.render(sun,13.12,1));assert(!c.state.active);
});

test('aircraft depth failure restores the default target and returns stock instead of stale depth',()=>{
 const a=rig(),f=renderer();const c=new AircraftRunwayDepth(f.r,a.root,[a.skin,a.wing]);
 f.r.setViewport(new T.Vector4(1,2,654,432));f.r.setScissor(new T.Vector4(9,8,123,332));f.r.setScissorTest(true);
 f.setClear(false);
 assert(c.render(sun,13.12,1));const initial=c.uniforms.aircraftCastDepth.value;
 a.root.position.x+=.5;f.fail(true);
 assert.equal(c.render(sun,13.12,.9),false);assert.equal(c.gain.value,0);
 assert.notEqual(c.uniforms.aircraftCastDepth.value,initial);
 assert.equal(f.r.getRenderTarget(),null);assert.equal(f.r.autoClear,false);
 assert.deepEqual(f.r.getViewport(new T.Vector4()).toArray(),[1,2,654,432]);
 assert.deepEqual(f.r.getScissor(new T.Vector4()).toArray(),[9,8,123,332]);
 assert.equal(f.r.getScissorTest(),true);
 f.fail(false);f.error(1282);assert(!c.render(sun,13.12,1));
 f.error(0);assert(c.render(sun,13.12,1));
 c.dispose();
});

test('runway shadow stock switch does not disable existing runway pavement or review optics',async()=>{
 const {aircraftRunwayCastRequested,summersideRunwayPavementRequested,runway03PavementRequested}=
  await import('../src/app/scenery-profile.ts');
 const clean=new URLSearchParams('scenery=standard&departure=cysu&diagnostics');
 assert(aircraftRunwayCastRequested(clean));
 for(const suffix of ['&stockAircraftRunwayCast','&qa=pose','&legacyShoreArcs','&scenery=standard','&runway03PavementReview']){
  assert.equal(aircraftRunwayCastRequested(new URLSearchParams(clean.toString()+suffix)),false,suffix);
 }
 const veto=new URLSearchParams(clean.toString()+'&stockAircraftRunwayCast');
 assert(summersideRunwayPavementRequested(veto));assert(runway03PavementRequested(veto));
 assert(aircraftRunwayCastRequested(new URLSearchParams(clean.toString()+'&stockSummersideRunwayPavement')));
});
