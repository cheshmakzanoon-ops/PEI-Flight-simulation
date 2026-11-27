import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {makeCharlottetownFssExterior,FSS_ART_PROFILE as p,FSS_ART_SOURCE as scope} from './src/fss-exterior.ts';
const eps=.000003, near=(x,y,why='stage proportion')=>assert(Math.abs(x-y)<eps,why);
const verts=m=>m.geometry.getAttribute('position');
const owns=(m,name)=>m.geometry.userData.artRoles[name]??[];
const ranges=m=>Object.entries(m.geometry.userData.artRoles).flatMap(([id,spans])=>spans.map(([a,b])=>[id,a,b]));
const fixture=()=>{
 const a=makeCharlottetownFssExterior(),b=makeCharlottetownFssExterior('mid');
 for(const x of [a,b])x.group.updateMatrixWorld(true);
 return[a,b];
};
const rayHits=(object,x,y,z,dx,dy,dz)=>new T.Raycaster(new T.Vector3(x,y,z),new T.Vector3(dx,dy,dz).normalize()).intersectObject(object,true);
test('unitless profile and exact draw budgets',()=>{
 const models=fixture();
 assert(Object.isFrozen(p)&&Object.isFrozen(p.body)&&Object.isFrozen(p.cabSillR));
 assert(p.capR[0]<p.body[0]&&p.capR[1]<p.body[1]&&p.cabSillR[0]<p.cabGlassR[0]&&p.cabSillR[1]<p.cabGlassR[1]);
 assert((p.capBeltTop-p.cabRise)<.05&&p.baseHalf[0]>p.body[0]&&p.baseHalf[1]>p.body[1]);
 for(const [i,k]of models.entries()){
  const bounds=new T.Box3().setFromObject(k.group);
  near(bounds.min.y,0);near(bounds.max.y,1);
  near(bounds.min.x,-p.baseHalf[0]);near(bounds.max.x,p.baseHalf[0]);near(bounds.min.z,-p.baseHalf[1]);near(bounds.max.z,p.baseHalf[1]);
  assert.equal(k.group.children.length,2);assert.equal(k.counts.draws,2);assert(k.counts.triangles<=(i?scope.midTriBudget:scope.nearTriBudget));
  assert.deepEqual(k.counts.triangles,i?426:618);
 }
});
test('one static subject, no stock shader/material mutation or images/operations',()=>{
 const [a,b]=fixture();
 const programs=new T.MeshStandardMaterial().customProgramCacheKey();
 for(const q of [a,b]){
  assert.equal(q.group.parent,null);
  assert.equal(q.group.userData.noOperationalElements,true);
  assert.equal(q.group.userData.photographicPixels,false);
  assert.equal(q.group.userData.reviewOnly,true);
  for(const m of [q.body,q.glass]){
   assert(m.material.isMeshStandardMaterial);
   assert.notEqual(m.material.customProgramCacheKey(),programs);
   assert.match(m.material.customProgramCacheKey(),/^fss-documentary-detached-v2-/);
   assert.equal(m.material.side,T.FrontSide);
   assert(m.material.depthWrite&&!m.material.transparent&&m.material.depthTest&&!m.castShadow&&!m.receiveShadow);
   assert(!Object.values(m.material).some(v=>v?.isTexture));
   assert.equal(m.geometry.index,null);
   assert.deepEqual(Object.keys(m.geometry.attributes).sort(),['color','fssFinish','normal','position']);
  }
 }
 assert(a.body.material.roughness>b.glass.material.roughness);
 assert.notEqual(a.glass.material,b.glass.material);
});
test('deterministic finite role spans and non-degenerate normals per mesh',()=>{
 const [a,b]=fixture();const an=makeCharlottetownFssExterior();
 const sha=q=>createHash('sha256').update(Buffer.from(q.array.buffer)).digest('hex');
 for(const key of ['body','glass'])for(const n of ['position','normal','color','fssFinish'])assert.equal(sha(a[key].geometry.getAttribute(n)),sha(an[key].geometry.getAttribute(n)));
 for(const q of [a,b])for(const m of [q.body,q.glass]){
   const g=m.geometry,a=g.getAttribute('position'),n=g.getAttribute('normal'),c=g.getAttribute('color'),rangesSorted=ranges(m).sort((a,b)=>a[1]-b[1]);
   const f=g.getAttribute('fssFinish');
   assert(a.count>0&&a.count===n.count&&n.count===c.count&&n.count===f.count);
   assert(Array.from(f.array).every(x=>Number.isInteger(x)&&x>=0&&x<=5));
   assert([...a.array,...n.array,...c.array].every(Number.isFinite));
   for(let i=0;i<n.count;i++)near(Math.hypot(n.getX(i),n.getY(i),n.getZ(i)),1);
   for(let i=0;i<rangesSorted.length;i++){
    const [,x,y]=rangesSorted[i];assert(x>=0&&y>x&&x%3===0&&y%3===0);
    assert.equal(x,i?rangesSorted[i-1][2]:0);
   }
   assert.equal(rangesSorted.at(-1)[2],a.count);
 }
});
test('cab is genuinely canted outward, subordinate and opaque, not a red block or fake interior',()=>{
 for(const q of fixture()){
  const g=q.glass.geometry,n=g.getAttribute('normal'),v=verts(q.glass);
  assert(owns(q.glass,'cabGlass').length>0);
  let triangles=0;
  for(const [a,b]of owns(q.glass,'cabGlass'))for(let i=a;i<b;i+=3){
   const cx=(v.getX(i)+v.getX(i+1)+v.getX(i+2))/3,cz=(v.getZ(i)+v.getZ(i+1)+v.getZ(i+2))/3;
   assert(n.getY(i)<-.24&&n.getX(i)*cx+n.getZ(i)*cz>.085);
   assert(Math.abs(v.getX(i))<p.body[0]&&Math.abs(v.getZ(i))<p.body[1]);
   triangles++;
  }
  assert.equal(triangles,16);
  const roofFirst=rayHits(q.group,0,2,0,0,-1,0)[0];
  assert(roofFirst.object===q.body);near(roofFirst.point.y,1);
 }
});
test('windshield and original sparse shaft openings sit behind solid shoulders',()=>{
 const [a,b]=fixture();
 const query=(k,x,y)=>rayHits(k.group,x,y,2,0,0,-1)[0];
 for(const v of [a,b]){
  const wind=query(v,0,.905);assert(wind.object===v.glass&&wind.point.z<p.body[1]);
  const stone=query(v,.208,.744);assert(stone.object===v.body);near(stone.point.z,p.body[1]);
  const sash=query(v,.127,.744);assert(sash.object===v.glass);
  near(sash.point.z,p.body[1]-(v===a?.020:.011));
  const field=query(v,.012,.744);assert(field.object===v.body);
  near(field.point.z,p.body[1]-.011);
  const low=query(v,-.219,.177),notched=query(v,.229,.177);
  assert(low.object===v.body&&notched.object===v.body);
  near(low.point.z,p.baseHalf[1]);near(notched.point.z,p.baseHalf[1]-.027);
 }
});
test('exact matched broad linear silhouette of near and medium from three detached opinions',()=>{
 const [a,b]=fixture(),N=132;
 for(const [eye,aim] of [[[1.35,.83,1.4],[0,.48,0]],[[-.30,.66,-1.65],[0,.49,0]],[[1.9,1.45,-.48],[0,.49,0]]]){
  const c=new T.PerspectiveCamera(35,1,.03,10);
  c.position.fromArray(eye);c.lookAt(...aim);c.updateMatrixWorld(true);c.updateProjectionMatrix();
  const label=r=>ranges(r.object).find(([,a,b])=>r.faceIndex*3>=a&&r.faceIndex*3<b)?.[0];
  let positive=0,miss=0,nearMidDelta=0,notFinite=0,misowned=0,maxNormalDelta=0;
  const ray=new T.Raycaster(),coord=new T.Vector2();
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
   ray.setFromCamera(coord.set((x+.5)/N*2-1,1-(y+.5)/N*2),c);
   const m=ray.intersectObject(a.group,true)[0],q=ray.intersectObject(b.group,true)[0];
   if(Boolean(m)!==Boolean(q))miss++;
   if(m&&q){positive++;const d=Math.abs(m.distance-q.distance);if(!Number.isFinite(d))notFinite++;
    if(d>1e-5){
      nearMidDelta++;const role=label(m);
      if(role!=='smallSash'&&role!=='shaftReveal')misowned++;
      if(label(q)!=='smallSash'&&label(q)!=='shaftOxide')misowned++;
      const n=q.face.normal;
      const normalGap=Math.abs(n.dot(m.point.clone().sub(q.point)));
      maxNormalDelta=Math.max(maxNormalDelta,normalGap);
      assert(m.distance>=q.distance-1e-6,'near shallow inward geometry must not project forwards');
    }
   }
  }
  assert(positive>1800&&positive<N*N*.84);
  assert.equal(miss,0,'a different exterior silhouette or unclosed recess');
  assert.equal(notFinite,0);
  assert(misowned===0,'changed near/mid captures must be actual bounded small aperture and backplate');
  assert(nearMidDelta>0&&nearMidDelta<60,'fine iris may differ, but not a full shaft panel');
  assert(maxNormalDelta<=.00901,'original prospective sash depth alone permits near/mid optical depth changes');
 }
});
test('watertight conforming Float32 edge custody crosses both owned draws',()=>{
 for(const stage of fixture()){
   const edges=new Map(),points=new Set(),neighbors=new Map();
   for(const m of [stage.body,stage.glass]){
    const a=verts(m),key=i=>[a.getX(i),a.getY(i),a.getZ(i)].join(',');
    for(let i=0;i<a.count;i+=3){
     const t=[key(i),key(i+1),key(i+2)];assert.equal(new Set(t).size,3);
     for(let j=0;j<3;j++){
      const f=t[j],s=t[(j+1)%3],code=f<s?f+'|'+s:s+'|'+f;
      const old=edges.get(code)??[0,0];old[0]++;old[1]+=f<s?1:-1;edges.set(code,old);
      const n=neighbors.get(f)??new Set();n.add(s);neighbors.set(f,n);
      const r=neighbors.get(s)??new Set();r.add(f);neighbors.set(s,r);
      points.add(f);points.add(s);
     }
    }
   }
   for(const e of edges.values())assert.deepEqual(e,[2,0]);
   const n=stage.counts.triangles;
   assert.equal(points.size-edges.size+n,2,'oriented closed exterior genus zero');
   assert.equal(edges.size,stage.group.userData.lod==='near'?927:639);
   const first=points.values().next().value, pending=[first],seen=new Set();
   for(let i=0;i<pending.length;i++){const a=pending[i];if(seen.has(a))continue;
      seen.add(a);for(const b of neighbors.get(a))pending.push(b);
   }
   assert.equal(seen.size,points.size);
 }
});
test('no apertures or transparent holes through housing',()=>{
 const[a,b]=fixture();
 for(const k of [a,b]){
  for(let i=0;i<26;i++){
    const a=i*Math.PI*2/26;
    for(const h of [.02,.10,.19,.31,.52,.77,.826,.863,.91,.95,.978,.996]){
      const ray=rayHits(k.group,1.8*Math.cos(a),h,1.8*Math.sin(a),-Math.cos(a),0,-Math.sin(a));
      assert(ray.length>=1,'expected solid thin or thick crown and lower mass');
    }
  }
 }
});
test('local analytic finish hooks leave stock shader, opacity, fog and output intact',()=>{
 const [q]=fixture(),base=T.ShaderLib.standard;
 const old={vs:base.vertexShader,fs:base.fragmentShader};
 const body={vertexShader:old.vs,fragmentShader:old.fs,uniforms:{}};
 const glass={vertexShader:old.vs,fragmentShader:old.fs,uniforms:{}};
 q.body.material.onBeforeCompile(body);q.glass.material.onBeforeCompile(glass);
 assert.equal(base.vertexShader,old.vs);assert.equal(base.fragmentShader,old.fs);
 for(const target of [body,glass]){
   assert(target.vertexShader.includes('fssObject=position;fssRole=fssFinish;'));
   for(const protect of ['#include <opaque_fragment>','#include <tonemapping_fragment>','#include <colorspace_fragment>','#include <fog_fragment>'])
     assert.equal(target.fragmentShader.split(protect).length,2);
   assert.equal(Object.keys(target.uniforms).length,0);
   assert(!target.fragmentShader.includes('gl_FragColor.rgb=')&&!target.fragmentShader.includes('sampler2D fss'));
 }
 assert(body.fragmentShader.includes('float fssFoot=max(length(dFdx(fssObject)),length(dFdy(fssObject)));'));
 assert(body.fragmentShader.includes('roughnessFactor=clamp(roughnessFactor+fssRoughnessNudge'));
 assert(glass.fragmentShader.includes('reflect(-fssToEye,normal)'));
 assert(glass.fragmentShader.includes('fssHorizon')&&!body.fragmentShader.includes('fssHorizon'));
 assert.throws(()=>q.glass.material.onBeforeCompile({vertexShader:old.vs,fragmentShader:'',uniforms:{}}));
});
test('just visible lower return carries partial oxide, not a four-side pedestal',()=>{
 for(const q of fixture()){
   const v=verts(q.body),sp=owns(q.body,'lowOxide');
   assert(sp.length>0);let seen=0;
   for(const [a,b]of sp)for(let i=a;i<b;i++){
    assert(v.getZ(i)>.22&&v.getX(i)<=.101001&&v.getY(i)>=0&&v.getY(i)<=.112001);seen++;
   }
   assert.equal(seen,18);
 }
});
test('asset-only idempotent disposal never owns external scene/light or stock',()=>{
 const [a,b]=fixture(),s=new T.Scene(),light=new T.AmbientLight();
 s.add(light,a.group,b.group);
 let times=0;for(const m of [a.body,a.glass]){
   m.geometry.addEventListener('dispose',()=>times++);
   m.material.addEventListener('dispose',()=>times++);
 }
 a.dispose();a.dispose();
 assert.equal(times,4);assert.deepEqual(a.group.children,[]);
 assert(s.children.includes(light));assert(s.children.includes(b.group));assert.equal(b.group.children.length,2);
 assert.throws(()=>makeCharlottetownFssExterior('current'));
});
