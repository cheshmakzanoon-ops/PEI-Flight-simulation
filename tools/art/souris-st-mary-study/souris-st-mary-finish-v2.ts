/** Standalone optional V2 appearance study, keeping the V1 program art and geometry sealed. */
import type { MaryRole } from './souris-saint-mary-forms.ts';
import { makeDetachedMaryFinish,patchDetachedMaryShaders } from './souris-saint-mary-finishes.ts';

const sandstone = `
void marySandstone(in vec2 m,inout vec3 base,out float rough,out float h){
 // Nominal original block family. Individual widths/heights are not survey dimensions.
 float v=m.y/.805+.011*sin(.54*m.x+.67)+.014*sin(1.82*m.x-.39);
 float dv=max(fwidth(v),.002),pair=floor(v), vCut=.37+.24*maryHash(vec2(pair,11.8));
 float vf=fract(v), row=pair*2.+step(vCut,vf);
 float bed0=maryBand(v,.003,.028,dv), bed1=maryBand(v-vCut,.004,.026,dv);
 float seamY=max(bed0,bed1);
 // Floor-based IDs are one per changed block, with a slowly displaced motif inside it.
 // Compute the width from the continuous metric axis to avoid cross-quad row derivatives.
 float x0=m.x/1.43;
 float dx=max(fwidth(x0),.002);
 float x=x0+.46*mod(row,2.)+.29*maryHash(vec2(80.5,row))+.009*sin(m.y*2.9+x0);
 float k=floor(x), xCut=.29+.44*maryHash(vec2(k+13.2,row+6.7));
 float xFr=fract(x), xId=k*2.+step(xCut,xFr);
 float seam0=maryBand(x,.003,.021,dx), seam1=maryBand(x-xCut,.003,.023,dx);
 float stable=1.-smoothstep(.19,.62,max(dv,dx));
 float gentle=1.-smoothstep(.34,.92,max(dv,dx));
 float seamX=max(seam0,seam1)*stable*(1.-seamY);
 float seam=clamp(seamY+seamX,0.,1.);
 float block=(maryHash(vec2(xId,row))-.5)*gentle;
 float wash=maryNoise(m*vec2(.31,.56))-.5;
 float vein=(maryNoise(m*vec2(2.78,6.28)+vec2(.077*row,.069*xId))-.5)*maryFoot(m,6.5);
 float scatter=(maryNoise(m*vec2(19.9,22.4))-.5)*maryFoot(m,23.);
 float boundary=1.-smoothstep(.36,.78,max(dv,dx));
 vec3 worn=base*vec3(1.+.087*wash+.177*block+.103*vein+.048*scatter,
                     1.+.134*wash+.238*block+.132*vein+.067*scatter,
                     1.+.158*wash+.257*block+.141*vein+.072*scatter);
 // Restrained lime-grey from near to mid; avoid black, clean manufactured joints.
 base=mix(worn,worn*.67+vec3(.023,.020,.015),.77*seam);
 rough=.041*block+.074*seam+.056*vein+.020*scatter;
 h=boundary*(-.0025*seam+.0019*vein+.0011*scatter);
}
`;
export function patchMaryStoneV2(vertex:string,fragment:string,role:MaryRole){
 const q=patchDetachedMaryShaders(vertex,fragment,role);
 if(!q||role!=='stone')return q;
 const a=q.fragment.indexOf('void marySandstone('),b=q.fragment.indexOf('void maryRoof(');
 if(a<0||b<=a||a!==q.fragment.lastIndexOf('void marySandstone('))return q;
 return {vertex:q.vertex,fragment:q.fragment.slice(0,a)+sandstone+q.fragment.slice(b)};
}
export function makeDetachedMaryFinishV2(role:MaryRole){
 const mat=makeDetachedMaryFinish(role);
 if(role==='stone'){
   mat.onBeforeCompile=s=>{const q=patchMaryStoneV2(s.vertexShader,s.fragmentShader,role);if(q){s.vertexShader=q.vertex;s.fragmentShader=q.fragment;}};
   mat.customProgramCacheKey=()=>`pei-souris-mary-detached-stone-style-only-v2`;
   mat.name+=' / independent V2 stone';
 }
 return mat;
}
