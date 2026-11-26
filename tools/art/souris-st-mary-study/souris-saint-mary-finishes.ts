/** Original metric material appearance. No picture, atlas, signage, or lighting capture. */
import { Color, MeshStandardMaterial } from 'three';
import type { MaryRole } from './souris-saint-mary-forms.ts';
const color = {
  stone:[0xa16c52,.89,.00], freestone:[0xc8bda8,.78,.00], roof:[0x4b514e,.92,.00],
  copper:[0x435e55,.57,.27], glass:[0x142524,.26,.03], wood:[0x41362b,.78,.00],metal:[0x79775b,.61,.20],
} as const;
const tools=`
varying vec2 vMaryMetric;
float maryHash(vec2 p) {
 vec3 q=fract(p.xyx*vec3(.1031,.1030,.0973));q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);
}
float maryNoise(vec2 p){
 vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(maryHash(i),maryHash(i+vec2(1,0)),f.x),mix(maryHash(i+vec2(0,1)),maryHash(i+vec2(1)),f.x),f.y);
}
float maryInt(float p,float a,float b){return floor(p)*(b-a)+clamp(fract(p)-a,0.,b-a);}
float maryBand(float p,float a,float b,float w){
 w=max(.002,w);return clamp((maryInt(p+w*.5,a,b)-maryInt(p-w*.5,a,b))/w,0.,1.);
}
float maryFoot(vec2 p,float m){
 vec2 w=fwidth(p)*m;return 1.-smoothstep(.23,.85,max(w.x,w.y));
}
void marySandstone(in vec2 m,inout vec3 base,out float rough,out float h){
 // Offsets are independent original masonry variation, not estimated wall/coursing survey.
 float f=m.y/.363+.017*sin(m.x*1.44)+.020*sin(m.x*.559+.4);
 float sf=fwidth(f),row=floor(f);
 float u=m.x/.688+mod(row,2.)*.439+.17*maryHash(vec2(row,41.))+.082*sin(m.x*2.06+row);
 float uf=max(fwidth(m.x)/.688,.002);
 float near=(1.-smoothstep(.30,.96,max(sf,uf)));
 float horizontal=maryBand(f,.014,.063,sf);
 float stagger=(1.-smoothstep(.38,.86,sf))*smoothstep(.085,.20,fract(f))*(1.-smoothstep(.86,.995,fract(f)));
 float head=maryBand(u,.046,.079,uf)*stagger;
 float mortar=clamp(horizontal+head-horizontal*head,0.,1.);
 float block=(maryHash(vec2(floor(u),row))-.5)*near;
 float shape=maryNoise(m*vec2(.27,.34))-.5;
 float micro=(maryNoise(m*vec2(18.1,15.7))-.5)*maryFoot(m,19.);
 vec3 worn=base*vec3(1.+.095*shape+.30*block+.078*micro,
                   1.+.173*shape+.49*block+.105*micro,
                   1.+.208*shape+.54*block+.108*micro);
 base=mix(worn,worn*.53+vec3(.026,.025,.021),mortar*.81);
 rough=.038*block+.106*mortar+.04*micro;
 h=near*(-.0038*mortar+.0017*micro);
}
void maryRoof(in vec2 m,inout vec3 base,out float rough,out float h){
 float t=m.y/.274, ft=fwidth(t);
 float stagger=(1.-smoothstep(.34,.88,ft))*smoothstep(.12,.22,fract(t))*(1.-smoothstep(.88,.98,fract(t)));
 float x=m.x/.42+mod(floor(t),2.)*.5;
 float lap=maryBand(t,.018,.088,ft),crossSeam=maryBand(x,.02,.053,fwidth(m.x)/.42)*stagger;
 float n=(maryNoise(m*vec2(.42,.58))-.5)*.15;
 float grit=(maryNoise(m*38.)-.5)*maryFoot(m,39.);
 base*=1.+n-.235*lap-.118*crossSeam+.065*grit;
 rough=.03*grit+.055*lap; h=-.0017*lap;
}
void maryCopper(in vec2 m,inout vec3 base,out float rough,out float h){
 float s=m.x/.562, w=fwidth(s);
 float ribs=maryBand(s,.048,.077,w);
 float patina=maryNoise(m*vec2(.45,.81))-.5;
 float micro=(maryNoise(m*9.4)-.5)*maryFoot(m,9.4);
 base*=vec3(1.+.12*patina,1.+.26*patina,1.+.19*patina)+.080*micro+.069*ribs;
 rough=.117*patina+.018*ribs; h=.0018*ribs*(1.-smoothstep(.32,1.,w));
}
void maryFreestone(in vec2 m,inout vec3 base,out float rough,out float h){
 float ton=maryNoise(m*3.51)-.5;
 float grit=(maryNoise(m*31.1)-.5)*maryFoot(m,31.1);
 base*=1.+.105*ton+.054*grit;
 rough=.042*ton; h=.0004*grit;
}
void maryWood(in vec2 m,inout vec3 base,out float rough,out float h){
 float grain=(maryNoise(m*vec2(36.0,2.0))-.5)*maryFoot(m,36.0);
 float seam=maryBand(m.x/.24,.038,.075,fwidth(m.x)/.24);
 base*=1.+.137*grain-.17*seam;
 rough=.05*grain; h=-.0012*seam;
}`;
const bump=`
 // Derivatives are evaluated unconditionally. A narrow neutral branch is independent of
 // metric UV islands and leaves normal unchanged when the relief is filtered out.
 vec3 mDx=dFdx(-vViewPosition), mDy=dFdy(-vViewPosition);
 vec3 mRx=cross(mDy,normal), mRy=cross(normal,mDx);
 float mDet=dot(mDx,mRx), mdX=dFdx(maryRelief), mdY=dFdy(maryRelief);
 if(abs(mDet)>1e-10){
   vec3 mGrad=sign(mDet)*(mdX*mRx+mdY*mRy);
   normal=normalize(abs(mDet)*normal-mGrad);
 }`;
// No reflection pass or source image. Opaque blue/grey glazing responds weakly to a
// simple daylight lobe at a grazing angle so dark reveals stay as depth, not holes.
const glaze=`
 vec3 mN=normalize(normal),mV=normalize(vViewPosition);
 vec3 mR=(vec4(reflect(-mV,mN),0.)*viewMatrix).xyz;
 float mSky=smoothstep(-.18,.57,mR.y),mFacing=clamp(dot(mN,mV),0.,1.);
 float mGrazing=(1.-mFacing)*(1.-mFacing);mGrazing*=mGrazing;
 vec3 mLobe=mix(vec3(.035,.039,.041),vec3(.104,.152,.172),mSky);
 outgoingLight+=mLobe*(.21+.65*mGrazing);
`;
const roles:Partial<Record<MaryRole,string>>={stone:'marySandstone',freestone:'maryFreestone',roof:'maryRoof',copper:'maryCopper',wood:'maryWood'};
const once=(s:string,k:string)=>s.indexOf(k)>=0&&s.indexOf(k)===s.lastIndexOf(k);
export function patchDetachedMaryShaders(vertex:string,fragment:string,role:MaryRole){
 const common='#include <common>',uv='#include <uv_vertex>',col='#include <color_fragment>';
 const rough='#include <roughnessmap_fragment>',nm='#include <normal_fragment_begin>',oe='#include <opaque_fragment>';
 if(role==='glass'){
   if(!once(fragment,oe)||fragment.includes('mGrazing'))return;
   return {vertex,fragment:fragment.replace(oe,glaze+oe)};
 }
 const f=roles[role];
 if(!f||![common,uv].every(k=>once(vertex,k))||![common,col,rough,nm].every(k=>once(fragment,k))||
  vertex.includes('vMaryMetric')||fragment.includes('vMaryMetric'))return;
 return {vertex:vertex.replace(common,common+'\nvarying vec2 vMaryMetric;').replace(uv,uv+'\nvMaryMetric=uv;'),
  fragment:fragment.replace(common,common+'\n'+tools)
   .replace(col,`${col}\nfloat maryRough,maryRelief;${f}(vMaryMetric,diffuseColor.rgb,maryRough,maryRelief);`)
   .replace(rough,rough+'\nroughnessFactor=clamp(roughnessFactor+maryRough,.34,.99);')
   .replace(nm,nm+'\n'+bump),};
}
export function makeDetachedMaryFinish(role:MaryRole,finish=true){
 const [c,r,m]=color[role];
 const out=new MeshStandardMaterial({color:new Color(c),roughness:r,metalness:m});
 out.name=`Souris.StMary.detached.${role}.${finish?'solid-and-procedural':'base-only'}`;
 if(finish&&role!=='metal'){
   out.onBeforeCompile=s=>{const q=patchDetachedMaryShaders(s.vertexShader,s.fragmentShader,role);if(q){s.vertexShader=q.vertex;s.fragmentShader=q.fragment;}};
   out.customProgramCacheKey=()=>`pei-souris-mary-detached-art-v1/${role}`;
 }
 return out;
}
