/** Original detached roof construction with measured planes and nominal joins. */
import * as T from 'three';
import {LEFURGEY as A} from './lefurgey-survey.generated.ts';
export type V=readonly [number,number];export type F=readonly [number,number,number];
export type RoofPatch={label:string;group:'main'|'lower';face:F;domain:readonly F[]};
export const outline=A.exactPlanUV as readonly V[];
export const datum=A.CGVD2013Datum;
const pl=(p:F,q:V)=>p[0]+p[1]*q[0]+p[2]*q[1];
export const lerp=(p:V,q:V,c:number):V=>[p[0]+c*(q[0]-p[0]),p[1]+c*(q[1]-p[1])];
export const flip=(p:F):F=>[-p[0],-p[1],-p[2]];
export const sub=(p:F,q:F):F=>[p[0]-q[0],p[1]-q[1],p[2]-q[2]];
const dist=(a:V,q:V)=>Math.hypot(a[0]-q[0],a[1]-q[1]);
export const signedArea=(p:readonly V[])=>p.reduce((t,a,j)=>{
 const b=p[(j+1)%p.length];return t+a[0]*b[1]-a[1]*b[0];
},0)*.5;
export function clip(s:readonly V[],c:F){
 if(s.length<3)return [];
 let a=s.at(-1)!,ua=pl(c,a);const r:V[]=[];
 for(const b of s){const ub=pl(c,b);
  if((ua>=0)!==(ub>=0)&&Math.abs(ua-ub)>1e-14)r.push(lerp(a,b,ua/(ua-ub)));
  if(ub>=0)r.push(b);
  a=b;ua=ub;
 }
 if(r.length>1&&dist(r[0],r.at(-1)!)<1e-9)r.pop();
 return r.filter((j,i)=>!i||dist(j,r[i-1])>1e-9);
}
export const trim=(s:readonly V[],C:readonly F[])=>C.reduce<readonly V[]>((a,b)=>clip(a,b),s);
export const box=(a:number,b:number,c:number,d:number):readonly F[]=>[[-a,1,0],[b,-1,0],[-c,0,1],[d,0,-1]];
function difference(s:readonly V[],C:readonly F[]){
 let a=s;const pieces:V[][]=[];
 for(const g of C){
  const left=clip(a,flip(g));if(left.length>=3&&Math.abs(signedArea(left))>1e-9)pieces.push(left);
  a=clip(a,g);if(a.length<3)break;
 }
 return pieces;
}
export const planTriangles=T.ShapeUtils.triangulateShape(outline.map(q=>new T.Vector2(...q)),[]).map(t=>t.map(i=>outline[i]));
const mast=A.knownSouthGableRidgeV;
const west:readonly F[]=[
 [-.24+.30*mast[0],1+.30*mast[1],-.30],
 [-.24-.30*mast[0],1-.30*mast[1],.30],
 [6.44,-1,0],[-mast[0]+2.20,-mast[1],1],[mast[0]+2.21,mast[1],-1]];
const mkPair=(label:string,rows:readonly [F,F],domain:readonly F[],group:RoofPatch['group']='main'):RoofPatch[]=>rows.map((face,i)=>({
 label:label+(i?' II':' I'),group,face,domain:[...domain,sub(rows[1-i],face)]
}));
const porchRows=[
 ['South veranda',A.observedPorchSectors.south],
 ['West narrow veranda',A.observedPorchSectors.west],
 ['East veranda',A.observedPorchSectors.east]
] as const;
// Measured porch pitches, nominal continuous hipped miter.
export const porchPitches:RoofPatch[]=porchRows.map(([label,face])=>({
 label,face,group:'lower',domain:porchRows.filter(([name])=>name!==label).map(([,other])=>sub(other,face))
}));
// Public south elevation shows this entry pediment; all coordinates nominal.
const entryPeaks:readonly [F,F]=[[11.895,-.17,.492],[19.816,-.17,-.492]];
const entryDomain=box(.657,2.31,6.82,9.29);
const entryPediment=mkPair('Nominal entry pediment',entryPeaks,entryDomain,'lower');
export function nominalPorchAt(p:V){
 const rows=[...porchPitches,...entryPediment];
 return rows.reduce((h,r)=>r.domain.every(d=>pl(d,p)>=-1e-7)?Math.max(h,pl(r.face,p)):h,-Infinity);
}
export const roofPatches:RoofPatch[]=[
 ...mkPair('Measured main',A.measuredMain,[
  [-2.188,1,.140], [12.03,-1,0],[-.94,0,1],[15.94,0,-1],[14.70,.218,-1],
 ]),
 ...mkPair('Measured small west gable',A.measuredWestSmallGable,box(7.1,11.85,-.16,3.81)),
 ...mkPair('South cross gable',A.partiallyMeasuredSouthGable,west),
 ...mkPair('Shallow north wing',A.measuredNorthWing,box(11.35,20.24,5.72,13.60)),
 {label:'Raised north shed',group:'main',face:A.measuredNorthRaisedRoof,domain:box(7.75,11.13,7.38,10.32)},
 ...porchPitches, ...entryPediment,
];
export function at(p:V,acceptLower=true){
 let y=-Infinity, label='';
 for(const c of roofPatches){
  if((!acceptLower&&c.group==='lower')||!c.domain.every(f=>pl(f,p)>=-1e-8))continue;
  const h=pl(c.face,p);if(h>y){y=h;label=c.label;}
 }
 return {y,label};
}
export type RoofCell={patch:RoofPatch;polygon:readonly V[]};
export function caps():RoofCell[]{
 const out:RoofCell[]=[];
 for(const [i,f]of roofPatches.entries()){
  let src=planTriangles.map(x=>trim(x,f.domain)).filter(t=>t.length>=3&&Math.abs(signedArea(t))>1e-9);
  for(const [j,b]of roofPatches.entries()){
   if(j===i)continue;
   const d=sub(b.face,f.face);
   const nearly=d.every(n=>Math.abs(n)<1e-9);
   if(nearly&&j>i)continue;
   const cutters=nearly?b.domain:[...b.domain,[d[0]+(j<i?1e-8:-1e-8),d[1],d[2]] as F];
   src=src.flatMap(p=>difference(p,cutters));
  }
  out.push(...src.map(p=>({patch:f,polygon:p})));
 }
 return out;
}
export const shoe=(p:V,y:number)=>new T.Vector3(p[0],y-datum,-p[1]);
export const hOn=(p:RoofPatch,q:V)=>pl(p.face,q);
export function signedPlanDistance(p:V){
 let ok=false,d=Infinity;for(const [k,a]of outline.entries()){
  const b=outline[(k+1)%outline.length],f=b[0]-a[0],g=b[1]-a[1],u=p[0]-a[0],v=p[1]-a[1];
  if((a[1]>p[1])!==(b[1]>p[1])&&u<f*v/g)ok=!ok;
  const t=Math.min(1,Math.max(0,(u*f+v*g)/(f*f+g*g)));d=Math.min(d,Math.hypot(u-t*f,v-t*g));
 }
 return ok?d:-d;
}
