import * as THREE from 'three';
import { BaywalkNative } from '../sim/baywalk-native.ts';
import { BAYWALK_COURT } from '../sim/baywalk-native.generated.ts';
import { facet,GROUND_LIFT } from '../sim/coastal-terrain.ts';
import type {Terrain} from '../sim/terrain.ts';
import type {Cover} from '../sim/cover.ts';

/** Province and new court use the same sampler threshold as the CPU.
 * Strict monotone fill: typed zero is never turned into positive dry support. */
export const baywalkLandGLSL=`
 uniform sampler2D northCourtField;
 uniform vec4 northCourtBounds;
 uniform vec2 northCourtSize;
 float northCourtSigned(vec2 q){
  if(any(lessThanEqual(q,northCourtBounds.xy))||any(greaterThanEqual(q,northCourtBounds.zw)))return -1.;
  vec2 f=(q-northCourtBounds.xy)/(northCourtBounds.zw-northCourtBounds.xy);
  return (texture2D(northCourtField,(.5+f*(northCourtSize-1.))/northCourtSize).r*255.-128.)*.10;
 }
 float northCourtDistance(float prior,vec2 q){
  if(prior>=0.)return prior;
  float s=northCourtSigned(q);
  return s>0.?s:prior;
 }`;
export function baywalkUniforms(b:BaywalkNative){
 const texture=new THREE.DataTexture(b.data.shore,b.width,b.height,THREE.RedFormat);
 texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.unpackAlignment=1;texture.needsUpdate=true;
 return {northCourtField:{value:texture},northCourtBounds:{value:new THREE.Vector4(...b.bounds)},
   northCourtSize:{value:new THREE.Vector2(b.width,b.height)}};
}
const smooth=(t:number)=>{const y=Math.min(1,Math.max(0,t));return y*y*(3-2*y);};

/** Independent court cap. Stock mesh/attributes stay unchanged, even if
 * local scenery is streamed offscreen. A narrow transition follows the
 * actual regular visually submitted facet at every current terrain tier. */
export class BaywalkGround {
 readonly mesh:THREE.Mesh;readonly position:THREE.BufferAttribute;
 readonly signatureBounds:readonly [number,number,number,number];
 private readonly mutable:number[]=[];
 private readonly parentWeights:Float32Array;
 private stamp?:string;
 readonly source:BaywalkNative;
 constructor(source:BaywalkNative,cover:Cover,terrain:Terrain,material:THREE.Material,
             inherited:(x:number,z:number)=>number){
  this.source=source;const {width,height,step,x0,z0,data}=source;
  const n=width*height,vertices=new Float32Array(n*3),uv=new Float32Array(n*2),indices:number[]=[];
  const old=new Float32Array(n);
  this.parentWeights=new Float32Array(n);
  const min=new THREE.Vector3(0,-4,0),max=new THREE.Vector3((width-1)*step,12,(height-1)*step);
  for(let j=0;j<height;j++)for(let i=0;i<width;i++){
   const k=j*width+i,x=x0+i*step,z=z0+j*step,h=data.y[k]*.01+GROUND_LIFT;
   const a=old[k]=cover.beforeBaywalk(terrain,x,z);
   vertices[k*3]=i*step;vertices[k*3+2]=j*step;
   const p=terrain.uv(x,z);uv[2*k]=p[0];uv[2*k+1]=p[1];
   const parent=1-smooth(-a/4.8);this.parentWeights[k]=parent;
   vertices[k*3+1]=parent?parent*inherited(x,z)+(1-parent)*h:h;
  }
  const used=new Uint8Array(n);
  for(let j=0;j<height-1;j++)for(let i=0;i<width-1;i++){
   const a=j*width+i,b=a+1,c=a+width,d=c+1;
   // Exact bilerp cannot make a positive sample when all incident nodes
   // are non-positive. Cells entirely stock dry do not need a duplicate cap.
   if(Math.max(data.shore[a],data.shore[b],data.shore[c],data.shore[d])<=128||
     Math.min(old[a],old[b],old[c],old[d])>=0)continue;
   indices.push(a,c,b,b,c,d);used[a]=used[b]=used[c]=used[d]=1;
  }
  for(let k=0;k<n;k++)if(used[k]&&this.parentWeights[k]>0)this.mutable.push(k);
  const g=new THREE.BufferGeometry();
  this.position=new THREE.BufferAttribute(vertices,3).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position',this.position);g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  g.setIndex(new THREE.BufferAttribute(new Uint16Array(indices),1));
  g.boundingBox=new THREE.Box3(min,max);g.boundingSphere=g.boundingBox.getBoundingSphere(new THREE.Sphere());
  this.mesh=new THREE.Mesh(g,material);this.mesh.position.set(x0,0,z0);this.mesh.name='Summerside measured north court terrain';
  this.signatureBounds=source.bounds;
 }
 update(signature:string,inherited:(x:number,z:number)=>number){
  if(this.stamp===signature)return false;
  const {x0,z0,width,step,data}=this.source;
  for(const k of this.mutable){
   const x=x0+step*(k%width),z=z0+step*Math.floor(k/width),w=this.parentWeights[k];
   this.position.setY(k,w*inherited(x,z)+(1-w)*(data.y[k]*.01+GROUND_LIFT));
  }
  this.position.needsUpdate=true;this.stamp=signature;return true;
 }
 height(x:number,z:number){
  const {x0,z0,step,width,height}=this.source;
  const u=Math.max(0,Math.min(width-1,(x-x0)/step)),v=Math.max(0,Math.min(height-1,(z-z0)/step));
  const i=Math.min(width-2,Math.floor(u)),j=Math.min(height-2,Math.floor(v)),k=j*width+i,p=this.position;
  return facet(u-i,v-j,p.getY(k),p.getY(k+1),p.getY(k+width),p.getY(k+width+1));
 }
}
export const baywalkTransferSpec=BAYWALK_COURT;

/** The registered satellite crop depicted the old false-water parcel.
 * Neutral dry aggregate is authored, not recovered/retouched imagery or
 * a classification of present-day grass, paving or construction. */
export const baywalkCourtOpticsGLSL=`
 vec3 northCourtDryOptics(vec3 world,float prior){
  vec2 q=world.xz-northCourtBounds.xy;
  vec2 dx=dFdx(q),dy=dFdy(q);
  float px=max(length(dx),length(dy));
  vec2 wind=vec2(noise(q*.067),noise(q*.092+31.));
  float weather=fbm(q*.17+wind*1.1);
  float larger=fbm(q*.045+vec2(1.1,13.6));
  float nearGrain=1.-smoothstep(.011,.145,px);
  float midGrain=1.-smoothstep(.11,.78,px);
  float sand=(noise(q*21.7+vec2(.4,.7))-.5)*nearGrain;
  float chips=(noise(q*7.25+vec2(31.,5.))-.5)*midGrain;
  float pores=(smoothstep(.72,.88,noise(q*11.4))-.11)*midGrain;
  vec3 gray=vec3(.165,.157,.141),warm=vec3(.216,.191,.151),olive=vec3(.173,.172,.133);
  vec3 mineral=mix(gray,warm,smoothstep(.25,.74,weather));
  mineral=mix(mineral,olive,smoothstep(.44,.71,larger)*.49);
  mineral*=1.+.13*(weather-.5)+.19*chips+.17*sand-.088*pores;
  // Damp grit limited to the actual registered waterside edge, not the
  // broad inherited false-shore scalar. No water-colored satellite texel.
  float wet=(1.-smoothstep(.05,.41,northCourtSigned(world.xz)));
  mineral=mix(mineral,mineral*vec3(.69,.73,.77),wet*.66);
  float apron=1.-smoothstep(.07,1.68,-prior);
  vec3 shoulder=vec3(.367,.266,.165)*(.94+.09*noise(q*.2));
  return mix(mineral,shoulder,apron*.83);
 }
 vec3 northCourtBankOptics(vec3 world){
  vec2 q=world.xz-northCourtBounds.xy;
  float damp=1.-smoothstep(.08,.66,world.y);
  float dryVariation=noise(q*.91+vec2(world.y*1.031,world.y*2.31));
  float open=fbm(q*.42+vec2(world.y*3.,-world.y*1.13));
  float grain=1.-smoothstep(.04,.55,max(length(dFdx(world)),length(dFdy(world))));
  vec3 bank=mix(vec3(.178,.158,.130),vec3(.102,.101,.087),damp);
  bank*=.92+.14*dryVariation+.09*grain*open;
  return bank;
 }
`;
