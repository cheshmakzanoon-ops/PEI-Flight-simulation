import * as T from 'three';
import type {Cover} from '../../sim/cover.ts';
import {QUARTERMASTER} from '../../sim/quartermaster.generated.ts';
import {verifyDecodedCover} from '../../sim/cover-proof.ts';
import type {OlearyLink} from '../oleary-railway/program-gate.ts';
import {QUAY_SOURCE,quartermasterQuayShaders,selectQuayPositions} from './finish.ts';

type Owner=T.Mesh<T.BufferGeometry,T.ShaderMaterial>;
type Draw=T.Mesh['onBeforeRender'];
type Receiver=Readonly<{shore:Owner;land:T.Mesh;air:Readonly<{value:number}>}>;
type Inputs={
 renderer:T.WebGLRenderer; scene:T.Scene; camera:T.PerspectiveCamera;
 cover:Cover; receive:()=>Receiver|undefined; link:OlearyLink;
};
const id=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const equal=(a:readonly unknown[],b:readonly unknown[])=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const ordinary=(m:T.ShaderMaterial)=>m instanceof T.ShaderMaterial&&
 m.side===T.DoubleSide&&m.depthTest&&m.depthWrite&&m.colorWrite&&m.depthFunc===T.LessEqualDepth&&
 m.opacity===1&&m.visible&&!m.transparent&&m.blending===T.NormalBlending&&!m.wireframe&&!m.alphaHash&&
 !m.alphaToCoverage&&!m.alphaTest&&!m.polygonOffset&&!m.stencilWrite&&!m.clipping&&!m.clippingPlanes&&
 !m.lights&&!m.fog&&m.toneMapped&&!m.dithering&&m.glslVersion===null&&m.uniformsGroups.length===0&&
 Object.keys(m.defines).length===0&&m.onBeforeCompile===T.Material.prototype.onBeforeCompile&&
 m.onBeforeRender===T.Material.prototype.onBeforeRender&&m.customProgramCacheKey===T.Material.prototype.customProgramCacheKey;
function f32(g:T.BufferGeometry,key:string,size:number){
 const a=g.getAttribute(key);
 return a instanceof T.BufferAttribute&&a.array instanceof Float32Array&&a.itemSize===size&&
  a.count===QUAY_SOURCE.count&&a.array.length===a.count*size&&!a.normalized&&
  a.usage===T.StaticDrawUsage&&a.gpuType===T.FloatType?a:undefined;
}
const stamp=(a:T.BufferAttribute)=>[a,a.array,a.version,a.count,a.itemSize,a.normalized,a.usage,a.gpuType];
const bytes=async(b:ArrayBufferView)=>{
 const raw=await crypto.subtle.digest('SHA-256',new Uint8Array(b.buffer as ArrayBuffer,b.byteOffset,b.byteLength));
 return Array.from(new Uint8Array(raw),x=>x.toString(16).padStart(2,'0')).join('');
};
const text=(s:string)=>bytes(new TextEncoder().encode(s));

/** Exact active q398 curtain material only, with original geometry and no
 * shader override, global sorting, extra draws, or borrowed-texture clone.
 * A new material still has its own Three ID. Matched native neutral RGBA
 * must prove that this retains the current scene's equal-depth winners. */
export async function prepareQuartermasterQuay(input:Inputs,signal:AbortSignal){
 const {renderer:r,scene,camera,receive,cover,link}=input;
 let draft:T.ShaderMaterial|undefined,adopted=false;
 try{
  if(T.REVISION!=='187'||!globalThis.crypto?.subtle||signal.aborted)return;
  const first=receive(),harbour=cover.harbour;
  if(!first||!harbour||harbour.plan!==QUARTERMASTER||cover.sourceSha!==QUARTERMASTER.pinCoverSha256||
     harbour.bytes.byteLength!==QUARTERMASTER.decodedBytes)return;
  const {shore,land,air}=first, stock=shore.material,g=shore.geometry;
  const originalHooks=[shore.onBeforeRender,shore.onAfterRender] as const;
  if(!equal(originalHooks,[T.Object3D.prototype.onBeforeRender,T.Object3D.prototype.onAfterRender])||
     !ordinary(stock)||stock.uniforms.atmosphericLabGain!==air||air.value!==1)return;
  const p=f32(g,'position',3),u=f32(g,'uv',2);
  if(!p||!u)return;
  const posStamp=stamp(p),uvStamp=stamp(u),bound=g.boundingSphere,boundElements=bound&&[...bound.center.toArray(),bound.radius];
  if(!bound||!boundElements||!boundElements.every(Number.isFinite))return;
  const gl=r.getContext() as WebGL2RenderingContext,viewport=new T.Vector4(),size=new T.Vector2();
  const sky=scene.environment,background=scene.background,fog=scene.fog,airBytes=harbour.bytes,coverBytes=cover.bytes;
  const frame=()=>{
   const a=gl.getContextAttributes();
   if(!a?.alpha||!a.depth||!a.antialias||a.stencil||!a.premultipliedAlpha||r.getContext()!==gl||gl.isContextLost()||
      r.getRenderTarget()!==null||r.xr.isPresenting||r.shadowMap.enabled||!r.sortObjects||
      r.getScissorTest()||r.clippingPlanes.length||r.localClippingEnabled||!r.autoClear||!r.autoClearColor||!r.autoClearDepth||
      !r.capabilities.logarithmicDepthBuffer||r.capabilities.reversedDepthBuffer||camera.reversedDepth||
      camera.layers.mask!==1||r.capabilities.precision!=='highp'||r.outputColorSpace!==T.SRGBColorSpace||
      r.toneMapping!==T.ACESFilmicToneMapping||r.toneMappingExposure!==1||scene.overrideMaterial||
      scene.environment!==sky||scene.background!==background||scene.fog!==fog||
      gl.getParameter(gl.SAMPLES)!==4||gl.getParameter(gl.DEPTH_BITS)!==24||
      gl.getParameter(gl.DEPTH_CLEAR_VALUE)!==1||gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)!==null||
      gl.isEnabled(gl.STENCIL_TEST)||gl.isEnabled(gl.SCISSOR_TEST))return false;
   r.getDrawingBufferSize(size);r.getCurrentViewport(viewport);
   return size.x>0&&size.y>0&&viewport.x===0&&viewport.y===0&&viewport.z===size.x&&viewport.w===size.y&&
    camera.position.toArray().every(Number.isFinite);
  };
  const sourceV=stock.vertexShader,sourceF=stock.fragmentShader,uniforms=stock.uniforms,defines=stock.defines,version=stock.version;
  const shared=Object.entries(uniforms);
  const present=()=>{
   const q=receive();
   return !signal.aborted&&q?.shore===shore&&q.land===land&&q.air===air&&air.value===1&&
    cover.bytes===coverBytes&&cover.harbour===harbour&&harbour.bytes===airBytes&&
    shore.parent===scene&&shore.visible&&shore.layers.mask===1&&shore.renderOrder===0&&shore.frustumCulled&&
    shore.matrixAutoUpdate&&shore.matrixWorldAutoUpdate&&!shore.castShadow&&!shore.receiveShadow&&
    !shore.position.x&&!shore.position.y&&!shore.position.z&&shore.quaternion.x===0&&
    shore.quaternion.y===0&&shore.quaternion.z===0&&shore.quaternion.w===1&&
    shore.scale.x===1&&shore.scale.y===1&&shore.scale.z===1&&equal(shore.matrixWorld.elements,id)&&
    shore.geometry===g&&g.index===null&&g.indirect===null&&g.groups.length===0&&g.drawRange.start===0&&
    g.drawRange.count===Infinity&&Object.keys(g.attributes).length===2&&Object.keys(g.morphAttributes).length===0&&
    g.boundingSphere===bound&&bound.radius===boundElements[3]&&bound.center.x===boundElements[0]&&
    bound.center.y===boundElements[1]&&bound.center.z===boundElements[2]&&p===f32(g,'position',3)&&u===f32(g,'uv',2)&&
    equal(stamp(p),posStamp)&&equal(stamp(u),uvStamp)&&ordinary(stock)&&stock.version===version&&
    stock.vertexShader===sourceV&&stock.fragmentShader===sourceF&&stock.uniforms===uniforms&&stock.defines===defines&&
    Object.keys(uniforms).length===shared.length&&shared.every(([k,v])=>uniforms[k]===v);
  };
  if(!frame()||!present())return;
  const selected=selectQuayPositions(p.array as Float32Array);
  if(!selected)return;
  const actual=await Promise.all([verifyDecodedCover(cover),bytes(airBytes),bytes(p.array),bytes(u.array),bytes(selected),text(sourceV),text(sourceF)]);
  if(!equal(actual,[QUAY_SOURCE.cover,QUAY_SOURCE.harbour,QUAY_SOURCE.position,QUAY_SOURCE.uv,
   QUAY_SOURCE.selected,QUAY_SOURCE.vertex,QUAY_SOURCE.fragment])||!frame()||!present()||shore.material!==stock)return;
  const recipe=quartermasterQuayShaders(sourceV,sourceF);
  if(!recipe||'qmqGain' in uniforms)return;
  const variant=draft=new T.ShaderMaterial().copy(Object.create(stock,{uniforms:{value:{}}}) as T.ShaderMaterial);
  variant.name='Quartermaster · exact existing quay finish';
  variant.vertexShader=recipe.vertexShader;variant.fragmentShader=recipe.fragmentShader;
  let closed=false,token=0,intent=false,confirmed=false,lastDraw=0,calls=0;
  let witness:Awaited<ReturnType<OlearyLink>>;
  const gain={get value(){
   // Three r187 uploads ShaderMaterial uniforms after setProgram. The
   // detached program proof alone is not an observed real draw.
   if(!token||!intent||r.info.render.frame!==token||!witness?.()||!live(false))return 0;
   confirmed=true;
   return 1;
  }};
  const authoredUniforms:Record<string,T.IUniform>=variant.uniforms={...uniforms,qmqGain:gain},authoredVersion=variant.version;
  const shader=()=>ordinary(variant)&&variant.uniforms===authoredUniforms&&variant.version===authoredVersion&&
   variant.vertexShader===recipe.vertexShader&&variant.fragmentShader===recipe.fragmentShader&&
   authoredUniforms.qmqGain===gain&&Object.keys(authoredUniforms).length===shared.length+1&&
   shared.every(([k,v])=>authoredUniforms[k]===v);
  const before:Draw=(renderer,s,view,geometry,material,group)=>{
   intent=false;confirmed=false;
   if(renderer!==r||s!==scene||view!==camera||geometry!==g||material!==variant||group!=null||
      !token||token!==r.info.render.frame||!live(true))return;
   intent=true;variant.uniformsNeedUpdate=true;
  };
  const after:Draw=(renderer,s,view,geometry,material,group)=>{
   if(renderer===r&&s===scene&&view===camera&&geometry===g&&material===variant&&group==null&&
      intent&&confirmed&&lastDraw!==token){lastDraw=token;calls++;}
   intent=false;confirmed=false;
  };
  function live(recheckFrame:boolean){
   return !closed&&present()&&shader()&&shore.material===variant&&shore.onBeforeRender===before&&shore.onAfterRender===after&&
    (!recheckFrame||frame());
  }
  const proxy=new T.Group();proxy.add(new T.Mesh(g,variant));
  witness=await link(proxy,signal);
  const ready=()=>!closed&&!token&&frame()&&present()&&shader()&&witness?.()===true&&
   shore.material===stock&&shore.onBeforeRender===originalHooks[0]&&shore.onAfterRender===originalHooks[1];
  if(!ready())return;
  const restore=()=>{
   token=0;intent=false;confirmed=false;
   if(shore.material===variant)shore.material=stock;
   if(shore.onBeforeRender===before)shore.onBeforeRender=originalHooks[0];
   if(shore.onAfterRender===after)shore.onAfterRender=originalHooks[1];
  };
  adopted=true;
  return {
   ready,
   get draws(){return calls;},
   begin(){
    if(!ready())return;
    try{
     token=r.info.render.frame+1;
     shore.material=variant;shore.onBeforeRender=before;shore.onAfterRender=after;
     return restore;
    }catch{restore();return;}
   },
   dispose(){if(!closed){closed=true;restore();variant.dispose();}},
  };
 }catch{return;}
 finally{if(!adopted)draft?.dispose();}
}
