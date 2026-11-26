/** Exact same original geometry, shape and draw. Only an alternate original
 * needle-bearing atlas tile over approved display slots, with continuous fade.
 * Zero and one take the native single-pair atlas sample; fractional support
 * blends old and new premultiplied colour/coverage, never their atlas columns. */
export const CAPE_DISPLAY='northCapeStandDisplay';
export const CAPE_LIVE='northCapeStandLive';
export const CAPE_VIEW_RULE={near0:170,near1:255,far1:690,far0:790,slope0:.05,slope1:.14,tilt1:.25,tilt0:.42} as const;
const ease=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
export const capeTilt=(rayY:number)=>ease((rayY-.19)/(.8-.19));
export function capeCardGain(distance:number,rayY:number){
 if(!Number.isFinite(distance)||!Number.isFinite(rayY))return 0;
 const k=CAPE_VIEW_RULE;
 return ease((distance-k.near0)/(k.near1-k.near0))*(1-ease((distance-k.far1)/(k.far0-k.far1)))*
  ease((rayY-k.slope0)/(k.slope1-k.slope0))*(1-ease((capeTilt(rayY)-k.tilt1)/(k.tilt0-k.tilt1)));
}
const vd=' attribute vec3 stem;attribute vec4 shape;varying vec2 vUV;varying vec3 param;';
const ve='  gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);vUV=uv;param=vec3(shape.z,tilt,shape.w);';
const fd=' varying vec2 vUV;varying vec3 param;uniform sampler2D canopy;';
const fu=' vec2 uv=clamp(vUV,vec2(.004),vec2(.996));';
const fs=' float a=mix(side.a,top.a,param.y);if(a<.30)discard;\n vec3 c=mix(side.rgb*side.a,top.rgb*top.a,param.y)/max(a,.001);';
const vary='flat varying vec2 capeStandMix;';
const k=CAPE_VIEW_RULE;
const gl=(n:number)=>Number.isInteger(n)?n+'.':String(n);
export function capeCrownShaders(v:string,f:string){
 if(v.includes(CAPE_DISPLAY)||f.includes(vary)||[vd,ve].some(s=>v.split(s).length!==2)||[fd,fu,fs].some(s=>f.split(s).length!==2))return;
 return {
 vertexShader:v.replace(vd,vd+`\n attribute float ${CAPE_DISPLAY};uniform float ${CAPE_LIVE};${vary}`)
  .replace(ve,`  float standAtlas=shape.z,standMix=0.;
  if(${CAPE_LIVE}>0. && (shape.z==0.||shape.z==1.) && (${CAPE_DISPLAY}==2.||${CAPE_DISPLAY}==3.)){
    float d=distance(cameraPosition,stem+vec3(0.,shape.x*.5,0.));
    float mixGain=${CAPE_LIVE}*smoothstep(${gl(k.near0)},${gl(k.near1)},d)*(1.-smoothstep(${gl(k.far1)},${gl(k.far0)},d))*
      smoothstep(${gl(k.slope0)},${gl(k.slope1)},ray.y)*(1.-smoothstep(${gl(k.tilt1)},${gl(k.tilt0)},tilt));
    if(mixGain>=1.)standAtlas=${CAPE_DISPLAY};else standMix=mixGain;
  }
  capeStandMix=vec2(${CAPE_DISPLAY},standMix);
  gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);vUV=uv;param=vec3(standAtlas,tilt,shape.w);`),
 fragmentShader:f.replace(fd,fd+'\n '+vary)
 // Derivatives have no UV-varying control flow. Sample the alternate atlas
 // with explicit gradients only for fractional gain. Old/full code path exact.
 .replace(fu,fu+'\n vec2 standDx=dFdx(uv)*vec2(.25,.5),standDy=dFdy(uv)*vec2(.25,.5);')
 .replace(fs,` float a=mix(side.a,top.a,param.y);
 vec3 c;
 if(capeStandMix.y>0.){
   vec2 p=vec2((capeStandMix.x+uv.x)*.25,.5*uv.y);
   vec4 otherSide=textureGrad(canopy,p+vec2(0.,.5),standDx,standDy);
   vec4 otherTop=textureGrad(canopy,p,standDx,standDy);
   float b=mix(otherSide.a,otherTop.a,param.y);
   vec3 pm=mix(side.rgb*side.a,top.rgb*top.a,param.y);
   vec3 pn=mix(otherSide.rgb*otherSide.a,otherTop.rgb*otherTop.a,param.y);
   a=mix(a,b,capeStandMix.y);
   if(a<.30)discard;
   c=mix(pm,pn,capeStandMix.y)/max(a,.001);
 }else{
   if(a<.30)discard;
   c=mix(side.rgb*side.a,top.rgb*top.a,param.y)/max(a,.001);
 }`)
 };
}
