import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {WebGLProgram} from 'three/src/renderers/webgl/WebGLProgram.js';
import {makeBowleyFloatConcept,BOWLEY_SECTION} from './bowley-float-concept.ts';
const A=makeBowleyFloatConcept(), M=A.material;
const lock=readFileSync(new URL('./STUDIO-PRELOCK.json',import.meta.url)),spec=JSON.parse(lock);
const sha=b=>createHash('sha256').update(b).digest('hex');
const raw=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
function expand(){
 const rec={},gl={VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,createShader:type=>({type}),
 shaderSource:(s,q)=>rec[s.type===35633?'vertex':'fragment']=q,
 compileShader:()=>{},createProgram:()=>({}),attachShader:()=>{},bindAttribLocation:()=>{},linkProgram:()=>{}};
 new WebGLProgram({getContext:()=>gl},'bowley-detached-float',{
   shaderType:'ShaderMaterial',shaderName:'',precision:'highp',
   vertexShader:M.vertexShader,fragmentShader:M.fragmentShader,defines:{},
   vertexColors:false,outputColorSpace:T.SRGBColorSpace,toneMapping:T.ACESFilmicToneMapping,
   doubleSided:false,logarithmicDepthBuffer:false,opaque:true,hasPositionAttribute:true,
   numSunLights:0,numSunLightShadows:0,numLightProbeGrids:0,
   numPointLights:0,numSpotLights:0,numDirLights:0,numRectAreaLights:0,numHemiLights:0,
   numPointLightShadows:0,numSpotLightShadows:0,numSpotLightMaps:0,numSpotLightShadowsWithMaps:0,numDirLightShadows:0,
   numClippingPlanes:0,numClipIntersection:0
 },{});
 return rec;
}
const digest=(a)=>{const d=raw(a);return{data:d.toString('base64'),sha:sha(d),bytes:d.byteLength};};
const geom=A.geometry;
const attr=Object.fromEntries(Object.entries(geom.attributes).map(([name,a])=>[name,{
  ...digest(a.array),itemSize:a.itemSize,normalized:a.normalized,type:a.array.constructor.name}]));
const [width,height]=spec.frame;
const views=spec.view.map(v=>{
 const c=new T.PerspectiveCamera(v.fov,width/height,.05,260);
 c.position.fromArray(v.eye);c.lookAt(...v.aim);c.updateMatrixWorld();
 return {...v,view:c.matrixWorldInverse.toArray(),projection:c.projectionMatrix.toArray(),
  normal:new T.Matrix3().getNormalMatrix(c.matrixWorldInverse).toArray()};
});
const shader=expand(),image=A.grain.image;
console.log(JSON.stringify({spec,three:T.REVISION,phase:'isolated no seat, no water',plan:BOWLEY_SECTION,views,
  viewSha:sha(lock),shader,shaderSha:Object.fromEntries(Object.entries(shader).map(([k,v])=>[k,sha(v)])),
  key:M.uniforms.bStudioSun.value.toArray(),attrs:attr,
  index:{count:geom.index.count,...digest(geom.index.array)},
  tex:{width:image.width,height:image.height,...digest(image.data)}}));
A.dispose();
