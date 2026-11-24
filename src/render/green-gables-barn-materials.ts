import * as T from 'three';
export const paints={
 cedar:0x727570,charcoal:0x616560,roof:0x939992,roofEdge:0x696c62,soffit:0x746f62,
 frame:0x92917d,red:0x813729,redEnd:0x6e362d,stone:0x777165,iron:0x3b3c37,
 glass:0x364844,dark:0x30312b,field:0x87934e
} as const;
export type Paint=keyof typeof paints;
const hashGLSL=`float hb(vec2 a){vec3 p=fract(vec3(a.xyx)*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float rockN(vec2 p){vec2 c=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hb(c),hb(c+vec2(1,0)),f.x),mix(hb(c+vec2(0,1)),hb(c+vec2(1)),f.x),f.y);}`;
export function paint(key:Paint){
 const c=new T.MeshStandardMaterial({color:paints[key],roughness:key==='glass'?.32:.80,metalness:key==='iron'?.39:0});
 c.name=key;
 const high=key==='roof',shingle=high||key==='cedar'||key==='charcoal';
 const door=key==='red'||key==='redEnd';
 c.customProgramCacheKey=()=>`peibarn-original-${key}`;
 c.onBeforeCompile=s=>{
  s.vertexShader='varying vec2 baUV;varying vec3 baLocal;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nbaUV=uv;baLocal=position;');
  let a='float relief=0.;vec2 q=baUV;';
  if(shingle){
   a+=`
     vec2 s=q/vec2(${high?'.186,.145':'.169,.116'});float course=floor(s.y);
     s.x+=.5*mod(course,2.)+(rockN(vec2(course*.131,0.))-.5)*.45;
     vec2 f=fract(s);
     float aa=1.-smoothstep(.029,.103,max(fwidth(q.x),fwidth(q.y)));
     float sunLip=1.-smoothstep(.013,.113,f.y);
     float edge=1.-smoothstep(.003,.051,min(f.x,1.-f.x));
     float tone=hb(floor(s)),grain=rockN(q*vec2(53.,6.4)),bleach=.63*rockN(q*vec2(.48,.89))+.37*rockN(q*1.7);
     float tarnish=rockN(q*vec2(.96,.23));
     float streak=rockN(vec2(q.x*3.1,q.y*.73));
     float fissure=(1.-smoothstep(.005,.045,min(f.x,1.-f.x)))*smoothstep(.35,.8,rockN(floor(s)*.81));
     float good=mix(.935,1.065,tone)+(.107*(grain-.5)+.188*(bleach-.5)-.102*(tarnish-.5)+.07*(streak-.5));
     float band=.057*sunLip+.102*edge*(.35+.65*pow(1.-f.y,2.));
     float baseFade=${high?'1.':'1.-(.07+.10*rockN(vec2(q.x*3.3,q.y*1.4)))*(1.-smoothstep(.12,1.03,baLocal.y))'};
     diffuseColor.rgb*=good*(1.-aa*band)*baseFade;
     relief=aa*(.0026*(1.-f.y)-.0017*edge-.0008*fissure)+.0015*(grain-.5);
   `;
  }else if(door){
   a+=`float u=q.x/.205,w=1.-smoothstep(.025,.105,fwidth(q.x));
   float g=rockN(q*vec2(45.,6.2)),o=rockN(q*vec2(2.4,8.0)),k=hb(vec2(floor(u),0.));
   float e=1.-smoothstep(.014,.082,min(fract(u),1.-fract(u)));
   diffuseColor.rgb*=.90+.07*g+.11*o+.095*k-.16*e*w;
   relief=.0028*g-.0024*e*w;`;
  }else if(key==='stone'){
   a+=`vec2 p=q/vec2(.37,.225);p.x+=.5*mod(floor(p.y),2.);
    vec2 f=fract(p);float e=min(min(f.x,1.-f.x)*.37,min(f.y,1.-f.y)*.225);
    float adj=1.-smoothstep(.02,.09,max(fwidth(q.x),fwidth(q.y)));
    float gn=rockN(q*vec2(41.,19.));float d=smoothstep(.005,.016,e+.008*gn);
    diffuseColor.rgb*=.71+.33*hb(floor(p))+.26*gn-.16*(1.-d)*adj;relief=.004*(gn-.48)+.0022*d*adj;`;
  }else if(key==='field'){
   a+=`float g=rockN(q*.19),k=rockN(q*31.)*.54+rockN(q*17.)*.46;diffuseColor.rgb*=.76+.15*g+.31*k;relief=.009*(k-.5);`;
  }else if(key==='glass'){
   a+=`vec3 n=normalize(vNormal),v=normalize(vViewPosition),r=transpose(mat3(viewMatrix))*reflect(-v,n);
    float gleam=smoothstep(-.21,.70,r.y)*(.70+.30*rockN(r.xz*9.));
    diffuseColor.rgb*=.37+.72*gleam;`;
  }else a+=`float g=rockN(q*vec2(29.,12.));diffuseColor.rgb*=.89+.19*g;relief=.0015*g;`;
  s.fragmentShader='varying vec2 baUV;varying vec3 baLocal;\n'+hashGLSL+'\n'+s.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n'+a)
    .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
     vec3 a1=dFdx(vViewPosition),a2=dFdy(vViewPosition),ba=cross(a2,normal),bb=cross(normal,a1);
     float db=dot(a1,ba);if(abs(db)>1.e-8)normal=normalize(abs(db)*normal-sign(db)*(dFdx(relief)*ba+dFdy(relief)*bb));
    `);
 };
 return c;
}
