/** Source-only East fog ground experiment; no renderer, upload, or mount. */
export type FogLightSource=Readonly<{vertexShader:string;fragmentShader:string}>;
const VARY='varying vec3 p; varying vec2 vuv;', ASSIGN='p=w.xyz;vuv=uv;';
const FUNC='vec3 stationGround(vec3 original,vec2 p,float coast){';
const CALL='stationGround(col,p.xz,coast)';
const LOG='#include <logdepthbuf_fragment>';
const OLD_CONTACT='contact=1.-smoothstep(-.13,.98+px*.35,min(hb,lb));';
const OLD_CAST='houseShadow=1.-smoothstep(-.2,1.12+px*.45,footprint);';
const prefix='fogReceiverStudy';
const hasExactly=(s:string,k:string)=>s.indexOf(k)>=0&&s.indexOf(k)===s.lastIndexOf(k);
const declaredKernel='highp float fogCandidateVisibilitySlack(highp vec3 UYV)';
const term=`
uniform vec2 fogReceiverStudyChannels;
highp float fogReceiverStudyContact(highp vec2 uv,highp float px){
 highp vec2 nearLow=uv-vec2(.46,-7.01),nearHigh=uv-vec2(-.05,2.365);
 highp float d=min(stationBox(nearLow,vec2(4.24,3.09)),stationBox(nearHigh,vec2(4.25,6.285)));
 return 1.-smoothstep(-.13,.98+min(px,.628)*.35,d);
}
highp float fogReceiverStudyCast(highp vec3 q,highp vec3 dx,highp vec3 dy){
 highp float slack=fogCandidateVisibilitySlack(q);
 // From inside the verified caster support only. .025 m is preflight,
 // not a bound on future native interpolation or an assumed real penumbra.
 highp float width=clamp(.5*(length(dx)+length(dy)),.02,.55);
 return smoothstep(.025,.025+width,slack);
}
`;
/** Reuses old absolute position and grade/water blends untouched. New optical
 * local coordinates are supplied from the exact receiver's vertex stream;
 * the lease, native equality and arithmetic certificate are separate tasks. */
export function patchDetachedFogLight(source:FogLightSource,kernel:string):FogLightSource|undefined{
 const {vertexShader:vs,fragmentShader:fs}=source;
 if([prefix,declaredKernel].some(m=>vs.includes(m)||fs.includes(m))||
    ![VARY,ASSIGN].every(m=>hasExactly(vs,m))||
    ![FUNC,CALL,LOG,OLD_CAST,OLD_CONTACT].every(m=>hasExactly(fs,m))||
    !hasExactly(kernel,declaredKernel)||!hasExactly(kernel,'return max(b0,b1);')||kernel.includes('#')||
    !hasExactly(fs,'float stationBox(vec2 p,vec2 b)')||
    !hasExactly(fs,'outcol*=1.-max(shade,houseShadow)*.33;')||
    !hasExactly(fs,'outcol*=1.-contact*.23;'))return;
 const kernelText=kernel.slice(kernel.indexOf(declaredKernel),kernel.indexOf('return max(b0,b1);')+'return max(b0,b1);'.length).trim()+'\n}\n';
 const extended='vec3 stationGround(vec3 original,vec2 p,float coast,highp vec3 fq,highp vec3 fx,highp vec3 fy){';
 return {
  vertexShader:vs.replace(VARY,VARY+`
varying highp vec3 fogReceiverStudyLocal;
uniform highp vec3 fogReceiverStudyOrigin;
uniform highp vec2 fogReceiverStudyBasis;
`).replace(ASSIGN,ASSIGN+`
highp vec3 dl=position-fogReceiverStudyOrigin;
fogReceiverStudyLocal=vec3(
 dot(dl.xz,vec2(fogReceiverStudyBasis.x,-fogReceiverStudyBasis.y)),dl.y,
 dot(dl.xz,vec2(fogReceiverStudyBasis.y,fogReceiverStudyBasis.x)));
`),
  fragmentShader:fs.replace(FUNC,'varying highp vec3 fogReceiverStudyLocal;\n'+kernelText+term+extended)
   .replace(LOG,LOG+`
 highp vec3 fogReceiverStudyDx=dFdx(fogReceiverStudyLocal),
            fogReceiverStudyDy=dFdy(fogReceiverStudyLocal);
`).replace(CALL,'stationGround(col,p.xz,coast,fogReceiverStudyLocal,fogReceiverStudyDx,fogReceiverStudyDy)')
   .replace(OLD_CONTACT,'if(fogReceiverStudyChannels.x>.5)contact=fogReceiverStudyContact(fq.xz,max(length(fx.xz),length(fy.xz)));else '+OLD_CONTACT)
   .replace(OLD_CAST,'if(fogReceiverStudyChannels.y>.5)houseShadow=fogReceiverStudyCast(fq,fx,fy);else '+OLD_CAST)
 };
}

// Exact study inputs of the original N112 31-12 receiver.
// These are raw shaders; actual compiled GL program/defines/owners still
// require native custody. This deliberately refuses any raw source drift.
export const EAST_FOG_RECEIVER_SOURCE=Object.freeze({
 vertex:'a71f9476607f8cb5313693f8558281963fdffa6ec6cbc0c8591010505eba9496',
 activeAtmosphere:'b199ba88b708f0211a4c49d14584505cddf0c32c53b0655ee348781ab5382d16',
 bareFixture:'56630d55a0b627ec720cd155e9d1d59e7719da97da60b0c81839949e3d782cdf',
 kernel:'5326e6a34a1a0dd37c4d0a2568425570fca3dba54f87f210ab08fb21c7ab781c',
});
export async function verifyDetachedFogReceiverSource(source:FogLightSource,kernel:string,
 family:'activeAtmosphere'|'bareFixture'='activeAtmosphere'){
 try{
  if(!globalThis.crypto?.subtle)return;
  const digest=async (text:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))]
   .map(q=>q.toString(16).padStart(2,'0')).join('');
  const [vertex,fragment,sunKernel]=await Promise.all([digest(source.vertexShader),digest(source.fragmentShader),digest(kernel)]);
  if(vertex!==EAST_FOG_RECEIVER_SOURCE.vertex||fragment!==EAST_FOG_RECEIVER_SOURCE[family]||sunKernel!==EAST_FOG_RECEIVER_SOURCE.kernel)return;
  return patchDetachedFogLight(source,kernel);
 }catch{return;}
}
