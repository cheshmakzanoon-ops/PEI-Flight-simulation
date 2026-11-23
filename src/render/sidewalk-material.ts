import * as THREE from 'three';
import {buildingShadowGLSL,type BuildingShadows} from './local-building-shadows.ts';

const vert=`
attribute vec3 walkStyle;
varying vec2 coords;varying vec3 walk;
varying vec3 wp,wn;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){
 vec4 p=modelMatrix*vec4(position,1.); wp=p.xyz; wn=normal; coords=uv; walk=walkStyle;
 gl_Position=projectionMatrix*viewMatrix*p;
 #include <logdepthbuf_vertex>
}
`;

export function sidewalkMaterial(sun:THREE.Vector3,casts?:BuildingShadows){
 return new THREE.ShaderMaterial({vertexShader:vert,side:THREE.FrontSide,alphaToCoverage:true,
 uniforms:{walkSun:{value:sun},walkAltitude:{value:0},...casts?.uniforms},
 fragmentShader:`
 varying vec2 coords;varying vec3 walk;
 varying vec3 wp,wn;
 uniform vec3 walkSun;uniform float walkAltitude;
 #include <common>
 #include <logdepthbuf_pars_fragment>
 ${casts?buildingShadowGLSL:''}
 float wHash(vec2 p){
  vec3 h=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));h+=dot(h,h.yzx+33.33);
  return fract((h.x+h.y)*h.z);
 }
 float wNoise(vec2 p){
  vec2 a=floor(p),u=fract(p);u=u*u*(3.-2.*u);
  return mix(mix(wHash(a),wHash(a+vec2(1,0)),u.x),mix(wHash(a+vec2(0,1)),wHash(a+1.),u.x),u.y);
 }
 float integral(float x,float a,float b){return floor(x)*(b-a)+clamp(fract(x)-a,0.,b-a);}
 float seam(float x,float a,float b){
  float p=max(fwidth(x),.0015);
  return (integral(x+p*.5,a,b)-integral(x-p*.5,a,b))/p;
 }
 void main(){
  #include <logdepthbuf_fragment>
  float fade=(1.-smoothstep(1140.,1470.,length(cameraPosition.xz-wp.xz)))*(1.-smoothstep(320.,425.,walkAltitude));
  if(fade<.003)discard;
  vec3 n=normalize(wn);
  float spectral=length(fwidth(wp.xz)),fine=1.-smoothstep(.070,.48,spectral),dist=length(cameraPosition-wp);
  float slope=max(0.,dot(n,walkSun)),weather=wNoise(wp.xz*.61);
  float wide=wNoise(wp.xz*.120),grit=wNoise(wp.xz*62.);
  float lip=abs(coords.x);
  vec3 c=vec3(.284,.284,.253);
  if(walk.x>.5&&walk.x<1.5)c=vec3(.267,.270,.252);
  if(walk.x>1.5&&walk.x<2.5)c=vec3(.256,.238,.207);
  if(walk.x>2.5&&walk.x<3.5)c=vec3(.246,.147,.109);
  if(walk.x>3.5&&walk.x<4.5)c=vec3(.242,.238,.222);
  if(walk.x>4.5)c=vec3(.101,.107,.104);
  c*=.94+.14*(wide-.50)+.135*(weather-.5)+.19*(grit-.50)*fine;
  float weeds=smoothstep(.80,.995,lip+(weather-.5)*.07)*smoothstep(.36,.74,wide);
  c=mix(c,vec3(.121,.142,.079),.29*weeds);
  if(walk.y<.5){
   if(walk.x<1.5){
    float p=coords.y/(walk.x<.5?2.55:1.09);
    float slab=wHash(vec2(floor(p),floor(coords.y/13.)));
    float joint=seam(p,.033,walk.x<.5?.037:.045);
    c*=1.+.096*(slab-.5)*fine-.43*joint;
    // subtle mottled chamfer, not an inferred raised road curb.
    float l=smoothstep(.91,.976,lip)*(1.-smoothstep(.981,1.,lip));
    c*=1.+.10*l*fine-.10*smoothstep(.937,1.,lip)*fine;
   }else if(walk.x<4.5){
    // Units in metres with staggered courses; soil partials stay in the joints.
    vec2 f=vec2(coords.x*walk.z,coords.y)/vec2(.118,.211);
    f.x+=mod(floor(f.y),2.)*.5;
    float m=wHash(floor(f)),gap=max(seam(f.x,.04,.086),seam(f.y,.05,.098));
    c*=1.+fine*.255*(m-.5)-.43*gap;
   }
  }else{c*=.59+.16*weather;}
  c*=.655+.44*slope;
  ${casts?`float shade=buildingShade(wp,n,dist);
  c*=mix(vec3(1.),vec3(.65,.72,.82),shade*smoothstep(.04,.55,slope));`:''}
  float air=1.-exp(-dist*.000022);
  gl_FragColor=vec4(mix(c,vec3(.56,.68,.72),air),fade);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }
 `});
}
