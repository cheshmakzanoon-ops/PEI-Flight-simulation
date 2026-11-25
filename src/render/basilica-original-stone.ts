import { Color, MeshStandardMaterial } from 'three';

/** A stateless surface study in the landmark's authored metre frame.
 * Tint and joint layout are original: no imagery sampling or fitted dimensions.
 * No change to layer footprint, light setup, draw count or caster ownership. */
export function basilicaStoneStudy(finish:'sandstone'|'dressing'){
 const dressing=finish==='dressing';
 const material=new MeshStandardMaterial({
  color:new Color(dressing?'#a2937b':'#80715b'),
  roughness:dressing?.79:.9, metalness:0,
 });
 material.name=dressing?'Basilica study: dressed arch stone':'Basilica study: weathered sandstone';
 material.customProgramCacheKey=()=>dressing?'pei-basilica-dressing-prototype-2':'pei-basilica-sandstone-prototype-2';
 material.onBeforeCompile=shader=>{
  const replace=(source:string, anchor:string, updated:string)=>{
   if(source.split(anchor).length!==2)throw new Error('Basilica stone shader anchor: '+anchor);
   return source.replace(anchor,updated);
  };
  const vary='varying vec3 stonePos,stoneDirection;';
  shader.vertexShader=replace(shader.vertexShader,'#include <common>', '#include <common>\n'+vary);
  shader.vertexShader=replace(shader.vertexShader,'#include <begin_vertex>',
   '#include <begin_vertex>\nstonePos=position; stoneDirection=normal;');
  shader.fragmentShader=replace(shader.fragmentShader,'#include <common>',`#include <common>
   ${vary}
   #define DRESSED_ARCH ${dressing?'1':'0'}
   float stoneHash(vec2 x){
    vec3 p=fract(vec3(x.xyx)*.1031);
    p+=dot(p,p.yzx+33.33);
    return fract((p.x+p.y)*p.z);
   }
   float stoneNoise(vec2 p){
    vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(stoneHash(i),stoneHash(i+vec2(1.,0.)),f.x),
      mix(stoneHash(i+vec2(0.,1.)),stoneHash(i+vec2(1.,1.)),f.x),f.y);
   }
   vec2 stonePlane(){
    vec3 n=abs(normalize(stoneDirection));
    // Read the same elevation courses across the front and returns. Avoid
    // stretching vertical courses over horizontal sill tops.
    if(n.y>max(n.x,n.z))return stonePos.xz;
    return vec2(n.x>n.z?stonePos.z:stonePos.x,stonePos.y);
   }
   struct StoneSample {float tonal; float seam; float relief; float grain; float clarity; float grainFade;};
   StoneSample stoneSurface(vec2 p) {
    vec2 footprint=vec2(fwidth(p.x),fwidth(p.y));
    vec2 grid=p/vec2(.54,.255);
    float aa=clamp(max(footprint.x/.54,footprint.y/.255),.002,.50);
    float clarity=1.-smoothstep(.055,.40,aa);
    float grainFade=1.-smoothstep(.012,.065,max(footprint.x,footprint.y));
    float irregular=.026*(stoneNoise(p*6.5)-.5);
    float course=floor(grid.y+irregular);
    float shift=.5*mod(course,2.)+.27*(stoneHash(vec2(course,3.))-.5);
    vec2 g=vec2(grid.x+shift+irregular,grid.y+irregular);
    vec2 block=floor(g),rim=min(fract(g),1.-fract(g));
    float distanceToJoint=min(rim.x,rim.y);
    float gap=1.-smoothstep(.016-aa*.6,.047+aa*.6,distanceToJoint);
    // Normal derivatives see only analytic, unfiltered heights. Coverage
    // weights determined using screen derivatives are applied afterwards.
    float rawJoint=1.-smoothstep(.012,.052,distanceToJoint);
    float relief=.0060*(1.-rawJoint);
    float lateral=stoneNoise(p*vec2(2.4,.52))-.5;
    float fine=stoneNoise(p*38.)-.5;
    #if DRESSED_ARCH == 1
     // Buttresses and portal dressing are hand-finished and smoother than
     // coursed wall stone: only broad tonal variation and tiny grit.
     return StoneSample(.028*(stoneNoise(p*1.7)-.5)+.035*fine*grainFade,0.,0.,.0006*fine,clarity,grainFade);
    #else
     float face=.18*(stoneHash(block+vec2(17.,-9.))-.5)*clarity;
     float seep=.032*lateral+.020*(stoneNoise(p*.21)-.5);
     return StoneSample(face+seep+.055*fine*grainFade,gap*clarity,relief,.0024*fine,clarity,grainFade);
    #endif
   }`);
  shader.fragmentShader=replace(shader.fragmentShader,'#include <color_fragment>',`#include <color_fragment>
   StoneSample stone=stoneSurface(stonePlane());
   diffuseColor.rgb*=1.+stone.tonal;
   diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.59,.61,.66),.56*stone.seam);`);
  shader.fragmentShader=replace(shader.fragmentShader,'#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   roughnessFactor=clamp(roughnessFactor+.065*stone.seam-.27*stone.tonal,.7,.97);`);
  shader.fragmentShader=replace(shader.fragmentShader,'#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   // Local mini-relief in metres. Gradient is filtered before normal change
   // to avoid making distant courses shimmer or look like separate geometry.
   vec3 stoneDx=dFdx(-vViewPosition),stoneDy=dFdy(-vViewPosition);
   vec3 stoneTx=cross(stoneDy,normal),stoneTy=cross(normal,stoneDx);
   float stoneDet=dot(stoneDx,stoneTx);
   vec2 dh=vec2(dFdx(stone.relief),dFdy(stone.relief))*stone.clarity+
    vec2(dFdx(stone.grain),dFdy(stone.grain))*stone.grainFade;
   if(abs(stoneDet)>1e-10) {
    vec3 slope=sign(stoneDet)*(dh.x*stoneTx+dh.y*stoneTy);
    normal=normalize(abs(stoneDet)*normal-slope);
   }`);
 };
 return material;
}
