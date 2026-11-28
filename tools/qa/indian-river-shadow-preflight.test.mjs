import {test} from 'node:test';
import A from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {pars as stockCanopyPars} from '../../src/render/stock-crown-program.ts';
import {prepareStMarysShadowPreflight} from '../../src/render/indian-river/st-marys-shadow-preflight.ts';
import {ST_MARYS_SLOT_ATTRIBUTE as KEY,ST_MARYS_STEM_XZ,StMarysShadows,buildStMarysReceivers,
 stockShadowFootprint} from '../../src/render/indian-river/st-marys-shadows.ts';
const raw=readFileSync(new URL('../../src/render/vegetation.ts',import.meta.url),'utf8');
const literal=k=>raw.match(new RegExp('const '+k+'=(?:pars\\+)?(`[^`]*`);','m'))[1].slice(1,-1);
const v=stockCanopyPars+literal('shadowV'),f=literal('shadowF');
A.equal(createHash('sha256').update(v).digest('hex'),'1f0a1ec8670b21e67d24f6847bfa427b25ea0f0dbdeefb17a0f79afafad8f481');
A.equal(createHash('sha256').update(f).digest('hex'),'db2362b1e5d3b32f487bd66f0dc30ad0755845b6d3188f35af80d3e43a93b293');
const sha=a=>createHash('sha256').update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const stamp=a=>Object.fromEntries(Object.entries(a.attributes).map(([k,v])=>[k,sha(v.array)]));
const gradeId='st-marys-2020-grade-study',capacity=45000;
function setup(){
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(53,1.5,.08,350000),plane=new T.PlaneGeometry(1,1),g=new T.InstancedBufferGeometry();
 g.setIndex(plane.index).setAttribute('position',plane.getAttribute('position')).setAttribute('uv',plane.getAttribute('uv'));
 const stems=new Float32Array(capacity*3),shapes=new Float32Array(capacity*4),hedges=new Float32Array(capacity*4);
 const slots=[3,0,4,1];
 for(let i=0;i<4;i++){
  const [x,z]=ST_MARYS_STEM_XZ[i],j=slots[i];
  stems.set([x,22.3,z],j*3);shapes.set([9+i,8+i,i,.97],j*4);
 }
 stems.set([-35870,22.3,2570],2*3);shapes.set([10,12,0,.98],2*4);
 stems.set([-35870,24,2575],5*3);shapes.set([4,5,1,.95],5*4);
 hedges.set([24,24.2,24.3,24],5*4);
 for(const [id,storage,d] of [['stem',stems,3],['shape',shapes,4],['hedgeGround',hedges,4]])
  g.setAttribute(id,new T.InstancedBufferAttribute(storage,d).setUsage(T.DynamicDrawUsage));
 g.instanceCount=6;
 const tex=new T.DataTexture(new Uint8Array(8*4*4),8,4);
 tex.needsUpdate=true; const c={value:tex},sun={value:new T.Vector3(-.6,.74,-.31)};
 const mat=new T.ShaderMaterial({vertexShader:v,fragmentShader:f,uniforms:{canopy:c,canopySun:sun},side:T.DoubleSide,depthWrite:false,
  transparent:true,blending:T.NormalBlending,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2});
 const shade=new T.Mesh(g,mat);shade.frustumCulled=false;shade.name='Canopy ground shadows';scene.add(shade);
 const crown=new T.Mesh(g,new T.MeshBasicMaterial());crown.name='current co-owner';scene.add(crown);
 const tg=new T.BufferGeometry();
 tg.setAttribute('position',new T.Float32BufferAttribute([-62,23,-62,62,22.5,-62,-62,23.75,62,62,23.25,62],3));
 tg.setIndex([0,2,1,2,3,1]);const ground=new T.Mesh(tg);ground.position.set(-36060,0,2560);
 ground.userData={subdiv:112,localGrade:gradeId};
 const source={mesh:ground,gradeId,bounds:[-36115,2500,-36002,2619],inChangedSupport:()=>true};
 const guard={permit:true,passes:true,live:true,theme:true,n:0,linkFail:false,trigger:undefined,last:undefined,disposed:[],
  revision:7,programs:new Map()};
 const gl={SAMPLES:0xa,LINK_STATUS:0xb,getContextAttributes:()=>({alpha:guard.theme,depth:true,antialias:true}),
  getParameter:p=>p===0xa?4:undefined,isContextLost:()=>!guard.live,isProgram:p=>p?.valid===true,
  getProgramParameter:(p,key)=>key===0xb&&p.link===true};
 const renderer={getContext:()=>gl,getRenderTarget:()=>null,capabilities:{isWebGL2:true,logarithmicDepthBuffer:true,reversedDepthBuffer:false},
  outputColorSpace:T.SRGBColorSpace,toneMapping:T.NoToneMapping,localClippingEnabled:false,clippingPlanes:[],xr:{isPresenting:false},shadowMap:{enabled:false},
  properties:{get:k=>guard.programs.get(k)},
  compile:(group,cameraArg,sceneArg)=>{
   guard.n++;A.equal(cameraArg,camera);A.equal(sceneArg,scene);
   A(!group.visible);A.equal(group.parent,null);A.equal(group.children.length,2);
   A.deepEqual(scene.children,[shade,crown]);A.equal(shade.geometry,g);A.equal(shade.material,mat);
   A.equal(crown.geometry,g);A.equal(g.getAttribute(KEY),undefined);
   const [sub,receive]=group.children;guard.last={sub,receive,group};
   for(const o of [sub,receive]){
    A(o.material.transparent&&o.material.forceSinglePass&&o.material.side===T.DoubleSide);
    o.geometry.addEventListener('dispose',()=>guard.disposed.push([o.name,Object.keys(o.geometry.attributes),o.geometry.index]));
    o.material.addEventListener('dispose',()=>guard.disposed.push([o.name,'material']));
    guard.programs.set(o.material,{currentProgram:{program:{valid:true,link:!guard.linkFail||o===sub},isReady:()=>true}});
   }
   guard.trigger?.(group);return new Set(group.children.map(o=>o.material));
  }};
 const controller=new AbortController();
 const args={renderer,camera,scene,source,permit:()=>guard.permit,signal:controller.signal,
  roster:()=>({stock:shade,stems,shapes,revision:guard.revision,total:g.instanceCount,original:5})};
 return {args,guard,controller,scene,shade,crown,g,mat,tex,plane,ground,stems,shapes,hedges,source,slots};
}
const stockNow=x=>{A.deepEqual(x.scene.children,[x.shade,x.crown]);A.equal(x.shade.geometry,x.g);A.equal(x.crown.geometry,x.g);
 A.equal(x.shade.material,x.mat);A.equal(x.g.index,x.plane.index);A.equal(x.g.getAttribute(KEY),undefined);};
test('exact detached single-pass shadow pair; raw input ownership, four old metre footprints, borrowed cleanup',async()=>{
 const x=setup(),old=stamp(x.g),vv=x.tex.source.version, tv=x.tex.version;
 let stockDispose=0,materialDispose=0,textureDispose=0;
 x.g.addEventListener('dispose',()=>stockDispose++);x.mat.addEventListener('dispose',()=>materialDispose++);x.tex.addEventListener('dispose',()=>textureDispose++);
 const prior=buildStMarysReceivers(x.source,gradeId,x.stems,x.shapes,5,6);A(prior);
 const staged=await prepareStMarysShadowPreflight(x.args);A(staged?.intact());A.equal(x.guard.n,1);stockNow(x);
 const out=staged.take();A(out?.unmountedStill());A(out.programsStill());
 A.equal(staged.take(),undefined);A.equal(out.suppression,x.guard.last.sub);A.equal(out.receiver,x.guard.last.receive);
 A.equal(out.suppression.parent,null);A.equal(out.receiver.parent,null);
 A.equal(out.stockGeometry,x.g);A.equal(out.stockMaterial,x.mat);A.equal(out.mask.itemSize,1);
 A.deepEqual(out.slots,x.slots);
 A.deepEqual(Array.from(out.mask.array.entries()).filter(([,v])=>!!v).map(([i,v])=>[i,v]),[[0,1],[1,1],[3,1],[4,1]]);
 A.deepEqual(stamp(prior.geometry),stamp(out.receiver.geometry));A.equal(out.triangleCount,prior.triangleCount);
 const attributes=out.receiver.geometry.attributes;
 for(let n=0;n<attributes.position.count;n++){
  const vi=attributes.stMarysShadowVariant.getX(n),q=out.slots[vi];
  const [ox,,oz]=out.receiver.position.toArray();
  const a=stockShadowFootprint({x:x.stems[q*3],z:x.stems[q*3+2],h:x.shapes[q*4],w:x.shapes[q*4+1]});
  const X=ox+attributes.position.getX(n),Z=oz+attributes.position.getZ(n);
  A(X>=a.x0-1e-6&&X<=a.x1+1e-6&&Z>=a.z0-1e-6&&Z<=a.z1+1e-6);
  A(attributes.uv.getX(n)>=0&&attributes.uv.getX(n)<=1&&attributes.uv.getY(n)>=0&&attributes.uv.getY(n)<=1);
 }
 for(const [k,a] of Object.entries(x.g.attributes))A.equal(out.suppression.geometry.getAttribute(k),a);
 A.equal(out.suppression.geometry.index,x.g.index);
 A.equal(out.suppression.material.uniforms,x.mat.uniforms);A.equal(out.receiver.material.uniforms,x.mat.uniforms);
 A.equal(out.receiver.material.fragmentShader,f);A(out.suppression.material.fragmentShader.includes('if(stMarysShadowReplaced>.5)discard;'));
 A.equal(x.tex.source.version,vv);A.equal(x.tex.version,tv);A.deepEqual(stamp(x.g),old);
 // Transfer leaves the staged wrapper disposal caller-owned, not double-retired.
 staged.dispose();A.equal(x.guard.disposed.length,0);
 const shader=out.receiver.material.fragmentShader;
 out.receiver.material.fragmentShader+='\n// later invalid owner';
 A.equal(out.programsStill(),false);out.receiver.material.fragmentShader=shader;
 A(out.programsStill());
 out.dispose();out.dispose();A.equal(out.programsStill(),false);stockNow(x);
 A.equal(stockDispose,0);A.equal(materialDispose,0);A.equal(textureDispose,0);
 A.equal(x.tex.source.version,vv);A.equal(x.tex.version,tv);A.deepEqual(stamp(x.g),old);
 A.deepEqual(x.guard.disposed[0].slice(1),[[KEY],null]);A.equal(x.guard.disposed.length,4);
 prior.geometry.dispose();
});
test('shader strings, inherited render flags and packed receiver bit-for-bit match the existing legacy recipe',async()=>{
 const x=setup(),testStock=setup();
 const p=await prepareStMarysShadowPreflight(x.args);A(p);
 const actual=p.take();
 const old=StMarysShadows.mount(testStock.scene,testStock.shade,gradeId,capacity);A(old);
 A(old.update(testStock.source,testStock.stems,testStock.shapes,5,7));
 const traits=['vertexShader','fragmentShader','depthTest','depthWrite','depthFunc','colorWrite','transparent','blending',
  'polygonOffset','polygonOffsetFactor','polygonOffsetUnits','side','forceSinglePass','premultipliedAlpha','fog','glslVersion','lights','clipping','alphaTest'];
 for(const k of traits){
  A.equal(actual.suppression.material[k],testStock.shade.material[k],k);
  A.equal(actual.receiver.material[k],old.mesh.material[k],k);
 }
 A.deepEqual(stamp(actual.receiver.geometry),stamp(old.mesh.geometry));
 A.equal(actual.mask.array.every((w,i)=>w===testStock.g.getAttribute(KEY).array[i]),true);
 old.dispose();stockNow(testStock);actual.dispose();stockNow(x);
});
test('held before compile for wrong shader/coverage, corrupted stock rest quad, nonzero hedge on a canonical slot or bad scope',async()=>{
 const cases=[
  x=>x.mat.fragmentShader+='\n// unpinned',
  x=>{x.mat.forceSinglePass=false;},x=>{x.shade.geometry.index.array[0]=1;},
  x=>{x.hedges[x.slots[0]*4]=.125;},x=>{x.guard.permit=false;},
  x=>{x.guard.theme=false;},x=>{x.mat.uniforms.overlay={value:0};},
  x=>{x.crown.geometry.setAttribute('foreignRole',new T.InstancedBufferAttribute(new Float32Array(6),1));},
 ];
 for(let i=0;i<cases.length;i++){
  const x=setup();cases[i](x);
  A.equal(await prepareStMarysShadowPreflight(x.args),undefined,i);
  A.equal(x.guard.n,0);
  stockNow(x);
 }
});
test('hold if duplicate or a new unknown nearby caster overlaps physically changed receiver depth',async()=>{
 const dup=setup();
 dup.stems.set([ST_MARYS_STEM_XZ[0][0],22.3,ST_MARYS_STEM_XZ[0][1]],2*3);
 A.equal(await prepareStMarysShadowPreflight(dup.args),undefined);
 const changed=setup();
 changed.stems.set([-36050,19.3,2568],2*3);
 A.equal(await prepareStMarysShadowPreflight(changed.args),undefined);
 A.equal(changed.guard.n,0);stockNow(changed);
});
test('failed driver link and cancellation clean owned wrapper, keep real scene and original source exact',async()=>{
 for(const method of ['link','aborted','roster','throw']){
  const x=setup(),b=stamp(x.g);
  if(method==='link')x.guard.linkFail=true;
  if(method==='aborted')x.guard.trigger=()=>x.controller.abort();
  if(method==='roster')x.guard.trigger=()=>x.guard.revision++;
  if(method==='throw')x.guard.trigger=()=>{throw Error('synthetic compile fault');};
  A.equal(await prepareStMarysShadowPreflight(x.args),undefined);
  A.equal(x.guard.n,1);A.equal(x.guard.disposed.length,4);A.deepEqual(x.guard.disposed[0].slice(1),[[KEY],null]);
  stockNow(x);A.deepEqual(stamp(x.g),b);
 }
});
test('compiled result refuses stale material, keys, canopy version or corrupt handoff mask',async()=>{
 for(const method of ['material','key','texture','slot','mask']){
  const x=setup(),s=await prepareStMarysShadowPreflight(x.args);A(s?.intact());
  if(method==='material')x.mat.depthWrite=true;
  if(method==='key')x.guard.programs.delete(x.guard.last.receive.material);
  if(method==='texture')x.tex.needsUpdate=true;
  if(method==='slot')x.shapes[x.slots[3]*4]=17;
  if(method==='mask')x.guard.last.sub.geometry.getAttribute(KEY).array[2]=1;
  A.equal(s.take(),undefined,method);s.dispose();stockNow(x);
 }
});
function swapTreeSlots(x,a,b){
 for(const [key,width] of [['stem',3],['shape',4],['hedgeGround',4]]){
  const attr=x.g.getAttribute(key),v=attr.array,tmp=v.slice(a*width,(a+1)*width);
  v.copyWithin(a*width,b*width,(b+1)*width);v.set(tmp,b*width);attr.needsUpdate=true;
 }
 x.guard.revision++;
}
test('active 135m roster turn rebuilds exactly, preserves linked programs and pending ranges until the same frame draw',async()=>{
 const x=setup(),ready=await prepareStMarysShadowPreflight(x.args),p=ready.take();A(p?.unmountedStill());
 const firstMask=p.mask,sub=p.suppression.geometry,old=p.receiver.geometry,sm=p.suppression.material,rm=p.receiver.material;
 const shaderObjects=[x.guard.programs.get(sm),x.guard.programs.get(rm)],pre=[p.receiver.geometry];
 let retired=0;old.addEventListener('dispose',()=>retired++);
 // Canonical woods move from old slot3 to original slot2; append another
 // wholly unrelated far hedge and change the real instance count.
 swapTreeSlots(x,3,2);
 x.stems.set([-35870,23.5,2580],6*3);x.shapes.set([5,6,2,.9],6*4);x.hedges.set([23.5,23.5,23.5,23.5],6*4);
 x.g.instanceCount=7;
 A(!p.unmountedStill());A.equal(p.refresh(),true);A(p.unmountedStill());A(p.programsStill());stockNow(x);
 A.equal(p.forestRevision,8);A.deepEqual(p.slots,[2,0,4,1]);
 A.equal(p.mask,firstMask);A.equal(p.suppression.geometry,sub);A.equal(p.suppression.geometry.instanceCount,7);
 A.equal(firstMask.getX(2),1);A.equal(firstMask.getX(3),0);A.equal(retired,1);
 A.equal(p.suppression.material,sm);A.equal(p.receiver.material,rm);A.equal(x.guard.n,1);
 A.deepEqual([x.guard.programs.get(sm),x.guard.programs.get(rm)],shaderObjects);
 const now=buildStMarysReceivers(x.source,gradeId,x.stems,x.shapes,5,7);
 A.deepEqual(stamp(p.receiver.geometry),stamp(now.geometry));now.geometry.dispose();
 pre.push(p.receiver.geometry);A.notEqual(pre[1],pre[0]);
 pre[1].addEventListener('dispose',()=>retired++);
 // Simulate an unrendered transit update between consecutive scene
 // submissions. No clearing ranges: previous bit edits must still upload.
 swapTreeSlots(x,2,3);A(p.refresh());A(p.unmountedStill());stockNow(x);
 A.deepEqual(p.slots,[3,0,4,1]);A.equal(retired,2);A.equal(firstMask.getX(3),1);A.equal(firstMask.getX(2),0);
 A.deepEqual(firstMask.updateRanges.map(r=>r.start),[3,2,2,3]);
 A.equal(p.forestRevision,9);A.equal(x.guard.n,1);
 p.dispose();stockNow(x);
});
test('real same-pose ground buffers permit a new versioned rim, not a different geometry, nor a counterfeit no-revision move',async()=>{
 const x=setup(),ready=await prepareStMarysShadowPreflight(x.args),p=ready.take();
 const a=p.receiver.geometry,v=stamp(a);
 x.ground.geometry.attributes.position.needsUpdate=true; // world independently authenticated identical data here
 A(p.refresh());A(p.unmountedStill());A.notEqual(p.receiver.geometry,a);A.deepEqual(stamp(p.receiver.geometry),v);
 const next=p.receiver.geometry; x.ground.geometry=x.ground.geometry.clone();
 A.equal(p.refresh(),false);A.equal(p.receiver.geometry,next);A.equal(p.programsStill(),false);
 p.dispose();stockNow(x);
 const y=setup(),r=await prepareStMarysShadowPreflight(y.args),q=r.take(),b=q.receiver.geometry;
 y.g.attributes.stem.needsUpdate=true;
 A.equal(q.refresh(),false);A.equal(q.receiver.geometry,b);q.dispose();stockNow(y);
});
test('new hedge footprint fails before replacing EBO/receiver/mask; an active refusal is terminal',async()=>{
 const x=setup(),p=(await prepareStMarysShadowPreflight(x.args)).take();A(p);
 const old=p.receiver.geometry,mask=sha(p.mask.array),rev=p.forestRevision,oldsub=p.suppression.geometry;
 const saved=Array.from(x.stems.subarray(15,18));
 x.stems.set([-36064,24,2568],15);x.g.attributes.stem.needsUpdate=true;x.guard.revision++;
 A.equal(p.refresh(),false);stockNow(x);
 A.equal(p.receiver.geometry,old);A.equal(sha(p.mask.array),mask);A.equal(p.suppression.geometry,oldsub);
 A.equal(p.forestRevision,rev);A(!p.unmountedStill());A(!p.programsStill());
 x.stems.set(saved,15);x.g.attributes.stem.needsUpdate=true;x.guard.revision++;
 A.equal(p.refresh(),false);A.equal(x.guard.n,1);p.dispose();
 stockNow(x);
});
