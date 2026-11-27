import * as THREE from 'three';
import {opaqueCoverageBlend} from './opaque-coverage-alpha.ts';
import {buildingShadowGLSL,type BuildingShadows} from './local-building-shadows.ts';

/** Original rolled-stone dust: no aerial or vendor pixels. Keep sub-centimetre
 * texture out of the distance path instead of letting it alias in a shallow pass. */
export function confederationMaterial(sun:THREE.Vector3,msaa:boolean,casts?:BuildingShadows,preserveSceneAlpha=false){
 return new THREE.ShaderMaterial({
  vertexShader:`
   attribute vec2 trailOptic;
   varying vec2 strip;varying vec2 optical;varying vec3 wp,wn;
   #include <common>
   #include <logdepthbuf_pars_vertex>
   void main(){
    wp=(modelMatrix*vec4(position,1.)).xyz;wn=normal;strip=uv;optical=trailOptic;
    gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);
    #include <logdepthbuf_vertex>
   }
  `,
  side:THREE.FrontSide,alphaToCoverage:msaa,transparent:false,depthWrite:true,
  ...(msaa&&preserveSceneAlpha?opaqueCoverageBlend:undefined),
  uniforms:{trailSun:{value:sun},trailAGL:{value:0},...casts?.uniforms},
  fragmentShader:`
   varying vec2 strip;varying vec2 optical;varying vec3 wp,wn;
   uniform float trailAGL;uniform vec3 trailSun;
   #include <common>
   #include <logdepthbuf_pars_fragment>
   ${casts?buildingShadowGLSL:''}
   float stoneHash(vec2 p){
    vec3 h=fract(vec3(p.xy,p.x)*vec3(.1031,.11369,.13787));
    h+=dot(h,h.yzx+19.19);return fract((h.x+h.y)*h.z);
   }
   float trailNoise(vec2 p){
    vec2 q=floor(p),d=fract(p);d=d*d*(3.-2.*d);
    return mix(mix(stoneHash(q),stoneHash(q+vec2(1.,0.)),d.x),mix(stoneHash(q+vec2(0.,1.)),stoneHash(q+1.),d.x),d.y);
   }
   void main(){
    #include <logdepthbuf_fragment>
    float distanceXZ=length(cameraPosition.xz-wp.xz),distanceEye=distance(cameraPosition,wp);
    float widthFoot=length(fwidth(wp.xz)),span=abs(strip.x);
    float fade=(1.-smoothstep(1075.,1390.,distanceXZ))*(1.-smoothstep(247.,333.,trailAGL));
    float grainField=trailNoise(wp.xz*.83),weather=trailNoise(wp.xz*.094);
    float border=.72+.105*(grainField-.5);
    float edgeStep=max(.09,min(.28,fwidth(span)));
    float envelope=1.-smoothstep(border,1.+edgeStep*.18,span);
    float coverage=envelope*fade*smoothstep(0.,1.,strip.y);
    if(coverage<${msaa?'.028':'.51'})discard;
    vec3 col=mix(vec3(.247,.225,.192),vec3(.287,.260,.218),optical.x);
    col*=.96+.24*(weather-.46)+.15*(grainField-.47);
    // Broad, irregular wheel and foot polish. It is not a white line, nor specifically worn by a vehicle.
    float middle=span-.38;
    float wear=exp(-8.8*middle*middle)*(.72+.28*weather);
    col+=wear*vec3(.015,.015,.013);
    float shoulder=smoothstep(.58,1.,span)*(.68+.32*grainField);
    col=mix(col,vec3(.146,.142,.110),.23*shoulder);
    if(widthFoot<.21&&distanceEye<244.){
     float fine=(1.-smoothstep(.041,.20,widthFoot))*(1.-smoothstep(93.,244.,distanceEye));
     float grain=mix(38.,28.,optical.x);
     vec2 p=wp.xz*grain,tile=floor(p),v=fract(p);
     float seed=stoneHash(tile);
     vec2 fleck=vec2(stoneHash(tile+vec2(3.14,.12)),stoneHash(tile+vec2(.28,5.31)));
     vec2 j=(v-.25-.50*fleck)*vec2(1.0+.30*seed,.81);
     float relief=1.-smoothstep(.045,.225,length(j));
     float dust=trailNoise(wp.xz*9.3)-.50;
     float visibleChip=1.-smoothstep(.18,.71,widthFoot*grain);
     col+=fine*(vec3(.048,.041,.030)*dust
          +visibleChip*relief*mix(vec3(-.039,-.035,-.030),vec3(.054,.049,.039),seed));
    }
    vec3 n=normalize(wn);float direct=max(0.,dot(n,trailSun));
    col*=.723+.367*direct;
    // Broad mapped woodland exposure, not estimated individual tree shadows.
    col*=mix(1.,.675+.26*weather+.063*grainField,clamp(optical.y,0.,1.));
    ${casts?`float shade=buildingShade(wp,n,distanceEye);col*=mix(vec3(1.),vec3(.68,.75,.83),shade*smoothstep(.04,.55,direct));`:''}
    float haze=1.-exp(-distanceEye*.000020);
    gl_FragColor=vec4(mix(col,vec3(.55,.65,.68),haze),coverage);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }
  `
 });
}
