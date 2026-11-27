import assert from 'node:assert/strict';
import test from 'node:test';
import {AddEquation,CustomBlending,NormalBlending,OneFactor,ZeroFactor} from 'three';
import {roadRibbonMaterial} from '../src/render/road-surface.ts';
import {supportsOpaqueCoverage} from '../src/render/opaque-coverage-alpha.ts';

test('road shoulder MSAA retains RGB replacement and preserves destination alpha',()=>{
 const context=(alpha:boolean,antialias:boolean,samples:number)=>({
  SAMPLES:0x80a9,
  getContextAttributes:()=>({alpha,antialias}),
  getParameter:()=>samples,
 });
 const prior=roadRibbonMaterial(),native=roadRibbonMaterial(supportsOpaqueCoverage(context(true,true,4)));
 assert.equal(prior.blending,NormalBlending);assert.equal(native.blending,CustomBlending);
 assert.deepEqual([native.blendEquation,native.blendSrc,native.blendDst],
                  [AddEquation,OneFactor,ZeroFactor]);
 assert.deepEqual([native.blendEquationAlpha,native.blendSrcAlpha,native.blendDstAlpha],
                  [AddEquation,ZeroFactor,OneFactor]);
 for(const k of ['transparent','alphaToCoverage','depthWrite','depthTest','side','roughness',
                  'polygonOffset','polygonOffsetFactor','polygonOffsetUnits','vertexColors'] as const)
  assert.equal(native[k],prior[k],k);
 const variant=native.clone();
 assert.deepEqual([variant.blending,variant.blendSrcAlpha,variant.blendDstAlpha],
  [CustomBlending,ZeroFactor,OneFactor]);
 for(const c of [context(false,true,4),context(true,false,4),context(true,true,1),context(true,true,0)])
  assert.equal(roadRibbonMaterial(supportsOpaqueCoverage(c)).blending,NormalBlending);
});
