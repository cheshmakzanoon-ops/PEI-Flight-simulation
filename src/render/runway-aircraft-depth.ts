import * as T from 'three';

const RES=256, HALF=8.25, NEAR=.125, FAR=48, LIGHT_EYE=23;
const clearDepth=()=>{const t=new T.DataTexture(new Uint8Array([255]),1,1,T.RedFormat);t.needsUpdate=true;return t;};
const mapVertex='void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
const mapFragment='void main(){gl_FragColor=vec4(0.);}';

type CastPiece={source:T.Mesh;pos:T.BufferAttribute;local:T.Matrix4;partOffset:number;version:number;index:T.BufferAttribute|null;indexVersion:number};
function finiteMatrix(m:T.Matrix4){return m.elements.every(Number.isFinite);}
function owns(root:T.Object3D,source:T.Object3D){
 for(let o:T.Object3D|null=source;o;o=o.parent)if(o===root)return true;
 return false;
}
function opaqueGeometry(m:T.Mesh){
 const mat=m.material;
 if(Array.isArray(mat)||!mat.visible||mat.transparent||mat.alphaTest>0||mat.opacity!==1||!mat.depthTest||!mat.depthWrite||
    mat.clippingPlanes?.length||m.morphTargetInfluences?.length||m instanceof T.SkinnedMesh||
    m.geometry.drawRange.start!==0||m.geometry.drawRange.count!==Infinity)return;
 const g=m.geometry,p=g.getAttribute('position');
 if(!(p instanceof T.BufferAttribute)||!(p.array instanceof Float32Array)||p.itemSize!==3||p.normalized||
    (g.index&&(g.index.itemSize!==1||g.index.normalized))||((g.index?.count??p.count)%3)!==0)return;
 return p;
}

/** Merges only a caller-owned list of genuine original exterior surfaces.
 * Geometry belongs to this offscreen pass, never to the original aircraft.
 * Current mount matrices can be followed without touching original buffers. */
export function makeExteriorCaster(owner:T.Object3D, roster:readonly T.Mesh[], maxTriangles=7300){
 if(!roster.length||roster.length>36||new Set(roster).size!==roster.length||
    !Number.isSafeInteger(maxTriangles)||maxTriangles<=0||maxTriangles>8192)return;
 const pieces:CastPiece[]=[];let verts=0,indices=0;
 for(const source of roster){
  const p=opaqueGeometry(source),g=source.geometry;
  if(!p||!owns(owner,source)||!p.count||
     (indices+(g.index?.count??p.count))/3>maxTriangles||verts+p.count>=65536||
     !p.array.every(Number.isFinite))return;
  const i=g.index;
  if(i&&(!Array.from(i.array).every(v=>Number.isInteger(v)&&v>=0&&v<p.count)))return;
  pieces.push({source,pos:p,local:new T.Matrix4(),partOffset:verts,version:p.version,index:i,indexVersion:i?.version??0});
  verts+=p.count;indices+=i?.count??p.count;
 }
 const g=new T.BufferGeometry(),values=new Float32Array(verts*3),tri=new Uint16Array(indices),a=new T.Vector3(),relative=new T.Matrix4(),bounds=new T.Box3();
 const attr=new T.BufferAttribute(values,3).setUsage(T.DynamicDrawUsage);
 g.setAttribute('position',attr);g.setIndex(new T.BufferAttribute(tri,1));
 let ti=0;
 for(const {pos,index,partOffset} of pieces)for(let i=0;i<(index?.count??pos.count);i++)tri[ti++]=partOffset+(index?.getX(i)??i);
 let ready=false;
 const advance=()=>{
  if(!owner.visible)return false;
  owner.updateWorldMatrix(true,false);
  if(!finiteMatrix(owner.matrixWorld)||Math.abs(owner.matrixWorld.determinant())<1e-9)return false;
  let changed=!ready;
  for(const piece of pieces){
   const {source,pos,index,local,partOffset}=piece;
   if(opaqueGeometry(source)!==pos||pos.version!==piece.version||source.geometry.index!==index||
      index?.version!==(index?piece.indexVersion:undefined)||!owns(owner,source))return false;
   relative.identity();
   for(let o:T.Object3D|null=source;o&&o!==owner;o=o.parent){
    if(!o.visible)return false;
    if(o.matrixAutoUpdate)o.updateMatrix();
    if(!finiteMatrix(o.matrix))return false;
    relative.premultiply(o.matrix);
   }
   // Traverse only admitted exterior mounts, in their original local
   // hierarchy, so locomotion does not touch the caster vertex buffer.
   if(ready&&relative.elements.every((v,i)=>Math.abs(v-local.elements[i])<1e-8))continue;
   local.copy(relative);changed=true;
   for(let i=0;i<pos.count;i++){
    a.fromBufferAttribute(pos,i).applyMatrix4(local);
    if(!Number.isFinite(a.x+a.y+a.z)||a.lengthSq()>100)return false;
    a.toArray(values,(partOffset+i)*3);
   }
  }
  if(changed){
   bounds.makeEmpty();
   for(let i=0;i<attr.count;i++)bounds.expandByPoint(a.fromBufferAttribute(attr,i));
   if(bounds.isEmpty())return false;
   g.boundingBox=bounds;g.computeBoundingSphere();attr.needsUpdate=true;ready=true;
  }
  return true;
 };
 if(!advance()){g.dispose();return;}
 return {geometry:g,advance,triangles:indices/3,verts};
}

/** Ordinary runway lighting receiver, injected only in authenticated receivers. */
export const aircraftRunwayCastGLSL=`
 uniform float aircraftCastLive;
 uniform sampler2D aircraftCastDepth;
 uniform mat4 aircraftCastTransform;
 uniform vec3 aircraftCastOrigin;
 float aircraftRunwayCast(vec3 surface){
  if(aircraftCastLive<.001)return 0.;
  vec3 q=(aircraftCastTransform*vec4(surface-aircraftCastOrigin,1.)).xyz*.5+.5;
  if(q.z<=0.||q.z>=1.||any(greaterThan(abs(q.xy-.5),vec2(.485))))return 0.;
  float d=0.,bias=.0014;
  vec2 size=vec2(${RES}.),f=q.xy*size-.5,w=fract(f),base=(floor(f)+.5)/size;
  // Four deterministic comparisons, then interpolate their visibility
  // rather than interpolating the depth across a caster edge.
  for(int j=0;j<=1;j++)for(int i=0;i<=1;i++){
   vec2 o=vec2(float(i),float(j)),v=mix(1.-w,w,o);
   float nearest=texture2D(aircraftCastDepth,base+o/size).r;
   d+=v.x*v.y*step(nearest+bias,q.z);
  }
  return aircraftCastLive*d;
 }
`;

/** Detached trial: one local RTT, no caster scene object in the player scene. */
export class AircraftRunwayDepth{
 private readonly depthScene=new T.Scene();
 private readonly mat=new T.ShaderMaterial({vertexShader:mapVertex,fragmentShader:mapFragment,side:T.DoubleSide,colorWrite:false,toneMapped:false});
 private readonly c=new T.OrthographicCamera(-HALF,HALF,HALF,-HALF,NEAR,FAR);
 private readonly neutral=clearDepth();
 private readonly view=new T.Matrix4();
 private readonly origin=new T.Vector3();
 private readonly originTransform=new T.Matrix4();
 private readonly center=new T.Vector3();
 private readonly ground=new T.Vector3();
 private readonly axis=new T.Vector3();
 private readonly side=new T.Vector3();
 private readonly up=new T.Vector3();
 private readonly caster?:ReturnType<typeof makeExteriorCaster>;
 private readonly proxy?:T.Mesh;
 private target?:T.WebGLRenderTarget;
 private disabled=false;
 private depthDraws=0;private depthTriangles=0;private refreshes=0;
 private readonly savedViewport=new T.Vector4();
 private readonly savedScissor=new T.Vector4();
 private readonly lastRoot=new T.Matrix4();
 private readonly lastSun=new T.Vector3();
 private lastGeometryVersion=-1;private lastGround=NaN;private validDepth=false;
 private admitSamples=true;private samplesSupported=false;
 private readonly invalidateDepth=()=>{this.validDepth=false;this.admitSamples=true;this.samplesSupported=false;this.clear();};
 get state(){return {active:this.gain.value>0,gain:this.gain.value,draws:this.depthDraws,triangles:this.depthTriangles,refreshes:this.refreshes};}
 readonly gain={value:0};
 readonly uniforms={aircraftCastLive:this.gain,aircraftCastDepth:{value:this.neutral as T.Texture},aircraftCastTransform:{value:this.view},aircraftCastOrigin:{value:this.origin}};
 private readonly r:T.WebGLRenderer;
 private readonly owner:T.Object3D;
 constructor(r:T.WebGLRenderer,owner:T.Object3D,roster:readonly T.Mesh[]){
  this.r=r;this.owner=owner;
  r.domElement.addEventListener('webglcontextlost',this.invalidateDepth);
  r.domElement.addEventListener('webglcontextrestored',this.invalidateDepth);
  this.caster=makeExteriorCaster(owner,roster);
  if(this.caster){
   this.proxy=new T.Mesh(this.caster.geometry,this.mat);this.proxy.matrixAutoUpdate=false;
   this.depthScene.add(this.proxy);
  }
 }
 clear(){this.gain.value=0;this.uniforms.aircraftCastDepth.value=this.neutral;}
 dispose(){
  this.disabled=true;this.clear();this.target?.dispose();this.target=undefined;
  this.r.domElement.removeEventListener('webglcontextlost',this.invalidateDepth);
  this.r.domElement.removeEventListener('webglcontextrestored',this.invalidateDepth);
  this.mat.dispose();this.caster?.geometry.dispose();this.neutral.dispose();this.depthScene.clear();
 }
 render(sun:T.Vector3,receiverY:number,gain:number){
  this.clear();
  const {r,proxy,caster}=this;
  if(this.disabled||!proxy||!caster||!Number.isFinite(receiverY+gain)||gain<=0||gain>1||
    r.getRenderTarget()!==null||r.xr.isPresenting||r.getContext().isContextLost()||
    r.capabilities.maxTextureSize<RES||r.localClippingEnabled||r.clippingPlanes.length||
    !Number.isFinite(sun.x+sun.y+sun.z)||sun.y<.3||sun.lengthSq()<.5)return false;
  const gl=r.getContext();
  if(this.admitSamples){
   this.samplesSupported=gl.getParameter(gl.SAMPLES)===4;
   this.admitSamples=false;
  }
  if(!this.samplesSupported||!caster.advance()){this.validDepth=false;return false;}
  this.ground.setFromMatrixPosition(this.owner.matrixWorld);
  const altitude=this.ground.y-receiverY;if(altitude<.25||altitude>22)return false;
  this.axis.copy(sun).normalize();
  const version=(caster.geometry.getAttribute('position') as T.BufferAttribute).version;
  if(this.validDepth&&this.target&&this.lastGeometryVersion===version&&this.lastGround===receiverY&&
     this.lastRoot.equals(this.owner.matrixWorld)&&this.lastSun.equals(this.axis)){
   this.uniforms.aircraftCastDepth.value=this.target.depthTexture!;this.gain.value=gain;return true;
  }
  this.validDepth=false;
  this.side.set(0,1,0).cross(this.axis).normalize();
  this.up.crossVectors(this.axis,this.side).normalize();
  if(this.side.lengthSq()<.9||this.up.lengthSq()<.9)return false;
  // Place the light camera between the plane and its ground projection.
  // Plane and cast coincide in the light image, but both must stay in depth range.
  const path=altitude/(2*this.axis.y);
  this.center.copy(this.ground).addScaledVector(this.axis,-path);
  for(const v of [this.side,this.up]){
   const q=this.center.dot(v),p=2*HALF/RES;this.center.addScaledVector(v,Math.round(q/p)*p-q);
  }
  this.c.position.copy(this.center).addScaledVector(this.axis,LIGHT_EYE);
  this.c.up.copy(this.up);this.c.lookAt(this.center);this.c.updateMatrixWorld();
  this.origin.set(Math.fround(this.center.x),Math.fround(this.center.y),Math.fround(this.center.z));
  this.originTransform.makeTranslation(this.origin.x,this.origin.y,this.origin.z);
  this.view.multiplyMatrices(this.c.projectionMatrix,this.c.matrixWorldInverse).multiply(this.originTransform);
  proxy.matrix.copy(this.owner.matrixWorld);proxy.matrixWorldNeedsUpdate=true;
  const auto=r.autoClear,clip=r.getScissorTest(),cube=r.getActiveCubeFace(),mip=r.getActiveMipmapLevel();
  r.getViewport(this.savedViewport);r.getScissor(this.savedScissor);
  try{
   if(!this.target){
    const dt=new T.DepthTexture(RES,RES,T.UnsignedIntType);
    dt.minFilter=dt.magFilter=T.NearestFilter;dt.name='aircraft runway shadow depth';
    this.target=new T.WebGLRenderTarget(RES,RES,{depthTexture:dt,depthBuffer:true,stencilBuffer:false,samples:0});
   }
   r.setRenderTarget(this.target);r.autoClear=false;r.clear(false,true,false);r.render(this.depthScene,this.c);
   if(gl.isContextLost()||gl.getError()!==gl.NO_ERROR){this.clear();return false;}
   this.depthDraws=r.info.render.calls;this.depthTriangles=r.info.render.triangles;
   if(this.depthDraws!==1||this.depthTriangles!==caster.triangles)return false;
   this.lastGeometryVersion=version;this.lastGround=receiverY;
   this.lastRoot.copy(this.owner.matrixWorld);this.lastSun.copy(this.axis);
   this.refreshes++;this.validDepth=true;
   this.uniforms.aircraftCastDepth.value=this.target.depthTexture!;
   this.gain.value=gain;return true;
  }catch{this.clear();return false;}
  finally{
   r.setRenderTarget(null,cube,mip);r.autoClear=auto;
   r.setViewport(this.savedViewport);r.setScissor(this.savedScissor);r.setScissorTest(clip);
  }
 }
}
