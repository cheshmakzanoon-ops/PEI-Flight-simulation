import * as T from 'three';
import {MCLEAN_UPPER_HIP as hip} from './mclean-upper-hip.generated.ts';

type XY=readonly [number,number]; // local face distance and relative Y
type XYZ=readonly [number,number,number];
type Ring={half:number;foot:number;spring:number;apex:number};
export type McLeanDormerQuality='near'|'mid';

export const MCLEAN_DORMER_ROLE=Object.freeze({
 cheek:0,outerPaint:1,lightMoulding:2,reveal:3,glass:4,
 hoodTop:5,hoodUnder:6,keystone:7,sill:8,sash:9
} as const);
const tone=[
 0x697368,0x9a9a82,0xcfc3a8,0x888e7c,0x657477,
 0x535d51,0x667064,0xb4b29a,0x7f8472,0x9a9f8a
] as const;
const sourceEdge=[hip.vertices[1],hip.vertices[2]] as const;
const exactTopOut=Math.max(...hip.vertices.map(q=>q[1]))-hip.baseY;
const BELL=.90*exactTopOut; // sealed relative studio shape, not a survey of the bell.
const A=sourceEdge[0],B=sourceEdge[1],len=Math.hypot(B[0]-A[0],B[2]-A[2]);
const tx=(B[0]-A[0])/len, tz=(B[2]-A[2])/len;
const nx=tz,nz=-tx;
const N=[nx,0,nz] as const,Y=[0,1,0] as const,TAN=[tx,0,tz] as const;
const NEG=(v:XYZ):XYZ=>[-v[0],-v[1],-v[2]];
const sub=(a:XYZ,b:XYZ):XYZ=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a:XYZ,b:XYZ):XYZ=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a:XYZ,b:XYZ)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const normal=(a:XYZ):XYZ=>{
 const l=Math.hypot(...a);
 if(!Number.isFinite(l)||l<1e-10)throw Error('degenerate detached dormer primitive');
 return [a[0]/l,a[1]/l,a[2]/l];
};
const ZERO=[0,0] as const;
const R=MCLEAN_DORMER_ROLE;
const centres=[.282,.718] as const;
const SCOPE=Object.freeze({
 seat:false,placement:false,stockMask:false,notCurrentConditions:true,
 originalDataYear:2020,historicReferenceYear:2009,addedGeometryMeasured:false,
 principalLocalSide:1,principalOrientation:'probable +U historical front, not a calibrated site heading',
 exclusivelyBelowMeasuredCap:true,minimumCutGap:.07,referencePixelsOrImages:false,
 centresAreAuthoredFractions:Object.freeze(centres)
} as const);
const loc=(s:number,y:number,d:number):XYZ=>[A[0]+tx*s+nx*d,y,A[2]+tz*s+nz*d];
const f=(u:number)=>-BELL*u;

function makeGeometry(quality:McLeanDormerQuality){
 if(quality!=='near'&&quality!=='mid')throw Error('invalid detached dormer study tier');
 const near=quality==='near',arcCount=near?16:8;
 const angles=Array.from({length:arcCount+1},(_,i)=>Math.PI*i/arcCount);
 const palette=tone.map(c=>new T.Color(c));
 const p:number[]=[], n:number[]=[], rgb:number[]=[],uv:number[]=[], role:number[]=[], id:number[]=[],component:number[]=[];
 const spans:Array<readonly [number,number]>=[];
 let who=0,part=0;
 const write=(a:XYZ,b:XYZ,k:number,st:XY)=>{
  const s=(a[0]-A[0])*tx+(a[2]-A[2])*tz;
  const d=(a[0]-A[0])*nx+(a[2]-A[2])*nz;
  if(s<.82||s>len-.82||a[1]>-.07||a[1]<-1.56||d<-.10001||d>.876)
   throw Error('shape exceeds detached bell role or approaches measured upper');
  p.push(...a);n.push(...b);uv.push(...st);role.push(k);id.push(who);component.push(part);
  const c=palette[k];rgb.push(c.r,c.g,c.b);
 };
 const t=(a:XYZ,b:XYZ,c:XYZ,aim:XYZ,k:number,s=ZERO as XY,v=ZERO as XY,w=ZERO as XY)=>{
  let nrm=normal(cross(sub(b,a),sub(c,a)));
  // Shapes are authored locally; deterministic winding with physical outward orientation.
  if(dot(nrm,aim)<0){nrm=NEG(nrm);[b,c]=[c,b];[v,w]=[w,v];}
  if(dot(nrm,aim)<1e-4)throw Error('detached dormer has indeterminate outward normal');
  write(a,nrm,k,s);write(b,nrm,k,v);write(c,nrm,k,w);
 };
 const q=(a:XYZ,b:XYZ,c:XYZ,d:XYZ,aim:XYZ,k:number)=>{
  t(a,b,c,aim,k);t(a,c,d,aim,k);
 };
 const outline=(r:Ring):readonly XY[]=>[
  [-r.half,r.foot],[r.half,r.foot],
  ...angles.map(v=>[r.half*Math.cos(v),r.spring+(r.apex-r.spring)*Math.sin(v)] as XY)
 ];
 const circle=(half:number,spring:number,apex:number):readonly XY[]=>
  angles.map(v=>[half*Math.cos(v),spring+(apex-spring)*Math.sin(v)]);
 function one(center:number){
  who++;
  const start=p.length/3;
  const get=(v:XY,d:number)=>loc(center+v[0],v[1],d);
  const place=(g:readonly XY[],d:number)=>g.map(a=>get(a,d));
  const cheekDirection=(a:XY,b:XY):XYZ=>normal([tx*(b[1]-a[1]),a[0]-b[0],tz*(b[1]-a[1])]);
  const adjoin=(a:readonly XYZ[],b:readonly XYZ[],aim:(i:number,j:number)=>XYZ,k:number)=>{
   if(a.length!==b.length)throw Error('dormer ring degree mismatch');
   for(let i=0;i<a.length;i++){const j=(i+1)%a.length;q(a[i],a[j],b[j],b[i],aim(i,j),k);}
  };
  const cover=(g:readonly XY[],d:number,k:number,front:boolean,glazing=false)=>{
   const v=place(g,d),box=g.map(a=>a[1]);
   const ymin=Math.min(...box),ymax=Math.max(...box),half=Math.max(...g.map(a=>Math.abs(a[0])));
   // Strict interior fan supports identical edge coordinates, closed despite strong recess.
   const middle=[g.reduce((s,a)=>s+a[0],0)/g.length,g.reduce((s,a)=>s+a[1],0)/g.length] as XY,z=get(middle,d);
   const tex=(w:XY):XY=>glazing?[(w[0]/half+1)*.5,(w[1]-ymin)/(ymax-ymin)] : ZERO;
   for(let i=0;i<g.length;i++){
    const j=(i+1)%g.length;t(z,v[i],v[j],front?N:NEG(N),k,tex(middle),tex(g[i]),tex(g[j]));
   }
  };
  const solid=(g:readonly XY[],a:number,b:number,k:number)=>{
   part++;
   const x=place(g,a),y=place(g,b);
   adjoin(x,y,(i,j)=>cheekDirection(g[i],g[j]),k);
   cover(g,a,k,false);cover(g,b,k,true);
  };
  const box=(a:number,b:number,c:number,d:number,front:number,back:number,k:number)=>{
   solid([[a,c],[b,c],[b,d],[a,d]],back,front,k);
  };
  // Main closed case. Back planes lie behind the unmodified historically interpreted bell.
  part++;
  const exterior=outline({half:.445,foot:f(.788),spring:f(.300),apex:f(.108)});
  const lip=outline({half:.408,foot:f(.755),spring:f(.302),apex:f(.128)});
  const raised=outline({half:.384,foot:f(.738),spring:f(.308),apex:f(.143)});
  const mouth=outline({half:.330,foot:f(.720),spring:f(.311),apex:f(.174)});
  const glass=outline({half:.309,foot:f(.704),spring:f(.318),apex:f(.186)});
  const back=place(exterior,-.078),front=place(exterior,.705),ed=place(lip,.735),
   rd=place(raised,.763),rr=place(mouth,.746),gg=place(glass,.630);
  adjoin(back,front,(i,j)=>cheekDirection(exterior[i],exterior[j]),R.cheek);
  cover(exterior,-.078,R.cheek,false);
  adjoin(front,ed,()=>N,R.outerPaint);
  adjoin(ed,rd,()=>N,R.lightMoulding);
  adjoin(rd,rr,()=>N,R.lightMoulding);
  adjoin(rr,gg,()=>N,R.reveal);
  cover(glass,.630,R.glass,true,true);

  // Separate narrow closed hood over the case, not just painted arch geometry.
  part++;
  const outer=circle(.505,f(.319),f(.061)),inner=circle(.421,f(.319),f(.113));
  const backC=(g:readonly XY[])=>g.map((a,j)=>get([a[0],a[1]+.025*Math.sin(angles[j])],-.060));
  const outerF=place(outer,.808),innerF=place(inner,.808),outerB=backC(outer),innerB=backC(inner);
  for(let i=0;i<arcCount;i++){
   const j=i+1,rad=(angles[i]+angles[j])/2;
   const n0=normal([tx*Math.cos(rad),Math.sin(rad),tz*Math.cos(rad)]);
   q(outerF[i],outerF[j],innerF[j],innerF[i],N,R.lightMoulding);
   q(outerB[i],outerB[j],innerB[j],innerB[i],NEG(N),R.hoodTop);
   q(outerF[i],outerF[j],outerB[j],outerB[i],n0,R.hoodTop);
   q(innerF[i],innerF[j],innerB[j],innerB[i],NEG(n0),R.hoodUnder);
  }
  for(const k of [0,arcCount])q(outerF[k],innerF[k],innerB[k],outerB[k],NEG(Y),R.hoodUnder);
  // Petite central hood-key and projecting sill are geometry, never old photo fragments.
  solid([[-.066,f(.119)],[.066,f(.119)],[.086,f(.070)],[-.086,f(.070)]],.793,.835,R.keystone);
  box(-.444,.444,f(.797),f(.755),.819,.698,R.sill);
  box(-.310,.310,f(.529),f(.510),.666,.628,R.sash);
  if(near)box(-.012,.012,f(.704),f(.525),.652,.628,R.sash);
  spans.push(Object.freeze([start,p.length/3] as const));
 }
 for(const fraction of centres)one(fraction*len);
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(p,3));
 g.setAttribute('normal',new T.Float32BufferAttribute(n,3));
 g.setAttribute('color',new T.Float32BufferAttribute(rgb,3));
 g.setAttribute('mcDormerOptics',new T.Float32BufferAttribute(uv,2));
 g.setAttribute('mcDormerRole',new T.Float32BufferAttribute(role,1));
 g.setAttribute('mcDormerId',new T.Uint8BufferAttribute(id,1));
 g.setAttribute('mcDormerPart',new T.Uint8BufferAttribute(component,1));
 g.computeBoundingBox();g.computeBoundingSphere();
 return {g,spans:Object.freeze(spans),triangles:p.length/9};
}
const GLSL=/*glsl*/`
varying vec2 mcDvOptics;
varying float mcDvRole;
vec3 mcDPane(vec3 base, vec2 window){
 // Opaque dim old sash; a soft film of sky, not literal brightness or internal room.
 vec2 c=clamp(window,0.,1.);
 float grad=smoothstep(.05,.97,c.y);
 float sky=.23+.77*grad;
 float lateral=.50+.50*sin(2.6*c.x+0.38);
 vec3 dye=mix(base*.62,vec3(.176,.236,.250),clamp(.13*sky+.09*lateral,0.,.3));
 return dye*(.724+.367*grad);
}
`;
function material(){
 const m=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.90,metalness:0,
  side:T.FrontSide,transparent:false,depthWrite:true,depthTest:true,flatShading:false});
 m.onBeforeCompile=sh=>{
  const t='#include <color_vertex>',s='#include <color_fragment>',r='#include <roughnessmap_fragment>';
  if(sh.vertexShader.split(t).length!==2||sh.fragmentShader.split(s).length!==2||sh.fragmentShader.split(r).length!==2)return;
  sh.vertexShader='attribute vec2 mcDormerOptics;attribute float mcDormerRole;varying vec2 mcDvOptics;varying float mcDvRole;\n'+
   sh.vertexShader.replace(t,t+'\n mcDvOptics=mcDormerOptics; mcDvRole=mcDormerRole;');
  sh.fragmentShader=GLSL+sh.fragmentShader.replace(s,s+
   '\n bool mcDIsPane=abs(mcDvRole-4.)<.25;\n if(mcDIsPane)diffuseColor.rgb=mcDPane(diffuseColor.rgb,mcDvOptics);')
   .replace(r,r+'\n if(mcDIsPane)roughnessFactor=.58;');
 };
 m.customProgramCacheKey=()=> 'mclean-historic-front-dormer-study-r187-v1';
 return m;
}
/** Two 2009-reference principal dormers in the detached frame; not an app mount, roof cut or dimensional survey. */
export function createMcLeanFrontDormerStudy(quality:McLeanDormerQuality='near'){
 const result=makeGeometry(quality),mat=material(),mesh=new T.Mesh(result.g,mat);
 mesh.name='McLean House Inn – detached historic pair of front dormers';
 mesh.castShadow=false;mesh.receiveShadow=false;
 let closed=false;
 return Object.freeze({mesh,quality,triangles:result.triangles,spans:result.spans,scope:SCOPE,
  close(){if(closed)return;closed=true;mesh.removeFromParent();result.g.dispose();mat.dispose();}
 });
}
