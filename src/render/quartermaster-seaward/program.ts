/** A detached only optics study. Selects one existing measured low roof
 * polygon, unchanged XYZ/normals/depth. No project hook, new geometry,
 * images, world contact, remembered resource or scene assignment. */
import {QUARTERMASTER_SEAWARD as P} from './seaward-roof-pins.ts';

const head='#include <common>',vm='void main(){vec4 p=';
const fm=' void main(){\n #include <logdepthbuf_fragment>';
const baseRoof=' }else{c*=1.-.11*fine*band(uv2d.x*1.8,.0,.17);}';
const draftToken='qmSeawardRoof';
const onlyOnce=(s:string,k:string)=>s.indexOf(k)>=0&&s.indexOf(k)===s.lastIndexOf(k);

const materialGLSL=/* glsl */`
 flat varying float qmSeawardRoof;
 uniform float qmSeawardOptics;
 float qmRoofHash(vec2 a){
  vec3 p=fract(a.xyx*vec3(.11413,.10921,.10132));
  p+=dot(p,p.yxz+21.42);return fract((p.x+p.y)*p.z);
 }
 float qmRoofDiffuse(vec2 a){
  vec2 i=floor(a),f=fract(a);f=f*f*(3.-2.*f);
  return mix(mix(qmRoofHash(i),qmRoofHash(i+vec2(1.,0.)),f.x),
             mix(qmRoofHash(i+vec2(0.,1.)),qmRoofHash(i+1.),f.x),f.y);
 }
 vec3 qmRoofFinish(vec3 prior,vec2 local,vec3 n,vec3 eye,float diameter){
  // Shift from regularly lined stock to a subdued low-slope roof. These
  // are original continuous response scales, not registered repair areas,
  // seams, standing water, ventilation, parapets or roof construction.
  vec2 p=mat2(.869,.494,-.494,.869)*(local+vec2(-156.,-102.));
  float macro=qmRoofDiffuse(p/24.+vec2(4.1,-8.8))-.5;
  float field=qmRoofDiffuse(p/8.4+vec2(19.1,6.6))-.5;
  float granular=(qmRoofDiffuse(p/.31+vec2(9.,15.9))-.5)*
   (1.-smoothstep(.105,.66,diameter));
  float facing=clamp(dot(n,eye),0.,1.);
  float sheen=pow(1.-facing,4.);
  vec3 slateGray=mix(prior,vec3(.142,.130,.119),.70);
  // Bounded rough diffuse and a soft angle term only; not metallic flashing
  // or a reflected photograph, and no texture fetches.
  return slateGray*(1.+macro*.14+field*.052+granular*.041)+
   sheen*vec3(.002,.003,.0035);
 }
`;

/** Exact source transformation read by the offline shader fixture. A
 * valid Three material also requires the sealed custody checks below. */
export function patchQuartermasterSeawardRoofProgram(vertex:string,fragment:string){
 if((vertex+fragment).includes(draftToken)||![head,vm].every(k=>onlyOnce(vertex,k))||
    ![fm,baseRoof].every(k=>onlyOnce(fragment,k)))return;
 const [a,b]=P.geometry.targetSpan;
 const v=vertex.replace(head,head+'\n flat varying float '+draftToken+';')
  .replace(vm,`void main(){${draftToken}=(gl_VertexID>=${a}&&gl_VertexID<${b})?1.:0.;vec4 p=`);
 const f=fragment.replace(fm,materialGLSL+fm+`
 // Form derivatives before the role switch, on the original local metres.
 float qmRoofFootprint=max(length(dFdx(uv2d)),length(dFdy(uv2d)));
 `).replace(baseRoof,` }else{
  float qmInherited=1.-.11*fine*band(uv2d.x*1.8,.0,.17);
  if(qmSeawardRoof>.5&&qmSeawardOptics>0.&&d<${P.art.maxRange.toFixed(1)}){
   float wm=qmSeawardOptics*(1.-smoothstep(${P.art.fullRange.toFixed(1)},${P.art.maxRange.toFixed(1)},d));
   c=mix(c*qmInherited,qmRoofFinish(c,uv2d,n,normalize(cameraPosition-wp),qmRoofFootprint),wm);
  }else c*=qmInherited;
 }
 `);
 return {vertexShader:v,fragmentShader:f};
}
