import * as T from 'three';
import { opaqueCoverageBlend } from './opaque-coverage-alpha.ts';
import { olearyLinkPrograms, type OlearyProgramProof } from './oleary-railway/program-gate.ts';

/** The strict same-XZ layer has no depth, navigation or terrain ownership.
 * Keep it behind the retained opaque world, immediately after real sky. */
export const CAPE_TRYON_SKY_SEAT = Object.freeze([
 -7.623687744140625,4.88040018081665,2.797260284423828,-41.837310791015625,5.59915018081665,15.350818634033203,-41.837310791015625,7.029837131500244,15.350818634033203,
 -41.837310791015625,5.59915018081665,15.350818634033203,-47.50859069824219,5.71829080581665,17.43170738220215,-41.837310791015625,7.029837131500244,15.350818634033203,
 -41.837310791015625,7.029837131500244,15.350818634033203,-47.50859069824219,5.71829080581665,17.43170738220215,-47.50859069824219,7.24971342086792,17.43170738220215,
]);

const origin=[-23443.888671875,0,-3876.2265625] as const;
const ownMatrix=[1,0,0,0,0,1,0,0,0,0,1,0,...origin,1];
const matrix16=[1,0,0,0,0,1,0,0,0,0,1,0,-21325.607917033114,0,-5153.832064952882,1];
const identity16=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const digests=[
 'c1ac4eb2b236e5b35a514c05b6b35cc360bf3d2174c48b3b7d0ada14ebf28581',
 'd8bd47c513d2d4797a004d5d488a5e591ff48f4d91f71a07532f7d9e4807234a',
 '9528113580bec53f9f64caae69f51aef5aa52aeb8bed78842dc87d8796353d5e',
 '33871cac1ee31a2c5e4cb22b35de67f6cf10e53758d3c0784b83790caee5fffa',
];
// Exact shader sources emitted by the existing scene, in either approved
// base or aerial form. Keep the known opaque alpha contract of the sky.
const SOURCE_ABI={skyVertex:'f65c08a3dd783f22adb0a2facbe33fd6ea52aaf36a6d2b8422b0b9fe0c83d36a',
 sky:['53d93c6dab57a30eb3f4b5c5f43091713af41eaab73ce05d009cf82e6643b293',
  '8135647a5a8cc183683f2a217b78bb0419fe2a4ada60967035655ddcf9e06750'],
 cliffVertex:'a71f9476607f8cb5313693f8558281963fdffa6ec6cbc0c8591010505eba9496',
 cliff:['0310018adbfc058c02372e855ed5b5e36b6aaa7b56aebd268b9cce89a1a0ee4b',
  '0e92b2fc24304ed5f47942b9581459391582224ee0dc96400a2caa1d98b92c66'],
};
const textDigest=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),
 v=>v.toString(16).padStart(2,'0')).join('');
const vertexAnchor='gl_Position=projectionMatrix*viewMatrix*w;',fragAnchor='void main(){';
const phi='tryonSkySeatAllowed';
const eq=(a:readonly unknown[],b:readonly unknown[])=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const hash=async (p:T.BufferAttribute)=>{
 const a=p.array;if(!(a.buffer instanceof ArrayBuffer))return;
 const bytes=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
};
const covered=(m:T.Material)=>m.blending===T.NoBlending||m.blending===T.NormalBlending||(
 m.blending===opaqueCoverageBlend.blending&&m.blendEquation===opaqueCoverageBlend.blendEquation&&
 m.blendSrc===opaqueCoverageBlend.blendSrc&&m.blendDst===opaqueCoverageBlend.blendDst&&
 m.blendEquationAlpha===opaqueCoverageBlend.blendEquationAlpha&&m.blendSrcAlpha===opaqueCoverageBlend.blendSrcAlpha&&m.blendDstAlpha===opaqueCoverageBlend.blendDstAlpha);
export function ordinarySkySeatOwner(m:T.Material){
 return !m.transparent&&m.colorWrite&&m.depthTest&&m.depthWrite&&m.opacity===1&&
  (m.depthFunc===T.LessEqualDepth||m.depthFunc===T.LessDepth)&&!m.stencilWrite&&covered(m);
}

type StageState='pending'|'checking'|'ready'|'mounted'|'stock-source'|'stock-shader'|'stock-render';
export class CapeTryonSkySeat{
 private g?:T.BufferGeometry;private m?:T.ShaderMaterial;private mesh?:T.Mesh;
 private activeCamera?:T.PerspectiveCamera;
 private ticket?:readonly unknown[];private proof?:OlearyProgramProof;
 private programAbort?:AbortController;
 private phase:StageState='pending';
 private context:ReturnType<T.WebGLRenderer['getContext']>;
 private skyAbi:readonly string[];private shoreAbi:readonly string[];
 private pass={value:0};private viewport=new T.Vector4();private size=new T.Vector2();private skyGeo:T.BufferGeometry;private skyMaterial:T.Material|T.Material[];
 private readonly renderer:T.WebGLRenderer;private readonly scene:T.Scene;private readonly sky:T.Mesh;
 private readonly shore:T.Mesh;private readonly source:T.ShaderMaterial;
 private readonly ground:()=>T.Mesh|undefined;private readonly cover:()=>Promise<boolean>;
 private readonly allowedShoreMaterial:()=>boolean;
 constructor(renderer:T.WebGLRenderer,scene:T.Scene,sky:T.Mesh,shore:T.Mesh,source:T.ShaderMaterial,
  ground:()=>T.Mesh|undefined,cover:()=>Promise<boolean>,allowedShoreMaterial:()=>boolean){
  this.renderer=renderer;this.scene=scene;this.sky=sky;this.shore=shore;this.source=source;
  this.ground=ground;this.cover=cover;this.allowedShoreMaterial=allowedShoreMaterial;
  this.skyGeo=sky.geometry;this.skyMaterial=sky.material;
  this.context=renderer.getContext();
  this.skyAbi=sky.material instanceof T.ShaderMaterial?[sky.material.vertexShader,sky.material.fragmentShader]:[];
  this.shoreAbi=[source.vertexShader,source.fragmentShader];

 }
 get state(){return this.phase;}
 private sourceState(){
  const ground=this.ground(),s=this.shore,g=ground?.geometry,sg=s.geometry;
  if(!ground||!g||!s.visible||!this.allowedShoreMaterial()||s.parent!==this.scene||ground.parent!==this.scene||
     this.source.vertexShader!==this.shoreAbi[0]||this.source.fragmentShader!==this.shoreAbi[1]||
     !eq(s.matrix.elements,identity16)||!eq(ground.matrix.elements,matrix16)||
     sg.index||sg.groups.length||g.groups.length||
     sg.drawRange.start||g.drawRange.start||sg.drawRange.count!==Infinity||g.drawRange.count!==Infinity)return;
  const p=sg.getAttribute('position'),su=sg.getAttribute('uv'),gp=g.getAttribute('position'),gu=g.getAttribute('uv'),gi=g.index;
  if(!(p instanceof T.BufferAttribute&&su instanceof T.BufferAttribute&&gp instanceof T.BufferAttribute&&
     gu instanceof T.BufferAttribute&&gi instanceof T.BufferAttribute)||
     p.count!==2730||su.count!==2730||gp.count!==12769||gu.count!==12769||gi.count!==75264||
     p.itemSize!==3||su.itemSize!==2||gp.itemSize!==3||gu.itemSize!==2||gi.itemSize!==1||gi.normalized||
     !(gi.array instanceof Uint16Array)||[p,su,gp,gu].some(a=>a.normalized||!(a.array instanceof Float32Array))||
     [...(su.array as Float32Array).subarray(24,36)].some(v=>v!==0))return;
  const bytes=[p,gp,gu,gi];
  return {bytes,ground,groundGeo:g,shoreGeo:sg,key:[ground,g,sg,p,su,gp,gu,gi,p.version,su.version,gp.version,gu.version,gi.version,
     p.array,su.array,gp.array,gu.array,gi.array]};
 }
 private rendererEligible(){
  const r=this.renderer,v=r.getViewport(this.viewport),sz=r.getSize(this.size),m=this.skyMaterial;
  return T.REVISION==='187'&&r.getContext()===this.context&&!this.context.isContextLost()&&m instanceof T.ShaderMaterial&&
   m.visible&&!m.transparent&&!m.depthTest&&!m.depthWrite&&m.colorWrite&&m.opacity===1&&!m.stencilWrite&&!m.alphaToCoverage&&
   (m.blending===T.NormalBlending||m.blending===T.NoBlending)&&m.vertexShader===this.skyAbi[0]&&m.fragmentShader===this.skyAbi[1]&&
   r.getRenderTarget()===null&&r.autoClear&&r.autoClearColor&&r.autoClearDepth&&r.sortObjects&&
   !r.getScissorTest()&&v.x===0&&v.y===0&&v.z===sz.x&&v.w===sz.y&&!r.xr.isPresenting&&!r.capabilities.reversedDepthBuffer&&r.capabilities.logarithmicDepthBuffer&&
   !this.scene.overrideMaterial&&this.sky.parent===this.scene&&this.sky.visible&&!this.sky.frustumCulled&&this.sky.layers.mask===1&&this.sky.renderOrder===-10&&
   this.sky.geometry===this.skyGeo&&this.sky.material===this.skyMaterial;
 }
 private near(c:T.Camera){const {x,y,z}=c.position;
  return Number.isFinite(y)&&y>=2&&y<375&&(x+23468)**2+(z+3867)**2<1000**2;
 }
 private clear(){
  this.pass.value=0;this.activeCamera=undefined;
  this.programAbort?.abort();this.programAbort=undefined;this.proof=undefined;
  this.mesh?.removeFromParent();this.m?.dispose();this.g?.dispose();
  this.g=this.m=this.mesh=undefined;this.ticket=undefined;
 }
 begin(c:T.PerspectiveCamera){
  if(!this.near(c)||!this.rendererEligible()||!c.isPerspectiveCamera){
   if(this.ticket){this.clear();this.phase='pending';}
   return;
  }
  const source=this.sourceState();
  if(!source){if(this.ticket){this.clear();this.phase='pending';}return;}
  if(!this.ticket||!eq(this.ticket,source.key)){
   this.clear();this.ticket=source.key;this.phase='checking';
   const ac=new AbortController();this.programAbort=ac;
   void this.prepare(source.key,source.bytes,c,ac.signal);
  }
  const issued=this.mesh;
  if(!issued)return;
  if(!this.proof?.()){this.phase='stock-render';return;}
  issued.visible=true;this.activeCamera=c;this.phase='ready';
  return ()=>{
   issued.visible=false;
   if(this.mesh===issued&&this.activeCamera===c){this.activeCamera=undefined;this.pass.value=0;}
  };
 }
 private async prepare(key:readonly unknown[],bytes:T.BufferAttribute[],c:T.PerspectiveCamera,signal:AbortSignal){
  let geom:T.BufferGeometry|undefined,shader:T.ShaderMaterial|undefined;
  try{
   const gl=this.renderer.getContext(),attrs=gl.getContextAttributes();
   if(gl.isContextLost()||gl.getParameter(gl.SAMPLES)!==4||gl.getParameter(gl.DEPTH_BITS)!==24||attrs?.alpha!==true||!attrs.antialias||!attrs.depth||attrs.stencil||
     [gl.RED_BITS,gl.GREEN_BITS,gl.BLUE_BITS,gl.ALPHA_BITS].some(k=>gl.getParameter(k)!==8)||!globalThis.crypto?.subtle){
    if(this.ticket===key)this.phase='stock-render';return;
   }
   const [coverOk,...sha]=await Promise.all([this.cover(),...bytes.map(hash)]);
   if(this.ticket!==key||signal.aborted)return;
   if(!coverOk||!eq(sha,digests)||!eq(this.sourceState()?.key??[],key)){this.phase='stock-source';return;}
   const s=this.source;
   const [skyV,skyF,cliffV,cliffF]=await Promise.all([...this.skyAbi,...this.shoreAbi].map(textDigest));
   if(this.ticket!==key||signal.aborted)return;
   if(skyV!==SOURCE_ABI.skyVertex||!SOURCE_ABI.sky.includes(skyF)||cliffV!==SOURCE_ABI.cliffVertex||
      !SOURCE_ABI.cliff.includes(cliffF)){this.phase='stock-shader';return;}
   if(!this.rendererEligible()||!this.near(c)||s.side!==T.DoubleSide||s.transparent||!ordinarySkySeatOwner(s)||
     s.vertexShader.split(vertexAnchor).length!==2||s.fragmentShader.split(fragAnchor).length!==2){
    this.phase='stock-shader';return;
   }
   geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(CAPE_TRYON_SKY_SEAT,3));
   geom.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(18),2));geom.computeBoundingSphere();
   shader=new T.ShaderMaterial({
    uniforms:{...s.uniforms,[phi]:this.pass},defines:{...s.defines},side:T.DoubleSide,
    depthTest:false,depthWrite:false,transparent:false,blending:T.NoBlending,toneMapped:s.toneMapped,
    vertexShader:s.vertexShader.replace(vertexAnchor,'gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);'),
    fragmentShader:`uniform float ${phi};\n`+s.fragmentShader.replace(fragAnchor,fragAnchor+`if(${phi}<.5)discard;`),
   });
   shader.allowOverride=false;
   const mesh=new T.Mesh(geom,shader);mesh.position.set(...origin);
   for(const k of ['geometry','material'] as const)Object.defineProperty(mesh,k,{value:mesh[k],writable:false,configurable:false});
   const probe=new T.Group();probe.add(mesh);
   const proof=await olearyLinkPrograms(this.renderer,c,this.scene,1,false,4600)(probe,signal);
   mesh.removeFromParent();
   if(this.ticket!==key||signal.aborted||!proof?.()){
    if(this.ticket===key)this.phase='stock-shader';return;
   }
   const settledGeometry=geom,settledMaterial=shader,
    seatPosition=geom.getAttribute('position'),seatUV=geom.getAttribute('uv'),
    seatProgram=[shader.vertexShader,shader.fragmentShader] as const;
   settledGeometry.setDrawRange(0,-1);
   mesh.name='Cape Tryon vertical sky-seat preview';mesh.renderOrder=-9;mesh.visible=false;
   mesh.onBeforeRender=(renderer,scene,camera,geometry,material,group)=>{
    const list=this.renderer.renderLists.get(this.scene,0);
    const a=list.opaque[0],b=list.opaque[1],current=this.sourceState();
    let ground=0,shore=0;
    const ordinary=list.opaque.length<=1024&&list.opaque.every((e,i)=>{
     if(i<2)return true;
     if(e.object===this.sky||e.object===mesh||!ordinarySkySeatOwner(e.material))return false;
     if(current&&e.object===current.ground){
      if(e.geometry!==current.groundGeo||e.material!==current.ground.material||e.group!==null)return false;
      ground++;
     }
     if(current&&e.object===this.shore){
      if(e.geometry!==current.shoreGeo||e.material!==this.shore.material||e.group!==null)return false;
      shore++;
     }
     return true;
    });
    const own=mesh.renderOrder===-9&&mesh.layers.mask===1&&eq(mesh.matrixWorld.elements,ownMatrix)&&
     settledGeometry.attributes.position===seatPosition&&settledGeometry.attributes.uv===seatUV&&
     !settledGeometry.index&&settledGeometry.groups.length===0&&seatPosition.array.every((v,i)=>v===CAPE_TRYON_SKY_SEAT[i])&&
     seatUV.array.every(v=>v===0)&&settledMaterial.vertexShader===seatProgram[0]&&settledMaterial.fragmentShader===seatProgram[1]&&
     settledMaterial.uniforms[phi]===this.pass;
    const allowed=own&&this.ticket===key&&!!this.proof?.()&&!!current&&eq(current.key,key)&&ordinary&&ground===1&&shore===1&&renderer===this.renderer&&scene===this.scene&&camera===this.activeCamera&&geometry===settledGeometry&&
     material===settledMaterial&&!settledMaterial.allowOverride&&!settledMaterial.depthWrite&&!settledMaterial.depthTest&&!settledMaterial.stencilWrite&&!settledMaterial.alphaToCoverage&&
     settledMaterial.blending===T.NoBlending&&settledMaterial.colorWrite&&!settledMaterial.transparent&&group===null&&this.rendererEligible()&&list.transmissive.length===0&&
     a?.object===this.sky&&a.geometry===this.skyGeo&&a.material===this.skyMaterial&&a.group===null&&
     b?.object===mesh&&b.geometry===settledGeometry&&b.material===settledMaterial&&b.group===null;
    // The r187 list already exists here. Visibility alone cannot revoke a
    // queued draw. A negative range skips all primitives, even on refusal.
    settledGeometry.setDrawRange(0,allowed?9:-1);
    this.pass.value=Number(allowed);settledMaterial.uniformsNeedUpdate=true;
    this.phase=allowed?'mounted':'stock-render';
   };
   this.proof=proof;this.mesh=mesh;this.g=geom;this.m=shader;
   this.scene.add(mesh);this.phase='ready';
  }catch{if(this.ticket===key)this.phase='stock-source';}
  finally{if(geom&&this.g!==geom)geom.dispose();if(shader&&this.m!==shader)shader.dispose();}
 }
}
