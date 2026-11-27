import * as T from 'three';
import {createMcLeanPrincipalHistoricStudy} from './mclean-principal-body.ts';
import type {McLeanBellQuality} from './mclean-historic-bell-study.ts';

type V3=readonly [number,number,number];
type V2=readonly [number,number];
type Attr='position'|'normal'|'color'|'mcHouseBoard'|'mcHouseKind';
const P=['position','normal','color','mcHouseBoard','mcHouseKind']as const;
const proof={near:{n:7392,glass:1176,hood:1398},mid:{n:5916,glass:888,hood:1110}}as const;
const stockPane:readonly V3[]=[
 [5.504756450653076,-7.085474491119385,2.6334309577941895],
 [5.504756450653076,-6.521274566650391,2.6334309577941895],
 [5.445160865783691,-6.521274566650391,4.717321872711182],
 [5.504756450653076,-7.085474491119385,2.6334309577941895],
 [5.445160865783691,-6.521274566650391,4.717321872711182],
 [5.445160865783691,-7.085474491119385,4.717321872711182]
];
const oldHoodBlue=[0.6583748459815979,0.5711248517036438,0.43415364623069763]as const;
const oldHoodStart=[5.706307888031006,-6.388274192810059,2.4421143531799316]as const;
const active=Object.freeze({
 doorAndHoodUnchanged:true,geometryOnlyWithinUnchangedModelTransom:true,
 fiveHistoricVisualLights:true,fenestrationDimensionsAreAuthored:true,gradeOrThresholdSiteAuthority:false,
 noOuterTrimChange:true,noPhotosOrTextures:true,detached:true
}as const);
const half=.016, bevel=.005, front=.020, buried=-.006,setback=.017;
const diff=(x:V3,y:V3):V3=>[x[0]-y[0],x[1]-y[1],x[2]-y[2]];
const dot=(a:V3,b:V3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:V3,b:V3):V3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=(v:V3):V3=>{
 const d=Math.hypot(...v);if(!Number.isFinite(d)||d<1e-9)throw Error('collapsed entrance trim joinery');
 return [v[0]/d,v[1]/d,v[2]/d];
};
const same=(a:V3,b:V3)=>a.every((u,i)=>u===b[i]);
const xyz=(a:T.BufferAttribute,i:number):V3=>[a.getX(i),a.getY(i),a.getZ(i)];
function attr(g:T.BufferGeometry,k:Attr){
 const a=g.getAttribute(k),s=k==='mcHouseKind'?1:k==='mcHouseBoard'?2:3;
 if(!(a instanceof T.BufferAttribute)||!(a.array instanceof Float32Array)||a.itemSize!==s||a.normalized)
  throw Error('unsupported frozen entrance ABI');
 return a;
}
function geometry(src:T.BufferGeometry,quality:McLeanBellQuality){
 const q=proof[quality];
 if(src.index||src.groups.length||Object.keys(src.attributes).length!==5||!P.every(k=>attr(src,k).count===q.n))
  throw Error('not the exact detached principal entry');
 const p=attr(src,'position'),roles=attr(src,'mcHouseKind'),cols=attr(src,'color'),oldN=attr(src,'normal');
 for(let k=0;k<6;k++){
  if(!same(xyz(p,q.glass+k),stockPane[k])||roles.getX(q.glass+k)!==4||roles.getX(q.hood+k)!==2||
      !same(xyz(cols,q.hood+k),oldHoodBlue))
   throw Error('unexpected glass or header role');
 }
 if(!same(xyz(p,q.hood),oldHoodStart))throw Error('untrusted stock header');
 const A=xyz(p,q.glass),B=xyz(p,q.glass+5),top=xyz(p,q.glass+1)[1],width=Math.hypot(B[0]-A[0],B[2]-A[2]);
 const axis=unit(diff(B,A)),N=[axis[2],0,-axis[0]]as V3;
 if(A[1]!==B[1]||Math.abs(axis[1])>1e-10||dot(N,xyz(oldN,q.glass))<.999999)
  throw Error('entrance receiving plane went out of bounds');
 const X=top-setback,Y=A[1]+setback,pts:number[]=[],ns:number[]=[],starts=[];
 const from=(u:number,y:number,d:number):V3=>[Math.fround(A[0]+axis[0]*u+N[0]*d),Math.fround(y),Math.fround(A[2]+axis[2]*u+N[2]*d)];
 const combine=(x:number,z:number):V3=>[axis[0]*x+N[0]*z,0,axis[2]*x+N[2]*z];
 const up=[0,1,0] as V3,down=[0,-1,0] as V3;
 const tri=(a:V3,b:V3,c:V3,aim:V3)=>{
  let nn=unit(cross(diff(b,a),diff(c,a)));
  if(dot(nn,aim)<0){nn=[-nn[0],-nn[1],-nn[2]];[b,c]=[c,b];}
  if(dot(nn,aim)<.99)throw Error('old transom insert cannot fold');
  for(const q of [a,b,c]){pts.push(...q);ns.push(...nn);}
 };
 const strip:readonly V2[]=quality==='near'?[
  [-half,buried],[half,buried],[half,front-bevel],[half-bevel,front],[-half+bevel,front],[-half,front-bevel]
 ]:[[-half,buried],[half,buried],[half,front],[-half,front]];
 for(const k of [1,2,3,4]){
  const s=k*width/5,lo=strip.map(p=>from(s+p[0],Y,p[1])),hi=strip.map(p=>from(s+p[0],X,p[1]));
  const start=q.n+pts.length/3;
  for(let i=0;i<strip.length;i++){
   const j=(i+1)%strip.length,aim=unit(combine(strip[j][1]-strip[i][1],strip[i][0]-strip[j][0]));
   tri(lo[i],lo[j],hi[j],aim);tri(lo[i],hi[j],hi[i],aim);
  }
  for(let i=1;i<strip.length-1;i++){tri(lo[0],lo[i],lo[i+1],down);tri(hi[0],hi[i],hi[i+1],up);}
  starts.push(Object.freeze([start,q.n+pts.length/3] as const));
 }
 const total=q.n+pts.length/3,g=new T.BufferGeometry();
 for(const k of P){
  const a=attr(src,k),u=new Float32Array(total*a.itemSize),base=q.n*a.itemSize;
  u.set(a.array);
  if(k==='position')u.set(pts,base);
  else if(k==='normal')u.set(ns,base);
  else for(let i=0;i<pts.length/3;i++){
   if(k==='color')u.set(oldHoodBlue,base+3*i);
   if(k==='mcHouseBoard')u.set([pts[3*i]+pts[3*i+2]*.77,pts[3*i+1]-A[1]],base+2*i);
   if(k==='mcHouseKind')u[base+i]=2;
  }
  g.setAttribute(k,new T.BufferAttribute(u,a.itemSize,a.normalized).setUsage(a.usage));
 }
 g.computeBoundingBox();g.computeBoundingSphere();
 return {g,starts:Object.freeze(starts),priorGlass:[q.glass,q.glass+6] as const,priorHood:[q.hood,q.hood+6] as const,
  oldVertexCount:q.n,newTriangles:pts.length/9,frame:Object.freeze({origin:A,
   tangentialAxis:axis,outwardNormal:N,glassWidth:width,glassHeight:top-A[1],innerBarWidth:2*half,
   y:[Y,X]as const,depth:[buried,front]as const})};
}
/** Original historic interpretation inside the exact existing model; optional and detached. */
export function createMcLeanEntranceTransomStudy(quality:McLeanBellQuality='near'){
 const a=createMcLeanPrincipalHistoricStudy(quality),body=a.body,old=body.geometry;
 let added:T.BufferGeometry|undefined;
 try{
  const p=geometry(old,quality);added=p.g;body.geometry=added;
  let closed=false;
  return Object.freeze({group:a.group,body:a.body,roof:a.roof,loft:a.loft,quality,active,frame:p.frame,
   priorGlass:p.priorGlass,priorHood:p.priorHood,barRanges:p.starts,
   oldVertexCount:p.oldVertexCount,newTriangles:p.newTriangles,bodyTriangles:a.bodyTriangles+p.newTriangles,
   close(){
    if(closed)return;closed=true;body.geometry=old;p.g.dispose();a.close();
   }
  });
 }catch(e){added?.dispose();a.close();throw e;}
}
