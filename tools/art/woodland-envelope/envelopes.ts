import {BufferAttribute,InstancedBufferAttribute,InstancedBufferGeometry,Mesh,ShaderMaterial,DoubleSide,Vector3} from 'three';
import {branchedCrown} from '../../../src/render/woodland-volume-geometry.ts';
import {branchVertex,branchFragment} from './original-program.ts';
import {opaqueCoverageBlend} from '../../../src/render/opaque-coverage-alpha.ts';
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const S=(x:number)=>{const t=clamp(x,0,1);return t**3*(10+t*(-15+6*t));};
const dS=(x:number)=>30*x*x*(1-x)*(1-x);
export const ceiling=.88;
export const archetypeBounds=Object.freeze({maxVerticalMetres:2.4,minJacobian:.4,maxDelta:.14,trimMax:.126,maxTris:82000,maxDraws:4});
export type ArtKind=0|1|2|3;
export type Envelope=readonly [anchor:number,step:number,trim:number];
export type Actor=Readonly<{input:readonly [x:number,y:number,z:number,height:number,width:number,v:ArtKind,light:number],e:Envelope}>;
export function sourceAnchor(v:ArtKind){
 const g=branchedCrown(v),P=g.getAttribute('position'),F=g.getAttribute('branchDetail'),E=g.index!.array;
 const levels:{y:number,weight:number}[]=[];let total=0;
 const point=(i:number)=>new Vector3(P.getX(i),P.getY(i),P.getZ(i));
 for(let i=0;i<E.length;i+=6){
  if(F.getX(E[i])<=.5)continue;
  const a=E[i],b=E[i+1],c=E[i+2],d=E[i+5];
  const u=point(a),v=point(b),r=point(c),t=point(d);
  const w=u.clone().sub(v).cross(u.clone().sub(r)).length()*.5+r.clone().sub(u).cross(t.clone().sub(u)).length()*.5;
  if(w<=0||!Number.isFinite(w))throw Error('original geometrical leaf area');
  levels.push({y:(u.y+v.y+r.y+t.y)*.25,weight:w});total+=w;
 }
 const q=total*.12;
 levels.sort((a,b)=>a.y-b.y);let current=0;
 const s=levels.find(l=>(current+=l.weight)>=q)?.y;
 const Y=s===undefined?NaN:Math.fround(s);
 if(!(Y>.09&&Y<ceiling-.085))throw Error('old authored anchor too near endpoint');
 g.dispose();return Y;
}
export function interpretShape(y0:number,ratio:number,h:number):Envelope{
 if(!Number.isFinite(ratio)||!Number.isFinite(h)||h<=0||ratio<.125||ratio>105/128||!Number.isFinite(y0)||y0<=.09||y0>=ceiling-.085)return [y0,0,0];
 const dif=ratio-y0,mag=Math.abs(dif);
 const maxD=Math.min(2.4/h,.14,.32*(dif>=0?ceiling-y0:y0));
 // Rounding guard preserves the physical slope bound with *packed* words.
 const amount=Math.fround(Math.sign(dif)*Math.min(mag,maxD*(1-1.e-6))*S((mag-.035)/.035));
 const trim=Math.fround((.126*(1-1.e-6))*S(Math.max(0,amount)/.14));
 return [y0,amount,trim];
}
export function geometryPoint(x:number,y:number,z:number,[a,delta,trim]:Envelope){
 if(y<=0||y>=ceiling||(!delta&&!trim))return {x,y,z,k:1,kd:0,dy:1};
 const lower=y<a,w=lower?a:ceiling-a;
 const t=lower?y/w:(y-a)/w;
 const b=lower?S(t):1-S(t);
 const g=dS(t)*(lower?1:-1)/w;
 const k=1-trim*b,dy=1+delta*g;
 return {x:x*k,y:y+delta*b,z:z*k,k,kd:-trim*g,dy};
}
export function geometryNormal(x:number,z:number,n:Vector3,p:{k:number,kd:number,dy:number}){
 return new Vector3(n.x/p.k,(n.y-p.kd*(x*n.x+z*n.z)/p.k)/p.dy,n.z/p.k);
}
const patch=(s:string,a:string,b:string)=>{if(s.split(a).length!==2)throw Error('exact stock program marker');return s.replace(a,b);};
const glsl=`
#if defined(BLC_PILOT)
#error separate lower envelope comparison must not stack on the legacy BLC layer
#endif
attribute vec3 treeEnvelope;
float peiRamp(float q){return q*q*q*(10.+q*(-15.+6.*q));}
void peiShape(inout vec3 p,inout vec3 n){
 float a=treeEnvelope.x,delta=treeEnvelope.y,trim=treeEnvelope.z,y=p.y;
 if(y<=0.||y>=.88||(delta==0.&&trim==0.))return;
 bool bottom=y<a;float w=bottom?a:.88-a;
 float t=bottom?y/w:(y-a)/w;
 float b=bottom?peiRamp(t):1.-peiRamp(t);
 float db=30.*t*t*(1.-t)*(1.-t)*(bottom?1.:-1.)/w;
 float k=1.-trim*b,dk=-trim*db,dy=1.+delta*db;
 n=vec3(n.x/k,(n.y-dk*dot(p.xz,n.xz)/k)/dy,n.z/k);
 p=vec3(p.x*k,y+delta*b,p.z*k);
}
`;
export const envelopeVertex=glsl+patch(patch(branchVertex,'  vec3 vertex=position;','  vec3 vertex=position,artNormal=normal;\n  peiShape(vertex,artNormal);'),
 'fNormal=normalize(spun(normal/scale));','fNormal=normalize(spun(artNormal/scale));');
export const envelopeFragment=branchFragment;
/** No app host. Only create actual exact original artwork for this bench. */
export function detachedEnvelopeGroup(actors:readonly Actor[],which:'original'|'interpretive'){
 const out:Mesh<InstancedBufferGeometry,ShaderMaterial>[]=[];
 const counts=[1888,1808,1762,1500];
 const tris=actors.reduce((n,a)=>n+counts[a.input[5]],0);
 if(!actors.length||tris>archetypeBounds.maxTris||!Number.isFinite(tris))return;
 try{
  for(let k=0;k<4;k++){
   const a=actors.filter(v=>v.input[5]===k);
   if(!a.length)continue;
   const p=branchedCrown(k),g=new InstancedBufferGeometry();
   g.setIndex(p.index);for(const [t,w] of Object.entries(p.attributes))g.setAttribute(t,w);
   const pack=(n:number,op:(x:Actor)=>number[])=>new BufferAttribute(Float32Array.from(a.flatMap(op)),n);
   // Use Three's actual instanced attribute, each authorized tuple in the given order.
   const attr=(n:number,op:(x:Actor)=>number[])=>new InstancedBufferAttribute(pack(n,op).array,n);
   g.setAttribute('treeStem',attr(3,t=>Array.from(t.input.slice(0,3))));
   g.setAttribute('treeShape',attr(4,t=>Array.from(t.input.slice(3,7))));
   g.setAttribute('treeSpin',attr(2,({input:[x,,z]})=>{
    const a=((Math.imul(Math.floor(x*5),0x45d9f3b)^Math.imul(Math.floor(z*5),0x119de1f3))>>>0)*(2*Math.PI/4294967296);
    return [Math.cos(a),Math.sin(a)];
   }));
   if(which==='interpretive')g.setAttribute('treeEnvelope',attr(3,t=>Array.from(t.e)));
   g.instanceCount=a.length;
   const m=new ShaderMaterial({vertexShader:which==='interpretive'?envelopeVertex:branchVertex,fragmentShader:branchFragment,
    alphaToCoverage:true,depthWrite:true,side:DoubleSide,transparent:false,...opaqueCoverageBlend,uniforms:{volumeFade:{value:new Vector3(9999,10000,1)}}});
   const mesh=new Mesh(g,m);mesh.frustumCulled=false;mesh.visible=false;out.push(mesh);
  }
  return {meshes:out,stats:Object.freeze({triangles:tris,draws:out.length,extraStyleBytes:which==='interpretive'?12*actors.length:0}),
   dispose(){for(const m of out){m.removeFromParent();m.geometry.dispose();m.material.dispose();}}};
 }catch(e){for(const m of out){m.geometry.dispose();m.material.dispose();}throw e;}
}
