import type {MeshStandardMaterial} from 'three';

/** World-space surfacing for the registered ribbons. Nothing here implies lane or shoulder survey data. */
export function addRoadSurface(material:MeshStandardMaterial){
 material.customProgramCacheKey=()=> 'pei-road-surface-v1';
 material.onBeforeCompile=(shader)=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>',`
   #include <common>
   attribute vec2 roadSurface;
   varying vec2 vRoadSurface,vRoadWorld;
  `).replace('#include <begin_vertex>',`
   #include <begin_vertex>
   vRoadSurface=roadSurface;
   vRoadWorld=(modelMatrix*vec4(position,1.)).xz;
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`
   #include <common>
   varying vec2 vRoadSurface,vRoadWorld;
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
    diffuseColor.rgb*=1.+grain+var+medium*polish;
    vec3 dust=mix(vec3(.34,.22,.13),vec3(.21,.15,.11),paved);
    diffuseColor.rgb=mix(diffuseColor.rgb,dust,shoulder*medium*(.28*gravel+.17*paved));
   }
  `);
 };
}
