import * as T from 'three';
import {buffer,append,plant,pack,tr,color,makeStalkBuffer,STALK_ART} from './corn-stalk.ts';

const vs=`
attribute vec3 pigment;
attribute float cornRole;
varying vec3 cP;
varying vec3 cW;
varying vec3 cN;
varying vec3 cPigment;
varying vec2 cUV;
varying float cRole;
void main(){
 cP=position;cW=(modelMatrix*vec4(position,1.)).xyz;
 cN=normalize(transpose(mat3(viewMatrix))*normalMatrix*normal);
 cPigment=pigment;cUV=uv;cRole=cornRole;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
}`;
const fs=`
uniform vec3 cornDay;
uniform float cornFieldResponse;
uniform float cornStudioGround;
varying vec3 cP;
varying vec3 cW;
varying vec3 cN;
varying vec3 cPigment;
varying vec2 cUV;
varying float cRole;
float randTile(vec2 p){
 vec3 t=fract(vec3(p.xyx)*vec3(.1031,.103,.0973));
 t+=dot(t,t.yxz+33.33);
 return fract((t.x+t.y)*t.z);
}
float blendNoise(vec2 p){
 vec2 b=floor(p),d=fract(p);d=d*d*(3.-2.*d);
 return mix(mix(randTile(b),randTile(b+vec2(1.,0.)),d.x),
   mix(randTile(b+vec2(0.,1.)),randTile(b+1.),d.x),d.y)-.5;
}
float response(vec2 p,float scale,float footprint){
 return blendNoise(p/scale)*(1.-smoothstep(.21,.67,footprint/scale));
}
void main(){
 vec3 n=normalize(cN)*(gl_FrontFacing?1.:-1.);
 vec3 l=normalize(cornDay);
 vec3 v=normalize(cameraPosition-cW);
 float noL=max(0.,dot(n,l)),noV=max(.001,dot(n,v));
 float lambert=cornStudioGround>.5?.37+.60*noL:.47+.62*noL;
 float openSky=.46+.54*clamp(n.y*.5+.5,0.,1.);
 vec3 c=cPigment;
 // All noise is a local unsigned illustration. No regime-specific row axis,
 // no periodic tiles and no copied pixels. Remove unresolved bands before light.
 float footprint=max(length(dFdx(cP.xz)),length(dFdy(cP.xz)));
 float dUv=max(fwidth(cUV.x),fwidth(cUV.y));
 float veinT=cUV.x*43.-4.1*abs(cUV.y-.5),dVein=fwidth(veinT);
 if(cRole<.5){
   float leafDetail=(1.-smoothstep(.025,.27,dUv));
   float mid=1.-smoothstep(.011,.029,abs(cUV.y-.5));
   float fine=(.55+.45*sin(veinT*6.2831853))*(1.-smoothstep(.128,.33,dVein));
   float stemSide=exp(-abs(cUV.y-.5)*8.);
   c*=1.+leafDetail*(.11*mid+.065*fine*stemSide-.026);
   float through=max(0.,dot(-n,l))*(cornStudioGround>.5?.115:.153);
   float glaze=mix(12.,22.,blendNoise(vec2(cUV.x*7.,cUV.y*3.))+.5);
   float glint=pow(max(0.,dot(n,normalize(l+v))),cornStudioGround>.5?15.:glaze)*(cornStudioGround>.5 ? (.035+.034*pow(1.-noV,2.)) : (.047+.072*pow(1.-noV,2.)));
   c=c*(lambert*openSky+through)+vec3(1.,.96,.74)*glint*c*.75;
 } else if(cRole<3.6){
   float shade=cRole>1.5&&cRole<2.5?.108:.035;
   c*=lambert*openSky+shade;
 } else if(cRole<5.6){
   vec2 p=cP.xz;
   float macro=response(p+vec2(19.13,4.55),10.5,footprint);
   float leafMass=response(p+vec2(-11.2,-17.2),3.2,footprint);
   float tips=response(p+vec2(39.86,66.13),1.14,footprint);
   float pinnae=response(p+vec2(71.3,-53.5),.52,footprint);
   float canopy=(.034*macro+.10*leafMass+.13*tips+.075*pinnae)*cornFieldResponse;
   float cover=cRole>4.5?mix(.42,.67,smoothstep(.03,1.54,cP.y)):.73;
   float grazed=.50+.37*sqrt(noV);
   c*=cover*grazed*(.52+.46*noL)*(1.+canopy);
   c+=vec3(.003,.004,.002)*(1.-smoothstep(.08,.36,noV));
 } else {
   vec2 p=cP.xz;
   if(cornStudioGround>.5) {
     float loft=.52+.36*response(p+vec2(6.4,-77.21),16.,footprint)+.24*response(p+vec2(5.1,51.3),3.5,footprint);
     float summer=response(p+vec2(105.,98.),.75,footprint);
     c*=loft+summer*.10;
   }else {
     float contact=1.-.18*exp(-6.3*length(p-vec2(.63,-.20)))
                     -.15*exp(-6.5*length(p))
                     -.19*exp(-7.3*length(p-vec2(-.55,.36)));
     c*=contact*(.75+.10*response(p+vec2(11.,37.3),.26,footprint));
     c=mix(c,vec3(.168,.193,.216),smoothstep(3.4,26.,length(cameraPosition-cW)));
   }
 }
 // Detached fixed lights; output is display-space only via original Three chunks.
 gl_FragColor=vec4(c,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;

export function cornArtMaterial(){
  return new T.ShaderMaterial({name:'Original maize leaf and envelope response, detached only',
   uniforms:{
    cornDay:{value:new T.Vector3(-.46,.72,.52).normalize()},
    cornFieldResponse:{value:1}, cornStudioGround:{value:1},
   },vertexShader:vs,fragmentShader:fs,side:T.DoubleSide,transparent:false,
   depthWrite:true,depthTest:true,blending:T.NoBlending,toneMapped:true});
}
export type CornStudyKind='near'|'near-single';
export function makeCornStudy(kind:CornStudyKind){
 if(kind!=='near'&&kind!=='near-single')throw Error('Unknown detached corn study mode');
 const material=cornArtMaterial();
 const disposal=(geometry:T.BufferGeometry)=>{
  let done=false;
  return ()=>{if(done)return;done=true;geometry.dispose();material.dispose();};
 };
 const buf=buffer(),seeds=STALK_ART.seeds;
 if(kind==='near-single')append(buf,makeStalkBuffer(seeds[1],'hero','weathered').g,0,0,1,.22);
 else{
  append(buf,makeStalkBuffer(seeds[0],'hero','weathered').g,-.56,.35,.92,-.74);
  append(buf,makeStalkBuffer(seeds[1],'hero','weathered').g,0,0,1.03,0);
  append(buf,makeStalkBuffer(seeds[2],'hero','weathered').g,.63,-.20,.96,-.91,.97);
 }
 if(buf.i.length/3>6000)throw Error('Close study exceeds budget');
 material.uniforms.cornStudioGround.value=0;
 const geometry=pack(buf),mesh=new T.Mesh(geometry,material);
 mesh.name='Illustrative close maize anatomy, real curled blades';
 return {mesh,geometry,material,kind,dispose:disposal(geometry)};
}
/** Proof display backdrop only, caller controls draw, not part of either art object. */
export function studioFloor(field:boolean){
 const a=field?640:47,ground=buffer(),P=field?color(0x52583f):color(0x77796f);
 for(const [x,z] of [[-a,-a],[a,-a],[-a,a],[a,a]])plant(ground,[x,-.004,z],P,6,0,0);
 tr(ground,0,2,1);tr(ground,1,2,3);return pack(ground);
}
