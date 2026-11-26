// Private original study. No imagery, calibrated colours, or imported world models.
import {MeshStandardMaterial} from 'three'

export type HolmanFinish='brick'|'stoneBase'|'stoneDetail'|'roof'|'glazing'|'curtain'|'metal'|'cloth'
const label='holman-original-masonry-v1'
const roles={
 brick:{color:'#9d5546',roughness:.88,metalness:0},stoneBase:{color:'#a69d8c',roughness:.86,metalness:0},
 stoneDetail:{color:'#afaa9c',roughness:.84,metalness:0},roof:{color:'#aaa7a0',roughness:.89,metalness:0},
 glazing:{color:'#394247',roughness:.28,metalness:.06},curtain:{color:'#213239',roughness:.30,metalness:.12},
 metal:{color:'#625c53',roughness:.51,metalness:.19},cloth:{color:'#844635',roughness:.94,metalness:0},
} as const
const vsHeader='\nvarying vec2 holmanMetricUV;\n'
const fsHeader=`
varying vec2 holmanMetricUV;
float hHash(vec2 p){
 vec3 h=fract(vec3(p.xyx)*vec3(.1031,.1129,.13787));
 h+=dot(h,h.yzx+19.19);return fract((h.x+h.y)*h.z);
}
float hInCourse(float coord,float rad,float footprint){
 float d=min(fract(coord),1.-fract(coord));
 return 1.-smoothstep(rad-max(.001,.42*footprint),rad+max(.001,.42*footprint),d);
}
vec2 hBakedMasonry(vec2 uv,vec2 fw,vec2 size,vec2 width,float rng){
 vec2 p=uv/size;
 p.x+=(mod(floor(p.y),2.)*.5);
 vec2 scaled=fw/size;
 float raster=max(scaled.x,scaled.y);
 float visible=1.-smoothstep(.16,.83,raster);
 float joint=max(hInCourse(p.x,width.x,scaled.x),hInCourse(p.y,width.y,scaled.y));
 float grain=hHash(floor(p));
 return vec2(visible*(grain-.5)*rng,joint*visible);
}
`
function bodyFor(role:HolmanFinish){
 if(role==='brick')return `
  vec2 fw=fwidth(holmanMetricUV); vec2 p=hBakedMasonry(holmanMetricUV,fw,vec2(.221,.073),vec2(.022,.056),.33);
  float cloud=sin(holmanMetricUV.x*.32+sin(holmanMetricUV.y*.23))*.035+sin(holmanMetricUV.x*.91+holmanMetricUV.y*.20)*.022;
  diffuseColor.rgb=mix(diffuseColor.rgb*(1.+p.x+cloud),vec3(.277,.232,.187),p.y*.72);
 `
 if(role==='stoneBase')return `
  vec2 fw=fwidth(holmanMetricUV); vec2 p=hBakedMasonry(holmanMetricUV,fw,vec2(.74,.343),vec2(.008,.024),.17);
  diffuseColor.rgb=mix(diffuseColor.rgb*(1.+p.x),diffuseColor.rgb*.67,p.y*.52);
 `
 if(role==='roof')return `
  vec2 fw=fwidth(holmanMetricUV);
  vec2 p=holmanMetricUV*.72;
  float vis=1.-smoothstep(.24,.9,max(fw.x,fw.y));
  float g=(.67*sin(p.x+sin(p.y))+.33*sin(p.y*.9+p.x*.8))*.021;
  diffuseColor.rgb*=1.+g*vis;
 `
 return ''
}
const viewFor=(role:HolmanFinish)=>role==='glazing'||role==='curtain'?`
  vec3 W=normalize(inverseTransformDirection(reflect(-normalize(vViewPosition),normal),viewMatrix));
  float band=smoothstep(-.14,.54,W.y);
  float underside=smoothstep(-.64,-.12,W.y);
  float fe=.063+.36*pow(1.-clamp(dot(normal,normalize(vViewPosition)),0.,1.),4.);
  vec3 reflection=mix(vec3(.042,.049,.046),mix(vec3(.408,.482,.503),vec3(.206,.326,.449),band),underside);
  diffuseColor.rgb=mix(diffuseColor.rgb,reflection,fe*${role==='curtain'?'.78':'.62'});
 `:''

export function makeHolmanFinish(role:HolmanFinish, detailed=true):MeshStandardMaterial{
 const mat=new MeshStandardMaterial(roles[role]); mat.name=role
 const body=detailed?bodyFor(role):''; const angle=detailed?viewFor(role):''
 if(!body&&!angle)return mat
 mat.customProgramCacheKey=()=>`${label}:${role}`
 mat.onBeforeCompile=s=>{
    if(body){
      s.vertexShader=vsHeader+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\n holmanMetricUV=uv;')
      s.fragmentShader=fsHeader+s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\n${body}`)
    }
    if(angle)s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>\n${angle}`)
 }
 return mat
}
