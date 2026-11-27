import assert from 'node:assert/strict';
import test from 'node:test';
import {AddEquation,CustomBlending,NormalBlending,OneFactor,Vector3,ZeroFactor} from 'three';
import {marshMaterials} from '../src/render/marsh-foliage/marsh-material.ts';
import {supportsOpaqueCoverage} from '../src/render/opaque-coverage-alpha.ts';

test('native marsh coverage retains sample colours and the scene alpha without changing depth or shaders',()=>{
 const ctx={SAMPLES:0x80a9,getContextAttributes:()=>({alpha:true,antialias:true}),getParameter:()=>4};
 const sun=new Vector3(-.52,.78,.35);
 const old=marshMaterials({sun,msaa:true},true);
 const scene=marshMaterials({sun,msaa:true,keepSceneAlpha:supportsOpaqueCoverage(ctx)},true);
 const m=scene.forward;
 assert.equal(m.blending,CustomBlending);
 assert.deepEqual([m.blendEquation,m.blendSrc,m.blendDst],[AddEquation,OneFactor,ZeroFactor]);
 assert.deepEqual([m.blendEquationAlpha,m.blendSrcAlpha,m.blendDstAlpha],[AddEquation,ZeroFactor,OneFactor]);
 assert.equal(old.forward.blending,NormalBlending);
 for (const k of ['vertexShader','fragmentShader','transparent','alphaToCoverage','depthWrite','depthTest','side'] as const)
  assert.equal(m[k],old.forward[k],k);
 assert.equal(scene.depth?.blending,old.depth?.blending);
 assert.equal(scene.depth?.customProgramCacheKey(),old.depth?.customProgramCacheKey());
 for(const [alpha,antialias,samples] of [[false,true,4],[true,false,4],[true,true,1],[true,true,0]] as const){
  const keepSceneAlpha=supportsOpaqueCoverage({...ctx,getContextAttributes:()=>({alpha,antialias}),getParameter:()=>samples});
  assert.equal(marshMaterials({sun,msaa:samples>=2,keepSceneAlpha},false).forward.blending,NormalBlending);
 }
 const noMSAA=marshMaterials({sun,msaa:false,keepSceneAlpha:true},false);
 assert.equal(noMSAA.forward.alphaToCoverage,false);
 assert.equal(noMSAA.forward.blending,NormalBlending);
 assert.equal(noMSAA.depth,undefined);
});
