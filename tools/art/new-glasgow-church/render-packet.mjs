import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {WebGLProgram} from 'three/src/renderers/webgl/WebGLProgram.js';
import {makeChurchDetached,churchStudioGround,CHURCH_CORE_PLAN} from './church-core.ts';
const B=makeChurchDetached(),floor=churchStudioGround();
const recipe=JSON.parse(readFileSync(new URL('./CHURCH-VIEW-PRELOCK.json',import.meta.url),'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
function display(mat){
 const rec={}, gl={VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,createShader:type=>({type}),
 shaderSource:(shader,src)=>rec[shader.type===35633?'vertex':'fragment']=src,
 compileShader:()=>{},createProgram:()=>({}),attachShader:()=>{},bindAttribLocation:()=>{},linkProgram:()=>{}};
 new WebGLProgram({getContext:()=>gl},'church-observed-core',{
 shaderType:'ShaderMaterial',shaderName:'',precision:'highp',
 vertexShader:mat.vertexShader,fragmentShader:mat.fragmentShader,defines:{},vertexColors:false,
 outputColorSpace:T.SRGBColorSpace,toneMapping:T.ACESFilmicToneMapping,doubleSided:false,logarithmicDepthBuffer:false,opaque:true,
 hasPositionAttribute:true,numSunLights:0,numSunLightShadows:0,numLightProbeGrids:0,
 numPointLights:0,numSpotLights:0,numDirLights:0,numRectAreaLights:0,numHemiLights:0,
 numPointLightShadows:0,numSpotLightShadows:0,numSpotLightMaps:0,numSpotLightShadowsWithMaps:0,numDirLightShadows:0,
 numClippingPlanes:0,numClipIntersection:0},{});return rec;
}
function geom(g){
 const buf=Object.fromEntries(['position','normal','uv','churchRole'].map(k=>{
  const a=g.getAttribute(k).array;
  return [k,Buffer.from(a.buffer,a.byteOffset,a.byteLength)];
 }));
 return {count:g.getAttribute('position').count,
   sha256:Object.fromEntries(Object.entries(buf).map(([k,b])=>[k,hash(b)])),
   attrs:Object.fromEntries(Object.entries(buf).map(([k,v])=>[k,v.toString('base64')]))};
}
function camera(v){
 const p=new T.PerspectiveCamera(v.fov,recipe.frame[0]/recipe.frame[1],.06,320);
 p.position.fromArray(v.eye);p.lookAt(...v.aim);p.updateMatrixWorld();
 return {...v,view:p.matrixWorldInverse.toArray(),pp:p.projectionMatrix.toArray()};
}
const M=B.material;
console.log(JSON.stringify({rev:T.REVISION, proof:'Original detached art; shape basis is not literal absolute placement',
 viewPrelockSha:hash(readFileSync(new URL('./CHURCH-VIEW-PRELOCK.json',import.meta.url))),
 recipe,views:recipe.view.map(camera),plan:CHURCH_CORE_PLAN,sections:B.sections,
 packed:{subject:geom(B.geometry),floor:geom(floor)},
 shading:{sun:M.uniforms.churchSun.value.toArray(),vertex:hash(M.vertexShader),fragment:hash(M.fragmentShader),sources:display(M)}}));
B.dispose();floor.dispose();
