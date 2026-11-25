import test from 'node:test';
import assert from 'node:assert/strict';
import {ArrayCamera, Box3, Frustum, Matrix4, OrthographicCamera, PerspectiveCamera, Scene, ShaderMaterial} from 'three';
import {WoodlandVolume} from '../src/render/woodland-volume.ts';
import {woodlandEye} from '../src/render/woodland-volume-cull.ts';
import {sceneryOptions,standardRegionalWind,standardTracadieOrtho,standardInlandOrtho,standardPrinceSurveyRoof,coastalMarshRequested,standardSourisShoreline} from '../src/app/scenery-profile.ts';
const N=121,keys=['treeStem','treeShape','treeSpin','crownLift'];
const fc=new Frustum(),mx=new Matrix4();
function fixture(stock=false){
 const sc=new Scene(),p:number[]=[],s:number[]=[];
 // All four templates behind, beside and ahead of this fixed eye; include the outer prefetch ring.
 for(let j=-4;j<=4;j++)for(let i=-4;i<=4;i++){const x=12*i+((3*i+4*j)&3),z=12*j+((i+6*j)&3);
  p.push(x,0,z);s.push(11+(j&3),10+((i+j)&3),((i*3+j+5)&3),.85);}
 const pos=Float32Array.from(p),shapes=Float32Array.from(s),v=new WoodlandVolume(sc,N,()=>.37,undefined,!stock);
 v.update(pos,shapes,pos.length/3,0,0,15,1);
 return {v,sc,pos,shapes,groups:(v as any).groups as any[]};
}
function eye(yaw=0){
 const c=new PerspectiveCamera(53,920/580,.08,350000);c.position.set(0,9,0);c.lookAt(Math.sin(yaw)*25,7,Math.cos(yaw)*25);c.updateMatrixWorld();
 return c;
}
function digest(a:Float32Array){return Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString('base64');}
function fullRows(groups:any[]){return groups.map(g=>keys.map(k=>g.streams[k]?digest(g.streams[k].array):null));}
function rowChecks(groups:any[]){
 for(const g of groups){let last=-1;const n=g.geometry.instanceCount,full=g.sourceCount;
  for(let i=0;i<n;i++){const s=n===full?i:g.rows.slots[i];assert.ok(last<s&&s<full);last=s;
   for(const k of keys){const src=g.streams[k];if(!src)continue;const draw=g.geometry.getAttribute(k);
    const w=src.itemSize;assert.deepEqual(draw.array.slice(i*w,(i+1)*w),src.array.slice(s*w,(s+1)*w));}
  }}
}
test('same-tick view-only compaction preserves all original columns, stable source order, mask, lift decisions and exact rollback',()=>{
 const {v,groups}=fixture(),mask=digest(v.mask.array as Float32Array),rows=fullRows(groups),baseline=v.count,rev=v.rosterVersion;
 const out:number[][][]=[];
 for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5,0]){
  v.updateView(eye(a));rowChecks(groups);assert.deepEqual(fullRows(groups),rows);
  const {active,submitted,admitted}=v.viewState;assert.ok(active&&submitted>0&&submitted<admitted);assert.equal(admitted,baseline);
  assert.equal(digest(v.mask.array as Float32Array),mask);assert.equal(v.rosterVersion,rev);
  out.push(groups.map(g=>Array.from(g.rows.slots.slice(0,g.geometry.instanceCount))));
 }
 assert.notDeepEqual(out[0],out[2]);assert.deepEqual(out[0],out[4]);
 v.setViewCull(false);assert.equal(v.viewState.submitted,baseline);assert.equal(v.viewState.active,false);
 for(const g of groups)for(const k of keys)if(g.streams[k])assert.equal(g.geometry.getAttribute(k),g.streams[k]);
});
test('unsupported projections, capability/fade/material drift fail open, repeated view or activation never thins the source ring',()=>{
 const {v,groups,pos,shapes}=fixture();const c=eye(),bad=eye();bad.projectionMatrix.elements[0]=NaN;
 for(const a of [undefined,new ArrayCamera([c]),new OrthographicCamera(),bad]){
  v.updateView(c);v.updateView(a);assert.equal(v.viewState.active,false);assert.equal(v.viewState.admitted,v.viewState.submitted);
 }
 v.fade.value.x=92;v.updateView(c);assert.equal(v.viewState.active,false);v.fade.value.x=38;
 const old=groups[0].mesh.material;groups[0].mesh.material=new ShaderMaterial();v.updateView(c);
 assert.equal(v.viewState.active,false);groups[0].mesh.material=old;
 v.updateView(c);const live=groups.map(g=>g.geometry.getAttribute('treeStem').version);v.updateView(c);assert.deepEqual(groups.map(g=>g.geometry.getAttribute('treeStem').version),live);
 v.update(pos,shapes,pos.length/3,0,0,152,1);v.updateView(c);assert.equal(v.count,0);assert.equal(v.viewState.submitted,0);
 v.update(pos,shapes,pos.length/3,0,0,18,1);v.updateView(c);assert.ok(v.viewState.active&&v.viewState.submitted>0);rowChecks(groups);
});
test('final render callback respects settled same-tick camera, unsupported second camera, and existing scene handler',()=>{
 const sc=new Scene(),c=eye(),calls:any[]=[];sc.onBeforeRender=(...a)=>{calls.push(a[2]);};
 const v=new WoodlandVolume(sc,3);v.update(new Float32Array([0,0,27,0,0,-27,0,0,55]),new Float32Array([8,7,0,1,8,7,0,1,8,7,0,1]),3,0,0,14,1);
 const invoke=(c:any,target:any=null,xr=false)=>(sc as any).onBeforeRender({xr:{isPresenting:xr}},sc,c,target);
 invoke(c);assert.equal(v.viewState.submitted,1);
 const g=(v as any).groups[0];assert.equal(g.geometry.getAttribute('treeStem').getZ(0),27);
 c.lookAt(0,8,-24);c.updateMatrixWorld();invoke(c);assert.equal(g.geometry.getAttribute('treeStem').getZ(0),-27);
 invoke(c,{});assert.equal(v.viewState.submitted,3);invoke(c,null,true);assert.equal(v.viewState.active,false);
 assert.equal(calls.length,4);
});
test('strictly clipped bounds cannot reject visible original template vertices; damaged instance remains drawn',()=>{
 const {v,groups}=fixture();const c=eye();assert.ok(woodlandEye(c,mx,fc));
 v.updateView(c);
 for(const g of groups){
  const kept=new Set(Array.from(g.rows.slots.slice(0,g.geometry.instanceCount)));
  const p=g.geometry.getAttribute('position'),s=g.streams;
  for(let k=0;k<g.sourceCount;k++){const x=s.treeStem.getX(k),y=s.treeStem.getY(k),z=s.treeStem.getZ(k);
   if(kept.has(k)||Math.hypot(x,z)>50.1)continue;
   const H=s.treeShape.getX(k),W=s.treeShape.getY(k),co=s.treeSpin.getX(k),si=s.treeSpin.getY(k);
   let intersects=0;
   for(let i=0;i<p.count;i++){const px=p.getX(i),py=p.getY(i),pz=p.getZ(i);
    const A=x+W*(px*co-pz*si),C=z+W*(px*si+pz*co),B=y+py*H;
    const dynamic=new Box3();dynamic.min.set(A,B,C);dynamic.max.set(A,B+(s.crownLift?.getX(k)??0),C);if(fc.intersectsBox(dynamic))intersects++;
   }
   assert.equal(intersects,0);
  }
 }
 const sc=new Scene(),damaged=new WoodlandVolume(sc,1);damaged.update(new Float32Array([0,0,-36]),new Float32Array([12,-4,0,1]),1,0,0,1,1);
 damaged.updateView(c);assert.equal(damaged.viewState.submitted,1);
});
test('new comparison does not enable woodland or disable unrelated Standard owners, preserves every historic explicit alias',()=>{
 for(const move of ['','?scenery=standard&departure=a','?woodland3D','?woodlandView','?woodlandBark','?scenery=detail','?stockRegionalWind']){
  const before=sceneryOptions(move),after=sceneryOptions(move+(move?'&':'?')+'stockWoodlandVolumeCull');
  for(const fn of [standardRegionalWind,standardTracadieOrtho,standardInlandOrtho,standardPrinceSurveyRoof,coastalMarshRequested,standardSourisShoreline])assert.equal(fn(after),fn(before));
  after.delete('stockWoodlandVolumeCull');assert.deepEqual([...after],[...before]);
 }
 const {v}=fixture(true);v.setViewCull(true);v.updateView(eye());assert.equal(v.viewState.enabled,false);assert.equal(v.viewState.submitted,v.count);
});

test('foreign scene override or changed donor program/alpha contract fails open on the same draw and recovers the exact circular bank',()=>{
 const {v,sc,groups}=fixture();const c=eye();const m=groups[0].donor,frag=m.fragmentShader,hook=m.onBeforeCompile,fade=m.uniforms.volumeFade;
 const full=()=>{v.updateView(c);assert.equal(v.viewState.active,false);assert.equal(v.viewState.admitted,v.viewState.submitted);};
 const comp=()=>{v.updateView(c);assert.ok(v.viewState.active&&v.viewState.submitted<v.viewState.admitted);};
 comp();sc.overrideMaterial=new ShaderMaterial();full();sc.overrideMaterial=null;comp();
 m.fragmentShader+=' ';full();m.fragmentShader=frag;comp();
 m.onBeforeCompile=()=>{};full();m.onBeforeCompile=hook;comp();
 m.alphaToCoverage=false;full();m.alphaToCoverage=true;comp();
 m.uniforms.volumeFade={value:fade.value.clone()};full();m.uniforms.volumeFade=fade;comp();
 m.defines={...m.defines,EXTERNAL_SHADOW_PASS:1};full();delete m.defines.EXTERNAL_SHADOW_PASS;comp();
 const attr=groups[0].geometry.getAttribute('position'),alt=attr.clone();groups[0].geometry.setAttribute('position',alt);full();groups[0].geometry.setAttribute('position',attr);comp();
});
