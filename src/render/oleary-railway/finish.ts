import * as T from 'three';
export type OlearyFinish='foundation'|'clapboard'|'timber'|'roof'|'glazing';
const smooth=(a:number,b:number,q:number)=>{const x=Math.max(0,Math.min(1,(q-a)/(b-a)));return x*x*(3-2*x);};
/** Same distance and pixel-area fade envelope as the local shader, not an FPS benchmark. */
export function olearyFinishEnvelope(pixelM:number,viewDistanceM:number){
 if(!Number.isFinite(pixelM)||!Number.isFinite(viewDistanceM)||pixelM<0||viewDistanceM<0)return 0;
 return (1-smooth(.031,.178,pixelM))*(1-smooth(46,147,viewDistanceM));
}
const fields=`
varying vec2 olBoardPosition;varying vec3 olLocal;
float olHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float olNoise(vec2 p){vec2 i=floor(p),q=fract(p);q=q*q*(3.-2.*q);
 return mix(mix(olHash(i),olHash(i+vec2(1.,0.)),q.x),mix(olHash(i+vec2(0.,1.)),olHash(i+vec2(1.)),q.x),q.y);}
float olMip(float footprint,float d){
 return (1.-smoothstep(.031,.178,footprint))*(1.-smoothstep(46.,147.,d));
}
vec3 olSafeNormal(vec3 p,vec3 n,float hh,float facing){
 // This is a small bump in object metres, not changed geometric depth.
 vec3 a=dFdx(p),b=dFdy(p),k=cross(b,n),j=cross(n,a);
 float det=dot(a,k)*facing;
 float x=dFdx(hh),y=dFdy(hh);
 if(!(abs(det)>1.e-10))return n;
 vec3 g=sign(det)*(x*k+y*j)/abs(det);float l=length(g);
 if(!(l>=0.))return n;
 return normalize(n-g*(.24/max(.24,l)));
}
`;
const recipes:Record<Exclude<OlearyFinish,'glazing'>,string>={
 roof:`
  // The metre scale is an artist roughness grain, not measured roof product.
  vec2 bins=vec2(p.x/.333,p.y/.157);
  float row=floor(bins.y);bins.x+=.5*mod(row,2.);
  vec2 cell=floor(bins),fracture=fract(bins);
  float lip=1.-smoothstep(.014,.108+foot*.56,fracture.y);
  float seam=1.-smoothstep(.008,.064+foot*.59,min(fracture.x,1.-fracture.x));
  float olCourseVariation=olHash(cell)-.5,storm=olNoise(p*.66)-.5;
  float speckle=(olNoise(p*31.)-.5)*(1.-smoothstep(.013,.055,foot));
  float body=fracture.y*.006 + .0021*seam;
  return vec3(1.+f*(.12*olCourseVariation+.082*storm+.034*speckle-.164*lip-.092*seam),
   f*(.0058*lip+body),f*(.079*olCourseVariation+.044*storm-.11*lip));
 `,
 clapboard:`
  const float pitch=.153;
  vec2 a=vec2(p.x,(p.y-.019)/pitch);float line=floor(a.y),q=fract(a.y);
  float lap=1.-smoothstep(.009,.096+foot*.45,q);
  float grain=(olNoise(vec2(a.x*7.5,line*2.6+q*.84))-.5)*(1.-smoothstep(.013,.046,foot));
  float old=olNoise(vec2(.66*a.x,line*.51))-.5;
  // Recess at the sill and wind-exposed cladding; neither run changes the stock foot.
  float sill=(1.-smoothstep(.81,1.07,olLocal.y))*.045;
  return vec3(1.+f*(.062*old+.041*grain-.13*lap-sill),f*(.0046*lap+.003*(1.-q)),f*(.056*old+.02*lap));
 `,
 timber:`
  // Fine low-contrast fibre, with no bright drawn-out stripes.
  float thin=(olNoise(vec2(p.x*19.,p.y*.88+olLocal.y*4.5))-.5)*(1.-smoothstep(.013,.049,foot));
  float shade=olNoise(vec2(p.y*2.1,olLocal.y*1.4+p.x*.96))-.5;
  float faint=(1.-smoothstep(.78,1.00,olLocal.y))*.04;
  return vec3(1.+f*(.073*thin+.063*shade-faint),f*.004*thin,f*(.064*shade+.035*thin));
 `,
 foundation:`
  // The timber apron in the same local batch is warm compared to the
  // foundation. Gate by the existing vertex palette and vertical extent.
  float apron=smoothstep(.018,.048,paint.r-paint.g)*(1.-smoothstep(1.01,1.34,olLocal.y));
  float bars=1.-smoothstep(.01,.089+foot*.43,fract(p.x/.162));
  float o=olNoise(p*vec2(29.,1.6))-.5;
  float cement=olNoise(p*3.13)-.5;
  float small=(olNoise(p*28.)-.5)*(1.-smoothstep(.013,.062,foot));
  float moist=(1.-smoothstep(-.19,.54,olLocal.y))*.080;
  float sill=smoothstep(.605,.758,olLocal.y)*.046;
  float value=mix(.09*cement+.06*small-moist,.077*o-.131*bars-sill-moist*.4,apron);
  return vec3(1.+f*value,f*mix(.0042*cement,.006*bars,apron),f*mix(.05*cement,.065*o+.027*bars,apron));
 `
};
/** Authored physical finish response only: same opaque vertices/depth, no imported texture or environment pass. */
export function olearyFinish(k:OlearyFinish){
 const m=new T.MeshStandardMaterial({side:T.DoubleSide,vertexColors:true,
  roughness:k==='glazing'?.41:k==='foundation'?.91:k==='roof'?.86:.79,metalness:0});
 m.name='O’Leary · '+k;
 if(k==='glazing')return m; // Real windows are recessed 0.118 game m in the recipe, never translucent overlays.
 m.customProgramCacheKey=()=>('oleary-original-finish-'+k+'-2');
 m.onBeforeCompile=s=>{
  const varying='varying vec2 olBoardPosition;varying vec3 olLocal;';
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\n'+varying)
   .replace('#include <begin_vertex>','#include <begin_vertex>\nolBoardPosition=uv;olLocal=position;');
  const response=fields+`
   vec3 olearyFinishResponse(vec2 p,vec3 viewPos,vec3 paint){
    float footprint=max(max(length(dFdx(p)),length(dFdy(p))),.27*max(length(dFdx(olLocal)),length(dFdy(olLocal))));
    float d=length(viewPos),foot=clamp(footprint,0.,.20),f=olMip(footprint,d);
    ${recipes[k]}
   }
  `;
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\n'+response)
    .replace('#include <color_fragment>','#include <color_fragment>\nvec3 olF=olearyFinishResponse(olBoardPosition,vViewPosition,diffuseColor.rgb);diffuseColor.rgb*=clamp(olF.x,.72,1.16);')
    .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+olF.z,.52,1.);')
    .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=olSafeNormal(-vViewPosition,normal,olF.y,faceDirection);');
 };
 return m;
}
