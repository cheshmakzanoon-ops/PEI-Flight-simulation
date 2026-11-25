import { Color,MeshStandardMaterial } from 'three';
import { originalFieldstoneAtlas } from './fieldstone-atlas';
export type StationSurface='fieldstone'|'wallace'|'painted-verge'|'weathered-shingle'|'aged-copper';
const base:Record<StationSurface,readonly[number,number,number]>={
 fieldstone:[0xffffff,.96,0], wallace:[0xa99d86,.86,0], 'painted-verge':[0xcfc9b9,.78,0],
 'weathered-shingle':[0x797571,.94,0], 'aged-copper':[0x5f6559,.73,.24],
};
const glsl=`
 varying vec2 vKensUv;
 float ksHash(vec2 v){vec3 h=fract(v.xyx*vec3(.1031,.1103,.0973));h+=dot(h,h.yzx+29.31);return fract((h.x+h.y)*h.z);}
 float ksNoise(vec2 t){vec2 k=floor(t),f=fract(t);f=f*f*(3.-2.*f);return mix(mix(ksHash(k),ksHash(k+vec2(1.,0.)),f.x),mix(ksHash(k+vec2(0.,1.)),ksHash(k+1.),f.x),f.y);}
 float ksIntegral(float t,float w){float p=fract(t);return floor(t)*2.*w+min(p,w)+max(0.,p-1.+w);}
 float ksBand(float t,float w,float dx){float d=max(dx,.001);return clamp((ksIntegral(t+.5*d,w)-ksIntegral(t-.5*d,w))/d,0.,1.);}
`;
const piece:Record<StationSurface,string>={
 fieldstone:`
   vec2 q=vKensUv;
   diffuseColor.rgb*=1.+.095*(ksNoise(q*.67+3.)-.5);
   float ksRelief=0.;
 `,
 wallace:`
   vec2 p=vKensUv; float px=max(length(dFdx(p)),length(dFdy(p)));
   float g=1.-smoothstep(.007,.071,px),z=ksNoise(vec2(p.x*11.,p.y*20.)+19.)-.5;
   diffuseColor.rgb*=1.+.095*(ksNoise(p*1.8+12.)-.5)+.105*g*z;
   float ksRelief=.0008*z*(1.-smoothstep(.002,.0069,px));
 `,
 'painted-verge':`
   vec2 p=vKensUv; float px=max(length(dFdx(p)),length(dFdy(p)));
   float haze=ksNoise(vec2(p.x*1.4,p.y*17.)+13.)-.5;
   float lines=ksNoise(vec2(p.x*3.2,p.y*55.3)+4.)-.5;
   diffuseColor.rgb*=1.+.046*haze+.051*lines*(1.-smoothstep(.003,.020,px));
   float ksRelief=0.;
 `,
 'weathered-shingle':`
   vec2 p=vKensUv;float px=max(length(dFdx(p)),length(dFdy(p)));
   // Gray weathered wood, not the prior City Hall asphalt role. Course/lap
   // scale is an original visual value, not a measured shingle dimension.
   float phase=p.y/.122, r=floor(phase);
   float ux=(p.x+.095*mod(r,2.))/.186;
   float lap=ksBand(phase,.052,fwidth(phase)),j=ksBand(ux,.034,fwidth(p.x)/.186);
   float gain=1.-smoothstep(.014,.121,px), detail=1.-smoothstep(.004,.032,px);
   float broad=ksNoise(p*.94+30.)-.5, grain=(ksNoise(vec2(p.x*41.,p.y*6.)+16.)-.5)*detail;
   diffuseColor.rgb*=1.+.142*broad+gain*(.103*(ksHash(vec2(floor(ux),r))-.5)+.068*grain-.099*lap-.047*j);
   float ksRelief=0.;
 `,
 'aged-copper':`
   vec2 p=vKensUv;
   float skin=ksNoise(p*4.3+17.);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.102,.131,.102),smoothstep(.50,.83,skin)*.35);
   float ksRelief=0.;
 `,
};
/** Detached visual materials; no site placement, photo pixels, or building measurements. */
export function stationSurface(role:StationSurface){
 const [color,roughness,metalness]=base[role];
 const atlas=role==='fieldstone'?originalFieldstoneAtlas():null;
 const map=atlas?.map??null,normalMap=atlas?.normalMap??null;
 const m=new MeshStandardMaterial({name:`Kensington ${role}`,color:new Color(color),roughness,metalness,map,normalMap});
 m.customProgramCacheKey=()=>`kensington-studio-C-${role}`;
 m.onBeforeCompile=s=>{
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vKensUv;').replace('#include <uv_vertex>','#include <uv_vertex>\nvKensUv=uv;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\n'+glsl).replace('#include <color_fragment>','#include <color_fragment>\n'+piece[role]);
  if(atlas){
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    float kFootprint=max(length(dFdx(vKensUv)),length(dFdy(vKensUv)));
    vec4 kRockTexel=texture2D(map,vMapUv);
    const vec3 kStableRock=vec3(${atlas.mean.map(f=>f.toFixed(8)).join(',')});
    float kStableBlend=mix(.15,1.,1.-smoothstep(.0084,.026,kFootprint));
    diffuseColor*=vec4(mix(kStableRock,kRockTexel.rgb,kStableBlend),kRockTexel.a);
   `).replace('#include <normal_fragment_maps>',`
    vec3 kBeforeNormal=normal;
    #include <normal_fragment_maps>
    normal=normalize(mix(kBeforeNormal,normal,.86*(1.-smoothstep(.0058,.0195,kFootprint))));
   `);
  }
  if(role==='wallace')s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    vec3 kp=dFdx(-vViewPosition),kq=dFdy(-vViewPosition);
    vec3 ka=cross(kq,normal),kb=cross(normal,kp);
    float kdet=dot(kp,ka);
    if(abs(kdet)>1.e-13)normal=normalize(abs(kdet)*normal-sign(kdet)*(dFdx(ksRelief)*ka+dFdy(ksRelief)*kb));
  `);
 };
 return m;
}
