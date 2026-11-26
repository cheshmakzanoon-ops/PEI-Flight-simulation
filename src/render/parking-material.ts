import {opaqueCoverageBlend} from './opaque-coverage-alpha.ts';
import * as THREE from 'three';
import {buildingShadowGLSL,type BuildingShadows} from './local-building-shadows.ts';

/** Matte, physically scaled exterior surfaces. No rectangles meant to
 * represent spaces, wheel positions, signage or property boundaries. */
export function parkingMaterial(sun:THREE.Vector3,casts?:BuildingShadows,preserveSceneAlpha=false){
 return new THREE.ShaderMaterial({alphaToCoverage:true,side:THREE.FrontSide,...(preserveSceneAlpha?opaqueCoverageBlend:undefined),
  uniforms:{parkSun:{value:sun},parkAltitude:{value:0},...casts?.uniforms},
  vertexShader:`
   attribute vec2 parkLayer;
   varying vec2 park;
   varying vec3 wp,wn;
   #include <common>
   #include <logdepthbuf_pars_vertex>
   void main(){
    vec4 p=modelMatrix*vec4(position,1.);
    wp=p.xyz;wn=normal;park=parkLayer;
    gl_Position=projectionMatrix*viewMatrix*p;
    #include <logdepthbuf_vertex>
   }
  `,
  fragmentShader:`
   uniform float parkAltitude;
   uniform vec3 parkSun;
   varying vec2 park;
   varying vec3 wp,wn;
   #include <common>
   #include <logdepthbuf_pars_fragment>
   ${casts?buildingShadowGLSL:''}
   float parkHash(vec2 p){
    vec3 h=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));
    h+=dot(h,h.yzx+33.33);return fract((h.x+h.y)*h.z);
   }
   float parkNoise(vec2 p){
    vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(parkHash(i),parkHash(i+vec2(1,0)),f.x),
     mix(parkHash(i+vec2(0,1)),parkHash(i+vec2(1)),f.x),f.y);
   }
   void main(){
    #include <logdepthbuf_fragment>
    float reach=(1.-smoothstep(2380.,2820.,length(cameraPosition.xz-wp.xz)))*
     (1.-smoothstep(730.,930.,parkAltitude));
    float edge=smoothstep(.035,.82,park.y);
    float alpha=edge*reach;
    if(alpha<.004)discard;
    float f=length(fwidth(wp.xz));
    float near=1.-smoothstep(.012,.30,f),mid=1.-smoothstep(.17,1.5,f);
    vec2 p=wp.xz;
    float base=parkNoise(p*.117),variation=parkNoise(p*.61);
    float e=parkNoise(p*6.4),pore=parkNoise(p*47.);
    vec3 c=vec3(.103,.102,.096); // weathered-asphalt default
    if(park.x>.5&&park.x<1.5)c=vec3(.226,.222,.196);
    if(park.x>1.5&&park.x<2.5)c=vec3(.198,.177,.155);
    if(park.x>2.5&&park.x<3.5)c=vec3(.183,.155,.119);
    if(park.x>3.5&&park.x<4.5)c=vec3(.179,.109,.064);
    if(park.x>4.5&&park.x<5.5)c=vec3(.150,.137,.119);
    if(park.x>5.5)c=vec3(.185,.132,.088);
    float gravel=step(2.5,park.x)*(1.-step(3.5,park.x));
    float soil=step(3.5,park.x)*(1.-step(4.5,park.x))+step(5.5,park.x);
    c*=.94+(base-.5)*mix(.17,.37,soil)+(variation-.5)*.10
      +mid*(e-.5)*mix(.17,.42,gravel)+near*(pore-.5)*mix(.21,.39,gravel);
    // Broad mineral/age patches; no invented stripes, painted stalls or
    // inferred paired tire marks. More mixed aggregate near the measured rim.
    float brown=(1.-edge)*(.27+.35*base);
    c=mix(c,vec3(.171,.128,.086),brown*.19);
    vec3 n=normalize(wn),s=normalize(parkSun);
    float lambert=max(0.,dot(n,s));
    c*=.63+.40*lambert;
    float d=length(cameraPosition-wp);
    ${casts?`float shade=buildingShade(wp,n,d);
      c*=mix(vec3(1.),vec3(.64,.71,.83),shade*smoothstep(.10,.65,lambert));`:''}
    gl_FragColor=vec4(mix(c,vec3(.56,.68,.72),1.-exp(-d*.000021)),alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }
  `});
}
