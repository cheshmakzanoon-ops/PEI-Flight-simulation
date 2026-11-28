import assert from 'node:assert/strict';
import {setTimeout as wait} from 'node:timers/promises';
import {test} from 'node:test';
import * as T from 'three';
import {basinCanneryFinishConsent,withoutBasinCanneryToken} from '../src/app/basin-cannery-option.ts';
import {eastPointWallOption} from '../src/render/east-wall-preview.ts';
import {basinHeadDispatchState,switchBasinHeadDispatchURL,sceneryOptions} from '../src/app/scenery-profile.ts';
import {BasinCanneryFinish,basinCannerySources,type BasinFinishFrame} from '../src/render/basin-cannery-finish.ts';
import {createBasinCannery} from '../src/render/basin-cannery.ts';
import {BASIN_CHANNEL} from '../src/sim/basin-head-channel.generated.ts';
import {BASIN_GROUND} from '../src/sim/basin-bank-relief.generated.ts';
import {RAD,project} from '../src/sim/geo.ts';

const A='?departure=basin-head-low&basinChannel',F='basinCanneryFinish=1',E='eastPointWallPreview=1';
test('actual direct query only; mixing East never enables either finish',()=>{
 for(const q of [A+'&'+F,A+'=&'+F+'&scenery=standard&diagnostics','?'+F+'&basinChannel&departure=basin-head-low'])
  assert.equal(basinCanneryFinishConsent(q),true,q);
 for(const q of [A,'?departure=basin-head-low&'+F,A+'&basinCanneryFinish=0',A+'&basinCannery%46inish=1',
  A+'&basinCanneryFinish=%31',A+'&'+F+'&'+F,A+'&'+E+'&'+F,A+'&scenery=detail&'+F,A+'&qa&'+F,
  A+'&basinWharf&'+F,A+'&noBasinCannery&'+F,A+'&noBasinBank&'+F,A+'&diagnostics&diagnostics&'+F,
  A+'&basinChannel&'+F,A+'=1&'+F,A+'&departure=basin-head-low&'+F,A+'&stockEastPointWalls&'+F,
  '?departure=east-light&'+E+'&'+F])assert.equal(basinCanneryFinishConsent(q),false,q);
 assert.equal(eastPointWallOption('?departure=east-light&'+E+'&'+F).requested,false);
 assert.equal(eastPointWallOption('?departure=east-light&'+E).requested,true);
 assert.equal(eastPointWallOption(A+'&'+E+'&'+F).requested,false);
});
test('old runtime/UI and legacy switch use stock URL regardless of own value',()=>{
 for(const q of ['',A,'?departure=basin-head-low','?departure=cavendish&diagnostics','?scenery=detail&basinChannel']){
  assert.equal(withoutBasinCanneryToken(q),q);
  const mixed=q+(q?'&':'?')+F+'&basinCannery%46inish=unsupported';
  assert.equal(withoutBasinCanneryToken(mixed),q);
  assert.deepEqual(basinHeadDispatchState(withoutBasinCanneryToken(mixed)),basinHeadDispatchState(q));
  assert.equal(sceneryOptions(withoutBasinCanneryToken(mixed)).toString(),sceneryOptions(q).toString());
 }
 const untrusted=A+'&x=%20a+%26&'+F+'&x=%2D&diagnostics';
 assert.equal(withoutBasinCanneryToken(untrusted),A+'&x=%20a+%26&x=%2D&diagnostics');
 const foreignQuestion=A+'&?basinCanneryFinish=foreign';
 const ambiguous=foreignQuestion+'&'+F;
 assert.equal(basinCanneryFinishConsent(ambiguous),false);
 assert.equal(withoutBasinCanneryToken(ambiguous),foreignQuestion);
 assert.equal(basinHeadDispatchState(withoutBasinCanneryToken(ambiguous)).compatible,
  basinHeadDispatchState(foreignQuestion).compatible);
 const old=switchBasinHeadDispatchURL('https://example.test/'+withoutBasinCanneryToken(A+'&'+F),false,'basin-head-low');
 assert.equal(new URL(old).search,'?departure=basin-head-low');
});

type R=T.WebGLRenderer;
type Raw=R['renderBufferDirect'];
const N={DEPTH_BITS:7,ALPHA_BITS:8,SAMPLES:9,VIEWPORT:10,DRAW_FRAMEBUFFER_BINDING:11,READ_FRAMEBUFFER_BINDING:12,
 SCISSOR_TEST:13,SAMPLE_COVERAGE:14,SAMPLE_ALPHA_TO_COVERAGE:15};
const fixture=({samples=4,authored=true,linkHold=false,patch=true}:{
 samples?:number;authored?:boolean;linkHold?:boolean;patch?:boolean}={})=>{
 const s=new T.Scene(),c=new T.PerspectiveCamera(53,1200/760,.08,350000);
 const a=createBasinCannery(),bridge=new T.Group(),bank=new T.Mesh();
 bank.name='seated Basin Head shore';
 const env=new T.Texture();
 env.mapping=T.EquirectangularReflectionMapping;s.environment=env;s.environmentIntensity=.77;
 s.environmentRotation.y=-.512*Math.PI*2;
 s.add(a,bridge,bank,new T.HemisphereLight(),new T.DirectionalLight());
 c.position.set(a.position.x+45,100,a.position.z+235);c.updateMatrixWorld(true);s.updateMatrixWorld(true);
 const source={
  terrain:{spec:{width:4096,height:2720,bounds:[-64.47,45.94,-61.93,47.1]}} as any,
  terrainSha:BASIN_GROUND.pinTerrainSha256,
  cover:{width:4096,height:2720,sourceSha:BASIN_CHANNEL.pinCoverSha256,sourceDecodedSha:BASIN_CHANNEL.pinCoverDecodedSha256,
   basin:{plan:BASIN_CHANNEL},wharfToe:false} as any,
  bank:{terrain:{spec:BASIN_GROUND}},actor:a,bridge,hasWharf:false
 };
 if(!authored)source.cover.sourceDecodedSha='bad';
 const {x,z}=project(-62.10574,46.37296);
 let current:BasinFinishFrame={route:'basin-head-low',selected:true,mode:'dispatch',view:0,flight:{},x,z,y:96,heading:338*RAD,time:0,status:'flying'};
 const gl={...N,isContextLost:()=>false,getContextAttributes:()=>({antialias:true,alpha:true,depth:true}),
  drawingBufferWidth:1200,drawingBufferHeight:760,getParameter:(what:number)=>({
   [N.DEPTH_BITS]:24,[N.ALPHA_BITS]:8,[N.SAMPLES]:samples,[N.VIEWPORT]:[0,0,1200,760],
   [N.DRAW_FRAMEBUFFER_BINDING]:null,[N.READ_FRAMEBUFFER_BINDING]:null})[what],isEnabled:()=>false};
 const seen:Array<Parameters<Raw>>=[];
 const raw:Raw=(...q)=>{seen.push(q);};
 const r={renderBufferDirect:raw,getContext:()=>gl,getRenderTarget:()=>null,capabilities:{isWebGL2:true,logarithmicDepthBuffer:true},
  getPixelRatio:()=>1,getSize:(p:T.Vector2)=>p.set(1200,760),getViewport:(p:T.Vector4)=>p.set(0,0,1200,760),
  getCurrentViewport:(p:T.Vector4)=>p.set(0,0,1200,760),
  getDrawingBufferSize:(p:T.Vector2)=>p.set(1200,760),getScissorTest:()=>false,xr:{},info:{autoReset:true},
  shadowMap:{},clippingPlanes:[],sortObjects:true,autoClear:true,autoClearDepth:true,autoClearColor:true,autoClearStencil:true,
  outputColorSpace:T.SRGBColorSpace,toneMapping:T.ACESFilmicToneMapping,toneMappingExposure:1} as unknown as R;
 let resolve:(()=>void)|undefined,qsignal:AbortSignal|undefined,links=0,disposed=0,didDigest=0;
 const uniform:{value:number}[]=[];
 const o=new BasinCanneryFinish(r,s,c,source,async(group,signal)=>{
  qsignal=signal;links++;
  assert.equal(group.parent,null);assert.equal(group.children.length,3);
  for(const child of group.children as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>[]){
   assert.ok(a.children.some((m)=>m instanceof T.Mesh&&m.geometry===child.geometry&&m.material!==child.material));
   child.material.addEventListener('dispose',()=>{disposed++;});
   if(patch){
    const sh={vertexShader:'#include <common>\n#include <uv_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>\n#include <normal_fragment_maps>',
     uniforms:{} as Record<string,{value:number}>};
    child.material.onBeforeCompile(sh as any,r);
    assert.ok(sh.uniforms.canneryWoodGain);uniform.push(sh.uniforms.canneryWoodGain);
   }
  }
  if(linkHold)await new Promise<void>(y=>resolve=y);
  return ()=>!signal.aborted;
 },()=>current);
 // Emulate only the independently tested linked-program attestation; all
 // original geometry/attributes/digests and scope/lifecycle stay real.
 (o as any).programBytes=async()=>{didDigest++;return true;};
 const meshAt=(role:string)=>a.getObjectByName('Cannery '+role) as T.Mesh;
 return {scene:s,camera:c,actor:a,source,bank,r,gl,raw,seen,o,meshAt,uniform,
  get now(){return current;},setNow:(x:Partial<BasinFinishFrame>)=>current={...current,...x},
  get links(){return links;},get verifiedLinks(){return didDigest;},get disposed(){return disposed;},get signal(){return qsignal;},
  complete:()=>resolve?.(),setResult:(v:boolean)=>(o as any).programBytes=async()=>v,
  drawOne:(role:string,group:T.Group|null=null)=>{const m=meshAt(role);r.renderBufferDirect(c,s,m.geometry,m.material as T.Material,m,group as any);},
  draw:()=>{for(const m of a.children as T.Mesh[])r.renderBufferDirect(c,s,m.geometry,m.material as T.Material,m,null);}};
};
async function allow(f:ReturnType<typeof fixture>,nav:'ready'|'held'='ready'){
 f.o.render(f.now,f.draw);
 for(let n=0;n<150&&f.o.state.phase==='waiting';n++)await wait(4);
 assert.equal(f.o.state.phase,nav,f.o.state.reason);
}
test('exact signed terrain, physical inset, bank, narrow source; corrupted fallback',()=>{
 const f=fixture(); assert.ok(basinCannerySources(f.source));
 for(const invalid of [{bank:undefined},{bridge:undefined},{actor:undefined},{hasWharf:true},
  {terrainSha:'no'},{cover:{...f.source.cover,basin:{plan:{...BASIN_CHANNEL}}}},{bank:{terrain:{spec:{...BASIN_GROUND}}}}])
  assert.equal(basinCannerySources({...f.source,...invalid}),false);
});
test('ready does not alter Dispatch, only an actual Begin may draw three substitutions at old sort point',async()=>{
 const f=fixture(),old=f.actor.children.map(o=>(o as T.Mesh).material);
 await allow(f);assert.equal(f.verifiedLinks,1);assert.equal(f.o.state.submitted,0);
 assert.ok(f.seen.every((row,i)=>row[3]===old[i]));
 f.o.begin(f.now,true);f.setNow({mode:'flight'});f.seen.length=0;
 f.o.render(f.now,f.draw);
 assert.deepEqual(f.seen.map((x,i)=>x[3]!==old[i]),[true,false,false,false,false,true,false,true]);
 assert.equal(f.o.state.submitted,3);assert.equal(f.r.renderBufferDirect,f.raw);
 assert.ok(f.uniform.every(x=>x.value===0));assert.deepEqual(f.actor.children.map(o=>(o as T.Mesh).material),old);
 f.setNow({view:1});f.seen.length=0;f.o.render(f.now,f.draw);
 assert.deepEqual(f.seen.map(row=>row[3]),old);assert.equal(f.o.state.submitted,0);
 f.o.dispose();assert.equal(f.disposed,3);
});
test('a fresh signed Cockpit departure can preflight, but only Chase may render the finish',async()=>{
 const f=fixture();f.setNow({view:1});await allow(f);
 f.o.begin(f.now,true);f.setNow({mode:'flight'});
 f.o.render(f.now,f.draw);
 assert.equal(f.o.state.submitted,0);assert.equal(f.o.state.phase,'active');
 f.setNow({view:0});f.o.render(f.now,f.draw);
 assert.equal(f.o.state.submitted,3);
});
test('trusted early click is sticky; late link cannot claim flight; fresh Dispatch can',async()=>{
 const f=fixture({linkHold:true});f.o.render(f.now,f.draw);
 for(let i=0;i<100&&!f.signal;i++)await wait(5);
 assert.ok(f.signal);
 f.o.begin(f.now,true);f.setNow({mode:'flight'});f.complete();
 await wait(30);assert.equal(f.o.state.phase,'held');assert.ok(f.signal.aborted);assert.equal(f.disposed,3);
 f.o.render(f.now,f.draw);assert.equal(f.o.state.submitted,0);
 f.o.reset();f.setNow({mode:'dispatch',flight:{}});f.o.render(f.now,f.draw);
 for(let i=0;i<100&&f.links!==2;i++)await wait(5);
 assert.equal(f.links,2);f.complete();await wait(30);assert.equal(f.o.state.phase,'ready');
 f.o.begin(f.now,false);f.setNow({mode:'flight'});f.o.render(f.now,f.draw);
 assert.equal(f.o.state.phase,'held');assert.equal(f.o.state.submitted,0);
 assert.equal(f.disposed,6);
});
test('synthetic start, unknown program, wrong URL owner or 0 AA stay original',async()=>{
 const f=fixture({samples:0});f.o.render(f.now,f.draw);assert.equal(f.links,0);f.o.begin(f.now,true);assert.equal(f.o.state.phase,'held');
 const bad=fixture();bad.setResult(false);await allow(bad,'held');assert.equal(bad.disposed,3);
 const blocked=fixture({authored:false});blocked.o.render(blocked.now,blocked.draw);assert.equal(blocked.links,0);
 const wrong=fixture();wrong.setNow({route:'east-light'});wrong.o.render(wrong.now,wrong.draw);assert.equal(wrong.links,0);
});
test('requires the ordinary World panorama yaw, not the default unrotated studio scene',async()=>{
 const f=fixture();
 f.scene.environmentRotation.y=0;
 f.o.render(f.now,f.draw);assert.equal(f.links,0);
 f.scene.environmentRotation.y=-.512*Math.PI*2;
 await allow(f);
 f.scene.environmentRotation.y+=.01;
 f.o.begin(f.now,true);assert.equal(f.o.state.phase,'held');
});
test('unexpected own tuple after one finish restores full frame and all hooks',async()=>{
 const f=fixture();await allow(f);f.o.begin(f.now,true);f.setNow({mode:'flight'});f.seen.length=0;
 let draws=0;
 f.o.render(f.now,()=>{if(++draws===1){f.drawOne('cladding');f.drawOne('door',new T.Group());}else f.draw();});
 assert.equal(draws,2);assert.equal(f.o.state.phase,'held');assert.equal(f.o.state.submitted,0);
 assert.equal(f.seen.length,10);assert.notEqual(f.seen[0][3],f.meshAt('cladding').material);
 assert.ok(f.seen.slice(2).every(q=>q[3]===(q[4] as T.Mesh).material));
 assert.equal(f.r.renderBufferDirect,f.raw);assert.ok(f.uniform.every(x=>x.value===0));
});
test('wireframe cannot retain a front-finish lease even without a version change',async()=>{
 const f=fixture();await allow(f);
 const m=f.meshAt('door').material as T.MeshStandardMaterial,old=m.version;
 m.wireframe=true;
 assert.equal(m.version,old);
 f.o.begin(f.now,true);assert.equal(f.o.state.phase,'held');
 assert.equal(f.o.state.submitted,0);
});
test('source mutation or exceptions cannot strand gain or renderer callback',async()=>{
 const f=fixture();await allow(f);f.o.begin(f.now,true);f.setNow({mode:'flight'});
 assert.throws(()=>f.o.render(f.now,()=>{f.drawOne('cladding');throw Error('real renderer failure');}),/real renderer failure/);
 assert.equal(f.r.renderBufferDirect,f.raw);assert.ok(f.uniform.every(x=>x.value===0));
 const own=f.meshAt('cladding').geometry.attributes.position as T.BufferAttribute;own.needsUpdate=true;
 f.o.render(f.now,f.draw);assert.equal(f.o.state.phase,'held');assert.equal(f.o.state.submitted,0);assert.equal(f.disposed,3);
});
