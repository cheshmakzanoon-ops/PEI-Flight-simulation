import {MeshStandardMaterial} from 'three';

/** Bounded opaque center infill, not glazing or a current fabrication spec.
 * UVs in metres in the independently described frame's horizontal/vertical plane. */
export function foundersDarkSpandrel(detail=true){
 const m=new MeshStandardMaterial({color:'#4a4a43',roughness:.89,metalness:0.0});
 m.name=detail?'Founders arch: original matte field and diagonal detail':'Founders arch: matte field control';
 if(!detail)return m;
 m.customProgramCacheKey=()=>'pei-founders-spandrel-original-v2';
 m.onBeforeCompile=p=>{
  p.vertexShader='varying vec2 infillMetres;\n'+p.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\n infillMetres=uv;');
  p.fragmentShader=`varying vec2 infillMetres;
float infillHash(vec2 q){
 vec3 g=fract(vec3(q.xyx)*vec3(.11369,.14125,.10313));
 g+=dot(g,g.yzx+29.25);
 return fract((g.x+g.y)*g.z);
}
float infillNoise(vec2 q){
 vec2 i=floor(q),f=fract(q);f=f*f*(3.-2.*f);
 return mix(mix(infillHash(i),infillHash(i+vec2(1,0)),f.x),
            mix(infillHash(i+vec2(0,1)),infillHash(i+vec2(1,1)),f.x),f.y);
}
`+p.fragmentShader;
  p.fragmentShader=p.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 mat2 infillAxis=mat2(.70710678,-.70710678,.70710678,.70710678);
 vec2 diag=infillAxis*infillMetres;
 float period=diag.y/.116,cover=max(.003,fwidth(period));
 float band=min(fract(period),1.-fract(period));
 float joint=(1.-smoothstep(.016-cover*.5,.016+cover*.5,band))*(1.-smoothstep(.17,.85,cover));
 float lane=infillHash(vec2(floor(period),7.3))-.5;
 float longWear=infillNoise(diag*vec2(.31,24.0)+vec2(7.2,15.7))-.5;
 float softDrift=infillNoise(infillMetres*vec2(.67,1.25)+vec2(2.3,8.3))-.5;
 float close=1.-smoothstep(.008,.049,max(fwidth(infillMetres.x),fwidth(infillMetres.y)));
 float drift=infillNoise(infillMetres*vec2(.74,.90)+vec2(47.,19.));
 float broadStain=drift*drift*drift;
 float tint=1.035+softDrift*.285+close*(lane*.132+longWear*.060)-joint*.34-broadStain*.37;
 diffuseColor.rgb*=max(.60,tint);
 `);
 };
 return m;
}
