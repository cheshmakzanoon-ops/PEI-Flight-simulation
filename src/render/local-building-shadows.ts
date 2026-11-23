import * as THREE from 'three';

const size=1536, reach=370, snap=92,radius=625,maxAltitude=395;
const nearDepth=.3,farDepth=1530,texelWidth=2*reach/size;
const empty=()=>{const t=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1,THREE.RGBAFormat);t.needsUpdate=true;return t;};
const casterV=`
 attribute float facadeStyle;
 varying float special;
 void main(){
  special=facadeStyle;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
 }`;
const casterF=`
 varying float special;
 #include <packing>
 void main(){
  // The exact Souris shell already uses the separately validated surveyed
  // light field. Never apply the generic cast from the same shell twice.
  if(special>5.5&&special<6.5)discard;
  gl_FragColor=packDepthToRGBA(gl_FragCoord.z);
 }`;

type Casters=(x:number,z:number,r:number,out:THREE.Mesh[])=>void;
export class BuildingShadows{
 private readonly c=new THREE.OrthographicCamera(-reach,reach,reach,-reach,nearDepth,farDepth);
 private readonly shadowScene=new THREE.Scene();
 private readonly mat=new THREE.ShaderMaterial({vertexShader:casterV,fragmentShader:casterF,
   side:THREE.DoubleSide,toneMapped:false});
 private readonly copies=new Map<THREE.Mesh,THREE.Mesh>();
 private readonly f=new THREE.Matrix4();
 private readonly center=new THREE.Vector3();
 private readonly right=new THREE.Vector3();
 private readonly up=new THREE.Vector3();
 private readonly lightDepth=new THREE.Vector3();
 private readonly kept:THREE.Mesh[]=[];
 private readonly savedClear=new THREE.Color();
 private target?:THREE.WebGLRenderTarget;
 private oldX=Infinity;private oldZ=Infinity;private last=0;
 private frames=0;private depthDraws=0;private depthTriangles=0;
 private readonly dummy=empty();
 readonly live={value:0};
 readonly uniforms={localCastLive:this.live,localCastMap:{value:this.dummy as THREE.Texture},
   localCastTransform:{value:this.f},localCastTexel:{value:1/size},localCastSun:{value:this.lightDepth},
   localCastRight:{value:this.right},localCastUp:{value:this.up},localCastPlaneScale:{value:2*reach/(farDepth-nearDepth)}};
 private readonly r:THREE.WebGLRenderer;
 constructor(renderer:THREE.WebGLRenderer,sun:THREE.Vector3){
  this.r=renderer;
  this.lightDepth.copy(sun).normalize();
  this.right.set(0,1,0).cross(this.lightDepth).normalize();
  this.up.crossVectors(this.lightDepth,this.right).normalize();
 }
 get state(){return {active:!!this.live.value,strength:this.live.value,updates:this.frames,depthDraws:this.depthDraws,depthTriangles:this.depthTriangles};}
 render(camera:THREE.Vector3,y:number,cast?:Casters){
  const a=Math.max(0,Math.min(1,(maxAltitude-(camera.y-y))/110)),strength=a*a*(3-2*a);
  if(!strength||!cast||this.r.capabilities.maxTextureSize<size){
   this.live.value=0;
   if(this.copies.size){this.copies.clear();this.shadowScene.clear();}
   return;
  }
  const x=Math.round(camera.x/snap)*snap,z=Math.round(camera.z/snap)*snap;
  const now=performance.now();
  this.kept.length=0;cast(x,z,radius,this.kept);
  if(this.kept.length===0){this.live.value=0;if(this.copies.size){this.copies.clear();this.shadowScene.clear();}return;}
  let changed=this.copies.size!==this.kept.length;
  if(!changed)for(const src of this.kept)if(!this.copies.has(src)){changed=true;break;}
  const moved=x!==this.oldX||z!==this.oldZ;
  if(!changed&&!moved&&this.target){this.live.value=strength;return;}
  if(now-this.last<155){
   // A removed or replaced caster immediately invalidates the cached map.
   if(changed)this.live.value=0;else if(this.live.value>0)this.live.value=strength;
   return;
  }
  this.last=now;
  if(!this.target){
   const t=new THREE.WebGLRenderTarget(size,size,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,
     format:THREE.RGBAFormat,type:THREE.UnsignedByteType,depthBuffer:true,stencilBuffer:false});
   t.texture.generateMipmaps=false;t.texture.colorSpace=THREE.NoColorSpace;
   this.target=t;this.uniforms.localCastMap.value=t.texture;
  }
  this.oldX=x;this.oldZ=z;
  if(changed){
   const keep=new Set(this.kept);
   for(const [old,c] of this.copies)if(!keep.has(old)){this.shadowScene.remove(c);this.copies.delete(old);}
   for(const src of this.kept)if(!this.copies.has(src)){
    const c=new THREE.Mesh(src.geometry,this.mat);c.position.copy(src.position);
    this.copies.set(src,c);this.shadowScene.add(c);
   }
  }
  this.center.set(x,y,z);
  // Keep the canonical light-plane raster fixed when the 92 m world
  // anchor advances. Radius selection does not set a fractional texel phase.
  for(const axis of [this.right,this.up]){
   const u=this.center.dot(axis);this.center.addScaledVector(axis,Math.round(u/texelWidth)*texelWidth-u);
  }
  this.c.position.copy(this.center).addScaledVector(this.lightDepth,795);
  this.c.lookAt(this.center);this.c.updateMatrixWorld();
  this.f.multiplyMatrices(this.c.projectionMatrix,this.c.matrixWorldInverse);
  const prev=this.r.getRenderTarget(),alpha=this.r.getClearAlpha(),auto=this.r.autoClear;
  this.r.getClearColor(this.savedClear);
  try{
   this.r.setRenderTarget(this.target);
   this.r.setClearColor(0xffffff,1);this.r.autoClear=true;this.r.render(this.shadowScene,this.c);
   this.depthDraws=this.r.info.render.calls;this.depthTriangles=this.r.info.render.triangles;
   this.frames++;this.live.value=strength;
  }finally{
   this.r.setRenderTarget(prev);this.r.setClearColor(this.savedClear,alpha);this.r.autoClear=auto;
  }
 }
}
export const buildingShadowGLSL=`
 uniform float localCastLive,localCastTexel;
 uniform sampler2D localCastMap;
 uniform mat4 localCastTransform;
 uniform vec3 localCastSun,localCastRight,localCastUp;
 uniform float localCastPlaneScale;
 #include <packing>
 float buildingShade(vec3 p,vec3 n,float distanceToEye){
  if(localCastLive<.001||distanceToEye>625.)return 0.;
  vec4 hp=localCastTransform*vec4(p,1.);
  vec3 q=hp.xyz*.5+vec3(.5);
  if(q.z<=0.||q.z>=1.||any(lessThan(q.xy,vec2(.01)))||any(greaterThan(q.xy,vec2(.99))))return 0.;
  float reach=1.-smoothstep(.382,.49,max(abs(q.x-.5),abs(q.y-.5)));
  float incidence=dot(n,localCastSun);
  float guarded=(incidence<0.?-1.:1.)*max(abs(incidence),.105);
  // Receiver depth at the *sampled* light-plane point, rather than at
  // the receiver's centre. Prevent self-acne even on a long flat roof.
  vec2 gradient=localCastPlaneScale*vec2(dot(n,localCastRight),dot(n,localCastUp))/guarded;
  float bias=(.15+.39*(1.-smoothstep(.105,.38,abs(incidence))))*.000654;
  vec2 base=(floor(q.xy/localCastTexel)+.5)*localCastTexel;
  float visible=0.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
   vec2 tap=base+vec2(float(x),float(y))*localCastTexel;
   float atTap=q.z+dot(gradient,tap-q.xy)-bias;
   visible+=step(atTap,unpackRGBAToDepth(texture2D(localCastMap,tap)));
  }
  return localCastLive*(1.-visible*.1111111)*reach*(1.-smoothstep(430.,625.,distanceToEye));
 }
`;
