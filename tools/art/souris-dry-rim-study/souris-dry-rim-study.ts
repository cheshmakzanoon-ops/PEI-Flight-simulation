/** Private diagnostic only. No automatic scene, render, or app registration. */
import * as T from 'three';
import {SOURIS_DRY_RIM_PACKET as P} from './souris-dry-rim.generated.ts';

export const SOURIS_DRY_RIM_NAME='Souris dry rim background continuation study';
export const SOURIS_DRY_RIM_GAIN='sourisDryRimActive';
export const SOURIS_DRY_RIM_MARKER_ANCHOR='gl_FragDepth=1.0;';
const BASE='0310018adbfc058c02372e855ed5b5e36b6aaa7b56aebd268b9cce89a1a0ee4b';
const AERIAL='0e92b2fc24304ed5f47942b9581459391582224ee0dc96400a2caa1d98b92c66';
const CLIFF_V='a71f9476607f8cb5313693f8558281963fdffa6ec6cbc0c8591010505eba9496';
// Exact submitted default Standard VBO from q366 at both ordinary positive
// phases. The simplified geometry-only CPU World differs elsewhere in this
// aggregate; that CPU digest is NOT an accepted renderer family.
// Exact observed browser matrix (not the offline construction matrix). Both
// quantize to the same uploaded Float32 values. Other hosts remain unproved.
const ACTUAL_CURRENT_TERRAIN_MATRIX=[1,0,0,0,0,1,0,0,0,0,1,0,70069.85458453854,0,18291.05105404871,1] as const;
const ACTUAL_CURRENT_SHORE='06f252ddf1dbec866f3cf893f79facede0de44f930a97cfbbfb89eff2852dd50';
const COVER='e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9';
const HEIGHT='661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d';
const SOURCE_COAST='b13b932509ccb4828eba54ed2753e3ad487d10c4ac9dd54f6ff188f0edfc1510';
const SKY_V='f65c08a3dd783f22adb0a2facbe33fd6ea52aaf36a6d2b8422b0b9fe0c83d36a';
const SKY_F=['53d93c6dab57a30eb3f4b5c5f43091713af41eaab73ce05d009cf82e6643b293',
 '8135647a5a8cc183683f2a217b78bb0419fe2a4ada60967035655ddcf9e06750'] as const;
const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const QS='#include <logdepthbuf_fragment>',COLOR='#include <colorspace_fragment>';
const ORDER=1000000000;
const encode=new TextEncoder();
type Scalar={value:number};
const sha=async(v:Uint8Array<ArrayBuffer>)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',v)),
 x=>x.toString(16).padStart(2,'0')).join('');
const bytes=(a:T.BufferAttribute)=>{
 const v=a.array;
 if(!(v.buffer instanceof ArrayBuffer))throw Error('Unexpected shared buffer');
 return new Uint8Array(v.buffer,v.byteOffset,v.byteLength);
};
const eq=(a:readonly unknown[],b:readonly unknown[])=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const vec3=(o:T.Object3D)=>[o.position.x,o.position.y,o.position.z, o.scale.x,o.scale.y,o.scale.z, o.quaternion.x,o.quaternion.y,o.quaternion.z,o.quaternion.w];
function meshAt(o:T.Mesh,scene:T.Scene,matrix:readonly number[]){
 return o.parent===scene&&o.isMesh&&o.visible&&o.layers.mask===1&&o.matrixAutoUpdate&&o.matrixWorldAutoUpdate&&
  eq(o.matrixWorld.elements,matrix)&&eq(vec3(o),[...matrix.slice(12,15),1,1,1,0,0,0,1]);
}
function att(g:T.BufferGeometry,n:string,size:number,count:number){
 const a=g.getAttribute(n);
 return a instanceof T.BufferAttribute&&a.array instanceof Float32Array&&a.itemSize===size&&
  a.count===count&&!a.normalized?a:undefined;
}
const attrStamp=(a:T.BufferAttribute)=>[a,a.array,a.itemSize,a.count,a.version,a.normalized];
function geometryFlags(g:T.BufferGeometry){
 return g.groups.length===0&&g.drawRange.start===0&&g.drawRange.count===Infinity&&g.indirect===null&&
   Object.keys(g.morphAttributes).length===0;
}
function matStamp(m:T.ShaderMaterial){
 return [m,m.vertexShader,m.fragmentShader,m.uniforms,m.version,m.defines,JSON.stringify(m.defines),m.side,m.transparent,
  m.colorWrite,m.depthWrite,m.depthTest,m.stencilWrite,m.opacity,m.blending,m.precision,m.allowOverride,m.toneMapped,
  m.depthFunc,m.polygonOffset,m.alphaToCoverage,m.glslVersion,
  ...Object.entries(m.uniforms).flatMap(([k,v])=>[k,v]),m.uniformsGroups.length];
}
const stockDraw=(m:T.Material)=>m.visible&&m.colorWrite&&m.depthWrite&&m.depthTest&&!m.transparent&&!m.polygonOffset&&
  !m.stencilWrite&&!m.alphaToCoverage&&m.opacity===1&&m.depthFunc===T.LessEqualDepth;
export type SourisDryRimSource={
 scene:T.Scene;
 renderer:T.WebGLRenderer;
 coast:T.Mesh;
 ground:T.Mesh;
 sky:T.Mesh;
 ocean:T.Mesh;
 cover:Uint8Array<ArrayBuffer>;
 verifiedTerrainSHA:string;
 liveSeam:()=>string|undefined;
 stockAtmosphericGain?:Scalar;
 /** Must attest normal Standard with original active two-span Souris repair, no optional host conflicts. */
 standardStillValid:()=>boolean;
};
type Item={object:T.Object3D|null;geometry:T.BufferGeometry|null;material:T.Material|null;group:unknown};
export type ResolveSourisDiagnosticRenderList=(list:Readonly<{
 opaque:readonly Item[];transmissive:readonly Item[];transparent:readonly Item[];
 }>,camera:T.PerspectiveCamera,actor:T.Mesh)=>boolean;

export function createDetachedDryRimGeometry(){
 const a=new T.BufferGeometry();
 a.setAttribute('position',new T.Float32BufferAttribute(P.position,3));
 a.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(2*P.position.length/3),2));
 a.computeBoundingBox();a.computeBoundingSphere();
 return a;
}
function makeBackgroundShader(donor:T.ShaderMaterial,pass:Scalar){
 if(donor.fragmentShader.split(QS).length!==2||donor.fragmentShader.split(COLOR).length!==2||
    !donor.fragmentShader.trimEnd().endsWith(COLOR+'\n}')|| donor.fragmentShader.includes('gl_FragDepth')||
    SOURIS_DRY_RIM_GAIN in donor.uniforms||donor.uniformsGroups.length)return;
 // Clone scalar/matrix settings but do not clone any of the shared texture
 // sources (Three copy() of texture uniforms can bump their source versions).
 const bridge=Object.create(donor) as T.ShaderMaterial;
 Object.defineProperty(bridge,'uniforms',{value:Object.freeze({})});
 const m=new T.ShaderMaterial().copy(bridge);
 m.uniforms={...donor.uniforms,[SOURIS_DRY_RIM_GAIN]:pass};
 m.fragmentShader='uniform highp float '+SOURIS_DRY_RIM_GAIN+';\n'+donor.fragmentShader
  .replace(QS,`if(${SOURIS_DRY_RIM_GAIN}!=1.)discard;\n ${QS}`)
  .replace(COLOR,COLOR+'\n '+SOURIS_DRY_RIM_MARKER_ANCHOR);
 m.allowOverride=false;m.depthTest=true;m.depthFunc=T.EqualDepth;m.depthWrite=false;m.blending=T.NoBlending;
 m.name=SOURIS_DRY_RIM_NAME+' shader';
 return m;
}

/** Diagnostic, not a production lease. Inputs are already owned by the private runner.
 * Never adds to the scene, starts compilation, changes any old owners or runs a render.
 * The runner must add only the returned mesh and independently qualify every active draw.
 */
export async function prepareDetachedSourisDryRimStudy(src:SourisDryRimSource){
 try{
  if(T.REVISION!=='187'||!globalThis.crypto?.subtle||src.verifiedTerrainSHA!==HEIGHT||
     src.cover.byteLength!==4096*2720*2||!src.standardStillValid()||src.liveSeam()!==P.terrain.seams)return;
  const {renderer,scene,ground,coast,ocean,sky,stockAtmosphericGain:air}=src,
   gl=renderer.getContext() as WebGL2RenderingContext;
  const origShore=coast.geometry,origGround=ground.geometry,origOcean=ocean.geometry,origSky=sky.geometry;
  const mats=[coast.material,ground.material,ocean.material,sky.material];
  if(!mats.every((m):m is T.ShaderMaterial=>m instanceof T.ShaderMaterial))return;
  const [shoreMat,groundMat,seaMat,skyMat]=mats;
  const steadyTerrain=matStamp(groundMat),steadyWater=matStamp(seaMat),steadyShore=matStamp(shoreMat),steadySky=matStamp(skyMat);
  const p=att(origShore,'position',3,3162),u=att(origShore,'uv',2,3162),v=att(origGround,'position',3,12769),w=att(origGround,'uv',2,12769),j=origGround.index;
  if(!p||!u||!v||!w||!(j instanceof T.BufferAttribute&&j.array instanceof Uint16Array&&j.itemSize===1&&j.count===75264&&!j.normalized))return;
  const ps=[p,u,v,w,j], incoming=ps.flatMap(attrStamp),cover=src.cover;
  const skyScalar=skyMat.uniforms.skyDiagnostic,skyNormal=()=>typeof skyScalar?.value==='number'&&
   sky.parent===scene&&sky.visible&&!sky.frustumCulled&&sky.layers.mask===1&&sky.renderOrder===-10&&
   sky.geometry===origSky&&sky.material===skyMat&&!skyMat.depthTest&&!skyMat.depthWrite&&!skyMat.transparent&&
   skyMat.colorWrite&&!skyMat.stencilWrite&&skyMat.opacity===1;
  const airOk=(m:T.ShaderMaterial)=>air===undefined||air.value===1&&m.uniforms.atmosphericLabGain===air;
  const waterScalar=seaMat.uniforms.sourisWaterTie;
  function sourceStill(){
   return src.standardStillValid()&&src.verifiedTerrainSHA===HEIGHT&&src.liveSeam()===P.terrain.seams&&
    src.cover===cover&&src.stockAtmosphericGain===air&&
    coast.name==='shore-to-sea surface'&&meshAt(coast,scene,I)&&meshAt(ground,scene,ACTUAL_CURRENT_TERRAIN_MATRIX)&&
    coast.geometry===origShore&&coast.material===shoreMat&&ground.geometry===origGround&&ground.material===groundMat&&
    ocean.parent===scene&&ocean.visible&&ocean.geometry===origOcean&&ocean.material===seaMat&&ocean.position.y===P.terrain.stockOCEAN&&waterScalar?.value===1&&
    !origShore.index&&geometryFlags(origShore)&&geometryFlags(origGround)&&origGround.index===j&&
    origShore.getAttribute('position')===p&&origShore.getAttribute('uv')===u&&
    origGround.getAttribute('position')===v&&origGround.getAttribute('uv')===w&&eq(ps.flatMap(attrStamp),incoming)&&
    eq(matStamp(groundMat),steadyTerrain)&&eq(matStamp(seaMat),steadyWater)&&eq(matStamp(shoreMat),steadyShore)&&eq(matStamp(skyMat),steadySky)&&
    stockDraw(shoreMat)&&shoreMat.side===T.DoubleSide&&skyNormal()&&[shoreMat,groundMat,seaMat,skyMat].every(airOk);
  }
  const sz=new T.Vector2(),view=new T.Vector4();
  function normalDefaultRaster(){
   const a=gl.getContextAttributes();
   if(!a||!a.alpha||!a.antialias||!a.depth||a.stencil||!a.premultipliedAlpha||!('createVertexArray' in gl)||
      renderer.getContext()!==gl||gl.isContextLost()||gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)!==null||
      gl.getParameter(gl.DEPTH_BITS)!==24||gl.getParameter(gl.DEPTH_CLEAR_VALUE)!==1||gl.getParameter(gl.SAMPLES)!==4||
      [gl.RED_BITS,gl.GREEN_BITS,gl.BLUE_BITS,gl.ALPHA_BITS].some(k=>gl.getParameter(k)!==8)||
      gl.isEnabled(gl.SCISSOR_TEST)||gl.isEnabled(gl.STENCIL_TEST)||renderer.getRenderTarget()!==null||
      !renderer.autoClear||!renderer.autoClearColor||!renderer.autoClearDepth||!renderer.sortObjects||
      renderer.localClippingEnabled||renderer.clippingPlanes.length||scene.overrideMaterial||renderer.xr.isPresenting||
      renderer.getScissorTest()||renderer.capabilities.reversedDepthBuffer||!renderer.capabilities.logarithmicDepthBuffer||
      renderer.capabilities.precision!=='highp')return false;
   renderer.getDrawingBufferSize(sz);renderer.getCurrentViewport(view);
   return view.x===0&&view.y===0&&view.z===sz.x&&view.w===sz.y&&sz.x>0&&sz.y>0;
  }
  if(!sourceStill()||!normalDefaultRaster())return;
  const K=P.terrain;
  const d=await Promise.all([sha(cover),...ps.map(a=>sha(bytes(a))),sha(bytes(p).subarray(P.shoreSpan[0]*12,P.shoreSpan[1]*12)),
   ...[shoreMat.vertexShader,shoreMat.fragmentShader,skyMat.vertexShader,skyMat.fragmentShader].map(s=>sha(encode.encode(s)))]);
  if(!eq(d,[COVER,ACTUAL_CURRENT_SHORE,K.oldUV,K.terrainPosition,P.currentTerrainUV,K.terrainEBO,P.originalRow,CLIFF_V,air?AERIAL:BASE,SKY_V,SKY_F[air?1:0]])||
    !sourceStill()||!normalDefaultRaster())return;
  const active={value:0},initial=makeBackgroundShader(shoreMat,active);if(!initial)return;
  const m:T.ShaderMaterial=initial;
  const g=createDetachedDryRimGeometry(),mesh=new T.Mesh(g,m);
  mesh.name=SOURIS_DRY_RIM_NAME;mesh.visible=false;mesh.renderOrder=ORDER;mesh.castShadow=false;mesh.receiveShadow=false;
  const pp=g.getAttribute('position') as T.BufferAttribute,uu=g.getAttribute('uv') as T.BufferAttribute;
  const ownMat=matStamp(m),own=[...attrStamp(pp),...attrStamp(uu)];
  const veto=()=>{active.value=0;g.setDrawRange(pp.count+1,0);m.uniformsNeedUpdate=true;};
  type Frame={camera:T.PerspectiveCamera;next:number;stampM:number[];stampP:number[];review:ResolveSourisDiagnosticRenderList;used:boolean};
  let ready:Frame|undefined,dead=false;
  function reset(){ready=undefined;mesh.visible=false;veto();}
  function unchanged(){
   return eq(matStamp(m),ownMat)&&eq(own,[...attrStamp(pp),...attrStamp(uu)])&&g.getAttribute('position')===pp&&g.getAttribute('uv')===uu&&
    pp.array.every((v,j)=>v===P.position[j])&&uu.array.every(v=>v===0)&&typeof active.value==='number'&&
    !g.index&&!g.groups.length&&g.indirect===null&&m.uniforms[SOURIS_DRY_RIM_GAIN]===active&&m.depthFunc===T.EqualDepth&&m.depthTest&&!m.depthWrite&&
    !m.allowOverride&&m.blending===T.NoBlending&&meshAt(mesh,scene,I)&&mesh.geometry===g&&mesh.material===m&&mesh.renderOrder===ORDER&&
    !mesh.castShadow&&!mesh.receiveShadow&&mesh.frustumCulled;
  }
  mesh.onBeforeRender=(r,s,c,gg,mm,group)=>{
   veto();
   const a=ready;
   if(!a||a.used)return;
   try{
    if(dead||r!==renderer||s!==scene||c!==a.camera||gg!==g||mm!==m||group!==null||
      renderer.info.render.frame!==a.next||!unchanged()||!sourceStill()||!normalDefaultRaster()||
      !eq(c.matrixWorldInverse.elements,a.stampM)||!eq(c.projectionMatrix.elements,a.stampP))return;
    const list=renderer.renderLists.get(scene,0),f=list.opaque,last=f.at(-1);
    const get=(o:T.Mesh,k:T.BufferGeometry,mat:T.Material)=>f.filter(e=>e.object===o&&e.geometry===k&&e.material===mat&&e.group===null).length===1;
    if(f.length>1024||!last||last.object!==mesh||last.geometry!==g||last.material!==m||last.group!==null||
       f[0]?.object!==sky||!get(sky,origSky,skyMat)||!get(ground,origGround,groundMat)||
       !get(coast,origShore,shoreMat)||!get(ocean,origOcean,seaMat)||list.transmissive.length||
       a.review(list,a.camera,mesh)!==true||!unchanged()||!sourceStill()||!normalDefaultRaster())return;
    a.used=true;
    g.setDrawRange(0,pp.count);active.value=1;m.uniformsNeedUpdate=true;
   }catch{/* no private callback can fault the stock render */}
  };
  mesh.onAfterRender=()=>{veto();};
  veto();
  return Object.freeze({
   mesh,proof:Object.freeze({position:P.positionSHA,uv:P.uvSHA,triangleCount:P.numTriangles,terrain:P.terrain.terrainPosition,
    sourceLand:SOURCE_COAST,originalSpan:P.shoreSpan,depthAndWorldUnchanged:true,diagnosticOnly:true}),
   begin(camera:T.PerspectiveCamera,review:ResolveSourisDiagnosticRenderList){
    try{
     if(dead||ready||mesh.parent!==scene||!camera.isPerspectiveCamera||camera.reversedDepth||camera.layers.mask!==1||
        !camera.matrixWorldAutoUpdate||!sourceStill()||!normalDefaultRaster()||
        typeof review!=='function'||Math.hypot(camera.position.x-72688,camera.position.z-P.z)>720||
        !(camera.position.y>=12&&camera.position.y<=245))return;
     const issued={camera,next:renderer.info.render.frame+1,stampM:camera.matrixWorldInverse.elements.slice(),stampP:camera.projectionMatrix.elements.slice(),review,used:false};
     ready=issued;mesh.visible=true;
     return ()=>{if(ready===issued)reset();};
    }catch{/* no callback may disturb an original draw */}
   },
   dispose(){if(dead)return;dead=true;reset();mesh.removeFromParent();g.dispose();m.dispose();}
  });
 }catch{/* Any uncertain private basis leaves the whole current scene unchanged. */}
}
