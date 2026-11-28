import * as T from 'three';
import {WebGLProgram} from 'three/src/renderers/webgl/WebGLProgram.js';
import {readFileSync as R} from 'node:fs';
import {createHash} from 'node:crypto';
import {makeWoodIslandsDetached,woodStudioGround} from './wood-islands.ts';
const sha=x=>createHash('sha256').update(x).digest('hex');
const k=makeWoodIslandsDetached(),f=woodStudioGround(),m=k.material;
const source={},fake={VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,createShader:type=>({type}),
 shaderSource:(s,a)=>source[s.type===35633?'vertex':'fragment']=a,
 compileShader:()=>{},createProgram:()=>({}),attachShader:()=>{},bindAttribLocation:()=>{},linkProgram:()=>{}};
new WebGLProgram({getContext:()=>fake},'wood-islands-private-physical-study',{
 shaderType:'ShaderMaterial',shaderName:'',precision:'highp',vertexShader:m.vertexShader,fragmentShader:m.fragmentShader,defines:{},
 outputColorSpace:T.SRGBColorSpace,toneMapping:T.ACESFilmicToneMapping,opaque:true,
 logarithmicDepthBuffer:false,vertexColors:false,numDirLights:0,numPointLights:0,numSpotLights:0,numSpotLightMaps:0,
 numRectAreaLights:0,numHemiLights:0,numLightProbeGrids:0,numDirLightShadows:0,numSpotLightShadows:0,numPointLightShadows:0,
 numSpotLightShadowsWithMaps:0,numClippingPlanes:0,numClipIntersection:0
},{});
const lock=R(new URL('./POSE-PRELOCK.json',import.meta.url)),PRE=JSON.parse(lock),[W,H]=PRE.frame;
const cams=[...PRE.flight,...PRE.detail].map(g=>{
 const camera=new T.PerspectiveCamera(g.fov,W/H,.08,2500);camera.position.fromArray(g.eye);
 camera.lookAt(...g.look);camera.updateMatrixWorld(true);
 return {...g,matrix:[camera.matrixWorldInverse.toArray(),camera.projectionMatrix.toArray()],
  rangeM:camera.position.distanceTo(new T.Vector3(...g.look))};
});
const pack=geo=>({vertices:geo.attributes.position.count,attrs:Object.fromEntries(Object.entries(geo.attributes).map(([k,x])=>{
 const b=Buffer.from(x.array.buffer,x.array.byteOffset,x.array.byteLength);
 return [k,{itemSize:x.itemSize,normalized:x.normalized,kind:x.array.constructor.name,bytes:b.length,sha:sha(b),b64:b.toString('base64')}];
}))});
console.log(JSON.stringify({scope:'Original detached physical-scale Wood Islands study; no actual flight/terrain/place claim',
 three:T.REVISION,frame:[W,H],lights:m.uniforms.woodSunLocal.value.toArray(),
 packed:{floor:pack(f),subject:pack(k.geometry)},source,sourceSHA:Object.fromEntries(Object.entries(source).map(([k,v])=>[k,sha(v)])),
 planSHA:sha(lock),apertures:k.apertures,dimensions:k.dimensions,views:cams}));
k.dispose();f.dispose();
