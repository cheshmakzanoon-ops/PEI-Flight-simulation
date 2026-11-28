import * as T from 'three';
import {WebGLProgram} from 'three/src/renderers/webgl/WebGLProgram.js';
import {createHash} from 'node:crypto';
import {cornArtMaterial} from '../grain-corn-anatomy/corn-study.ts';
import {append,buffer,hash,makeStalkBuffer,pack} from '../grain-corn-anatomy/corn-stalk.ts';
const mat=cornArtMaterial(),N=256;
const raws=new Map(),sha=b=>createHash('sha256').update(b).digest('hex');
const copy=a=>{const b=Buffer.from(a.buffer,a.byteOffset,a.byteLength);return {data:b.toString('base64'),sha:sha(b),bytes:b.length};};
const emit=a=>({attrs:Object.fromEntries(Object.entries(a.attributes).map(([n,b])=>
 [n,{...copy(b.array),itemSize:b.itemSize,normalized:b.normalized,type:b.array.constructor.name}])),
 index:{count:a.index.count,...copy(a.index.array)}});
for(let v=0;v<2;v++){
 const b=buffer(),xy=[];
 for(let j=0;j<650&&xy.length<8;j++){
  const x=2.6*(hash(j,v,181)-.5),z=2.4*(hash(j,v,803)-.5);
  if(xy.some(a=>Math.hypot(a[0]-x,a[1]-z)<.40))continue;
  xy.push([x,z]);
  append(b,makeStalkBuffer(129+v*789+j*149,'hero','weathered').g,x,z,.86+.18*hash(j,v,578),2*Math.PI*hash(j,v,227));
 }
 if(xy.length!==8)throw Error('bounded authored cluster incomplete');
 if(b.i.length<12000||b.p.length/3>65535)throw Error('unexpected original geometry');
 const gg=pack(b);raws.set('variant-'+v,emit(gg));gg.dispose();
}
const shader={},gl={VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,createShader:type=>({type}),
 shaderSource:(s,q)=>shader[s.type===35633?'vertex':'fragment']=q,compileShader:()=>{},createProgram:()=>({}),attachShader:()=>{},bindAttribLocation:()=>{},linkProgram:()=>{}};
new WebGLProgram({getContext:()=>gl},'source-original-leaf-radiance',{
 shaderType:'ShaderMaterial',precision:'highp',shaderName:'',vertexShader:mat.vertexShader,
 fragmentShader:mat.fragmentShader,defines:{},vertexColors:false,outputColorSpace:T.LinearSRGBColorSpace,
 toneMapping:T.NoToneMapping,doubleSided:true,logarithmicDepthBuffer:false,opaque:true,hasPositionAttribute:true,
 numSunLights:0,numSunLightShadows:0,numLightProbeGrids:0,numPointLights:0,numDirLights:0,
 numPointLightShadows:0,numSpotLightShadows:0,numSpotLightMaps:0,numSpotLights:0,numSpotLightShadowsWithMaps:0,
 numDirLightShadows:0,numHemiLights:0,numRectAreaLights:0,numClippingPlanes:0,numClipIntersection:0
},{});
const cams=[];
for(let v=0;v<2;v++)for(const elevation of [25,64])for(const az of [19,109,199,289]){
 const c=new T.OrthographicCamera(-2.6,2.6,2.6,-2.6,.05,40);
 const at=new T.Vector3(0,1.03,0),a=az*Math.PI/180,e=elevation*Math.PI/180;
 c.position.set(10*Math.cos(e)*Math.sin(a),10*Math.sin(e),10*Math.cos(e)*Math.cos(a)).add(at);
 c.lookAt(at);c.updateMatrixWorld();
 cams.push({variant:'variant-'+v,elevation,az,orthographicSpanM:5.2,eye:c.position.toArray(),
  view:c.matrixWorldInverse.toArray(),normal:new T.Matrix3().getNormalMatrix(c.matrixWorldInverse).toArray(),
  projection:c.projectionMatrix.toArray()});
}
console.log(JSON.stringify({frame:[N,N],renderedOriginalGeometry:Object.fromEntries(raws),shader,cams,light:mat.uniforms.cornDay.value.toArray(),three:T.REVISION}));
