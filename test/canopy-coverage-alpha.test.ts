import assert from 'node:assert/strict';
import test from 'node:test';
import {AddEquation,CustomBlending,NormalBlending,OneFactor,ShaderMaterial,ZeroFactor} from 'three';
import {inheritedCanopyCoverageBlend,keepSupplementalCanopyLegacyBlend,opaqueCanopyCoverageBlend,supportsOpaqueCanopyCoverage} from '../src/render/canopy-coverage-alpha.ts';

function context(alpha:boolean,antialias:boolean,count:number,lost=false){
 let queries=0;
 const supported=supportsOpaqueCanopyCoverage({
  SAMPLES:0x80a9,
  getContextAttributes:()=>lost?null:{alpha,antialias},
  getParameter(key:number){assert.equal(key,0x80a9);queries++;return count;},
 });
 return {supported,queries};
}

test('opaque canopy destination alpha applies only to a real alpha multisample framebuffer',()=>{
 assert.deepEqual(context(true,true,4),{supported:true,queries:1});
 assert.deepEqual(context(true,true,0),{supported:false,queries:1});
 assert.deepEqual(context(true,false,4),{supported:false,queries:0});
 assert.deepEqual(context(false,true,4),{supported:false,queries:0});
 assert.deepEqual(context(true,true,4,true),{supported:false,queries:0});
});

test('the accepted blend replaces RGB but keeps the already-rendered alpha',()=>{
 assert.deepEqual(opaqueCanopyCoverageBlend,{
  blending:CustomBlending,
  blendEquation:AddEquation,blendSrc:OneFactor,blendDst:ZeroFactor,
  blendEquationAlpha:AddEquation,blendSrcAlpha:ZeroFactor,blendDstAlpha:OneFactor,
 });
 const crown=new ShaderMaterial({alphaToCoverage:true,...opaqueCanopyCoverageBlend});
 assert.equal(crown.transparent,false);assert.equal(crown.depthWrite,true);assert.equal(crown.depthTest,true);
 assert.equal(crown.alphaToCoverage,true);assert.equal(inheritedCanopyCoverageBlend(crown),opaqueCanopyCoverageBlend);
 crown.blendDstAlpha=ZeroFactor;
 assert.equal(inheritedCanopyCoverageBlend(crown),undefined);
 const original=new ShaderMaterial({alphaToCoverage:true});
 assert.equal(original.blending,NormalBlending);assert.equal(inheritedCanopyCoverageBlend(original),undefined);
 crown.dispose();original.dispose();
});


test('specialized supplemental clones preserve every prior blend field',()=>{
 const original=new ShaderMaterial({alphaToCoverage:true});
 const base=new ShaderMaterial({alphaToCoverage:true,...opaqueCanopyCoverageBlend});
 const supplemental=base.clone();
 keepSupplementalCanopyLegacyBlend(supplemental);
 for(const key of Object.keys(opaqueCanopyCoverageBlend) as (keyof typeof opaqueCanopyCoverageBlend)[])
  assert.equal(supplemental[key],original[key],key);
 assert.equal(supplemental.alphaToCoverage,true);
 assert.equal(inheritedCanopyCoverageBlend(base),opaqueCanopyCoverageBlend);
 for(const m of [original,base,supplemental])m.dispose();
});
