import { MeshStandardMaterial } from 'three';
/** Source-independent shaders for a private Georgetown detached comparison.
 * Nominal width/color choices are artistic, not geometry measurements. */
export type InnSurface='blueLap'|'charcoalRoof'|'paintedCase';
const palette={
 blueLap:{paint:0x315e77,roughness:.84},
 charcoalRoof:{paint:0x58595a,roughness:.90},
 paintedCase:{paint:0xd8d7cf,roughness:.68},
} as const;
const standard=`
varying vec2 vGeorgetownMetric;
float peiInnHash(vec2 p) {
 vec3 q=fract(vec3(p.xyx)*vec3(.1031,.10369,.09513));
 q+=dot(q,q.yzx+31.83);
 return fract((q.x+q.y)*q.z);
}
float peiInnIntegrated(float p,float a,float b){
 return floor(p)*(b-a)+clamp(fract(p)-a,0.,b-a);
}
float peiInnBand(float p,float a,float b,float w){
 return clamp((peiInnIntegrated(p+w*.5,a,b)-peiInnIntegrated(p-w*.5,a,b))/w,0.,1.);
}
float peiInnFwidth(float p){return max(.014,fwidth(p));}
float peiInnSoftNoise(vec2 p){
 vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
 return mix(mix(peiInnHash(i),peiInnHash(i+vec2(1.,0.)),f.x),
   mix(peiInnHash(i+vec2(0.,1.)),peiInnHash(i+vec2(1.,1.)),f.x),f.y);
}
vec3 peiInnBlueLap(vec2 m){
 float v=m.y/.164, dv=peiInnFwidth(v);
 float lap=peiInnBand(v,0.,.090,dv), lip=peiInnBand(v,.092,.143,dv);
 float coarse=peiInnSoftNoise(vec2(.34*m.x,.9*m.y))-.5;
 float f=1.-smoothstep(.22,.96,dv);
 vec2 grainAx=vec2(m.x*1.1,m.y*62.+.12*sin(m.x*4.2));
 float gr=(peiInnSoftNoise(grainAx)-.5)*(1.-smoothstep(.2,1.0,max(fwidth(grainAx.x),fwidth(grainAx.y))));
 return vec3(1.+.103*coarse+.052*gr-.245*lap+.11*lip*f, -.024*coarse, .048*lap-.029*lip*f);
}
vec3 peiInnCharcoal(vec2 m){
 float r=m.y/.154, v=peiInnFwidth(r);
 float course=peiInnBand(r,.025,.108,v);
 float spacing=m.x/.292;
 float seam=.0;
 // Blend the stagger instead of assigning per-row integer changes across quads.
 float lane=(1.-smoothstep(.3,.88,v))*smoothstep(.07,.2,fract(r))*(1.-smoothstep(.84,.97,fract(r)));
 float u=spacing+.49*mod(floor(r),2.);
 seam=peiInnBand(u,.03,.064,peiInnFwidth(spacing))*lane;
 float outline=(peiInnSoftNoise(vec2(.32*m.x,.42*m.y))-.5)*.115;
 vec2 micro=m*vec2(21.,30.);
 float granule=(peiInnSoftNoise(micro)-.5)*.055*(1.-smoothstep(.25,1.1,max(fwidth(micro.x),fwidth(micro.y))));
 return vec3(1.+outline+granule-.210*course-.150*seam,.003*outline,.072*course+.038*seam);
}
`;
const roles={blueLap:'peiInnBlueLap',charcoalRoof:'peiInnCharcoal'} as const;
const exactly=(s:string,k:string)=>s.indexOf(k)>=0&&s.indexOf(k)===s.lastIndexOf(k);
export function applyInnSurface(vertex:string,fragment:string,s:InnSurface){
 if(s==='paintedCase')return;
 const C='#include <common>',V='#include <uv_vertex>',F='#include <color_fragment>',R='#include <roughnessmap_fragment>';
 if(![C,V].every(k=>exactly(vertex,k))||![C,F,R].every(k=>exactly(fragment,k))||vertex.includes('vGeorgetownMetric')||fragment.includes('vGeorgetownMetric'))return;
 return {
  vertex:vertex.replace(C,C+'\nvarying vec2 vGeorgetownMetric;').replace(V,V+'\nvGeorgetownMetric=uv;'),
  fragment:fragment.replace(C,C+'\n'+standard)
    .replace(F,F+`\nvec3 localInn=${roles[s]}(vGeorgetownMetric);\ndiffuseColor.rgb*=vec3(localInn.x+localInn.y,localInn.x,localInn.x-localInn.y);\n`)
    .replace(R,R+'\nroughnessFactor=clamp(roughnessFactor+localInn.z,.55,.98);'),
 };
}
export function makeInnSurface(s:InnSurface,details=true){
 const r=palette[s],mat=new MeshStandardMaterial({color:r.paint,roughness:r.roughness,metalness:0});
 mat.name='Private original Georgetown / '+s;
 if(details&&s!=='paintedCase'){
  mat.onBeforeCompile=q=>{
   const shaders=applyInnSurface(q.vertexShader,q.fragmentShader,s);
   if(shaders){q.vertexShader=shaders.vertex;q.fragmentShader=shaders.fragment;}
  };
  mat.customProgramCacheKey=()=>`pei-georgetown-finish-intake-v1/${s}`;
 }
 return mat;
}
