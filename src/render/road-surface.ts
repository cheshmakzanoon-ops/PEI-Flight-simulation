import type {MeshStandardMaterial} from 'three';
import {victoriaPavingGLSL,VICTORIA_PAVER_KIND} from './victoria-pavers.ts';
import type {RoadPavement} from './road-pavement.ts';
import {northCapeShadowGLSL,type NorthCapeShadow} from './north-cape-shadow.ts';
import {buildingShadowGLSL,type BuildingShadows} from './local-building-shadows.ts';

/** World-space surfacing for the registered ribbons. Nothing here implies lane or shoulder survey data. */
export function addRoadSurface(material:MeshStandardMaterial,casts?:BuildingShadows,pavement?:RoadPavement,seat?:{value:number},victoria=false,cape?:NorthCapeShadow){
 material.customProgramCacheKey=()=> 'pei-road-surface-v3'+(casts?'-cast':'')+(pavement?'-pavement':'')+(seat?'-seat':'')+(victoria?'-victoria':'')+(cape?'-cape':'');
 material.onBeforeCompile=(shader)=>{
  if(casts)Object.assign(shader.uniforms,casts.uniforms);
  if(cape)Object.assign(shader.uniforms,cape.uniforms);
  if(pavement)Object.assign(shader.uniforms,pavement.uniforms);
  if(seat)shader.uniforms.roadSeatGain=seat;
  shader.vertexShader=shader.vertexShader.replace('#include <common>',`
   #include <common>
   attribute vec2 roadSurface;
   ${seat?`attribute float roadSeatDelta;uniform float roadSeatGain;
   float roadSeatAmount(){
    vec2 world=(modelMatrix*vec4(position,1.)).xz;
    return roadSeatGain*(1.-smoothstep(350.,900.,length(world-cameraPosition.xz)));
   }`:''}
   varying vec2 vRoadSurface,vRoadWorld;
   ${seat?'varying float vSeatDisplaced;':''}
   ${casts||cape?'varying vec3 localRoadReceiver;':''}
  `).replace('#include <begin_vertex>',`
   #include <begin_vertex>
   ${seat?'float seatDelta=roadSeatAmount()*roadSeatDelta;transformed.y+=seatDelta;vSeatDisplaced=abs(seatDelta);':''}
   vRoadSurface=roadSurface;
   vRoadWorld=(modelMatrix*vec4(position,1.)).xz;
   ${casts||cape?'localRoadReceiver=(modelMatrix*vec4(transformed,1.)).xyz;':''}
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`
   #include <common>
   varying vec2 vRoadSurface,vRoadWorld;
   ${seat?'varying float vSeatDisplaced;':''}
   ${casts||cape?'varying vec3 localRoadReceiver;':''}
   ${casts?buildingShadowGLSL:''}
   ${cape?northCapeShadowGLSL:''}
   ${pavement?`uniform sampler2D roadPaveA,roadPaveB;
   uniform float roadPaveBlend;`:''}
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
   ${victoria?victoriaPavingGLSL:''}
  `).replace('#include <color_fragment>',`
   #include <color_fragment>
   ${pavement?'vec3 roadPaveBasis=diffuseColor.rgb;':''}
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
   ${victoria?`
   vec2 victoriaUV=victoriaLocal(vRoadWorld);
   float victoriaMarker=1.-step(.002,abs(vRoadSurface.y-${(VICTORIA_PAVER_KIND/127).toFixed(8)}));
   float victoriaBlend=victoriaMarker*victoriaWeight(victoriaUV);
   vec3 victoriaNormal=vec3(0.);
   float victoriaRough=.95;
   `:''}
   ${pavement?`
   // At a grazing angle meter-per-screen-pixel filtering fades the material
   // before individual stones alias. Only existing paved-class ribbons use it.
   float paveClass=step(.22,vRoadSurface.y)*(1.-step(.76,vRoadSurface.y));
   float roadPaveAmount=roadPaveBlend*paveClass*(1.-smoothstep(.06,.40,px))${victoria?"*(1.-victoriaBlend)":""};
   vec3 roadPaveNormal=vec3(0.);
   float roadPaveRough=.98;
   mat2 rotatePave=mat2(.804617,.593794,-.593794,.804617);
   vec2 auv=vRoadWorld/2.,buv=rotatePave*vRoadWorld/2.5+vec2(.31,.57);
   vec2 adx=dFdx(auv),ady=dFdy(auv),bdx=dFdx(buv),bdy=dFdy(buv);
   if(roadPaveAmount>.0001){
    vec4 a=textureGrad(roadPaveA,auv,adx,ady);
    vec4 b=textureGrad(roadPaveB,buv,bdx,bdy);
    // Irregular slow blend between two distinct aggregate scans; no sampled
    // crack/repair implies the state of any specific PEI road.
    float up=(roadNoise(vRoadWorld*.171+vec2(8.2,2.3))*.70
      +roadNoise(vRoadWorld*.053+vec2(1.2,7.7))*.30);
    float variant=smoothstep(.18,.82,up);
    float tone=mix(a.r,b.r,variant);
    float subduedWear=1.+.075*(roadNoise(vRoadWorld*.087)-.5);
    float useEdge=smoothstep(.72,.98,abs(vRoadSurface.x))*(1.-smoothstep(.10,.63,edgePx));
    vec3 newer=mix(roadPaveBasis*subduedWear,vec3(.21,.15,.11),useEdge*.12);
    diffuseColor.rgb=mix(diffuseColor.rgb,newer*exp((tone-.5)*2.21),roadPaveAmount);
    // Bitmap rows run along +z/positive v. The original OpenGL green
    // component points opposite increasing source rows.
    vec2 alongRows=vec2(1.,-1.);
    vec2 tangent=mix((a.gb*2.-1.)*alongRows,transpose(rotatePave)*((b.gb*2.-1.)*alongRows),variant);
    roadPaveNormal=vec3(tangent.x,0.,tangent.y)*(.25*roadPaveAmount);
    roadPaveRough=clamp(.79+.19*mix(a.a,b.a,variant),.79,.98);
   }
   `:''}
   ${victoria?`
   if(victoriaBlend>.0001){
    vec3 pavers=victoriaPaver(victoriaUV,px,victoriaNormal,victoriaRough);
    diffuseColor.rgb=mix(diffuseColor.rgb,pavers,victoriaBlend);
   }
   `:''}
  `);
  if(seat)shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',`
   #include <normal_fragment_begin>
   vec3 physicalRoadNormal=normalize(cross(dFdx(vViewPosition),dFdy(vViewPosition)));
   if(vSeatDisplaced>.000001)normal=dot(normal,physicalRoadNormal)<0.?-physicalRoadNormal:physicalRoadNormal;
  `);
  if(pavement)shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
   #include <roughnessmap_fragment>
   if(roadPaveAmount>.0001)roughnessFactor=mix(roughnessFactor,roadPaveRough,roadPaveAmount);
  `).replace('#include <normal_fragment_maps>',`
   #include <normal_fragment_maps>
   if(roadPaveAmount>.0001){
    vec3 tangentNormal=mat3(viewMatrix)*roadPaveNormal;
    normal=normalize(normal+tangentNormal-normal*dot(normal,tangentNormal));
   }
  `);
  if(victoria)shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
   #include <roughnessmap_fragment>
   if(victoriaBlend>.0001)roughnessFactor=mix(roughnessFactor,victoriaRough,victoriaBlend);
  `).replace('#include <normal_fragment_maps>',`
   #include <normal_fragment_maps>
   if(victoriaBlend>.0001){
    vec3 bump=mat3(viewMatrix)*(victoriaNormal*victoriaBlend);
    normal=normalize(normal+bump-normal*dot(normal,bump));
   }
  `);
  if(cape)shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
   float roadCapeShade=capeShade(localRoadReceiver,normalize(vec3(-.60,.74,-.31)),distance(cameraPosition,localRoadReceiver));
   outgoingLight*=mix(vec3(1.),vec3(.54,.60,.65),roadCapeShade);
   #include <opaque_fragment>
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
