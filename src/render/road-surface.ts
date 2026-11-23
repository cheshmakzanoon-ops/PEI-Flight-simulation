import type {MeshStandardMaterial} from 'three';
import {buildingShadowGLSL,type BuildingShadows} from './local-building-shadows.ts';

/** World-space surfacing for the registered ribbons. Nothing here implies lane or shoulder survey data. */
export function addRoadSurface(material:MeshStandardMaterial,casts?:BuildingShadows){
 material.customProgramCacheKey=()=> casts?'pei-road-surface-shadow-v2':'pei-road-surface-v2';
 material.onBeforeCompile=(shader)=>{
  if(casts)Object.assign(shader.uniforms,casts.uniforms);
  shader.vertexShader=shader.vertexShader.replace('#include <common>',`
   #include <common>
   attribute vec2 roadSurface;
   varying vec2 vRoadSurface,vRoadWorld;
   ${casts?'varying vec3 localRoadReceiver;':''}
  `).replace('#include <begin_vertex>',`
   #include <begin_vertex>
   vRoadSurface=roadSurface;
   vRoadWorld=(modelMatrix*vec4(position,1.)).xz;
   ${casts?'localRoadReceiver=(modelMatrix*vec4(position,1.)).xyz;':''}
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`
   #include <common>
   varying vec2 vRoadSurface,vRoadWorld;
   ${casts?'varying vec3 localRoadReceiver;'+buildingShadowGLSL:''}
   float roadHash(vec2 p){
    vec3 h=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));
    h+=dot(h,h.yzx+33.33);
    return fract((h.x+h.y)*h.z);
   }
   float roadNoise(vec2 p){
    vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(roadHash(i),roadHash(i+vec2(1,0)),f.x),
               mix(roadHash(i+vec2(0,1)),roadHash(i+1.),f.x),f.y);
   }
  `).replace('#include <color_fragment>',`
   #include <color_fragment>
   float px=length(fwidth(vRoadWorld));
   float medium=1.-smoothstep(.72,4.1,px), fine=1.-smoothstep(.12,.75,px);
   float edgePx=fwidth(vRoadSurface.x);
   if(px<4.1){
    // One continuous XZ field prevents hard breaks on contiguous road segments.
    float wearPatch=roadNoise(vRoadWorld*.092);
    float aggregate=roadNoise(vRoadWorld*2.38);
    float weather=roadNoise(vRoadWorld*.69+vec2(2.7,9.3));
    float paved=step(.22,vRoadSurface.y)*(1.-step(.76,vRoadSurface.y));
    float gravel=1.-step(.22,vRoadSurface.y);
    float edge=abs(vRoadSurface.x);
    float edgeFade=1.-smoothstep(.10,.63,edgePx);
    float shoulder=smoothstep(.70,.98,edge+(weather-.5)*.13)*edgeFade;
    float wheel=1.-smoothstep(.07,.28,abs(edge-.46));
    float grain=(aggregate-.5)*fine*mix(.20,.40,gravel);
    float var=((wearPatch-.5)*.24+(weather-.5)*.11)*medium;
    float polish=wheel*edgeFade*mix(-.13,-.06,paved)*max(paved,gravel);
    if(vRoadSurface.y<-.22){
     // Finer compacted soil and fine crumbs, not the old speckled aggregate.
     // Keep wheel wear low contrast and break it into continuous terrain-space
     // patches. These are visual cues, not measured wheel ruts or soil type.
     float dustControl=roadNoise(vRoadWorld*.103+vec2(4.2,-1.5));
     float use=smoothstep(.19,.75,dustControl);
     vec3 soil=diffuseColor.rgb;
     soil*=1.+medium*(.29*(wearPatch-.5)+.16*(weather-.5));
     soil*=1.+fine*.29*(aggregate-.5);
     soil*=1.-edgeFade*wheel*(.055+.076*use)*medium;
     vec3 edgeDust=vec3(.245,.109,.047)*(1.+.22*(weather-.5));
     soil=mix(soil,edgeDust,shoulder*medium*.21);
     diffuseColor.rgb=soil;
     // A fine and macroscopic edge interruption keeps the new dirt
     // from reading like a painted rectangular ribbon at low altitude.
     // Paved, aggregate and bridge alpha values remain exactly one.
     float shoulderNoise=(weather-.5)*.09+(aggregate-.5)*.065;
     float shoulderWeight=smoothstep(.76,.985,edge+shoulderNoise);
     diffuseColor.a*=1.-shoulderWeight*edgeFade;
     if(diffuseColor.a<.025)discard;

    }else{
         diffuseColor.rgb*=1.+grain+var+medium*polish;
    vec3 dust=mix(vec3(.34,.22,.13),vec3(.21,.15,.11),paved);
    diffuseColor.rgb=mix(diffuseColor.rgb,dust,shoulder*medium*(.28*gravel+.17*paved));
    }
   }
  `);
  if(casts)shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`
   #include <lights_fragment_end>
   vec3 localRoadNormal=normalize(cross(dFdx(localRoadReceiver),dFdy(localRoadReceiver)));
   float roadCast=buildingShade(localRoadReceiver,localRoadNormal,distance(cameraPosition,localRoadReceiver));
   reflectedLight.directDiffuse*=mix(vec3(1.),vec3(.22,.29,.38),roadCast);
   reflectedLight.directSpecular*=1.-.82*roadCast;
  `);
 };
}
