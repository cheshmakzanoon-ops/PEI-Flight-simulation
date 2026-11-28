/** Read-only Three r187 stock-vs-additive packet with exact source texture bytes. */
import * as T from 'three';
import {WebGLProgram} from 'three/src/renderers/webgl/WebGLProgram.js';
import {getDFGLUT} from 'three/src/renderers/shaders/DFGLUTData.js';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {makeClarkeFrontWithDisplayBench,CLARKE_DISPLAY_BENCH} from '../orwell-display-bench.ts';

assert.equal(T.REVISION,'187');
assert.ok(process.argv[2],'give a fresh packet directory');
const path=resolve(process.argv[2]);mkdirSync(path);
const hash=x=>createHash('sha256').update(x).digest('hex'), assets=new Set();
function seal(v,ext){
 const q=typeof v==='string'?Buffer.from(v):Buffer.from(v.buffer,v.byteOffset,v.byteLength);
 const sha=hash(q),name=sha+'.'+ext;
 if(!assets.has(name)){assets.add(name);writeFileSync(resolve(path,name),q,{flag:'wx'});}
 return {file:name,sha,bytes:q.byteLength};
}
const lut=getDFGLUT(),i=lut.image;
assert.ok(i.data instanceof Uint16Array&&i.width===16&&i.height===16&&i.data.length===512);
assert.ok(lut.format===T.RGFormat&&lut.type===T.HalfFloatType&&lut.wrapS===T.ClampToEdgeWrapping&&
 lut.wrapT===T.ClampToEdgeWrapping&&lut.magFilter===T.LinearFilter&&lut.minFilter===T.LinearFilter&&
 !lut.flipY&&!lut.generateMipmaps&&lut.colorSpace===T.NoColorSpace&&lut.unpackAlignment===1);
const literal=Buffer.alloc(1024);i.data.forEach((u,n)=>literal.writeUInt16LE(u,n*2));
const dfg=seal(literal,'rg16f');assert.equal(dfg.sha,'b41ba8e2bd29fa007dfbf034d4d58b853f378062183847846b1f6d228f2c7e79');
const gl={
 VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,createProgram:()=>({}),createShader:k=>({k}),
 shaderSource:(s,c)=>{s.code=c;},compileShader(){},attachShader(){},linkProgram(){},deleteShader(){},bindAttribLocation(){},
};
function shader(m,marker){
 const base=T.ShaderLib[m.isMeshPhysicalMaterial?'physical':'standard'];
 const q={vertexShader:base.vertexShader,fragmentShader:base.fragmentShader,uniforms:T.UniformsUtils.clone(base.uniforms)};
 m.onBeforeCompile(q,undefined);
 if(marker!==null){
  const t='#include <dithering_fragment>';assert.equal(q.fragmentShader.split(t).length,2);
  q.fragmentShader=q.fragmentShader.replace(t,t+'\ngl_FragColor=vec4('+marker+',1.);');
 }
 const options={vertexShader:q.vertexShader,fragmentShader:q.fragmentShader,defines:m.defines,vertexColors:true,opaque:true,
   doubleSided:false,shaderType:m.type,shaderName:'OrwellBenchStudio',precision:'highp',map:!!m.map,mapUv:m.map?'uv':'',
   normalMap:!!m.normalMap,normalMapTangentSpace:!!m.normalMap,normalMapUv:m.normalMap?'uv':'',roughnessMap:!!m.roughnessMap,roughnessMapUv:m.roughnessMap?'uv':'',
   clearcoat:m.isMeshPhysicalMaterial&&m.clearcoat>0,fog:false,envMap:false,logarithmicDepthBuffer:true,numSunLights:0,
   numSunLightShadows:0,numLightProbeGrids:0,numDirLights:1,numHemiLights:1,numPointLights:0,numSpotLights:0,numSpotLightMaps:0,numRectAreaLights:0,
   numDirLightShadows:0,numPointLightShadows:0,numSpotLightShadows:0,numSpotLightShadowsWithMaps:0,
   numLightProbes:0,numClippingPlanes:0,numClipIntersection:0,toneMapping:T.ACESFilmicToneMapping,outputColorSpace:T.SRGBColorSpace,
   rendererExtensionParallelShaderCompile:false};
 const p=new WebGLProgram({getContext:()=>gl},m.customProgramCacheKey(),options,{});
 return {vertex:seal(p.vertexShader.code,'vert'),fragment:seal(p.fragmentShader.code,'frag')};
}
const textures=new Map();
function authoredSurface(t,k){
 if(textures.has(t))return textures.get(t);
 assert.ok(t.isDataTexture&&t.image.width===256&&t.image.height===256&&t.image.data instanceof Uint8Array);
 assert.ok(t.colorSpace===(k==='map'?T.SRGBColorSpace:T.NoColorSpace)&&t.channel===0&&t.unpackAlignment===1&&!t.flipY);
 assert.ok(t.format===T.RGBAFormat&&t.type===T.UnsignedByteType&&t.wrapS===T.RepeatWrapping&&t.wrapT===T.RepeatWrapping&&
  t.magFilter===T.LinearFilter&&t.minFilter===T.LinearMipmapLinearFilter&&t.anisotropy===6&&t.generateMipmaps);
 t.updateMatrix();const p={data:seal(t.image.data,'u8'),srgb:k==='map',size:[256,256],anisotropy:6,transform:t.matrix.elements};
 textures.set(t,p);return p;
}
const root=makeClarkeFrontWithDisplayBench(),parts=[];
for(let i=0;i<root.children.length;i++)for(const o of root.children[i].children){
 const m=o.material,added=i===1;
 const area=added?(o.name==='bench-ends'?'1.,0.,0.':'0.,1.,0.'):'0.,0.,0.';
 const protect=!added&&['glazing','deck','portal-timber'].includes(o.name)?'0.,0.,1.':'0.,0.,0.';
 const attr=Object.fromEntries(Object.entries(o.geometry.attributes).map(([a,p])=>[a,seal(p.array,'f32')]));
 assert.equal(o.geometry.index,null);
 const maps=Object.fromEntries(['map','normalMap','roughnessMap'].filter(k=>m[k]).map(k=>[k,authoredSurface(m[k],k)]));
 if(added)assert.deepEqual(maps,{});
 parts.push({name:o.name,added,tris:o.geometry.attributes.position.count/3,attr,normal:shader(m,null),marker:shader(m,area),protected:shader(m,protect),maps,
   material:{diffuse:m.color.toArray(),roughness:m.roughness,metalness:m.metalness,emissive:m.emissive.toArray(),
   normalScale:m.normalScale.toArray(),clearcoat:m.clearcoat??0,clearcoatRoughness:m.clearcoatRoughness??0,ior:m.ior??1.5,
   specularIntensity:m.specularIntensity??1,specularColor:m.specularColor?.toArray()??[1,1,1]}});
}
const W=840,H=580,far=85;
const cameras=Object.fromEntries(Object.entries({
 lowEntry:{eye:[-1.40,1.43,7.03],target:[-.35,1.61,.07],fov:41.5},
 lowAisle:{eye:[2.18,1.04,7.34],target:[-.01,1.40,.10],fov:38.7},
}).map(([name,{eye,target,fov}])=>{
 const c=new T.PerspectiveCamera(fov,W/H,.08,far);
 c.position.set(...eye);c.lookAt(...target);c.updateMatrixWorld(true);
 const cv=c.matrixWorldInverse,sun=new T.Vector3(-.43,.78,.49).normalize().transformDirection(cv);
 return [name,{eye,target,fov,view:cv.elements,normalView:new T.Matrix3().getNormalMatrix(cv).elements,
  projection:c.projectionMatrix.elements,clipWorld:c.projectionMatrix.clone().multiply(cv).invert().elements,
  sun:{direction:sun.toArray(),color:new T.Color(0xffe7cc).multiplyScalar(2.05).toArray()},
  hemi:{direction:new T.Vector3(0,1,0).transformDirection(cv).toArray(),skyColor:new T.Color(0xe3ecff).multiplyScalar(1.68).toArray(),
        groundColor:new T.Color(0x9d7f6a).multiplyScalar(.96).toArray()}}];
}));
writeFileSync(resolve(path,'manifest.json'),JSON.stringify({three:T.REVISION,view:[W,H],far,dfg,cameras,parts,
 floorY:CLARKE_DISPLAY_BENCH.studioBottomY,shadowX:CLARKE_DISPLAY_BENCH.studioFootX,shadowZ:CLARKE_DISPLAY_BENCH.studioFootZ,source:'Strict original geometry and generated maps, separate neutral workshop environment, no donor pixels.'},null,2)+'\n',{flag:'wx'});
console.log(parts.reduce((a,p)=>[a[0]+(!p.added?p.tris:0),a[1]+(p.added?p.tris:0)], [0,0]));
