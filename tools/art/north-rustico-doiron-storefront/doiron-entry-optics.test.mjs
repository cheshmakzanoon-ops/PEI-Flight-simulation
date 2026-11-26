import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ShaderLib,MeshStandardMaterial} from 'three';
import {makeDoironEntryStudy,patchDoironEntryFinish} from './doiron-entry-study.ts';
import {makeDoironEntryOpticalStudy,patchDoironEntryOptics} from './doiron-entry-optics.ts';

const roles=['back','trim','sill','lap','shingle','glass','door','canopy','soffit'];
const {vertexShader:v,fragmentShader:f}=ShaderLib.standard;
const expected={
 off:[],glass:['glass'],
 eave:['trim','sill','lap','shingle','glass','door'],
 edge:['trim','sill','shingle','glass','door'],
 full:['trim','sill','lap','shingle','glass','door'],
};
const find=(o,r)=>o.children.find(m=>m.userData.role===r);

test('every isolated optical control affects only its intended original roles; missing hood disables shadow',()=>{
 for(const [stage,allowed] of Object.entries(expected)){
  for(const role of roles){
   const result=patchDoironEntryOptics(v,f,role,{stage});
   if(!allowed.includes(role)){assert.equal(result,undefined);continue;}
   assert.ok(result);
   assert.equal(result.fragment.includes('outgoingLight=doironEntryGlaze'),role==='glass'&&['glass','full'].includes(stage));
   assert.equal(result.fragment.includes('outgoingLight*=1.-doironEntryEave'),['eave','full'].includes(stage));
   assert.equal(result.fragment.includes('outgoingLight*=1.-doironEntryEdge'),['edge','full'].includes(stage)&&role!=='lap');
   const sampling=/\b(?:texture|texture2D|sampler2D|samplerCube)\b/g;
   assert.equal((result.fragment.match(sampling)??[]).length,(f.match(sampling)??[]).length);
   assert.equal((result.fragment.match(/\buniform\b/g)??[]).length,(f.match(/\buniform\b/g)??[]).length);
   assert.equal((result.fragment.match(/\bdiscard\b/g)??[]).length,(f.match(/\bdiscard\b/g)??[]).length);
   assert.equal((result.fragment.match(/diffuseColor\.a/g)??[]).length,(f.match(/diffuseColor\.a/g)??[]).length);
   assert.equal(patchDoironEntryOptics(result.vertex,result.fragment,role,{stage}),undefined);
   assert.ok(result.fragment.lastIndexOf('outgoingLight')<result.fragment.indexOf('#include <opaque_fragment>'));
  }
 }
 for(const r of roles)assert.equal(patchDoironEntryOptics(v,f,r,{stage:'eave',hood:false}),undefined);
 const noHood=patchDoironEntryOptics(v,f,'glass',{stage:'full',hood:false});
 assert.ok(noHood.fragment.includes('doironEntryGlaze')&&noHood.fragment.includes('doironEntryEdge'));
 assert.ok(!noHood.fragment.includes('doironEntryEave'));
 assert.equal(patchDoironEntryOptics(v,f.replace('#include <opaque_fragment>',''), 'glass'),undefined);
 assert.equal(patchDoironEntryOptics(v+'\n#include <begin_vertex>',f,'glass'),undefined);
});

test('full/isolated controls are exactly the same geometry and initial shading inputs',()=>{
 for(const hood of [true,false]){
  const stock=makeDoironEntryStudy({hood});
  for(const stage of Object.keys(expected)){
   const study=makeDoironEntryOpticalStudy({stage,hood});
   assert.equal(study.children.length,stock.children.length);
   for(const m of study.children){
    const role=m.userData.role,baseline=find(stock,role);
    for(const key of ['position','normal','uv'])assert.deepEqual(m.geometry.attributes[key].array,baseline.geometry.attributes[key].array);
    assert.equal(m.material.opacity,baseline.material.opacity);
    assert.equal(m.material.transparent,baseline.material.transparent);
    assert.equal(m.material.side,baseline.material.side);
    assert.equal(m.material.roughness,baseline.material.roughness);
    assert.ok(m.material.color.equals(baseline.material.color));
    const existing=patchDoironEntryFinish(v,f,role)??{vertex:v,fragment:f};
    const options={stage,hood};
    const patched=patchDoironEntryOptics(existing.vertex,existing.fragment,role,options)??existing;
    const q={vertexShader:v,fragmentShader:f,uniforms:{key:{value:1}}},u=q.uniforms;
    m.material.onBeforeCompile(q,{});
    assert.equal(q.vertexShader,patched.vertex);
    assert.equal(q.fragmentShader,patched.fragment);
    assert.equal(q.uniforms,u);
    assert.deepEqual(q.uniforms,{key:{value:1}});
   }
  }
 }
});

test('material ownership and cache key are independent of caller option object edits',()=>{
 const custom=new MeshStandardMaterial({name:'Doiron entry / glass'});
 const initial={stage:'full',hood:true,materialFor:r=>r==='glass'?custom:undefined};
 const untouched=custom.onBeforeCompile;
 const mesh=makeDoironEntryOpticalStudy(initial);
 assert.equal(find(mesh,'glass').material,custom);
 assert.equal(custom.onBeforeCompile,untouched);
 const sample=find(mesh,'lap').material,k=sample.customProgramCacheKey();
 initial.stage='off';initial.hood=false;
 assert.equal(sample.customProgramCacheKey(),k);
 const q={vertexShader:v,fragmentShader:f,uniforms:{}};
 sample.onBeforeCompile(q,{});
 assert.match(q.fragmentShader,/doironEntryEave/);
});
