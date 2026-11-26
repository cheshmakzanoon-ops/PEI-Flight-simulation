import {MeshStandardMaterial, Color, type ColorRepresentation} from 'three';

/** Original interpretation of the documented 2009 exterior. No photos,
 * measured paint codes, visible signs or fabric dimensions are reproduced.
 * Host model provides UV in metres: U along a face, V from its lower edge. */
export type CourtFinish='shingle'|'plywood'|'roof'|'trim'|'pier';
const paint:Record<CourtFinish,{name:string;base:ColorRepresentation;roughness:number}>={
 shingle:{name:'old warm-white shingles',base:0xd5d0ba,roughness:.89},
 plywood:{name:'restrained painted north backing',base:0xc4c1ad,roughness:.89},
 roof:{name:'weathered graphite asphalt',base:0x343942,roughness:.95},
 trim:{name:'aged pale trim',base:0xdcdbca,roughness:.81},
 pier:{name:'grey-weathered timber',base:0x6b675e,roughness:.96},
};
const profiles:Record<CourtFinish,string>={
 shingle:`vec2 cell=vec2(p.x/.192,p.y/.143);float row=floor(cell.y);
  cell.x+=mod(row,2.)*.49+.07*sin(row*2.73);
  float tone=courtHash(vec2(floor(cell.x),row));
  float lap=courtLap(cell.y,.09),joint=courtLap(cell.x,.039);
  float weather=courtNoise(vec2(p.x*.65,p.y*1.42));
  c*=1.+(tone-.5)*.15*courtFade(cell)+(weather-.5)*.075-.15*lap-.052*joint;
  c*=1.-.063*(1.-smoothstep(.12,1.3,p.y))*(.6+.4*weather);`,
 plywood:`c*=1.+(courtNoise(p*1.3)-.5)*.091-.075*courtLap(p.x/1.20,.014)-.054*courtLap(p.y/2.38,.012);`,
 roof:`vec2 cell=vec2(p.x/.311,p.y/.157);float row=floor(cell.y);cell.x+=mod(row,2.)*.5;
  float lap=courtLap(cell.y,.102),joint=courtLap(cell.x,.034);
  float tone=courtHash(vec2(floor(cell.x),row)),grain=courtNoise(p*vec2(80.,58.));
  float grainFade=1.-smoothstep(.13,1.,max(length(dFdx(p)),length(dFdy(p)))*60.);
  c*=1.+.145*(tone-.5)*courtFade(cell)+.054*(grain-.5)*grainFade+
     .07*(courtNoise(p*.87)-.5)-.124*lap-.042*joint;`,
 trim:`c*=1.+.064*(courtNoise(p*1.9)-.5)-.035*(1.-smoothstep(.04,.32,p.y));`,
 pier:`vec2 grain=vec2(p.x*36.,p.y*1.8);c*=1.+.25*(courtNoise(grain)-.5)*courtFade(grain)+.13*(courtNoise(p*1.5)-.5);
  c*=1.-.14*(1.-smoothstep(.08,.75,p.y));`,
};
const common=`
varying vec2 vCourtCourseUV;
float courtHash(vec2 p){
 p=fract(p*vec2(.1031,.11369));p+=dot(p,p.yx+19.19);return fract((p.x+p.y)*p.x);
}
float courtNoise(vec2 p){
 vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(courtHash(i),courtHash(i+vec2(1.,0.)),f.x),
            mix(courtHash(i+vec2(0.,1.)),courtHash(i+1.),f.x),f.y);
}
float courtFade(vec2 p){return 1.-smoothstep(.17,.76,max(fwidth(p.x),fwidth(p.y)));}
float courtLap(float p,float width){
 float aa=max(fwidth(p),.002);
 float f=fract(p+.5),d=abs(f-.5);
 return (1.-smoothstep(max(0.,width-.34*aa),width+.54*aa,d))*(1.-smoothstep(.17,.70,aa));
}
`;
const unique=(s:string,key:string)=>s.indexOf(key)>=0&&s.indexOf(key)===s.lastIndexOf(key);
export function patchCourtFinish(v:string,f:string,role:CourtFinish){
 const hv='#include <common>',uv='#include <uv_vertex>',cf='#include <color_fragment>';
 if(!unique(v,hv)||!unique(v,uv)||!unique(f,hv)||!unique(f,cf)||v.includes('vCourtCourseUV')||f.includes('vCourtCourseUV'))return;
 return {
  vertex:v.replace(hv,hv+'\nvarying vec2 vCourtCourseUV;').replace(uv,uv+'\nvCourtCourseUV=uv;'),
  fragment:f.replace(hv,hv+'\n'+common).replace(cf,cf+'\n{ vec2 p=vCourtCourseUV;vec3 c=diffuseColor.rgb;\n'+profiles[role]+'\ndiffuseColor.rgb=max(c,0.); }'),
 };
}
export function courtFinish(role:CourtFinish){
 const s=paint[role];
 const mat=new MeshStandardMaterial({name:'Quintin Court · '+s.name,color:new Color(s.base),metalness:0,roughness:s.roughness});
 mat.onBeforeCompile=q=>{
  const patched=patchCourtFinish(q.vertexShader,q.fragmentShader,role);
  if(patched){q.vertexShader=patched.vertex;q.fragmentShader=patched.fragment;}
 };
 mat.customProgramCacheKey=()=>`pei-history-court-2009-finish-v1/${role}`;
 return mat;
}
