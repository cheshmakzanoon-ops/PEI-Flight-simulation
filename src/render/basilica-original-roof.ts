import { Color, MeshStandardMaterial } from 'three';

type RoofFinish='slate'|'aged-sheet'|'verdigris-cap';
/** Original local weathering. Finish names are art roles, not spectrographic measurements. */
const finishes={
 slate:{base:'#4b5055',rough:.86,metal:.02,span:.42,row:.29,variation:.20,seam:.18,oxide:.025},
 'aged-sheet':{base:'#626365',rough:.64,metal:.33,span:.54,row:1.42,variation:.19,seam:.19,oxide:.14},
 'verdigris-cap':{base:'#547c73',rough:.77,metal:.17,span:.53,row:1.42,variation:.23,seam:.16,oxide:.26},
} as const;
export function basilicaRoofStudy(finish:RoofFinish){
 const u=finishes[finish],m=new MeshStandardMaterial({color:new Color(u.base),roughness:u.rough,metalness:u.metal});
 m.name='Basilica study: '+finish;
 m.customProgramCacheKey=()=>('pei-basilica-roof-prototype-1:'+finish);
 m.onBeforeCompile=shader=>{
  const withChunk=(text:string,chunk:string,code:string)=>{
   const a='#include <'+chunk+'>';
   if(text.split(a).length!==2)throw new Error('Basilica roof chunk '+chunk);
   return text.replace(a,a+'\n'+code);
  };
  shader.uniforms.roofStudySize={value:[u.span,u.row]};
  shader.uniforms.roofStudySurface={value:[u.variation,u.seam,u.oxide]};
  const iface='varying vec3 basilicaRoofP,basilicaRoofN;';
  shader.vertexShader=withChunk(shader.vertexShader,'common',iface);
  shader.vertexShader=withChunk(shader.vertexShader,'begin_vertex','basilicaRoofP=position; basilicaRoofN=normal;');
  shader.fragmentShader=withChunk(shader.fragmentShader,'common',`${iface}
   uniform vec2 roofStudySize;
   uniform vec3 roofStudySurface;
   float bsHash(vec2 v){
    vec3 a=fract(vec3(v.xyx)*.1031);a+=dot(a,a.yzx+33.33);
    return fract((a.x+a.y)*a.z);
   }
   float bsNoise(vec2 p){
    vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(bsHash(i),bsHash(i+vec2(1.,0.)),f.x),
    mix(bsHash(i+vec2(0.,1.)),bsHash(i+vec2(1.,1.)),f.x),f.y);
   }`);
  shader.fragmentShader=withChunk(shader.fragmentShader,'color_fragment',`
   vec3 BN=normalize(basilicaRoofN);
   vec3 pitchU=cross(vec3(0.,1.,0.),BN);
   pitchU=length(pitchU)>.01?normalize(pitchU):vec3(1.,0.,0.);
   vec3 pitchV=cross(BN,pitchU);
   vec2 stripe=vec2(dot(basilicaRoofP,pitchU),dot(basilicaRoofP,pitchV))/roofStudySize;
   float f=clamp(max(fwidth(stripe.x),fwidth(stripe.y)),.008,.68);
   float clarity=1.-smoothstep(.05,.52,f),oxide=bsNoise(stripe*vec2(.9,.43));
   stripe.x+=.22*mod(floor(stripe.y),2.);
   float seams=1.-smoothstep(.017-f*.58,.042+f*.6,min(fract(stripe.x),1.-fract(stripe.x)));
   float rows=1.-smoothstep(.015-f*.55,.031+f*.6,min(fract(stripe.y),1.-fract(stripe.y)));
   float deposit=smoothstep(.38,.80,oxide)*roofStudySurface.z;
   float panel=clarity*(bsHash(floor(stripe))-.5);
   vec3 weather=mix(vec3(1.),vec3(.75,1.10,.91),deposit);
   diffuseColor.rgb*=weather*(1.+roofStudySurface.x*panel+(.034*(oxide-.5)));
   diffuseColor.rgb*=1.-roofStudySurface.y*clarity*max(seams,rows*.62);`);
  shader.fragmentShader=withChunk(shader.fragmentShader,'roughnessmap_fragment',
   'roughnessFactor=clamp(roughnessFactor+deposit*.25+clarity*(rows+seams)*.034,.47,.98);');
 };
 return m;
}
