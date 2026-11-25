import type {MeshStandardMaterial} from 'three';

/** Original, scale-filtered surface only. Color and wear are illustrative;
 * no measured asphalt recipe, marking layout, or temporary traffic changes. */
export function addBridgeAsphalt(material:MeshStandardMaterial){
 material.customProgramCacheKey=()=> 'pei-bridge-asphalt-v1';
 material.onBeforeCompile=(shader)=>{
  shader.vertexShader=shader.vertexShader
   .replace('#include <common>','#include <common>\nvarying vec2 deckMetric;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\ndeckMetric=uv;');
  shader.fragmentShader=shader.fragmentShader
   .replace('#include <common>',`
    #include <common>
    varying vec2 deckMetric;
    float daHash(vec2 p){
     vec3 h=fract(p.xyx*vec3(.1031,.1030,.0973));h+=dot(h,h.yzx+33.33);return fract((h.x+h.y)*h.z);
    }
    float daNoise(vec2 p){
     vec2 q=floor(p),f=fract(p);f=f*f*(3.-2.*f);
     return mix(mix(daHash(q),daHash(q+vec2(1.,0.)),f.x),
                mix(daHash(q+vec2(0.,1.)),daHash(q+1.),f.x),f.y);
    }
   `)
   .replace('#include <color_fragment>',`
    #include <color_fragment>
    vec2 m=deckMetric;
    float px=max(length(dFdx(m)),length(dFdy(m)));
    // Taper coarse as well as detailed differences above low-pass scale.
    // This surface uses no global textures or extra glint at cruise.
    float closeLane=1.-smoothstep(.46,4.5,px);
    if(closeLane>.001){
     float closeAggregate=1.-smoothstep(.016,.083,px);
     float coarseAggregate=1.-smoothstep(.065,.60,px);
     float farFinish=daNoise(m*vec2(.029,.31)+5.)-.5;
     float wheelDist=min(abs(abs(m.y)-.95),abs(abs(m.y)-2.63));
     float wheelSheen=exp(-pow(wheelDist/.36,2.))*closeLane;
     float medium=0.,fine=0.;
     if(coarseAggregate>.01)medium=(daNoise(m*4.6+6.83)-.5)*coarseAggregate;
     if(closeAggregate>.01)fine=(daNoise(m*35.0+1.81)-.5)*closeAggregate;
     float randomWear=.76+.36*daNoise(m*vec2(.47,.93)+12.4);
     float outside=smoothstep(3.52,5.4,abs(m.y))*closeLane;
     float shade=1.+farFinish*.034*closeLane+medium*.112+fine*.15
       -(.058*wheelSheen+.051*outside)*randomWear;
     diffuseColor.rgb*=shade;
    }
   `);
 };
}
