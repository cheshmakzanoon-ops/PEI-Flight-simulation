/** Detached original art. Coordinates are caller-provided and do not imply a surveyed site. */
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export type FenceSeat=Readonly<{x:number;y:number;z:number}>;
export type FabricSpec=Readonly<{
 seats:readonly FenceSeat[];height:number;aperture:number;gauge:number;close?:boolean;closed?:boolean;
}>;

const up=new T.Vector3(0,1,0);
const POST=.031,RAIL=.021,BOTTOM=.075,EMBED=.105;
const MAX_POSTS=64;
const BETWEEN=(x:number,a:number,b:number)=>Number.isFinite(x)&&x>=a&&x<=b;
const quadOrder=[0,1,2,0,2,3] as const;
const copy=(p:FenceSeat)=>new T.Vector3(p.x,p.y,p.z);

/** Exact periodic one-dimensional stripe integral. Duty is the orthogonal
 * metal diameter divided by orthogonal picket pitch, not a painted alpha. */
export function stripePixel(phase:number,footprint:number,duty:number){
 if(!Number.isFinite(phase)||!BETWEEN(footprint,0,64)||!BETWEEN(duty,.001,.25))
  throw new RangeError('invalid periodic stripe sample');
 const a=(1-duty)/2,b=(1+duty)/2;
 const area=(x:number)=>{
  const i=Math.floor(x),f=x-i;return i*duty+Math.max(0,Math.min(duty,f-a));
 };
 if(footprint===0){const f=phase-Math.floor(phase);return f>=a&&f<=b?1:0;}
 const w=Math.max(.0001,footprint);
 return Math.max(0,Math.min(1,(area(phase+w*.5)-area(phase-w*.5))/w));
}

const edge='varying vec2 fenceMetres;';
const stripeGLSL=`
 varying vec2 fenceMetres;
 uniform float fencePitch, fenceDuty;
 float fenceIntegral(float q,float a,float w){
  return floor(q)*w+clamp(fract(q)-a,0.,w);
 }
 float fenceStripe(float q,float footprint){
  float w=max(.0001,footprint),a=(1.-fenceDuty)*.5;
  return clamp((fenceIntegral(q+.5*w,a,fenceDuty)-fenceIntegral(q-.5*w,a,fenceDuty))/w,0.,1.);
 }
 float fenceCover(){
  vec2 q=vec2(fenceMetres.x+fenceMetres.y,fenceMetres.x-fenceMetres.y)/fencePitch;
  vec2 footprint=fwidth(q);
  float a=fenceStripe(q.x,footprint.x),b=fenceStripe(q.y,footprint.y);
  // Once neither diagonal carries useful pixel structure, hand off to
  // structural metal. This avoids glitter from infinitesimal far wires.
  float resolved=1.-smoothstep(.58,1.48,max(footprint.x,footprint.y));
  return (a+b-a*b)*resolved;
 }
`;
function fabricMaterial(aperture:number,duty:number){
 const m=new T.MeshStandardMaterial({color:'#a5a9a7',roughness:.55,metalness:.65,side:T.DoubleSide,
  alphaToCoverage:true,alphaTest:.025,depthWrite:true,transparent:false,
  // RGB replaces only covered samples; the caller's target alpha does not
  // accumulate coverage a second time on this opaque structural prop.
  blending:T.CustomBlending,blendSrc:T.OneFactor,blendDst:T.ZeroFactor,
  blendSrcAlpha:T.ZeroFactor,blendDstAlpha:T.OneFactor});
 m.onBeforeCompile=q=>{
  if(q.vertexShader.split('#include <uv_vertex>').length!==2||q.fragmentShader.split('#include <alphatest_fragment>').length!==2)
   throw Error('unrecognized chain fabric shader');
  q.uniforms.fencePitch={value:aperture};q.uniforms.fenceDuty={value:duty};
  q.vertexShader=edge+'\n'+q.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nfenceMetres=uv;');
  q.fragmentShader=stripeGLSL+q.fragmentShader.replace('#include <alphatest_fragment>',
    `diffuseColor.a*=fenceCover();
#ifdef ALPHA_TO_COVERAGE
 // The built-in chunk delegates to smoothstep with equal bounds in flat
 // zero regions. Form a strictly positive width before any discard.
 diffuseColor.a=smoothstep(alphaTest,alphaTest+max(.00006,fwidth(diffuseColor.a)),diffuseColor.a);
 if(diffuseColor.a==0.)discard;
#else
 #include <alphatest_fragment>
#endif`);
 };
 m.customProgramCacheKey=()=> 'original-chain-fabric-spatial-v1';
 return m;
}
function tube(a:T.Vector3,b:T.Vector3,r:number,n:number){
 const axis=b.clone().sub(a),h=axis.length(),q=new T.Quaternion().setFromUnitVectors(up,axis.normalize());
 return new T.CylinderGeometry(r,r,h,n).applyQuaternion(q).translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);
}

export function createChainFabricStudy(spec:FabricSpec){
 const {seats,height,aperture,gauge,close=true,closed=false}=spec,duty=gauge*Math.SQRT2/aperture;
 if(!Number.isInteger(seats.length)||seats.length<(closed?3:2)||seats.length>MAX_POSTS||
    !BETWEEN(height,.55,3)||!BETWEEN(aperture,.030,.105)||!BETWEEN(gauge,.0015,.0055)||
    !BETWEEN(duty,.006,.16)||!seats.every(p=>BETWEEN(p.x,-512,512)&&BETWEEN(p.y,-100,100)&&BETWEEN(p.z,-512,512)))
  throw new RangeError('invalid local chain fabric dimensions');
 for(let i=0;i<seats.length;i++)for(let j=0;j<i;j++){
  if(Math.hypot(seats[i].x-seats[j].x,seats[i].z-seats[j].z)<.12)
   throw new RangeError('posts cannot share a footing');
 }
 const ends=closed?[...seats.slice(1),seats[0]]:seats.slice(1);
 const spans=ends.map((b,i)=>{
  const a=seats[i],horizontal=Math.hypot(b.x-a.x,b.z-a.z);
  if(!BETWEEN(horizontal,.55,4.2)||Math.abs(b.y-a.y)>.23*horizontal)
   throw new RangeError('span must have a supported post interval and grade');
  return {a,b,horizontal};
 });
 const pos:number[]=[],uv:number[]=[],tubes:T.BufferGeometry[]=[],N=close?10:5;
 for(const seat of seats){
  const a=copy(seat).addScaledVector(up,-EMBED),b=a.clone().addScaledVector(up,height+EMBED+.044);
  tubes.push(tube(a,b,POST,N));
 }
 for(const {a,b,horizontal:L} of spans){
  const A=copy(a),B=copy(b);
  tubes.push(tube(A.clone().addScaledVector(up,height),B.clone().addScaledVector(up,height),RAIL,N));
  if(!close)continue;
  // Fabric ends reach just inside each post. Each face follows the two
  // supplied seat heights; neither grade, post or contact is inferred.
  const x=POST*.6, left=A.clone().lerp(B,x/L),right=A.clone().lerp(B,1-x/L);
  const q=[left.clone().addScaledVector(up,BOTTOM),right.clone().addScaledVector(up,BOTTOM),
   right.clone().addScaledVector(up,height-.003),left.clone().addScaledVector(up,height-.003)];
  const tex=[[x,BOTTOM],[L-x,BOTTOM],[L-x,height-.003],[x,height-.003]];
  for(const k of quadOrder){pos.push(q[k].x,q[k].y,q[k].z);uv.push(...tex[k]);}
 }
 const metal=mergeGeometries(tubes,false);
 for(const g of tubes)g.dispose();
 if(!metal)throw Error('failed to batch galvanized post geometry');
 metal.computeBoundingBox();metal.computeBoundingSphere();
 const postMaterial=new T.MeshStandardMaterial({color:'#949b9e',metalness:.68,roughness:.52}),group=new T.Group();
 const supports=new T.Mesh(metal,postMaterial);group.add(supports);
 let fabric:T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>|undefined;
 if(close){
  const mesh=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(pos,3))
    .setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  mesh.computeVertexNormals();mesh.computeBoundingBox();mesh.computeBoundingSphere();
  fabric=new T.Mesh(mesh,fabricMaterial(aperture,duty));group.add(fabric);
 }
 group.name='Detached galvanized site enclosure';
 return {group,supports,fabric,posts:seats.length,spans:spans.length,
  triangles:metal.index!.count/3+pos.length/9,
  dispose(){group.removeFromParent();metal.dispose();postMaterial.dispose();fabric?.geometry.dispose();fabric?.material.dispose();}};
}
