import * as T from 'three';
import {WebGLProgram} from 'three/src/renderers/webgl/WebGLProgram.js';
import {createBasinCannery} from '../../../../src/render/basin-cannery.ts';
import {FRONT_FINISH,prepareCanneryWaterfrontFinish} from '../basin-waterfront-finish.ts';
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

const root=resolve(process.argv[2]??'proof');mkdirSync(root);
const hash=b=>createHash('sha256').update(b).digest('hex');
const save=(name,v)=>{
 const b=typeof v==='string'?Buffer.from(v):Buffer.from(v.buffer,v.byteOffset,v.byteLength);
 writeFileSync(resolve(root,name),b,{flag:'wx'});return {name,sha:hash(b),bytes:b.byteLength};
};
const asset=createBasinCannery();
assert.equal(T.REVISION,'187');assert.equal(asset.children.length,8);
function code(mesh,kind){
 const q=mesh.material, r=mesh.name.slice(8);
 const p={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,
  uniforms:T.UniformsUtils.clone(T.ShaderLib.standard.uniforms)};
 q.onBeforeCompile(p,undefined);
 if(kind==='marker'){
  const f=FRONT_FINISH[r], common='#include <common>', start='#include <begin_vertex>', end='#include <dithering_fragment>';
  if(f){
   p.vertexShader=p.vertexShader.replace(common,common+'\nflat varying int plateRole;').replace(start,start+`\nplateRole=gl_VertexID>=${f.span[0]}&&gl_VertexID<${f.span[1]}?1:0;`);
   const clr={cladding:'1.,0.,0.',door:'0.,1.,0.',gallery:'0.,0.,1.'}[r];
   p.fragmentShader=p.fragmentShader.replace(common,common+'\nflat varying int plateRole;').replace(end,end+`\ngl_FragColor=vec4(plateRole==1?vec3(${clr}):vec3(0.),1.);`);
  }else p.fragmentShader=p.fragmentShader.replace(end,end+'\ngl_FragColor=vec4(0.,0.,0.,1.);');
 }
 const gl={VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,createProgram:()=>({}),createShader:k=>({k}),
   shaderSource:(s,c)=>{s.code=c;},compileShader(){},attachShader(){},linkProgram(){},deleteShader(){},bindAttribLocation(){}};
 const params={vertexShader:p.vertexShader,fragmentShader:p.fragmentShader,defines:q.defines,vertexColors:false,opaque:true,doubleSided:true,
  shaderType:q.type,shaderName:r,precision:'highp',map:false,mapUv:'uv',fog:false,envMap:false,numSunLights:0,numSunLightShadows:0,numLightProbeGrids:0,
  numDirLights:1,numHemiLights:1,numPointLights:0,numSpotLights:0,numSpotLightMaps:0,
  numRectAreaLights:0,numDirLightShadows:0,numPointLightShadows:0,numSpotLightShadows:0,numSpotLightShadowsWithMaps:0,
  numLightProbes:0,numClippingPlanes:0,numClipIntersection:0,toneMapping:T.ACESFilmicToneMapping,outputColorSpace:T.SRGBColorSpace,
  logarithmicDepthBuffer:true,rendererExtensionParallelShaderCompile:false};
 const c=new WebGLProgram({getContext:()=>gl},q.customProgramCacheKey(),params,{});
 return {vs:c.vertexShader.code,fs:c.fragmentShader.code};
}
function modes(m,label){
 const r=m.name.slice(8);
 return Object.fromEntries(Object.entries(code(m,label)).map(([k,c])=>[k,save(r+'-'+label+'.'+k,c)]));
}
const parts=asset.children.map(m=>{
 const r=m.name.slice(8), g=m.geometry,q=m.material;
 const attr=Object.fromEntries(Object.entries(g.attributes).map(([a,x])=>[a,save(r+'-'+a+'.f32',x.array)]));
 return {name:r,verts:g.attributes.position.count,attr,stock:modes(m,'stock'),marker:modes(m,'marker'),
  diffuse:q.color.toArray(),emissive:q.emissive.clone().multiplyScalar(q.emissiveIntensity).toArray(),roughness:q.roughness,metalness:q.metalness};
});
const lease=await prepareCanneryWaterfrontFinish(asset);assert(lease);assert(lease.set(true));
for(let i=0;i<parts.length;i++)if(FRONT_FINISH[parts[i].name])parts[i].active=modes(asset.children[i],'active');
assert(lease.set(false));lease.release();
for(let i=0;i<parts.length;i++)assert.equal(hash(code(asset.children[i],'stock').fs),parts[i].stock.fs.sha);

const width=1040,height=680,far=340, cameras={};
const poses={
 'southern-harbour':{eye:[25.0,7.85,17.5],target:[1.65,4.60,-.85],fov:41},
 'northern-harbour':{eye:[25.3,15.5,-19.7],target:[1.8,4.35,-.75],fov:41},
 'turned-away':{eye:[28.,9.,16.],target:[56.,9.2,38.],fov:48},
};
for(const [name,p] of Object.entries(poses)){
 const c=new T.PerspectiveCamera(p.fov,width/height,.25,far);
 c.position.set(...p.eye);c.lookAt(...p.target);c.updateMatrixWorld(true);
 const light=new T.Vector3(.52,.77,name==="northern-harbour"?-.35:.35).normalize().transformDirection(c.matrixWorldInverse);
 cameras[name]={...p,far,view:c.matrixWorldInverse.toArray(),normalView:new T.Matrix3().getNormalMatrix(c.matrixWorldInverse).toArray(),
  projection:c.projectionMatrix.toArray(),clipToWorld:c.projectionMatrix.clone().multiply(c.matrixWorldInverse).invert().toArray(),
  directional:{direction:light.toArray(),color:new T.Color(0xffedda).multiplyScalar(2.2).toArray()},
  hemi:{direction:new T.Vector3(0,1,0).transformDirection(c.matrixWorldInverse).toArray(),skyColor:new T.Color(0xe3eeff).multiplyScalar(1.48).toArray(),
   groundColor:new T.Color(0x78654c).multiplyScalar(1.48).toArray()}};
}
const tri=parts.reduce((x,p)=>x+p.verts/3,0);assert.equal(tri,1460);
const a=asset.children.find(p=>p.name==='Cannery cladding').geometry.attributes.position;
const b=asset.children.find(p=>p.name==='Cannery door').geometry.attributes.position;
const c=asset.children.find(p=>p.name==='Cannery gallery').geometry.attributes.position;
const geo={triangles:tri,litParts:parts.length,treated:[2,10,2],treatedAreasM2:[a,b,c].map((t,i)=>{
 const [l,r]=Object.values(FRONT_FINISH)[i].span;let sum=0;
 for(let j=l;j<r;j+=3){
  const x=new T.Vector3().fromBufferAttribute(t,j),
    y=new T.Vector3().fromBufferAttribute(t,j+1).sub(x),z=new T.Vector3().fromBufferAttribute(t,j+2).sub(x);
  sum+=y.cross(z).length()*.5;
 }
 return sum;
})};
writeFileSync(resolve(root,'manifest.json'),JSON.stringify({scope:'Exact current authored Basin Head inlet Cannery, detached neutral stage, no production ground or optics.',
 three:T.REVISION,origin:asset.position.toArray(),viewport:[width,height],parts,cameras,geo},null,2)+'\n',{flag:'wx'});
console.log(geo);
