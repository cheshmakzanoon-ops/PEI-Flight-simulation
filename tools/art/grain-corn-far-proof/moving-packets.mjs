import fs from 'node:fs';
import * as T from 'three';
import {WebGLProgram} from 'three/src/renderers/webgl/WebGLProgram.js';
const root=new URL('./',import.meta.url),read=k=>JSON.parse(fs.readFileSync(new URL(k,root)));
const p=JSON.parse(fs.readFileSync('packet.json')), lock=read('dense-moving-prelock.json'),cam=[];
for(let v=0;v<2;v++)for(const span of lock.spans)for(const sweep of lock.sweeps) {
 for(let i=0;i<lock.framesPerSweep;i++){
  const q=i/(lock.framesPerSweep-1);
  const az=sweep.az[0]*(1-q)+sweep.az[1]*q, elevation=sweep.elev[0]*(1-q)+sweep.elev[1]*q;
  const c=new T.OrthographicCamera(-2.6,2.6,2.6,-2.6,.05,40),center=new T.Vector3(0,1.03,0);
  const a=az*Math.PI/180,e=elevation*Math.PI/180;
  c.position.set(10*Math.cos(e)*Math.sin(a),10*Math.sin(e),10*Math.cos(e)*Math.cos(a)).add(center);
  c.lookAt(center);c.updateMatrixWorld();
  cam.push({variant:'variant-'+v,elevation,az,orthographicSpanM:5.2,eye:c.position.toArray(),
    view:c.matrixWorldInverse.toArray(),projection:c.projectionMatrix.toArray(),normal:new T.Matrix3().getNormalMatrix(c.matrixWorldInverse).toArray(),
    placement:{sweep:sweep.name,span,i,cx:79.65+(i%4)*.25,cy:54.6+((2*i)%7)*.116}});
 }
}
if(!process.argv.includes('--atlas-program')){
 p.cams=cam;console.log(JSON.stringify(p));
} else {
 const expanded={},gl={VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,createShader:type=>({type}),
 shaderSource:(s,q)=>expanded[s.type===35633?'vertex':'fragment']=q,
 compileShader:()=>{},createProgram:()=>({}),attachShader:()=>{},bindAttribLocation:()=>{},linkProgram:()=>{}};
 const vert='void main(){gl_Position=vec4(position.xy,0.,1.);}';
 const frag=`
 precision highp sampler2DArray;
 uniform sampler2DArray sourceAngles;
 uniform vec3 samplePlacement; // centre x, centre y and full author span in device pixels
 uniform vec4 indexBlend; // sector x, next y, normalized x fraction z, young/old base in w
 uniform vec2 elevationBlend;
 out vec4 colour;
 void main(){
    vec2 u=(gl_FragCoord.xy-samplePlacement.xy)/samplePlacement.z+.5;
    u.y=1.-u.y;
    vec2 dx=dFdx(u),dy=dFdy(u);
    if(any(lessThan(u,vec2(0.)))||any(greaterThan(u,vec2(1.))))discard;
    vec4 a=textureGrad(sourceAngles,vec3(u,indexBlend.w+indexBlend.x),dx,dy);
    vec4 b=textureGrad(sourceAngles,vec3(u,indexBlend.w+indexBlend.y),dx,dy);
    vec4 c=textureGrad(sourceAngles,vec3(u,elevationBlend.x+indexBlend.x),dx,dy);
    vec4 d=textureGrad(sourceAngles,vec3(u,elevationBlend.x+indexBlend.y),dx,dy);
    colour=mix(mix(a,b,indexBlend.z),mix(c,d,indexBlend.z),elevationBlend.y);
 }`;
 new WebGLProgram({getContext:()=>gl},'detached-dense-atlas-motion',{
 shaderType:'ShaderMaterial',precision:'highp',shaderName:'',vertexShader:vert,fragmentShader:frag,defines:{},glslVersion:T.GLSL3,vertexColors:false,
 outputColorSpace:T.LinearSRGBColorSpace,toneMapping:T.NoToneMapping,doubleSided:true,logarithmicDepthBuffer:false,
 opaque:true,hasPositionAttribute:true,numSunLights:0,numSunLightShadows:0,numLightProbeGrids:0,numPointLights:0,numPointLightShadows:0,numPointLightShadowMaps:0,numDirLights:0,numDirLightShadows:0,
 numSpotLights:0,numSpotLightShadows:0,numSpotLightMaps:0,numSpotLightShadowsWithMaps:0,numRectAreaLights:0,numHemiLights:0,numClippingPlanes:0,numClipIntersection:0},{});
 console.log(JSON.stringify({frame:lock.frame,cams:cam,shader:expanded,three:T.REVISION}));
}
