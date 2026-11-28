import * as T from 'three';
import {WebGLProgram} from 'three/src/renderers/webgl/WebGLProgram.js';
import {decodeRailArtwork} from '../../../../../src/render/summerside-station/rail-art.ts';
import {RAIL_ART as A} from '../../../../../src/render/summerside-station/art.generated.ts';
import {SUMMERSIDE_STATION as S} from '../../../../../src/render/summerside-station/source.generated.ts';
import {prepareRailRoofFinish} from '../rail-roof-finish.ts';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

const out=resolve(process.argv[2]??'proof');
mkdirSync(out); // Never implicitly overwrite a prior result.
const sha=a=>createHash('sha256').update(a).digest('hex');
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const wire=readFileSync(new URL('../../../../../public/art/'+A.file,import.meta.url));
const raw=gunzipSync(wire);
assert.equal(sha(wire),A.wireSha);assert.equal(sha(raw),A.rawSha);
const a=decodeRailArtwork(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),undefined);
assert(a);assert.equal(a.group.children.length,10);assert.equal(T.REVISION,'187');
const role=a.group.getObjectByName('roof');
assert(role);
const compressed=(name,data)=>{
 const buffer=typeof data==='string'?Buffer.from(data):bytes(data);
 writeFileSync(resolve(out,name),buffer,{flag:'wx'});
 return {name,sha:sha(buffer),bytes:buffer.byteLength};
};
function capture(m,marker=false){
 const p={uniforms:T.UniformsUtils.clone(T.ShaderLib.standard.uniforms),
  vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
 m.onBeforeCompile(p,undefined);
 if(marker){
  const root='#include <dithering_fragment>';
  assert.equal(p.fragmentShader.split(root).length,2);
  const x=m.name==='roof'?1:0;
  p.fragmentShader=p.fragmentShader.replace(root,root+`\ngl_FragColor=vec4(${x}.0,${x}.0,${x}.0,1.0);`);
 }
 const gl={VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,createProgram:()=>({}),createShader:k=>({k}),
   shaderSource:(s,code)=>{s.code=code;},compileShader(){},attachShader(){},linkProgram(){},deleteShader(){},bindAttribLocation(){}};
 const settings={vertexShader:p.vertexShader,fragmentShader:p.fragmentShader,defines:m.defines,vertexColors:true,opaque:true,
  shaderType:m.type,shaderName:m.name,precision:'highp',map:!!m.map,mapUv:'uv',fog:false,
  envMap:false,numSunLights:0,numSunLightShadows:0,numLightProbeGrids:0,numDirLights:1,numHemiLights:1,numPointLights:0,numSpotLights:0,numSpotLightMaps:0,
  numRectAreaLights:0,numDirLightShadows:0,numPointLightShadows:0,numSpotLightShadows:0,numSpotLightShadowsWithMaps:0,
  numLightProbes:0,numClippingPlanes:0,numClipIntersection:0,toneMapping:T.ACESFilmicToneMapping,outputColorSpace:T.SRGBColorSpace,
  logarithmicDepthBuffer:true,rendererExtensionParallelShaderCompile:false};
 const c=new WebGLProgram({getContext:()=>gl},m.customProgramCacheKey(),settings,{});
 return {vertex:c.vertexShader.code,fragment:c.fragmentShader.code};
}
function shaders(name,pass){
 return {vs:compressed(name+'.vert',pass.vertex), fs:compressed(name+'.frag',pass.fragment)};
}
const model=a.group.matrix.clone().setPosition(0,0,0);
const exported=a.group.children.map(m=>{
 const g=m.geometry,q=m.material;
 assert(!Array.isArray(q));assert.equal(q.side,T.FrontSide);
 const attrs=['position','normal','uv','color'].map(n=>[n,compressed(m.name+'-'+n+'.f32',g.attributes[n].array)]);
 const before={name:m.name,verts:g.attributes.position.count,indices:g.index.count,
  attr:Object.fromEntries(attrs),index:compressed(m.name+'.u16',g.index.array),
  stock:shaders(m.name+'-stock',capture(q)),marker:shaders(m.name+'-marker',capture(q,true)),
  diffuse:q.color.toArray(),emissive:q.emissive.clone().multiplyScalar(q.emissiveIntensity).toArray(),
  roughness:q.roughness,metalness:q.metalness};
 if(q.map){
  q.map.updateMatrix();
  before.map={...compressed(m.name+'.rgba',q.map.image.data),dimensions:[q.map.image.width,q.map.image.height],
    transform:q.map.matrix.toArray(),sRGB:q.map.colorSpace===T.SRGBColorSpace,anisotropy:q.map.anisotropy};
 }
 return before;
});
const lease=await prepareRailRoofFinish(a.group);assert(lease);
assert(lease.set(true));const fin=shaders('roof-finish',capture(role.material));
assert(lease.set(false));lease.release();
const before=capture(role.material);
assert.equal(sha(before.fragment),exported.find(x=>x.name==='roof').stock.fs.sha);
assert.equal(sha(before.vertex),exported.find(x=>x.name==='roof').stock.vs.sha);
const cameras={};
const external=process.argv[3];
const width=external?1200:1060,height=external?760:690;
for(const [name,v] of Object.entries(external?{}:{
 'street-quarter':{eye:[-31.8,13.6,32.5],target:[4.3,4.45,-1.7],fov:40},
 'harbour-quarter':{eye:[34.7,24.6,-33.8],target:[4.1,4.1,-1.7],fov:41},
 'flyby-scale':{eye:[78.8,63.5,-101.5],target:[4.1,4.15,-1.8],fov:53},
 'turned-away':{eye:[35.0,18.,-36.3],target:[77.1,19.4,-64.7],fov:53},
})){
 const c=new T.PerspectiveCamera(v.fov,width/height,.25,380);
 c.position.set(...v.eye).applyMatrix4(model);c.lookAt(new T.Vector3(...v.target).applyMatrix4(model));c.updateMatrixWorld(true);
 const mv=c.matrixWorldInverse.clone().multiply(model);
 const n=new T.Matrix3().getNormalMatrix(mv);
 const light=new T.Vector3(-.60,.74,-.31).normalize().transformDirection(c.matrixWorldInverse);
 const up=new T.Vector3(0,1,0).transformDirection(c.matrixWorldInverse);
 cameras[name]={...v,worldEye:c.position.toArray(),view:c.matrixWorldInverse.toArray(),modelView:mv.toArray(),
  normalView:n.toArray(),projection:c.projectionMatrix.toArray(),clipToWorld:c.projectionMatrix.clone().multiply(c.matrixWorldInverse).invert().toArray(),
  directional:{direction:light.toArray(),color:new T.Color(0xffedda).multiplyScalar(2.2).toArray()},
  hemi:{direction:up.toArray(),skyColor:new T.Color(0xe3eeff).multiplyScalar(1.48).toArray(),
   groundColor:new T.Color(0x78654c).multiplyScalar(1.48).toArray()}};
}
if(external){
 const body=readFileSync(resolve(external)), j=JSON.parse(body);
 assert.equal(j.base,'4cc5d89cec2a3f719f1dd723308c3cd8a6e3728e');
 const origin=new T.Vector3().setFromMatrixPosition(a.group.matrix);
 const deprojected=new T.Matrix4().makeTranslation(...origin.toArray());
 for(const n of [360,420]){
  const v=j.rows[n];
  assert(v.site==='spinnakers-low'&&v.viewName==='Chase'&&v.mode==='flight'&&v.samples===4&&v.gl===0&&
    v.localHosts.includes('Summerside Railway Station · bounded 2020 exterior preview'));
  const view=new T.Matrix4().fromArray(v.view).multiply(deprojected),p=new T.Matrix4().fromArray(v.projection);
  const mv=view.clone().multiply(model), location=new T.Vector3(...v.camera).sub(origin);
  const envelope=role.geometry.attributes.position;
  const [xs,ys]=[[],[]];
  for(let i=0;i<envelope.count;i++){
   const pos=new T.Vector4(envelope.getX(i),envelope.getY(i),envelope.getZ(i),1).applyMatrix4(mv).applyMatrix4(p);
   assert(pos.w>0);
   xs.push((1+pos.x/pos.w)*width*.5);ys.push((1-pos.y/pos.w)*height*.5);
  }
  const q=(a,b)=>[Math.floor(Math.min(...a)),Math.floor(Math.min(...b)),Math.ceil(Math.max(...a)),Math.ceil(Math.max(...b))];
  cameras['native-aperture-n'+n]={eye:location.toArray(),worldEye:location.toArray(),target:null,
   fov:2*Math.atan(1/v.projection[5])*180/Math.PI, far:v.projection[14]/(v.projection[10]+1),
   view:view.toArray(),modelView:mv.toArray(),normalView:new T.Matrix3().getNormalMatrix(mv).toArray(),
   projection:p.toArray(),clipToWorld:p.clone().multiply(view).invert().toArray(),
   directional:{direction:new T.Vector3(-.60,.74,-.31).normalize().transformDirection(view).toArray(),
    color:new T.Color(0xffedda).multiplyScalar(2.2).toArray()},
   hemi:{direction:new T.Vector3(0,1,0).transformDirection(view).toArray(),skyColor:new T.Color(0xe3eeff).multiplyScalar(1.48).toArray(),
    groundColor:new T.Color(0x78654c).multiplyScalar(1.48).toArray()},
   archivedBaseline:{frame:n,ordinarySite:v.site,archivedFramePNG:v.sha,archiveReceipt:sha(body),roofBounds:q(xs,ys),
    exactWorldViewProjection:[v.view,v.projection]}};
 }
}
const settings={layout:S.tile+'/'+S.ordinal,sourceWire:A.wireSha,sourceDecoded:A.rawSha,three:T.REVISION,viewport:[width,height],
 scope:'Detached plate visual comparison, exact shipped 3D station asset and Three r187 material GLSL in EGL. No terrain, Sky HDR/engine fog, other scene actors, native product browser or current fit.',
 studioModel:model.toArray(),cameras,exported,finish:fin};
settings.scope=settings.scope.replace('\n',' ');
writeFileSync(resolve(out,'manifest.json'),JSON.stringify(settings,null,2)+'\n',{flag:'wx'});
a.dispose();console.log('Three r187 captured genuine Standard/finish materials;',A.triangles,'tris',exported.length,'owner draws');
