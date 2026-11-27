/** Original analytic East-facing finish over the exact isolated V2 mesh only. */
import type * as T from 'three';
import {createDetachedGeorgetownPierV2,GEORGETOWN_PIER_V2} from './georgetown-pier-v2.ts';

const makeV3 = 'Georgetown historic Marine Terminal V3 east fascia study';
const MAX={start:-123, fadeIn:-112, fadeOut:12, stop:23, near:425, out:820} as const;

// These analytic primitives describe a narrow interruption and its smooth
// bevel. Their widths/phase are interpretation, not transferred source pixels.
const BAND_HELPERS=`
 float pierEastIntegral(float s,float lo,float hi) {
  return floor(s)*(hi-lo)+clamp(fract(s)-lo,0.,hi-lo);
 }
 float pierEastPulse(float l,float h,float lo,float hi,float iw) {
  return clamp((pierEastIntegral(h,lo,hi)-pierEastIntegral(l,lo,hi))*iw,0.,1.);
 }
 float pierEastRampIntegral(float s,float lo,float hi) {
  float z=clamp((s-lo)/(hi-lo),0.,1.);
  return (hi-lo)*z*z*z*(1.-.5*z)+max(s-hi,0.);
 }
 float pierEastRampAA(float l,float h,float lo,float hi,float iw) {
  return clamp((pierEastRampIntegral(h,lo,hi)-pierEastRampIntegral(l,lo,hi))*iw,0.,1.);
 }
`;

// Derivatives are taken in uniform flow before any per-primitive or spatial
// condition. No lookup reads from geometry, environment resources or images.
const EAST_FOOTPRINT=`
  float pierEastU=marineUV.x;
  float pierEastPattern=pierEastU*.32051282+.083*sin(pierEastU*.071+.64)+.381;
  float pierEastUWidth=max(fwidth(pierEastPattern),.001);
  float pierEastYL=marineP.y;
  float pierEastYWidth=max(fwidth(pierEastYL),.001);
  float pierEastEnvelope=smoothstep(${MAX.start.toFixed(1)},${MAX.fadeIn.toFixed(1)},pierEastU)*
       (1.-smoothstep(${MAX.fadeOut.toFixed(1)},${MAX.stop.toFixed(1)},pierEastU))*
       (1.-smoothstep(${MAX.near.toFixed(1)},${MAX.out.toFixed(1)},e));
`;

const EAST_RELIEF=`
  if(marineRole>.5&&marineRole<1.5&&pierEastEnvelope>0.) {
   float l=pierEastPattern-.5*pierEastUWidth,h=pierEastPattern+.5*pierEastUWidth,iw=1./pierEastUWidth;
   float body=pierEastPulse(l,h,.435,.565,iw);
   float bevel0=pierEastPulse(l,h,.388,.435,iw);
   float bevel1=pierEastPulse(l,h,.565,.612,iw);
   float resolved=1.-smoothstep(.35,.68,pierEastUWidth);
   float yl=pierEastYL-.5*pierEastYWidth,yh=pierEastYL+.5*pierEastYWidth,yiw=1./pierEastYWidth;
   float cap=pierEastRampAA(yl,yh,1.19,1.58,yiw);
   float aboveToe=pierEastRampAA(yl,yh,.13,.43,yiw);
   vec3 axis=normalize(vec3(n.z,0.,-n.x));
   float side0=max(dot(normalize(n+.32*axis),pierSun),0.)-lit;
   float side1=max(dot(normalize(n-.32*axis),pierSun),0.)-lit;
   float relief=resolved*aboveToe*(1.-.88*cap)*
     (-.52*body-.16*(bevel0+bevel1)+.44*(bevel0*side0+bevel1*side1));
   vec3 warm=vec3(.277,.231,.180)*(.79+.21*lit+.13*zones);
   vec3 registered=mix(c*(1.+relief),warm,.64*cap);
   c=mix(c,registered,pierEastEnvelope);
  }
`;
const insertOnce=(s:string,pin:string,fn:(a:string)=>string)=>{
 if(s.split(pin).length!==2)throw Error('Unexpected detached V2 fascia shader interface');
 return s.replace(pin,fn(pin));
};
const HAZE='  float haze=clamp(1.-exp(-e*.000021),0.,.83);';
export const GEORGETOWN_PIER_V3_EAST_FASCIA=Object.freeze({
 name:makeV3,role:1,shadow:false,
 // Scope identifies a finish witness, not an operating site or a measured construction outline.
 authoredPhaseNotMeasured:true, artistApproxPeriodM:3.12,
 uvAndCameraEnvelope:MAX,
 parentMesh:GEORGETOWN_PIER_V2.name,
 inheritedPositionSHA256:'80cb6eab877eb24cce14d09bfe46a44aeaf3ac2455abf6053f9eb7b542752be2',
 expectedTriangles:658, drawCount:1,
 markerPredicate:'marineRole>.5&&marineRole<1.5&&pierEastEnvelope>0.',
 rgbOnly:true
});
export function createDetachedGeorgetownPierV3EastFascia(sun:T.Vector3){
 const m=createDetachedGeorgetownPierV2(sun);
 const own=m.material;
 if(m.name!==GEORGETOWN_PIER_V2.name||m.visible||m.parent||m.castShadow||m.receiveShadow||
    m.geometry.attributes.position.count!==GEORGETOWN_PIER_V3_EAST_FASCIA.expectedTriangles*3)
  throw Error('Lost exact isolated V2 parent');
 let f=own.fragmentShader;
 f=insertOnce(f,' void main(){',s=>BAND_HELPERS+s);
 f=insertOnce(f,'  vec3 c;',s=>EAST_FOOTPRINT+s);
 own.fragmentShader=insertOnce(f,HAZE,s=>EAST_RELIEF+s);
 own.name='Georgetown V3 original east-facing industrial fascia optics';
 m.name=makeV3;
 m.userData.georgetownHistoricEastFasciaProof=GEORGETOWN_PIER_V3_EAST_FASCIA;
 return m;
}
