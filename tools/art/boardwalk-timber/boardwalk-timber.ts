import {MeshStandardMaterial} from 'three';

export type TimberRole='deck'|'edge';
export type TimberVariant='flat'|'tone'|'full'|'relief-tone'|'relief';
export const timberRelief=(v:TimberVariant|undefined)=>v==='relief-tone'||v==='relief';
// In the relief comparison only, put the true terminal faces in a
// separate UV chart inside the existing attribute. The 8m offset is a
// role tag, not an offset to the model or a second stream.
export const TIMBER_TERMINAL_U_TAG=8;
export const TIMBER_VIEW_RECIPE=Object.freeze({
 // Nominal 8-inch visual rhythm prompted by the tender; no actual on-site
 // spacing or gaps measured. This estimate is NOT the tender's tolerance.
 visualBoardPitchM:.2032,authorHalfGrooveFraction:.014,minFilter:.040,
});
export function integratedTimberGroove(stationM:number, footprintM:number){
 const t=stationM/TIMBER_VIEW_RECIPE.visualBoardPitchM;
 const w=Math.max(TIMBER_VIEW_RECIPE.minFilter, Math.abs(footprintM)/TIMBER_VIEW_RECIPE.visualBoardPitchM);
 const half=TIMBER_VIEW_RECIPE.authorHalfGrooveFraction;
 const band=(f:number)=>Math.min(f,half)+Math.max(f-(1-half),0);
 const a=t-w*.5,b=t+w*.5,ka=Math.floor(a),kb=Math.floor(b);
 return Math.min(1,Math.max(0,((kb-ka)*(2*half)+band(b-kb)-band(a-ka))/w));
}
const standard=/* glsl */`
varying vec2 vPeiTimberM;
float peiTimberHash(vec2 q){
 vec3 v=fract(vec3(q.xyx)*vec3(.1047,.1093,.0971));
 v+=dot(v,v.yzx+29.41);
 return fract((v.x+v.y)*v.z);
}
float peiTimberNoise(vec2 q){
 vec2 f=fract(q);f=f*f*(3.-2.*f);
 vec2 i=floor(q);
 return mix(mix(peiTimberHash(i),peiTimberHash(i+vec2(1.,0.)),f.x),
  mix(peiTimberHash(i+vec2(0.,1.)),peiTimberHash(i+vec2(1.,1.)),f.x),f.y);
}
float peiTimberAnti(vec2 c){
 vec2 w=fwidth(c);
 return 1.-smoothstep(.27,1.30,max(w.x,w.y));
}
float peiTimberUnitGroove(float f){
 const float h=.014;
 return min(f,h)+max(f-(1.-h),0.);
}
float peiTimberGroove(float t,float w){
 // Exact box-filtered periodic dark coverage, including intervals crossing
 // integer seams. Differentiate the coordinate only, not filtered output.
 w=max(.040,w);
 float a=t-.5*w,b=t+.5*w;
 float ia=floor(a),ib=floor(b);
 return clamp(((ib-ia)*.028+peiTimberUnitGroove(fract(b))-peiTimberUnitGroove(fract(a)))/w,0.,1.);
}
vec3 peiTimberPatina(vec2 p,float edge){
 float t=p.y/.2032,w=fwidth(t), i=floor(t),f=fract(t);
 float freq=1.-smoothstep(.24,1.13,w);
 float s=clamp(.061+.5*w,.063,.48);
 float base=peiTimberHash(vec2(i,5.39)),a=peiTimberHash(vec2(i-1.,5.39)),b=peiTimberHash(vec2(i+1.,5.39));
 float board=(base + .5*(a-base)*(1.-smoothstep(0.,s,f)) +
                    .5*(b-base)*smoothstep(1.-s,1.,f) -.5)*freq;
 vec2 flow=vec2(p.x*.89,p.y*.53);
 float weather=(peiTimberNoise(flow)-.5)*peiTimberAnti(flow);
 // Plank fibers follow the across-walk meter axis. Fine dark fibers are
 // procedural decor, not footprints, stain from a sample, or hardware.
 vec2 fiber=vec2(p.x*1.32,p.y*49.3+.131*sin(p.x*7.7)+.103*sin(p.x*3.8+p.y*5.2));
 float grain=(peiTimberNoise(fiber)-.5)*peiTimberAnti(fiber)*freq;
 float groove=peiTimberGroove(t,w);
 float tone=1.+.158*board+.137*weather+.094*grain-.202*groove;
 float chroma=.026*board-.018*weather;
 float rough=.076*weather-.053*board+.034*groove;
 return vec3(tone+.017*edge*weather,chroma,rough);
}
`;
const extraNormal=/* glsl */`
vec3 peiTimberMicroNormal(vec3 n,vec3 P,vec2 uvM){
 vec2 tx=dFdx(uvM),ty=dFdy(uvM);
 vec3 dx=dFdx(P),dy=dFdy(P);
 float wobble=uvM.x*2.23+uvM.y*1.82;
 float a=uvM.y*109.9+.48*sin(wobble);
 float b=uvM.y*74.3-.29*sin(uvM.x*6.18);
 vec2 derivA=vec2(.48*2.23*cos(wobble),109.9+.48*1.82*cos(wobble));
 vec2 derivB=vec2(-.29*6.18*cos(uvM.x*6.18),74.3);
 float fadeA=1.-smoothstep(.08,.37,max(abs(dot(derivA,tx)),abs(dot(derivA,ty)))*.15915494);
 float fadeB=1.-smoothstep(.08,.38,max(abs(dot(derivB,tx)),abs(dot(derivB,ty)))*.15915494);
 vec2 slope=(.00027*cos(a)*fadeA)*derivA+(.00018*cos(b)*fadeB)*derivB;
 // Standard differential-height expression in view space; derivative
 // operands are prefilter coordinates, never derivatives of derivatives.
 vec3 rx=cross(dy,n),ry=cross(n,dx);
 float d=dot(dx,rx);
 float normGain=max(abs(d),1e-9);
 vec3 v=n*normGain-sign(d)*(dot(slope,tx)*rx+dot(slope,ty)*ry);
 return normalize(v);
}
`;
const reliefPatina=/* glsl */`
vec3 peiTimberReliefPatina(vec2 p,float edge){
 vec3 base=peiTimberPatina(p,edge);
 float t=p.y/.2032,w=fwidth(t);
 float fade=1.-smoothstep(.19,.91,w);
 vec2 breakup=vec2(p.x*2.12,p.y*1.48);
 float splits=(peiTimberNoise(breakup)-.5)*peiTimberAnti(breakup);
 float groove=peiTimberGroove(t,w);
 // Lower the old optically printed seam further only on the actual narrow
 // groove, with intermittent variation across the length of the plank.
 // Use the same box integral even during phase shifts and near→far.
 float depth=.223+(.119*splits)*fade;
 float shadow=depth*groove;
 float shoulder = peiTimberGroove(t+.037,w);
 float bright = .039*(shoulder-.028)*fade;
 base.x+=bright-shadow;
 base.z+=.047*groove+.018*splits*fade;
 return base;
}
vec3 peiTimberSawnEnds(vec2 p){
 // Same broad weather-gray finish, with effectively horizontal growth
 // stripes and shallow pore grain across the real exposed terminal faces.
 // No cut-end photograph or actual joinery details.
 vec2 rings=vec2(p.x*1.83,p.y*93.1+.27*sin(p.x*14.61));
 vec2 pores=vec2(p.x*24.2,p.y*50.7);
 float coarse=peiTimberNoise(vec2(p.x*1.26,p.y*9.2))-.5;
 float ring=(peiTimberNoise(rings)-.5)*peiTimberAnti(rings);
 float pore=(peiTimberNoise(pores)-.5)*peiTimberAnti(pores);
 return vec3(.962+.152*coarse+.193*ring+.076*pore,.011*coarse,.019-.028*ring);
}
`;
const reliefNormal=/* glsl */`
vec3 peiTimberReliefGroove(vec3 n,vec3 P,vec2 uvM){
 float t=uvM.y/.2032;
 float f=fract(t+.5)-.5;
 vec2 du=vec2(dFdx(t),dFdy(t));
 float fade=1.-smoothstep(.04,.175,abs(du.x)+abs(du.y));
 float ramp=clamp((abs(f)-.013)/.045,0.,1.);
 // A shallow spline shoulder. The slope is zero both at the dark
 // finger and at the start of the broad flat timber. Screen derivatives
 // are of the raw metric coordinate only.
 float dh=(.00110/.045)*6.*ramp*(1.-ramp)*sign(f)*fade;
 vec3 dx=dFdx(P),dy=dFdy(P),rx=cross(dy,n),ry=cross(n,dx);
 float det=dot(dx,rx);
 return normalize(max(abs(det),1e-9)*n-sign(det)*dh*(du.x*rx+du.y*ry));
}
`;
const once=(s:string,k:string)=>s.indexOf(k)>=0&&s.indexOf(k)===s.lastIndexOf(k);
export function patchBoardwalkTimber(vertex:string,fragment:string,role:TimberRole,variant:TimberVariant='full'){
 const common='#include <common>',uv='#include <uv_vertex>',color='#include <color_fragment>',
  rough='#include <roughnessmap_fragment>', normal='#include <normal_fragment_maps>';
 if(variant==='flat')return;
 const relief=timberRelief(variant),micro=role==='deck'&&(variant==='full'||variant==='relief');
 if(![common,uv].every(x=>once(vertex,x))||![common,color,rough,normal].every(x=>once(fragment,x))||
  vertex.includes('vPeiTimberM')||fragment.includes('vPeiTimberM'))return;
 const pre=role==='deck'?'0.':'1.';
 const p='vPeiTimberM';
 const shade=relief?(role==='deck'?`peiTimberReliefPatina(${p},${pre})`:
  `mix(peiTimberReliefPatina(${p},${pre}),peiTimberSawnEnds(vec2(${p}.x-8.,${p}.y)),step(4.,${p}.x))`):
  `peiTimberPatina(${p},${pre})`;
 const perturb=micro?('\nnormal=peiTimberMicroNormal(normal,-vViewPosition,vPeiTimberM);\n'+
  (relief?'normal=peiTimberReliefGroove(normal,-vViewPosition,vPeiTimberM);\n':'')):'';
 return {
  vertex:vertex.replace(common,common+'\nvarying vec2 vPeiTimberM;').replace(uv,uv+'\nvPeiTimberM=uv;'),
  fragment:fragment.replace(common,common+'\n'+standard+(relief?reliefPatina:'')+(micro?extraNormal:'')+(micro&&relief?reliefNormal:''))
   .replace(color,color+`\nvec3 peiTimberP=${shade};
diffuseColor.rgb *= vec3(peiTimberP.x+peiTimberP.y,peiTimberP.x,peiTimberP.x-peiTimberP.y);\n`)
   .replace(rough,rough+'\nroughnessFactor=clamp(roughnessFactor+peiTimberP.z,.67,.99);\n')
   .replace(normal,normal+perturb),
 };
}
export function makeBoardwalkTimber(role:TimberRole,variant:TimberVariant='full'){
 const deck=role==='deck';
 const material=new MeshStandardMaterial({name:'Detached timber / '+role,color:deck?0x979186:0x726d63,roughness:deck?.86:.92,metalness:0});
 if(variant==='flat')return material;
 material.onBeforeCompile=q=>{
  const patch=patchBoardwalkTimber(q.vertexShader,q.fragmentShader,role,variant);
  if(patch){q.vertexShader=patch.vertex;q.fragmentShader=patch.fragment;}
 };
 material.customProgramCacheKey=()=>`pei-seawalk-detached-timber-v1/${role}/${variant}`;
 return material;
}
