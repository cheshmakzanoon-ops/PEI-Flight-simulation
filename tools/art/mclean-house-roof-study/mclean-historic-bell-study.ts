import * as T from 'three';
import {MCLEAN_UPPER_HIP as measured} from './mclean-upper-hip.generated.ts';

type V2=readonly [number,number];
type V3=readonly [number,number,number];
type Band=readonly [fall:number,outward:number];
export type McLeanBellQuality='near'|'mid';
export const MCLEAN_BELL_ROLE=Object.freeze({hip:0,bell:1,shadowEdge:2,artificialClosure:3} as const);
// Drop/offset have no dimensional authority below the 2020 upper analysis cut.
const PROFILE:readonly Band[]=[
 [0,0],[.085,.020],[.235,.052],[.388,.101],[.527,.188],[.660,.310],[.778,.493],[.877,.688],[.955,.883],[1,1]
];
const MID=[0,2,4,6,8,9] as const;
const maximumRise=Math.max(...measured.vertices.map(v=>v[1]))-measured.baseY;
const authoredDrop=.90*maximumRise;
const authoredOffset=.56*maximumRise;
const edgeThickness=.054;
const NOTES=Object.freeze({
 roofHistoricallyInterpreted:true,
 worldPlacement:false,
 physicalOrLegalPlanAuthority:false,
 sourceHigherThanCut:true,
 hasFoundationOrAnnex:false,
 currentConditionClaim:false,
 publishedOriginalGeometry:false,
 upperAnalysisAbsoluteYM:measured.baseY,
 upperFitEpoch:2020,
 lowerArtReferenceEpoch:2009,
 maximumAuthoredOffset:authoredOffset,
 authoredDrop,
} as const);
const P=measured.vertices,
 plan=P.slice(0,4).map(p=>[p[0],p[2]] as V2);
const offsets=plan.map((a,i)=>{
 const b=plan[(i+1)%4],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
 if(!(len>2))throw Error('invalid licensed hip side');
 return [dz/len,-dx/len] as V2;
});
const miter=offsets.map((b,i)=>{
 const a=offsets[(i+3)%4],r=1+a[0]*b[0]+a[1]*b[1];
 if(!(r>.78 && r<1.22))throw Error('implausible licensed hip corner');
 return [(a[0]+b[0])/r,(a[1]+b[1])/r] as V2;
});
const vPlus=(a:V3,b:V3):V3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const vMinus=(a:V3,b:V3):V3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const vScale=(a:V3,f:number):V3=>[a[0]*f,a[1]*f,a[2]*f];
const vCross=(a:V3,b:V3):V3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const vUnit=(a:V3):V3=>{
 const r=Math.hypot(...a);if(!Number.isFinite(r)||r<1e-8)throw Error('degenerate detached roof normal');
 return vScale(a,1/r);
};
const vDot=(a:V3,b:V3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const ridge=(p:V3):V3=>[p[0],p[1]-measured.baseY,p[2]];
const reliefTones=[0x545b50,0x4b5449,0x323a35,0x373935] as const;

function buildMassing(quality:McLeanBellQuality){
 if(quality!=='near'&&quality!=='mid')throw Error('private bell study quality');
 const near=quality==='near';
 const bell:readonly Band[]=near?PROFILE:MID.map(i=>PROFILE[i]);
 const rings=bell.map(([fall,out])=>plan.map((p,i):V3=>[
  p[0]+miter[i][0]*authoredOffset*out,(fall===0?0:-authoredDrop*fall),p[1]+miter[i][1]*authoredOffset*out
 ]));
 const skirt=rings.at(-1)!.map(p=>[p[0],p[1]-edgeThickness,p[2]] as V3);
 const positions:number[]=[],normals:number[]=[],colors:number[]=[],courses:number[]=[],roles:number[]=[];
 const put=(p:V3,n:V3,style:number,st:V2)=>{
  positions.push(...p);normals.push(...n); courses.push(...st);roles.push(style);
  const c=palette[style];colors.push(c.r,c.g,c.b);
 };
 const palette=reliefTones.map(c=>new T.Color(c));
 const triangle=(p:readonly [V3,V3,V3],s:readonly [V2,V2,V2],style:number,norm?:readonly [V3,V3,V3])=>{
  const face=vUnit(vCross(vMinus(p[1],p[0]),vMinus(p[2],p[0])));
  if(!norm)norm=[face,face,face];
  if(norm.some(n=>vDot(n,face)<.65))throw Error('detached roof smooth normal crossed its physical facet');
  for(let j=0;j<3;j++)put(p[j],norm[j],style,s[j]);
 };
 for(let k=6;k<measured.indices.length;k+=3){
  const i=measured.indices,r=measured.roles[k/3],pts=[ridge(P[i[k]]),ridge(P[i[k+1]]),ridge(P[i[k+2]])] as const;
  // Tangent axis from original ring corresponding to its exact measured plane.
  const E=r==='westRise'?3:r==='eastFall'?1:r==='southRise'?0:2;
  const v=plan[E],w=plan[(E+1)%4],dy=[w[0]-v[0],w[1]-v[1]] as const,h=Math.hypot(...dy);
  const normal=vUnit(vCross(vMinus(pts[1],pts[0]),vMinus(pts[2],pts[0])));
  if(normal[1]<=0)throw Error('unexpected licensed upper face winding');
  const asc=Math.sqrt(1+normal[1]**2/(1-normal[1]**2));
  const pattern=(p:V3):V2=>[((p[0]-v[0])*dy[0]+(p[2]-v[1])*dy[1])/h,p[1]*asc];
  triangle(pts,[pattern(pts[0]),pattern(pts[1]),pattern(pts[2])],MCLEAN_BELL_ROLE.hip);
 }
 const tang=plan.map((p,i):V3=>{
  const b=plan[(i+1)%4];return vUnit([b[0]-p[0],0,b[1]-p[1]]);
 });
 const edgeUnit=(ring:readonly V3[],i:number)=>vScale(vPlus(ring[i],ring[(i+1)%4]),.5);
 for(let f=0;f<4;f++){
  const i=f,j=(f+1)%4,t=tang[f],s=offsets[f],org=plan[f];
  const center=rings.map(rr=>edgeUnit(rr,f));
  const cumulative=[0];
  for(let q=1;q<center.length;++q)cumulative.push(cumulative[q-1]+Math.hypot(...vMinus(center[q],center[q-1])));
  const normal=(ring:number):V3=>{
   const from=center[Math.max(0,ring-1)],to=center[Math.min(center.length-1,ring+1)];
   const n=vUnit(vCross(t,vMinus(to,from)));
   if(n[1]<0||n[0]*s[0]+n[2]*s[1]<=0)throw Error('invalid lower bell winding');
   return n;
  };
  const tex=(p:V3,ring:number):V2=>[(p[0]-org[0])*t[0]+(p[2]-org[1])*t[2],-cumulative[ring]];
  for(let n=0;n<rings.length-1;n++){
   const a=rings[n],b=rings[n+1],v=normal(n),w=normal(n+1);
   const at=tex(a[i],n),au=tex(a[j],n),bt=tex(b[i],n+1),bu=tex(b[j],n+1);
   triangle([a[i],a[j],b[j]],[at,au,bu],MCLEAN_BELL_ROLE.bell,[v,v,w]);
   triangle([a[i],b[j],b[i]],[at,bu,bt],MCLEAN_BELL_ROLE.bell,[v,w,w]);
  }
  // Source supports a shadowed slim edge, not any exact gutter or framing.
  const a=rings.at(-1)!,b=skirt,z:V2=[0,0];
  triangle([a[i],a[j],b[j]],[z,z,z],MCLEAN_BELL_ROLE.shadowEdge);
  triangle([a[i],b[j],b[i]],[z,z,z],MCLEAN_BELL_ROLE.shadowEdge);
 }
 const z:V2=[0,0];
 triangle([skirt[0],skirt[1],skirt[2]],[z,z,z],MCLEAN_BELL_ROLE.artificialClosure);
 triangle([skirt[0],skirt[2],skirt[3]],[z,z,z],MCLEAN_BELL_ROLE.artificialClosure);
 return {positions,normals,colors,courses,roles};
}
const hName='McLean House Inn - private historic bell-mansard illustration';
const ink=/*glsl*/`
varying vec2 mcBvCourse;
varying float mcBvRole;
float mcBHash(vec2 p){
 p=fract(p*vec2(.1031,.1099));
 p+=dot(p,p.yx+19.19);
 return fract((p.x+p.y)*p.x);
}
float mcBRoofResponse(vec2 c){
 // Derivatives are evaluated in uniform control flow, before the role branch.
 vec2 micro=c/vec2(.324,.148),dx=fwidth(micro);
 float spectral=1.-smoothstep(.37,1.10,max(dx.x,dx.y));
 float xWidth=max(.002,dx.x),yWidth=max(.002,dx.y);
 float row=floor(micro.y);
 float x=micro.x+mod(row,2.)*.48+.10*(mcBHash(vec2(row,3.))-0.5);
 vec2 cell=vec2(floor(x),row);
 float lap=1.-smoothstep(.016,.072+.48*yWidth,fract(micro.y));
 float joint=1.-smoothstep(.018,.064+.48*xWidth,abs(fract(x+.50)-.5));
 float tile=mcBHash(cell)-.5;
 float slow=1.-smoothstep(.68,2.6,max(.324*dx.x,.148*dx.y));
 float haze=slow*.027*(sin(c.x*.77+c.y*1.27)+.40*sin(c.x*1.77-c.y*.65));
 return 1.+haze+spectral*(.135*tile-.085*lap-.052*joint);
}
`;
/** No geographic mount or ground. Roof upper is measured; bell, edge and technical underside are illustrative. */
export function createMcLeanHistoricBellStudy(quality:McLeanBellQuality='near'){
 const data=buildMassing(quality),g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));
 g.setAttribute('normal',new T.Float32BufferAttribute(data.normals,3));
 g.setAttribute('color',new T.Float32BufferAttribute(data.colors,3));
 g.setAttribute('mcBCourse',new T.Float32BufferAttribute(data.courses,2));
 g.setAttribute('mcBRole',new T.Float32BufferAttribute(data.roles,1));
 g.computeBoundingBox();g.computeBoundingSphere();
 const m=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.94,metalness:0,
  side:T.FrontSide,transparent:false,depthWrite:true,depthTest:true,flatShading:false});
 m.onBeforeCompile=shader=>{
  const v='#include <color_vertex>',f='#include <color_fragment>';
  if(shader.vertexShader.split(v).length!==2||shader.fragmentShader.split(f).length!==2)return;
  shader.vertexShader='attribute vec2 mcBCourse;attribute float mcBRole;varying vec2 mcBvCourse;varying float mcBvRole;\n'+
   shader.vertexShader.replace(v,v+'\n mcBvCourse=mcBCourse; mcBvRole=mcBRole;');
  shader.fragmentShader=ink+shader.fragmentShader.replace(f,
   f+'\n float mcBFilter=mcBRoofResponse(mcBvCourse);\n if(mcBvRole<1.5)diffuseColor.rgb*=mcBFilter;');
 };
 m.customProgramCacheKey=()=>'mclean-historic-bell-v1-r187';
 const mesh=new T.Mesh(g,m);
 mesh.name=hName;mesh.castShadow=false;mesh.receiveShadow=false;
 let disposed=false;
 return Object.freeze({mesh,quality,triangles:g.getAttribute('position').count/3,scope:NOTES,close(){
  if(disposed)return;disposed=true;mesh.removeFromParent();g.dispose();m.dispose();
 }});
}
