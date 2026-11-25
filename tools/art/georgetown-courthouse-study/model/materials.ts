import { DoubleSide,MeshStandardMaterial } from 'three';

export const ROLES = ['rubble','foundation','cut','recess','roof','red','glass','metal'] as const;
export type Role = typeof ROLES[number];
const roughness:Record<Role,number>={rubble:.93,foundation:.97,cut:.83,recess:.91,roof:.91,red:.66,glass:.32,metal:.71};
const noise=`
  varying vec2 vCourtUV;
  float courtHash(vec2 p) {
    vec3 f=fract(p.xyx*vec3(.1079,.1031,.0973)); f+=dot(f,f.yzx+31.32);
    return fract((f.x+f.y)*f.z);
  }
  float courtNoise(vec2 p) {
    vec2 j=floor(p),f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(courtHash(j),courtHash(j+vec2(1,0)),f.x),
     mix(courtHash(j+vec2(0,1)),courtHash(j+1.),f.x),f.y);
  }
`;
function attach(m:MeshStandardMaterial,role:Role){
 m.customProgramCacheKey=()=>`georgetown-original-stone-v4-${role}`;
 m.onBeforeCompile=s=>{
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vCourtUV;')
   .replace('#include <uv_vertex>','#include <uv_vertex>\nvCourtUV=uv;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\n'+noise);
  const f=role==='rubble'?`
    vec2 q=vCourtUV;
    float fw=max(length(dFdx(q)),length(dFdy(q))), gain=1.-smoothstep(.045,.245,fw);
    float strata=q.y+.013*sin(q.x*1.17)+.009*sin(q.x*4.6+q.y*.38);
    float fy=strata/.302, row=floor(fy), edgeY=min(fract(fy),1.-fract(fy))*.302;
    float r=courtHash(vec2(row,4.)), width=.53+.44*r, offset=(r-.5)*1.31;
    float fx=(q.x+offset+.048*sin(q.x*.89+row*2.13)) / width;
    float cell=floor(fx), piece=courtHash(vec2(cell,row));
    float boundary=min(fract(fx),1.-fract(fx))*width;
    float warp=(courtNoise(q*4.3+21.)-.5)*.021;
    float keep=1.-smoothstep(.007,max(.017,.027+fw*.26),min(edgeY,boundary)+warp);
    float scarp=courtNoise(q*8.7+piece*23.)-.5;
    float rough=courtNoise(q*31.2+piece*17.)-.5;
    float fade=1.-smoothstep(.015,.067,fw);
    float rowCycle=mod(row,6.), cue=courtHash(vec2(cell*.37,row));
    float banding=(rowCycle<1.0?.16:0.)+smoothstep(.91,.99,cue)*(rowCycle<1.0?.15:.07);
    diffuseColor.rgb*=1.+gain*(.18*(piece-.5)+.19*scarp+.09*rough*fade);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.287,.259,.220),banding*gain);
    diffuseColor.rgb*=1.-keep*gain*.15;
    float courtRelief=(1.-keep)*(.010+.021*scarp+.004*rough*fade)*gain;
  `:role==='roof'?`
    vec2 x=vCourtUV;
    float px=max(length(dFdx(x)),length(dFdy(x))),fade=1.-smoothstep(.029,.138,px);
    float row=floor(x.y/.159),s=fract(x.y/.159);
    float i=floor((x.x+.177*mod(row,2.))/.348);
    float rough=courtNoise(x*34.)-.5;
    float line=1.-smoothstep(.041,max(.065,.098+px*5.7),s);
    diffuseColor.rgb*=1.+fade*(.32*(courtHash(vec2(i,row))-.5)+rough*.10-line*.17);
  `:role==='foundation'?`
    vec2 p=vCourtUV;float px=max(length(dFdx(p)),length(dFdy(p)));
    float courtFoundationFilter=1.-smoothstep(.045,.186,px);
    float y=(p.y+.014*sin(p.x*2.07))/.291, row=floor(y), x=(p.x+.236*mod(row,2.))/.708;
    float stone=courtHash(vec2(floor(x),row)), bluff=courtNoise(p*9.5+18.);
    float joint=1.-smoothstep(.005,.025+px*.48,min(min(fract(y),1.-fract(y))*.291,min(fract(x),1.-fract(x))*.708));
    diffuseColor.rgb*=1.+courtFoundationFilter*(.23*(stone-.5)+.16*(bluff-.5)-.24*joint);
  `:`
    float px=max(length(dFdx(vCourtUV)),length(dFdy(vCourtUV)));
    float grain=(courtNoise(vCourtUV*18.)-.5)*(1.-smoothstep(.017,.095,px));
    diffuseColor.rgb*=1.+grain*${role==='red'?'.11':'.15'};
  `;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+f);
  if(role==='rubble')s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    // Small original normals in view space, fade smoothly when a joint is subpixel.
    vec3 cx=dFdx(-vViewPosition),cy=dFdy(-vViewPosition);
    vec3 ax=cross(cy,normal),ay=cross(normal,cx);
    float det=dot(cx,ax);
    if(abs(det)>1e-13)normal=normalize(abs(det)*normal-sign(det)*(dFdx(courtRelief)*ax+dFdy(courtRelief)*ay));
  `);
 };
}
export function courthouseMaterial(role:Role){
 const m=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:roughness[role],metalness:role==='metal'?.13:0,
  envMapIntensity:role==='glass'?.48:.74});
 if(role!=='glass')attach(m,role);
 return m;
}
