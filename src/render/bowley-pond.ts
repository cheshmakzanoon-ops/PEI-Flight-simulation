import * as THREE from 'three';
import {type BowleyPond, type BowleyShoreRun} from '../sim/bowley-pond.ts';
import type {Terrain} from '../sim/terrain.ts';

export const bowleyClipGLSL=/*glsl*/`
 uniform sampler2D bowleyMask;
 uniform vec4 bowleyRect;
 uniform float bowleyY;
 uniform mat4 bowleyInverseProjection,bowleyEyeToWorld;
 uniform vec4 bowleyViewport;
 float bowleyDistance(vec2 q){
  vec2 u=(q-bowleyRect.xy)*bowleyRect.zw;
  if(any(lessThan(u,vec2(0.)))||any(greaterThanEqual(u,vec2(1.))))return 127.;
  return texture2D(bowleyMask,u).r*255.-128.;
 }
 // One classification for a physical screen ray. In standard MSAA the
 // primitive-dependent interpolation can otherwise discard land and still
 // discard its water replacement somewhere else within the same pixel.
 float bowleyRasterDistance(){
  vec2 xy=(floor(gl_FragCoord.xy)+.5-bowleyViewport.xy)/bowleyViewport.zw*2.-1.;
  vec3 r=mat3(bowleyEyeToWorld)*(bowleyInverseProjection*vec4(xy,0.,1.)).xyz;
  if(abs(r.y)<.0000001)return 127.;
  float t=(bowleyY-cameraPosition.y)/r.y;
  return t>0.?bowleyDistance(cameraPosition.xz+r.xz*t):127.;
 }
`;
/** Isolated calm optics. No marine breakers, tide, depth or measured waves. */
export const bowleyWaterGLSL=/*glsl*/`
 uniform sampler2D rippleMap;
 void main(){
 #include <logdepthbuf_fragment>
 vec2 q=p.xz,st=q-bowleyRect.xy;
 float edge=bowleyRasterDistance();
 if(edge>=0.)discard;
 vec3 eye=cameraPosition-p;float d=length(eye);
 vec3 V=eye/max(d,.01);
 vec2 u=st*.046+clock*vec2(.009,.0027);
 mat2 R=mat2(.756,-.655,.655,.756);
 vec2 a=texture2D(rippleMap,u).rg-.5;
 vec2 b=R*(texture2D(rippleMap,transpose(R)*st*.107-clock*vec2(.0054,.0041)).rg-.5);
 float detail=1.-smoothstep(550.,3000.,d);
 vec2 ripple=(a*.11+b*.038)*detail;
 vec3 N=normalize(vec3(ripple.x,1.,ripple.y)),reflected=reflect(-V,N);
 float up=clamp(dot(N,V),0.,1.);
 // Broader ripple lobes receive less clear horizon light in the interior
 // metre next to the observed edge. Profile only affects water colour.
 float clear= smoothstep(4.,40.,-edge);
 float f=(.022+.87*pow(1.-up,5.))*mix(.57,1.,clear);
 float mottled=noise(st*.018)*.73+noise(st*.072+vec2(27.,3.))*.27;
 float margin=(1.-smoothstep(5.,101.,-edge))*.26;
 vec3 pond=mix(vec3(.020,.035,.030),vec3(.065,.071,.049),mottled*.35+margin);
 vec3 skyColor=skyAt(reflected)*.64;
 float sunDot=max(dot(reflected,sun),0.);
 float gleam=.23*pow(sunDot,mix(130.,255.,detail))*mix(.28,1.,clear);
 vec3 c=mix(pond,skyColor,f)+vec3(1.,.84,.66)*gleam;
 gl_FragColor=vec4(mist(c,d,p.y),1.);
`;
/** Seat against the visible adjacent terrain, not an inferred sediment layer. */
export const bowleyShoreGLSL=/*glsl*/`
 uniform sampler2D imageMap;
 uniform float bowleyY;
 void main(){
 #include <logdepthbuf_fragment>
 vec3 n=normalize(cross(dFdx(p),dFdy(p)));
 float d=distance(cameraPosition,p);
 float stain=noise(p.xz*.42+vec2(p.y*.17,p.y*.31)),wet=1.-smoothstep(.04,.42,abs(p.y-bowleyY));
 vec3 atlas=texture2D(imageMap,vec2(vuv.x,1.-vuv.y)).rgb*.25;
 vec3 peat=mix(vec3(.036,.047,.023),vec3(.055,.061,.031),stain);
 vec3 k=mix(atlas,peat,.47+wet*.28);
 k*=.81+max(0.,dot(vec3(n.x,.2,n.z),sun))*.19;
 gl_FragColor=vec4(mist(k,d,p.y),1.);
`;
export function bowleyUniforms(pond:BowleyPond):Record<string,THREE.IUniform>{
 const s=pond.spec,im=new THREE.DataTexture(pond.bytes,s.width,s.height,THREE.RedFormat);
 im.generateMipmaps=false;im.minFilter=im.magFilter=THREE.LinearFilter;im.unpackAlignment=1;im.needsUpdate=true;
 return {bowleyMask:{value:im},bowleyRect:{value:new THREE.Vector4(s.left,s.top,1/(pond.x1-s.left),1/(pond.z1-s.top))},
  bowleyY:{value:s.waterY}};
}
export class BowleyWaterMesh {
 readonly surface:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;
 readonly rim:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
 private readonly arcs:BowleyShoreRun[];
 private readonly position:THREE.BufferAttribute;
 private revision?:string;
 private X:number;
 private Z:number;
 constructor(readonly pond:BowleyPond,t:Terrain,water:THREE.ShaderMaterial,bank:THREE.ShaderMaterial){
  const {left,top,waterY}=pond.spec,w=pond.x1-left,d=pond.z1-top;
  this.X=left+w*.5;this.Z=top+d*.5;
  // Keep the fixed-stage quad behind every verified peak of the mask even
  // on the outermost multisamples; the source mask still rejects its apron.
  this.surface=new THREE.Mesh(new THREE.PlaneGeometry(w+24,d+24),water);
  this.surface.rotation.x=-Math.PI*.5;this.surface.position.set(this.X,waterY,this.Z);
  this.surface.name='Bowley Pond 2020 water plane';
  const arcs=this.arcs=pond.contours(),p=new Float32Array(arcs.length*18),uv=new Float32Array(arcs.length*12);
  for(let i=0;i<arcs.length;i++){
   const [ax,az,bx,bz]=arcs[i],a=t.uv(ax,az),b=t.uv(bx,bz);
   const x=ax-this.X,z=az-this.Z,u=bx-this.X,v=bz-this.Z,j=i*18,k=i*12;
   p.set([x,0,z,u,0,v,x,0,z,x,0,z,u,0,v,u,0,v],j);
   uv.set([...a,...b,...a,...a,...b,...b],k);
  }
  const g=new THREE.BufferGeometry();
  this.position=new THREE.BufferAttribute(p,3).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position',this.position);g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  this.rim=new THREE.Mesh(g,bank);this.rim.position.set(this.X,0,this.Z);this.rim.name='Bowley Pond seated bank curtain';
 }
 update(x:number,z:number,signature:(b:BowleyPond['bounds'])=>string,height:(x:number,z:number)=>number){
  // The far plane stays exact. Curtains are frustum-coherent and never
  // sampled or uploaded outside the local viewing band.
  this.rim.visible=Math.hypot(x-this.X,z-this.Z)<12500;
  if(!this.rim.visible)return;
  const id=signature(this.pond.bounds);
  if(this.revision===id)return;this.revision=id;
  const y=this.pond.spec.waterY,p=this.position;
  for(let i=0;i<this.arcs.length;i++){
   const [x,z,u,v]=this.arcs[i],a=height(x,z),b=height(u,v),k=i*6;
   p.setY(k,Math.min(a,y)-.027);p.setY(k+1,Math.min(b,y)-.027);
   p.setY(k+2,Math.max(a,y)+.025);p.setY(k+3,Math.max(a,y)+.025);
   p.setY(k+4,Math.min(b,y)-.027);p.setY(k+5,Math.max(b,y)+.025);
  }
  p.needsUpdate=true;this.rim.geometry.computeBoundingSphere();
 }
}
