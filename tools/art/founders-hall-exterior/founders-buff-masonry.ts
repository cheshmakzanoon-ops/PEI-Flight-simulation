import {MeshStandardMaterial} from 'three';

/** Original visual treatment for the bounded buff entrance surround.
 * UVs are local metres along the panel and vertically from the facade base.
 * Nothing here asserts the current substrate, dimensions or joint schedule. */
export function foundersBuffMasonry(detail=true){
 const m=new MeshStandardMaterial({color:'#bba991',roughness:.87,metalness:0});
 m.name=detail?'Founders buff entrance: original masonry finish':'Founders buff entrance: uniform control';
 if(!detail)return m;
 m.customProgramCacheKey=()=>'pei-founders-buff-original-surface-v1';
 m.onBeforeCompile=p=>{
  p.vertexShader='varying vec2 entranceSurface;\n'+p.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\n entranceSurface=uv;');
  p.fragmentShader=`varying vec2 entranceSurface;
float entranceHash(vec2 q){
 vec3 c=fract(vec3(q.xyx)*vec3(.1031,.1197,.1379));
 c+=dot(c,c.yzx+19.64);
 return fract((c.x+c.y)*c.z);
}
float entranceNoise(vec2 v){
 vec2 i=floor(v),f=fract(v); f=f*f*(3.-2.*f);
 return mix(mix(entranceHash(i),entranceHash(i+vec2(1.,0.)),f.x),
  mix(entranceHash(i+vec2(0.,1.)),entranceHash(i+1.),f.x),f.y);
}
`+p.fragmentShader;
  p.fragmentShader=p.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 vec2 panel=entranceSurface/vec2(.78,.379);
 vec2 aa=min(vec2(.18),max(vec2(.001),fwidth(panel)*.60));
 // The small running offset is illustrative, and washed out as it subpixels.
 panel.x+=mod(floor(panel.y),2.)*.18;
 vec2 d=min(fract(panel),1.-fract(panel));
 vec2 e=smoothstep(vec2(.010,.018)-aa,vec2(.010,.018)+aa,d);
 float resolved=1.-smoothstep(.19,.77,max(fwidth(panel.x),fwidth(panel.y)));
 float grout=(1.-e.x*e.y)*resolved;
 float grade=entranceNoise(entranceSurface*vec2(.70,.48));
 float patches=entranceNoise(entranceSurface*vec2(1.45,.99)+vec2(18.5,71.2));
 float pores=(entranceNoise(entranceSurface*72.)-.5)*(1.-smoothstep(.005,.023,max(fwidth(entranceSurface.x),fwidth(entranceSurface.y))));
 float run=entranceNoise(entranceSurface*vec2(4.3,.27)+vec2(36.,15.));
 float stone=(entranceHash(floor(panel))-.5)*.093*resolved;
 float base=.086*exp(-max(0.,entranceSurface.y)*1.68);
 float tint=.915+grade*.105+patches*.104+stone+pores*.044-base;
 vec3 warm=mix(vec3(1.004,.994,.972),vec3(.946,.985,1.012),smoothstep(.41,.88,run)*.40);
 diffuseColor.rgb*=warm*tint*(1.-smoothstep(.68,.95,run)*.083);
 diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.67,.704,.711),grout*.56);
 `);
  p.fragmentShader=p.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
 roughnessFactor=clamp(roughnessFactor+(patches-.5)*.084+grout*.047,.72,.98);`);
 };
 return m;
}
