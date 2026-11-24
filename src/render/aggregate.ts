import * as THREE from 'three';
import {GRAVEL_SOURCE_SHA256, GRAVEL_SOURCE_COUNT, GRAVEL_SOURCE_BITS} from './gravel.generated.ts';

/** One new surface value, not a new attribute. Kind zero stays original
 * generic fallback (including unverified source, both unknown rows). */
export const GRAVEL_KIND = 16;
export const GRAVEL_INTERNAL_FLAG = 128;
export const GRAVEL_RAW_SIZE = 320 * 320 * 4;
export const GRAVEL_RAW_SHA256 = 'c6fab144f5b34069c8993d452c67ab67d5328c05c2e3f2405693deb42d183548';
export function gravelAuthority(count:number,digest?:string) {
 if (count!==GRAVEL_SOURCE_COUNT || digest!==GRAVEL_SOURCE_SHA256)return undefined;
 try { const b=atob(GRAVEL_SOURCE_BITS);
  return b.length===Math.ceil(count/8)?b:undefined;
 } catch { return undefined; }
}
export function classifiedGravel(authority:string|undefined,ordinal:number,flags:number){
 return !!authority && !(flags&24) && Number.isInteger(ordinal) &&
   ordinal>=0&&ordinal<GRAVEL_SOURCE_COUNT && !!(authority.charCodeAt(ordinal>>3)&(1<<(ordinal&7)));
}

export async function aggregateTexture(bytes:Uint8Array){
 if(bytes.byteLength!==GRAVEL_RAW_SIZE||!globalThis.crypto?.subtle)return undefined;
 const exact=Uint8Array.from(bytes);
 try{
  const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',exact));
  if(Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('')!==GRAVEL_RAW_SHA256)return undefined;
 }catch{return undefined;}
 const map=new THREE.DataTexture(exact,320,320,THREE.RGBAFormat,THREE.UnsignedByteType);
 map.name='Original compact-aggregate material study';map.colorSpace=THREE.NoColorSpace;
 map.wrapS=map.wrapT=THREE.RepeatWrapping;
 map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;
 map.generateMipmaps=true;map.anisotropy=4;map.needsUpdate=true;return map;
}

export function gravelPilot(texture?:THREE.Texture){
 return {aggregateMap:{value:texture??null},aggregateGain:{value:texture?1:0},aggregateEyeAGL:{value:Infinity}};
}
export type GravelPilot=ReturnType<typeof gravelPilot>;

function at(source:string,anchor:string,next:string){
 if(source.indexOf(anchor)<0||source.indexOf(anchor)!==source.lastIndexOf(anchor))throw Error('Aggregate pilot compile anchor changed: '+anchor);
 return source.replace(anchor,next);
}

/** Detached adapter after the existing road shader. Source-positive grade only;
 * projection, geometry, road depth, old class logic and casts remain intact.
 * Different program key prevents accidental use by stock renderer variants. */
export function applyGravelPilot(material:THREE.MeshStandardMaterial,look:GravelPilot){
 const stock=material.onBeforeCompile;const cache=material.customProgramCacheKey();
 material.customProgramCacheKey=()=>cache+'|mapped-aggregate-b1';
 material.onBeforeCompile=(p,r)=>{
  stock.call(material,p,r);Object.assign(p.uniforms,look);
  p.vertexShader=at(p.vertexShader,'#include <common>',`
   #include <common>
   varying vec2 vAggregateMetric;
  `);
  p.vertexShader=at(p.vertexShader,'vRoadSurface=roadSurface;',`
   vRoadSurface=roadSurface;
   // 5 km owner origins are multiples of 2,500 m. 10 m aligns both
   // periodic phases, including the rational 3/5,4/5 rotation.
   // Derivatives come from metre-local geometry, not 100 km Float32 world XZ.
   vAggregateMetric=position.xz+mod(modelMatrix[3].xz,vec2(10.));
  `);
  p.fragmentShader=at(p.fragmentShader,'#include <common>',`
   #include <common>
   varying vec2 vAggregateMetric;
   uniform sampler2D aggregateMap;
   uniform float aggregateGain,aggregateEyeAGL;
  `);
  p.fragmentShader=at(p.fragmentShader,'#include <color_fragment>',`
   #include <color_fragment>
   vec3 aggregateBasis=diffuseColor.rgb;
  `);
  p.fragmentShader=at(p.fragmentShader,'#include <alphatest_fragment>',`
   vec2 aggregateBump=vec2(0.);
   float aggregateRough=.98;
   float aggregateAmount=0.;
   if(aggregateGain>.0001&&aggregateEyeAGL<220.){
    // This gate is constant across the draw, so derivative quads remain legal.
    vec2 ma=dFdx(vAggregateMetric),mb=dFdy(vAggregateMetric);
    float px=max(length(ma),length(mb));
    float exactClass=1.-step(.001,abs(vRoadSurface.y-${(GRAVEL_KIND/127).toFixed(9)}));
    float dist=length(vViewPosition);
    aggregateAmount=exactClass*min(aggregateGain,1.)*
      (1.-smoothstep(116.,220.,aggregateEyeAGL))*
      (1.-smoothstep(124.,485.,dist))*(1.-smoothstep(1.75,4.8,px));
    if(aggregateAmount>.0001){
     float patchA=roadNoise(vRoadWorld*.292+vec2(17.2,-36.7));
     float patchB=roadNoise(vRoadWorld*.086+vec2(-78.,53.8));
     float resolvedTransition=1.-smoothstep(.16,.54,px);
     vec2 breakXY=mat2(.875,.484,-.484,.875)*vRoadWorld;
     float gritBeds=roadNoise(breakXY*1.19+vec2(32.7,3.5));
     float dustBands=roadNoise(breakXY*.73+vec2(-13.7,20.5));
     float fines=smoothstep(.23,.79,patchA*.48+patchB*.30+dustBands*.22);
     float luma=dot(aggregateBasis,vec3(.2126,.7152,.0722));
     vec3 cool=vec3(1.028,.998,.925)*luma;
     vec3 earth=vec3(1.235,.974,.696)*luma;
     vec3 clean=mix(cool,earth,.20+.68*fines);
     // Separate metre-scale variations in the amount of fine mineral
     // from unresolved subcentimeter relief. No literal tire lines.
     clean*=.965+(patchA-.5)*.17+(patchB-.5)*.16+
              (dustBands-.5)*.135+(gritBeds-.5)*(.07+.13*resolvedTransition);
     float grain=1.-smoothstep(.052,.148,px);
     if(grain>.0001){
      const mat2 turn=mat2(.6,.8,-.8,.6);
      vec2 uv=vAggregateMetric*.5, alternate=turn*uv+vec2(.373,.157);
      vec4 first=textureGrad(aggregateMap,uv,ma*.5,mb*.5);
      vec4 other=textureGrad(aggregateMap,alternate,turn*ma*.5,turn*mb*.5);
      float topoMix=smoothstep(.28,.72,patchB*.64+patchA*.36);
      vec4 combined=mix(first,other,topoMix);
      float chips=(combined.r-128./255.)*(.84-.32*fines)*grain;
      clean*=exp(chips*1.90);
      vec2 slope=mix(first.gb-128./255.,transpose(turn)*(other.gb-128./255.),topoMix);
      aggregateBump=slope*(1.08-.35*fines)*aggregateAmount*grain;
      aggregateRough=mix(.87,1.,combined.a);
     }
     // Discontinuous, terrain-revealing contacts INSIDE the existing
     // strip. This does not assert the location or width of real shoulders.
     float edge=abs(vRoadSurface.x);
     float wear=roadNoise(vRoadWorld*.686+vec2(2.4,9.1));
     float inside=mix(.798,.944,wear*.65+patchA*.18+gritBeds*.17);
     float rag=1.-smoothstep(inside,1.0,edge);
     float place=(1.-smoothstep(.08,.78,edgePx))*
        (1.-smoothstep(75.,173.,dist))*aggregateAmount;
     clean=mix(clean,clean*vec3(1.04,.94,.87),smoothstep(.49,.93,edge)*.20*wear);
     diffuseColor.rgb=mix(diffuseColor.rgb,clean,aggregateAmount);
     diffuseColor.a*=mix(1.,rag,.94*place);
     if(diffuseColor.a<.025)discard;
    }
   }
   #include <alphatest_fragment>
  `);
  p.fragmentShader=at(p.fragmentShader,'#include <roughnessmap_fragment>',`
   #include <roughnessmap_fragment>
   if(aggregateAmount>.0001)roughnessFactor=mix(roughnessFactor,aggregateRough,aggregateAmount*.68);
  `);
  p.fragmentShader=at(p.fragmentShader,'#include <normal_fragment_maps>',`
   #include <normal_fragment_maps>
   if(dot(aggregateBump,aggregateBump)>0.){
    vec3 bn=mat3(viewMatrix)*vec3(aggregateBump.x,0.,aggregateBump.y);
    normal=normalize(normal+bn-normal*dot(normal,bn));
   }
  `);
 };
 material.needsUpdate=true;
}
