import * as T from 'three';
import type {Layer as MaterialRole} from './facade.ts';
export type ChurchMaterials=Record<MaterialRole,T.MeshStandardMaterial>;
const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
const fract=(v:number)=>v-Math.floor(v);
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const smooth=(q:number)=>q*q*(3-2*q);
const hash=(x:number,y:number,k:number)=>{
  let h=Math.imul(x+107,374761393)^Math.imul(y+211,668265263)^Math.imul(k+19,889523592);
  h=Math.imul(h^(h>>>13),1274126177);return (((h^(h>>>16))>>>0)&0xffff)/65535;
};
const periodic=(u:number,v:number,a:number,b:number,k:number)=>{
  const x=u*a,y=v*b,X=Math.floor(x),Y=Math.floor(y);
  const wrap=(i:number,n:number)=>((i%n)+n)%n;
  const x0=wrap(X,a),x1=wrap(X+1,a),y0=wrap(Y,b),y1=wrap(Y+1,b);
  const fx=smooth(fract(x)),fy=smooth(fract(y));return mix(mix(hash(x0,y0,k),hash(x1,y0,k),fx),mix(hash(x0,y1,k),hash(x1,y1,k),fx),fy);
};
type RGB=readonly [number,number,number];
type Layer={c:RGB;h:number};
function texture(bytes:Uint8Array,n:number,w:number,space:string,x:number,y:number){
  const ta=new T.DataTexture(bytes,n,w,T.RGBAFormat,T.UnsignedByteType);
  ta.colorSpace=space;ta.generateMipmaps=true;ta.minFilter=T.LinearMipmapLinearFilter;ta.magFilter=T.LinearFilter;
  ta.wrapS=ta.wrapT=T.RepeatWrapping;ta.repeat.set(1/x,1/y);ta.anisotropy=4;ta.needsUpdate=true;
  return ta;
}
function layer(m:T.MeshStandardMaterial,w:number,h:number,U:number,V:number,fn:(u:number,v:number)=>Layer,normal:true|false=true){
  const bytes=new Uint8Array(w*h*4),heights=new Float32Array(w*h);
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
    const l=fn((i+.5)/w,(j+.5)/h),idx=i+j*w,o=idx*4;
    heights[idx]=l.h;for(let c=0;c<3;c++)bytes[o+c]=Math.round(clamp(l.c[c],0,255));bytes[o+3]=255;
  }
  m.color.set(0xffffff);m.map=texture(bytes,w,h,T.SRGBColorSpace,U,V);
  if(!normal)return;
  const nm=new Uint8Array(w*h*4);
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
    const x0=(i+w-1)%w,x1=(i+1)%w,y0=(j+h-1)%h,y1=(j+1)%h;
    const X=(heights[j*w+x0]-heights[j*w+x1])*w/(2*U),Y=(heights[y0*w+i]-heights[y1*w+i])*h/(2*V);
    const z=1/Math.sqrt(1+X*X+Y*Y),o=(i+j*w)*4;
    nm[o]=Math.round((X*z*.5+.5)*255);nm[o+1]=Math.round((Y*z*.5+.5)*255);nm[o+2]=Math.round((z*.5+.5)*255);nm[o+3]=255;
  }
  m.normalMap=texture(nm,w,h,T.NoColorSpace,U,V);
}
const white=new T.Color(0xffffff);
const std=(c:number,r:number,metalness=0)=>new T.MeshStandardMaterial({color:c,roughness:r,metalness,vertexColors:true});
export function churchMaterials():ChurchMaterials{
 const m:ChurchMaterials={
  paint:std(0xd8d9d5,.82),scallop:std(0xdcdad1,.81),foundation:std(0x4d5350,.94),redRoof:std(0x593536,.86),trim:std(0x313937,.79),
  whiteTrim:std(0xe1e1d6,.74),reveal:std(0x293035,.98),glass:new T.MeshPhysicalMaterial({color:0x505b58,roughness:.19,metalness:.205,envMapIntensity:1.12,clearcoat:.73,clearcoatRoughness:.18,vertexColors:true}),
  iron:std(0x282f31,.7,.12),door:std(0xcfcac0,.82),metal:new T.MeshPhysicalMaterial({color:0x9c9da0,roughness:.58,metalness:.38,envMapIntensity:.76,clearcoat:.16,vertexColors:true}),
  relief:std(0xb0a99b,.82),figure:std(0xa69b80,.87)
 };
 // This surface models weathered exterior panes, not a visible interior. The
 // directional sky/ground response and restrained slight pane variation follow
 // the view rather than baking a donor reflection into the building.
 m.glass.onBeforeCompile=(s)=>{
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 paneSite;')
    .replace('#include <begin_vertex>','#include <begin_vertex>\npaneSite=(modelMatrix*vec4(position,1.)).xyz;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 paneSite;')
    .replace('#include <opaque_fragment>',`
     vec3 labView=normalize(vViewPosition);
     vec3 labNormal=normalize(normal+vec3(.007*sin(paneSite.y*2.8+paneSite.z),.012*sin(paneSite.x*1.48+paneSite.y*3.8),0.));
     vec3 reflection=inverseTransformDirection(reflect(-labView,labNormal),viewMatrix);
     float sunSide=smoothstep(-.245,.40,reflection.y);
     float Fresnel=.040+.13*pow(1.-max(0.,dot(labNormal,labView)),4.);
     float glassWave=.92+.065*sin(dot(paneSite,vec3(.48,1.87,.58)))+.03*sin(dot(paneSite,vec3(.96,5.31,1.44)));
     float h=smoothstep(4.1,14.8,paneSite.y);
     vec3 pebble=mix(vec3(.063,.068,.064),vec3(.26,.328,.396),sunSide)*(.70+.30*h);
     outgoingLight=outgoingLight*(.94+.12*sunSide)+pebble*Fresnel*glassWave;
     #include <opaque_fragment>`);
 };
 for(const [mat,isFish] of [[m.paint,false],[m.scallop,true]] as const){
  layer(mat,256,256,3.05,2.62,(u,v)=>{
   const n=20,row=Math.floor(v*n),t=fract(v*n),cN=12;
   const x=fract((u+(row%2)*.5/cN)*cN),col=Math.floor(fract(u+((row%2)*.5/cN))*cN);
   const edge=isFish?.24*(1-Math.sqrt(Math.max(0,1-4*(x-.5)**2))):.016;
   const s=fract(t-edge),join=clamp((.031-Math.min(x,1-x))/.031)*(1-clamp((s-.86)/.12));
   const wide=periodic(u,v,4,5,87)-.5,gr=periodic(u,v,41,24,12)-.5,coarse=periodic(u,v,12,13,30)-.5;
   const lip=clamp((.081-s)/.081),bodyT=hash(col,row,112)-.5;
   const l=216.4+15.6*wide+9.4*coarse+7.1*gr+bodyT*7.9-11.8*lip-7.8*join;
   return {c:[l+1.4+2*wide,l+.6,l-3.8+2.3*wide],h:.0051*(1-s)*clamp(s/.073)-.0019*join+.00049*gr};
  });mat.normalScale.set(.62,.62);
 }
 layer(m.redRoof,320,320,3.42,2.834,(u,v)=>{
  const n=23,t=fract(v*n),row=Math.floor(v*n),cols=14;
  const s=fract(u+.50/cols*(row%2)),x=fract(s*cols),f=u*cols;
  const wide=periodic(u,v,3,3,77)-.5,tile=hash(Math.floor(s*cols),row,51)-.5;
  const nap=periodic(u,v,98,71,65)-.5,flat=periodic(u,v,12,13,83)-.5;
  const seam=clamp((.063-t)/.063),join=clamp((.019-Math.min(x,1-x))/.019)*(1-seam);
  const C=13*wide+9.4*tile+8.4*nap+8*flat-11*seam-6*join;
  return {c:[88+C,52+C*.77,50+C*.78],h:.0038*(1-t)*clamp(t/.055)+.00095*nap-.003*join};
 });m.redRoof.normalScale.set(.68,.68);m.redRoof.color.copy(white);
 layer(m.foundation,224,112,2.90,1.05,(u,v)=>{
  const n=5,r=Math.floor(v*n),vy=fract(v*n),x=fract(u+(r%2)*.071)*7,c=Math.floor(x),ux=fract(x);
  const noise=periodic(u,v,63,46,21)-.5, veins=periodic(u,v,19,12,89)-.5,loft=periodic(u,v,5,6,61)-.5;
  const d=Math.min(Math.min(vy,1-vy)*.56,Math.min(ux,1-ux)),join=1-clamp((d+loft*.03-.016)/.026);
  const C=87+22*loft+15*noise+14*veins+25*(hash(c,r,41)-.5)-15*join;
  return {c:[C+1.6,C+1.1,C-3.4],h:.0058*(1-join)+.0011*noise+.0022*veins};
 });m.foundation.normalScale.set(.75,.75);
 layer(m.metal,176,224,2.56,3.24,(u,v)=>{
  const broad=periodic(u,v,4,3,54)-.5, oxide=periodic(u,v,15,21,4)-.5;
  const pin=periodic(u,v,111,98,94)-.5; const j=fract(v*8),m=fract(u*6);
  const lap=1-clamp((j-.003)/.025),join=1-clamp(Math.min(m,1-m)/.024);
  const d=157+16*broad+9.4*oxide+7.7*pin-4.2*lap-7.5*join;
  return {c:[d-2.2,d-.3,d+.6],h:.0013*pin+.0035*join+.0019*lap};
 });m.metal.normalScale.set(.42,.42);
 return m;
}
