/** Export an actual emitted Three r187 standard programme and authored mesh, no WebGL mock result. */
import * as T from 'three';
import {WebGLProgram} from 'three/src/renderers/webgl/WebGLProgram.js';
import {getDFGLUT} from 'three/src/renderers/shaders/DFGLUTData.js';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {makeKentSide2016,KENT_LOWER} from '../inn-kent-lower.ts';
const path=resolve(process.argv[2]??'fixture');mkdirSync(path);
assert.equal(T.REVISION,'187');
const hash=x=>createHash('sha256').update(x).digest('hex'), assets=new Set();
const seal=(v,ext)=>{
 const q=typeof v==='string'?Buffer.from(v):Buffer.from(v.buffer,v.byteOffset,v.byteLength);
 const sha=hash(q),name=sha+'.'+ext;
 if(!assets.has(name)){assets.add(name);writeFileSync(resolve(path,name),q,{flag:'wx'});}
 return {file:name,sha,bytes:q.byteLength};
};
const lut=getDFGLUT(),i=lut.image;
assert.ok(i.data instanceof Uint16Array&&i.width===16&&i.height===16&&i.data.length===512);
assert.ok(lut.format===T.RGFormat&&lut.type===T.HalfFloatType&&lut.wrapS===T.ClampToEdgeWrapping&&
 lut.wrapT===T.ClampToEdgeWrapping&&lut.magFilter===T.LinearFilter&&lut.minFilter===T.LinearFilter&&
 !lut.flipY&&!lut.generateMipmaps&&lut.colorSpace===T.NoColorSpace&&lut.unpackAlignment===1);
const literal=Buffer.alloc(1024);i.data.forEach((u,n)=>literal.writeUInt16LE(u,n*2));
const dfg=seal(literal,'rg16f'); assert.equal(dfg.sha,'b41ba8e2bd29fa007dfbf034d4d58b853f378062183847846b1f6d228f2c7e79');
const gl={
 VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,createProgram:()=>({}),createShader:k=>({k}),
 shaderSource:(s,c)=>{s.code=c;},compileShader(){},attachShader(){},linkProgram(){},deleteShader(){},bindAttribLocation(){},
};
function shader(m,marker){
 const q={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,
  uniforms:T.UniformsUtils.clone(T.ShaderLib.standard.uniforms)};
 m.onBeforeCompile(q,undefined);
 if(marker!==null){
  const t='#include <dithering_fragment>';assert.equal(q.fragmentShader.split(t).length,2);
  q.fragmentShader=q.fragmentShader.replace(t,t+'\ngl_FragColor=vec4('+marker+',1.);');
 }
 const options={vertexShader:q.vertexShader,fragmentShader:q.fragmentShader,defines:m.defines,vertexColors:false,opaque:true,
   doubleSided:false,shaderType:m.type,shaderName:'KentStudio',precision:'highp',map:false,mapUv:'uv',fog:false,
   envMap:false,logarithmicDepthBuffer:true,numSunLights:0,numSunLightShadows:0,numLightProbeGrids:0,
   numDirLights:1,numHemiLights:1,numPointLights:0,numSpotLights:0,numSpotLightMaps:0,numRectAreaLights:0,
   numDirLightShadows:0,numPointLightShadows:0,numSpotLightShadows:0,numSpotLightShadowsWithMaps:0,
   numLightProbes:0,numClippingPlanes:0,numClipIntersection:0,
   toneMapping:T.ACESFilmicToneMapping,outputColorSpace:T.SRGBColorSpace,rendererExtensionParallelShaderCompile:false};
 const p=new WebGLProgram({getContext:()=>gl},m.customProgramCacheKey(),options,{});
 return {vertex:seal(p.vertexShader.code,'vert'),fragment:seal(p.fragmentShader.code,'frag')};
}
const root=makeKentSide2016(), parts=[];
for(let i=0;i<root.children.length;i++)for(const o of root.children[i].children){
 const m=o.material,r=o.userData.role,added=i===1;
 const mask=added?({hood:'1.,0.,0.',hoodShadow:'1.,0.,0.',case:'0.,1.,0.',glass:'0.,0.,1.'}[r]??'.25,.25,.25'):'0.,0.,0.';
 const attr=Object.fromEntries(Object.entries(o.geometry.attributes).map(([a,p])=>[a,seal(p.array,'f32')]));
 assert.equal(o.geometry.index,null);
 parts.push({name:o.name,role:r,added,tris:o.geometry.attributes.position.count/3,attr,normal:shader(m,null),marker:shader(m,mask),
   diffuse:m.color.toArray(),roughness:m.roughness,metalness:m.metalness,emissive:m.emissive.toArray()});
}
const W=900,H=660,far=220;
const cameras=Object.fromEntries(Object.entries({
 front:{eye:[.75,5.40,24.9],target:[0,4.20,0],fov:28.5},
 oblique:{eye:[9.0,4.15,21.2],target:[-.28,4.18,0],fov:31.0},
}).map(([name,{eye,target,fov}])=>{
 const c=new T.PerspectiveCamera(fov,W/H,.18,far);
 c.position.set(...eye); c.lookAt(...target); c.updateMatrixWorld(true);
 const cv=c.matrixWorldInverse, sun=new T.Vector3(-.43,.78,.49).normalize().transformDirection(cv);
 return [name,{eye,target,fov,view:cv.elements,normalView:new T.Matrix3().getNormalMatrix(cv).elements,
  projection:c.projectionMatrix.elements,clipWorld:c.projectionMatrix.clone().multiply(cv).invert().elements,
  sun:{direction:sun.toArray(),color:new T.Color(0xffeddd).multiplyScalar(2.0).toArray()},
  hemi:{direction:new T.Vector3(0,1,0).transformDirection(cv).toArray(),skyColor:new T.Color(0xe5efff).multiplyScalar(1.54).toArray(),
        groundColor:new T.Color(0x9e8f79).multiplyScalar(.92).toArray()}}];
}));
writeFileSync(resolve(path,'manifest.json'),JSON.stringify({three:T.REVISION,view:[W,H],far,dfg,cameras,parts,
 floorY:KENT_LOWER.specimenBottomY,source:'Untouched prior upper + authored historical Kent lower; no photography, dates/rights in README.'},null,2)+'\n',{flag:'wx'});
console.log(parts.reduce((a,p)=>[a[0]+(!p.added?p.tris:0),a[1]+(p.added?p.tris:0)], [0,0]));
