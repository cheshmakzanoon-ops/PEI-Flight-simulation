import assert from 'node:assert/strict';
import test from 'node:test';
import {FrontSide,NormalBlending,Vector3} from 'three';
import {parkingMaterial} from '../src/render/parking-material.ts';
import {opaqueCoverageBlend} from '../src/render/opaque-coverage-alpha.ts';

test('only the opaque mapped parking blend changes on the multisample path',()=>{
 const sun=new Vector3(-.38,.85,-.36).normalize();
 const stock=parkingMaterial(sun),corrected=parkingMaterial(sun,undefined,true);
 assert.equal(stock.vertexShader,corrected.vertexShader);
 assert.equal(stock.fragmentShader,corrected.fragmentShader);
 assert.equal(stock.uniforms.parkSun.value,sun);
 assert.equal(corrected.uniforms.parkSun.value,sun);
 assert.deepEqual(Object.keys(corrected.uniforms),Object.keys(stock.uniforms));
 for(const m of [stock,corrected]){
  assert.equal(m.side,FrontSide);assert.equal(m.alphaToCoverage,true);
  assert.equal(m.transparent,false);assert.equal(m.depthWrite,true);assert.equal(m.depthTest,true);
 }
 assert.equal(stock.blending,NormalBlending);
 for(const key of Object.keys(opaqueCoverageBlend) as (keyof typeof opaqueCoverageBlend)[])
  assert.equal(corrected[key],opaqueCoverageBlend[key]);
 stock.dispose();corrected.dispose();
});
