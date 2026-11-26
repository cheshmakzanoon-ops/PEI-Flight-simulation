/** Original finish on the measured O’Leary warehouse shell only.
 * No photo samples, new geometry, openings, texture, or extra render pass. */
import {MeshStandardMaterial,Vector2} from 'three';
import {Q150} from './q150-plan.generated.ts';
const U=Q150.frame.gameU,V=Q150.frame.gameV;
const vec=(a:readonly number[])=>'vec2('+a.map(x=>x.toFixed(10)).join(',')+')';
const tag='#include <common>',vertexDecl='varying vec2 q150SheetLocal;';
const shade=`
 ${vertexDecl}
 uniform vec2 q150SheetGain;
 float q150SincSafe(float x){
  return x<.002?1.-x*x/6.:max(0.,sin(min(x,3.14159265))/x);
 }
 vec3 q150ViewBump(vec3 n,float h,vec3 p,float side){
  vec3 dx=dFdx(p),dy=dFdy(p);
  vec3 a=cross(dy,n),b=cross(n,dx);
  float d=dot(dx,a)*side;
  if(abs(d)<1.e-7)return n;
  vec3 g=sign(d)*(dFdx(h)*a+dFdy(h)*b);
  return normalize(n*abs(d)-g);
 }
`;
const material=`
 // Horizontal 3D wall coordinates; width is an authored optical assumption,
 // not measured panel spacing. No repeating painted facade stripe.
 float q150A=dot(q150SheetLocal,${vec(U)}),q150B=dot(q150SheetLocal,${vec(V)});
 // Along this face the variable axis holds the original measured geometry.
 float q150Across=abs(dFdx(q150A))+abs(dFdy(q150A))>abs(dFdx(q150B))+abs(dFdy(q150B))?q150A:q150B;
 float q150W=fwidth(q150A)+fwidth(q150B);
 float q150Fade=1.-smoothstep(44.,142.,length(vViewPosition));
 float q150Band=q150SincSafe(5.81776417*max(.0,q150W))*(1.-smoothstep(.19,.43,q150W));
 float q150Wave=sin(11.63552835*q150Across)*q150Band;
 float q150Macro=sin(q150A*.92+q150B*1.71)*sin(q150A*.44-q150B*.76)*.58+
                  sin(q150A*.263+q150B*.1167)*.42;
 float q150Relief=.0085*q150Wave*q150Fade, q150Brightness=1.+q150Fade*(.062*q150Macro+.021*q150Wave);
 diffuseColor.rgb*=mix(1.,q150Brightness,q150SheetGain.x);
`;
function patch(s:string,marker:string,body:string){
 if(s.split(marker).length!==2)throw Error('Unexpected warehouse shader');
 return s.replace(marker,marker+'\n'+body);
}
export function q150FoldMaterialEnabled(m:MeshStandardMaterial):boolean{
 if(m.name!=='q150 original sheet'||m.map||m.envMap||m.transparent||m.side!==0)return false;
 const before=m.onBeforeCompile,stable=m.customProgramCacheKey();
 m.onBeforeCompile=function(s,r){
  before.call(this,s,r);
  s.vertexShader=patch(patch(s.vertexShader,tag,vertexDecl),'#include <begin_vertex>','q150SheetLocal=position.xz;');
  s.fragmentShader=patch(patch(patch(s.fragmentShader,tag,shade),'#include <color_fragment>',material),
   '#include <normal_fragment_maps>','vec3 q150N=q150ViewBump(normal,q150Relief*q150SheetGain.y,-vViewPosition,faceDirection); if(q150SheetGain.y>0.&&q150Fade>0.&&q150Band>0.)normal=q150N;');
  s.uniforms.q150SheetGain={value:new Vector2(1,1)};
 };
 m.customProgramCacheKey=()=>stable+'|prototype-q150-rod-prefilter-v1';
 return true;
}
