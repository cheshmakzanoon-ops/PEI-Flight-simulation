import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DoubleSide, MeshStandardMaterial, ShaderLib, Vector3, type WebGLRenderer} from 'three';
import {surveyedCowlingFinish} from '../src/render/cowling-finish.ts';

type Shader=Parameters<MeshStandardMaterial['onBeforeCompile']>[0];
function shaderSource(overrides:Partial<Shader>={}) {
 return {vertexShader:ShaderLib.standard.vertexShader,fragmentShader:ShaderLib.standard.fragmentShader,uniforms:{},...overrides} as Shader;
}
const compile=(m:MeshStandardMaterial,s:Shader)=>m.onBeforeCompile(s,{} as WebGLRenderer);

test('cowling uses one stock PBR shader program shape with separately bound coordinate transforms',()=>{
 const original=new MeshStandardMaterial({color:0xe2dfcf,side:DoubleSide,roughness:.39,metalness:.34});
 const geometry={scale:new Vector3(.62,.56,1.4),offset:new Vector3(0,-.01,-2.65)};
 const exterior=surveyedCowlingFinish(original),interior=surveyedCowlingFinish(original,geometry);
 assert.equal(exterior.customProgramCacheKey(),interior.customProgramCacheKey());
 const e=shaderSource(),i=shaderSource(),o=shaderSource();
 compile(exterior,e);compile(interior,i);compile(original,o);
 assert.notEqual(e.vertexShader,o.vertexShader);
 assert.notEqual(e.fragmentShader,o.fragmentShader);
 assert.equal(e.vertexShader,i.vertexShader);assert.equal(e.fragmentShader,i.fragmentShader);
 assert.notStrictEqual(e.uniforms.surveySkinScale,i.uniforms.surveySkinScale);
 assert.notStrictEqual(e.uniforms.surveySkinOffset,i.uniforms.surveySkinOffset);
 assert.deepEqual(e.uniforms.surveySkinScale.value.toArray(),[1,1,1]);
 assert.deepEqual(e.uniforms.surveySkinOffset.value.toArray(),[0,0,0]);
 assert.deepEqual(i.uniforms.surveySkinScale.value.toArray(),[.62,.56,1.4]);
 assert.deepEqual(i.uniforms.surveySkinOffset.value.toArray(),[0,-.01,-2.65]);
 assert.deepEqual(Object.keys(o.uniforms),[]);
 for(const m of [interior,exterior]){
  assert.equal(m.depthWrite,original.depthWrite);
  assert.equal(m.side,original.side);assert.equal(m.opacity,original.opacity);
  assert.equal(m.transparent,original.transparent);
  assert.equal(m.map,null);assert.equal(m.normalMap,null);assert.equal(m.bumpMap,null);
  assert.equal(m.roughness,original.roughness);assert.equal(m.metalness,original.metalness);
 }
 assert(e.fragmentShader.includes('diffuseColor.rgb*='));
 assert(e.fragmentShader.includes('roughnessFactor=clamp('));
 assert.equal(e.fragmentShader.match(/diffuseColor\.a\s*=/g),null);
});

test('an unsupported or ambiguous shader falls back atomically to the supplied stock program',()=>{
 const finish=surveyedCowlingFinish(new MeshStandardMaterial());
 for(const shader of [
  shaderSource({vertexShader:ShaderLib.standard.vertexShader.replace('#include <begin_vertex>','')}),
  shaderSource({fragmentShader:ShaderLib.standard.fragmentShader.replace('#include <roughnessmap_fragment>','')}),
  shaderSource({fragmentShader:ShaderLib.standard.fragmentShader+'\n#include <color_fragment>'}),
 ]){
  const before={...shader};compile(finish,shader);
  assert.deepEqual(shader,before);
  assert.deepEqual(Object.keys(shader.uniforms),[]);
 }
});
