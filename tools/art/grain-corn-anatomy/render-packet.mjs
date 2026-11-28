import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {WebGLProgram} from 'three/src/renderers/webgl/WebGLProgram.js';
import {makeCornStudy,studioFloor} from './corn-study.ts';
const sha=b=>createHash('sha256').update(b).digest('hex');
const raw=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const prelock=readFileSync(new URL('./CORN-ART-PRELOCK.json',import.meta.url)),spec=JSON.parse(prelock);
const art={near:makeCornStudy('near'),'near-single':makeCornStudy('near-single')},
 floors={near:studioFloor(false)};
const A=art.near,M=A.material,dim=spec.frame;
function expand(){
 const rec={},gl={VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,createShader:type=>({type}),
 shaderSource:(s,q)=>rec[s.type===35633?'vertex':'fragment']=q,
 compileShader:()=>{},createProgram:()=>({}),attachShader:()=>{},bindAttribLocation:()=>{},linkProgram:()=>{}};
 new WebGLProgram({getContext:()=>gl},'detached-corn-art',{
   shaderType:'ShaderMaterial',shaderName:'',precision:'highp',
   vertexShader:M.vertexShader,fragmentShader:M.fragmentShader,defines:{},
   vertexColors:false,outputColorSpace:T.SRGBColorSpace,toneMapping:T.ACESFilmicToneMapping,
   doubleSided:true,logarithmicDepthBuffer:false,opaque:true,hasPositionAttribute:true,
   numSunLights:0,numSunLightShadows:0,numLightProbeGrids:0,
   numPointLights:0,numSpotLights:0,numDirLights:0,numRectAreaLights:0,numHemiLights:0,
   numPointLightShadows:0,numSpotLightShadows:0,numSpotLightMaps:0,numSpotLightShadowsWithMaps:0,numDirLightShadows:0,
   numClippingPlanes:0,numClipIntersection:0
 },{});
 return rec;
}
const digest=(a)=>{const d=raw(a);return{data:d.toString('base64'),sha:sha(d),bytes:d.byteLength};};
function emit(geometry){
 return {attrs:Object.fromEntries(Object.entries(geometry.attributes).map(([name,a])=>[name,{
  ...digest(a.array),itemSize:a.itemSize,normalized:a.normalized,type:a.array.constructor.name}])),
  index:{count:geometry.index.count,...digest(geometry.index.array)}};
}
const views=spec.cameras.map(v=>{
 const c=new T.PerspectiveCamera(v.fov,dim[0]/dim[1],.05,2200);
 c.position.fromArray(v.eye);c.lookAt(...v.aim);c.updateMatrixWorld();
 return {...v,rangeM:Math.hypot(...v.eye),view:c.matrixWorldInverse.toArray(),projection:c.projectionMatrix.toArray(),
  normal:new T.Matrix3().getNormalMatrix(c.matrixWorldInverse).toArray()};
});
const s=expand(),geom=Object.fromEntries(Object.entries(art).map(([k,a])=>[k,emit(a.geometry)]));
const g=emit(floors.near);
console.log(JSON.stringify({spec,three:T.REVISION,scope:'Detached original anatomy only, no gameplay',
  baseLock:sha(prelock),interiorLock:null,interior:{interior:[]},views,
  shader:s,shaderSha:Object.fromEntries(Object.entries(s).map(([k,v])=>[k,sha(v)])),
  light:M.uniforms.cornDay.value.toArray(),basis:null,geo:geom,floors:{near:g},budget:{trianglesSingle:1936,trianglesTriple:5808}}));
for(const a of Object.values(art))a.dispose();
for(const a of Object.values(floors))a.dispose();
