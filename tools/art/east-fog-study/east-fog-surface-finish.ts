/** Detached, untextured East Point wall and roof surface study. Source-color
 * references do not establish product, panel spacing, paint, or weathering. */
type Pair=Readonly<{vertexShader:string;fragmentShader:string}>;
const header='#include <common>';
const begin='#include <begin_vertex>\nvLocal=position;vClad=clad;';
const stockPaint='diffuseColor.rgb*=1.-.15*nearCourse*course-.065*nearSeam*seam;';
const roughness='#include <roughnessmap_fragment>';
const has=(src:string,word:string)=>src.indexOf(word)>=0&&src.indexOf(word)===src.lastIndexOf(word);
export const EAST_FINISH=Object.freeze({
 // Closed corrected envelope [5055,5457); peers and appended details are different owners.
 first:5055,end:5457,origin:[17.05,-5.9] as const,rotation:1.89,
 ribSpacing:.52, ribWeight:.135,fullRadius:177,farRadius:245,
 wingJoinV:-3.92,ridgeU:[1.73950285418021,.3148365524853488] as const,
});
const fragment=/* glsl */`
flat varying highp int fogFinishRole;
varying highp vec3 fogFinishMetres;
uniform float fogFinishAmount;
float fogFinishHash(vec2 q) {
 vec3 b=fract(q.xyx*vec3(.12347,.10313,.10709));
 b+=dot(b,b.yxz+29.71);
 return fract((b.x+b.y)*b.z);
}
float fogFinishNoise(vec2 q) {
 vec2 a=floor(q),f=fract(q);f*=f*(3.-2.*f);
 return mix(mix(fogFinishHash(a),fogFinishHash(a+vec2(1.,0.)),f.x),
            mix(fogFinishHash(a+vec2(0.,1.)),fogFinishHash(a+1.),f.x),f.y);
}
float fogFinishRib(float phase,float width) {
 float w=clamp(width*.38,.003,.10);
 float edge=abs(fract(phase+.5)-.5);
 return 1.-smoothstep(.033-w*.25,.081+w,edge);
}
`;
export function patchEastFogFinish(source:Pair):Pair|undefined{
 const {vertexShader:v,fragmentShader:f}=source;
 if((v+f).includes('fogFinish')||![header,begin].every(k=>has(v,k))||
    ![header,stockPaint,roughness,'#include <color_fragment>','varying vec3 vViewPosition;'].every(k=>has(f,k)))return;
 const Q=EAST_FINISH,c=Math.cos(Q.rotation).toFixed(15),s=Math.sin(Q.rotation).toFixed(15);
 return {
  vertexShader:v.replace(header,header+`
flat varying highp int fogFinishRole;
varying highp vec3 fogFinishMetres;
`).replace(begin,begin+`
 fogFinishRole=0;
 vec2 d=position.xz-vec2(17.05,-5.9);
 fogFinishMetres=vec3(dot(d,vec2(${c},-${s})),position.y,dot(d,vec2(${s},${c})));
 if(gl_VertexID>=${Q.first}&&gl_VertexID<${Q.end}){
   fogFinishRole=normal.y>.5?2:(abs(normal.y)<.05?1:0);
 }
`),
  fragmentShader:f.replace(header,header+fragment)
   .replace('#include <color_fragment>',`#include <color_fragment>
 // Always derive interpolants before the role branch, including triangle edges.
 vec3 fogFx=dFdx(fogFinishMetres),fogFy=dFdy(fogFinishMetres);
 float fogFoot=max(length(fogFx),length(fogFy));
 float fogRoughness=0.;
`)
   .replace(stockPaint,stockPaint+`
 if(fogFinishRole>0&&fogFinishAmount>0.){
   float fAmt=clamp(fogFinishAmount,0.,1.)*(1.-smoothstep(${Q.fullRadius.toFixed(1)},${Q.farRadius.toFixed(1)},length(vViewPosition)));
   vec3 fm=fogFinishMetres;
   if(fogFinishRole==2){
     // Standing-seam-like rib rhythm seen in the 2023 aerial. Spacing is authored.
     float ribPhase=fm.z/${Q.ribSpacing};
     float ribDeriv=(abs(fogFx.z)+abs(fogFy.z))/${Q.ribSpacing};
     float resolved=1.-smoothstep(.12,.66,ribDeriv);
     float striae=fogFinishRib(ribPhase,ribDeriv);
     float bevel=fogFinishRib(ribPhase+.070,ribDeriv);
     float tone=fogFinishNoise(fm.xz/3.8)-.5;
     float fine=(fogFinishNoise(fm.xz/.19+.712)-.5)*(1.-smoothstep(.050,.225,fogFoot));
     float ridge=fm.z<${Q.wingJoinV}?${Q.ridgeU[0]}:${Q.ridgeU[1]};
     float fadeEdge=smoothstep(.025,.15,abs(fm.x-ridge));
     float rib=resolved*fadeEdge*(-${Q.ribWeight}*striae+.051*bevel);
     diffuseColor.rgb*=1.+fAmt*(.10*tone+.038*fine+rib);
     fogRoughness=-fAmt*(.085+.030*resolved*striae);
   }else{
     // Keep the original small-scale paint; add restrained weathering by broad patches.
     vec2 q=vec2(fm.x*.749+fm.z*.905, fm.y);
     float scope=fogFinishNoise(q/vec2(1.76,1.14)+vec2(7.9,1.27))-.5;
     float base=1.-smoothstep(.025,.79,fm.y);
     float crest=fogFinishNoise(q*vec2(.92,1.4)+vec2(8.3,31.2))-.5;
     float fine=(fogFinishNoise(q/vec2(.21,.13))-.5)*(1.-smoothstep(.037,.23,fogFoot));
     vec3 age=vec3(.073,.069,.065)*scope+vec3(.029,.035,.039)*crest;
     diffuseColor.rgb*=1.+fAmt*(age+.036*fine-vec3(.083,.078,.064)*base);
     fogRoughness=.018*fAmt*base;
   }
 }
`)
   .replace(roughness,roughness+'\n if(fogRoughness!=0.)roughnessFactor=clamp(roughnessFactor+fogRoughness,.40,1.);'),
 };
}
