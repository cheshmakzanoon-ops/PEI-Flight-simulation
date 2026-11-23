import * as THREE from 'three';
import { splitRoofEdge,splitRoofTriangle,type GroundPoint,type Triangle,type RoofRidge } from '../sim/roof-ridge.ts';
import { FARM_ATLAS_SHA,FARM_PROFILES } from './farm-shells.generated.ts';

type Pt=GroundPoint;
type Facade=7|8|9;
type Row=readonly [feature:number,footprintKey:number,kind:number,style:Facade,side:number,
 nx:number,nz:number,...knots:number[]];
export interface FarmShell {
 style:Facade;side:number;normal:Pt;
 /** Alternating signed distance and height pairs, in metres. */
 profile:readonly number[];
}
const ROAD_PORTAL_MIN=6.8;
const map:Readonly<Record<string,readonly Row[]>>=FARM_PROFILES;
export const farmRoofAtlas=(sha:string|undefined)=> sha===FARM_ATLAS_SHA;
/** Integer vertices of the exact original footprint, including ordering. */
export function farmFootprintKey(outline:readonly (readonly [number,number])[]){
 let h=2166136261;
 for(const [x,y] of outline){h=Math.imul(h^Math.round(x*1e6),16777619);h=Math.imul(h^Math.round(y*1e6),16777619);}
 return h>>>0;
}
export function readFarmShell(tile:string,feature:number,outline:readonly (readonly [number,number])[]):FarmShell|undefined{
 const rows=map[tile];if(!rows)return;
 for(const r of rows){
  if(r[0]>feature)break;
  if(r[0]!==feature)continue;
  if(r[1]!==farmFootprintKey(outline))return;
  return {style:r[3],side:r[4],normal:{x:r[5]*.000001,z:r[6]*.000001},profile:r.slice(7).map(x=>x*.01)};
 }
}
export function farmRoofHeight(x:number,profile:readonly number[]){
 let k=2;while(k<profile.length-2&&x>profile[k])k+=2;
 const l=profile[k-2],y=profile[k-1],r=profile[k],z=profile[k+1];
 return y+(z-y)*(x-l)/(r-l);
}
type Vertex=(p:Pt,y:number,tint:THREE.Color,u:number,v:number,kind:number)=>void;
type SlopePt={p:Pt;y:number;u:number;v:number};
const trim=new THREE.Color(0xa39d8f);
const ridgeCap=new THREE.Color(0x898b87);
const soffit=new THREE.Color(0x645847);
const concrete=new THREE.Color(0x78766c);
const doorSecured=[0xa49d8c,0xb7b2a3,0x797974,0x9c9b8f].map(c=>new THREE.Color(c));
const farmWood=[0x743a32,0x706c60,0x8b5243,0x888074,0x66685f].map(c=>new THREE.Color(c));
const farmMetal=[0x77746d,0x687b82,0x8b8980,0x6b695b,0x7b5048,0x8d918a,0x767a70].map(c=>new THREE.Color(c));
const farmLow=[0x818783,0x797669,0x637582,0x9a8578,0x867266,0x757d70].map(c=>new THREE.Color(c));
const farmTops=[0x737476,0x83827e,0x636869,0x777b78,0x858983,0x656b68,0x74716b].map(c=>new THREE.Color(c));
const mix=(a:Pt,b:Pt,t:number):Pt=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});

export function emitFarmShell(ring:readonly Pt[],center:Pt,base:number,seed:number,shell:FarmShell,
 heightAt:(x:number,z:number)=>number,write:Vertex){
 const {normal:n,profile}=shell;
 const along=(p:Pt)=>-(p.x-center.x)*n.z+(p.z-center.z)*n.x;
 const across=(p:Pt)=>(p.x-center.x)*n.x+(p.z-center.z)*n.z;
 const sky=(p:Pt)=>base+farmRoofHeight(across(p),profile);
 const overhang=.18+(seed%5)*.018,thickness=.115+(seed%3)*.022;
 const ups=ring.map((p,i)=>Math.hypot(p.x-ring[(i+1)%ring.length].x,p.z-ring[(i+1)%ring.length].z));
 const winding=Math.sign(ring.reduce((area,p,i)=>{
  const q=ring[(i+1)%ring.length];return area+(p.x-center.x)*(q.z-center.z)-(q.x-center.x)*(p.z-center.z);
 },0));
 const inner=ring.map((p,i)=>{
  const q=ring[(i+1)%ring.length],d=Math.max(1e-8,ups[i]);
  return {x:(p.z-q.z)*winding/d,z:(q.x-p.x)*winding/d};
 });
 const margin=(p:Pt,i:number)=>(p.x-ring[i].x)*inner[i].x+(p.z-ring[i].z)*inner[i].z;
 const factor=Math.min(.069,overhang/Math.max(2,Math.max(...ups)*.5));
 const convex=ring.every(p=>inner.every((_,i)=>margin(p,i)>=-1e-6));
 // Most plans allow constant-width real eaves. Slightly irregular plans
 // use the kernel-safe inward scale; don't project soffits across notches.
 let inset:readonly Pt[]=ring;
 if(convex){
  const offset=ring.map((p,i)=>{
   const a=inner[(i+ring.length-1)%ring.length],b=inner[i];
   const m=overhang/Math.max(.15,1+a.x*b.x+a.z*b.z);
   return {x:p.x+(a.x+b.x)*m,z:p.z+(a.z+b.z)*m};
  });
  if(offset.every(p=>inner.every((_,i)=>margin(p,i)>=-1e-6)))inset=offset;
 }else if(inner.every((_,i)=>margin(center,i)>1e-6)){
  inset=ring.map(p=>mix(p,center,factor));
 }
 const lines=(offset:number):RoofRidge=>{
  const nx=n.x/(n.x*n.x+n.z*n.z),nz=n.z/(n.x*n.x+n.z*n.z);
  return {normal:n,origin:{x:center.x+nx*offset,z:center.z+nz*offset},peakM:0,leftSlope:0,rightSlope:0};
 };
 const cut:RoofRidge[]=[];
 for(let i=2;i<profile.length-2;i+=2)cut.push(lines(profile[i]));
 // Real gables use folded metal at the peak; use an in-profile strip
 // only at the measured crest, not a superimposed duplicate surface.
 const crest=profile.length>=6?profile[profile.length===6?2:4]:undefined;
 const roofCut=crest===undefined?cut:[...cut,lines(crest-.22),lines(crest+.22)];
 const cw=(shell.style===7?farmWood:shell.style===8?farmMetal:farmLow)[(seed>>>3)%(shell.style===7?farmWood.length:shell.style===8?farmMetal.length:farmLow.length)];
 const cr=farmTops[(seed>>>5)%farmTops.length];
 const roof=(p:Pt,y:number)=>({p,y,u:along(p),v:across(p)});
 const triangle=(a:SlopePt,b:SlopePt,c:SlopePt,tint:THREE.Color,flag:number)=>{
  write(a.p,a.y,tint,a.u,a.v,flag);write(b.p,b.y,tint,b.u,b.v,flag);write(c.p,c.y,tint,c.u,c.v,flag);
 };
 const quad=(a:SlopePt,b:SlopePt,c:SlopePt,d:SlopePt,tint:THREE.Color,flag:number)=>{
  triangle(a,b,c,tint,flag);triangle(a,c,d,tint,flag);
 };
 const outline=ring.map(p=>new THREE.Vector2(p.x-center.x,center.z-p.z));
 for(const face of THREE.ShapeUtils.triangulateShape(outline,[])){
  let parts:Triangle[]=[[ring[face[0]],ring[face[1]],ring[face[2]]]];
  for(const plane of roofCut)parts=parts.flatMap(t=>splitRoofTriangle(t,plane));
  for(const t of parts){
   const cap=crest!==undefined&&Math.abs(t.reduce((sum,p)=>sum+across(p),0)/3-crest)<.22;
   triangle(roof(t[0],sky(t[0])),roof(t[1],sky(t[1])),roof(t[2],sky(t[2])),cap?ridgeCap:cr,cap?4:1);
  }
 }
 function distances(a:Pt,b:Pt){
  const vx=b.x-a.x,vz=b.z-a.z,size=vx*vx+vz*vz;
  const p=(q:Pt)=>((q.x-a.x)*vx+(q.z-a.z)*vz)/size;
  const knots=[0,1];
  for(const k of cut){
   const m=splitRoofEdge(a,b,k);
   if(m.length===3)knots.push(p(m[1]));
  }
  return knots.sort((x,y)=>x-y);
 }
 const inside=(p:Pt)=>{
  let hit=false;
  for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length];
   if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)hit=!hit;
  }
  return hit;
 };
 function sideWall(A:Pt,B:Pt,index:number){
  const length=Math.hypot(B.x-A.x,B.z-A.z);
  if(length<.12)return;
  const path=distances(A,B);
  const top=(p:Pt)=>sky(p)-thickness;
  const rock=(p:Pt)=>heightAt(p.x,p.z)-.72;
  let portal=-1,portalLen=0;
  for(let s=0;s<path.length-1;s++){
   const a=path[s],b=path[s+1],width=(b-a)*length,lo=mix(A,B,a),hi=mix(A,B,b);
   if(index===shell.side&&width>=ROAD_PORTAL_MIN&&width>portalLen&&Math.min(top(lo)-rock(lo),top(hi)-rock(hi))>3.25){
    portal=s;portalLen=width;
   }
  }
  const w=(p:Pt,y:number,u:number,v:number)=>({p,y,u,v});
  const foot=(ga:number,gb:number,ha:number,hb:number)=>[
   Math.min(ha-.06,ga+.90),Math.min(hb-.06,gb+.90)
  ];
  const wall=(a:Pt,b:Pt,l:number,r:number,headA?:number,headB?:number)=>{
   const ga=rock(a),gb=rock(b),ha=headA??top(a),hb=headB??top(b),[fl,fr]=foot(ga,gb,ha,hb);
   quad(w(a,ga,l,0),w(a,fl,l,fl-ga),w(b,fr,r,fr-gb),w(b,gb,r,0),concrete,-3);
   quad(w(a,fl,l,fl-ga),w(a,ha,l,ha-ga),w(b,hb,r,hb-gb),w(b,fr,r,fr-gb),cw,0);
  };
  for(let s=0;s<path.length-1;s++){
   const l=path[s],r=path[s+1],a=mix(A,B,l),b=mix(A,B,r);
   if(s!==portal){wall(a,b,l*length,r*length);continue;}
   const mid=(l+r)*.5+(seed%3-1)*.018;
   const half=Math.min(shell.style===7?1.72:2.05,portalLen*.27)/length;
   const e=mid-half,f=mid+half;
   const P=mix(A,B,e),Q=mix(A,B,f),eM=e*length,fM=f*length;
   const g0=rock(P),g1=rock(Q),pY=top(P),qY=top(Q);
   const sill=Math.max(g0,g1)+.78,high=Math.min(sill+(shell.style===7?3.03:3.7),pY-.31,qY-.31);
   if(e<=l+.005||f>=r-.005||high-sill<2.18){wall(a,b,l*length,r*length);continue;}
   const nx=(B.z-A.z)/length,nz=-(B.x-A.x)/length;
   const direction=(center.x-P.x)*nx+(center.z-P.z)*nz>0?1:-1;
   const recessed=(p:Pt)=>({x:p.x+nx*.145*direction,z:p.z+nz*.145*direction});
   const p=recessed(P),q=recessed(Q),h=high-sill,u=fM-eM;
   if(![p,q,mix(p,q,.25),mix(p,q,.5),mix(p,q,.75)].every(inside)){wall(a,b,l*length,r*length);continue;}
   wall(a,P,l*length,eM);wall(Q,b,fM,r*length);
   wall(P,Q,eM,fM,sill,sill);
   quad(w(P,high,eM,high-g0),w(P,pY,eM,pY-g0),w(Q,qY,fM,qY-g1),w(Q,high,fM,high-g1),cw,0);
   const c=doorSecured[(seed>>>9)%doorSecured.length];
   quad(w(p,sill,0,0),w(p,high,0,h),w(q,high,1,h),w(q,sill,1,0),c,-1);
   quad(w(P,sill,0,0),w(P,high,0,h),w(p,high,.145,h),w(p,sill,.145,0),cw,-2);
   quad(w(Q,sill,0,0),w(q,sill,.145,0),w(q,high,.145,h),w(Q,high,0,h),cw,-2);
   quad(w(P,high,0,0),w(Q,high,u,0),w(q,high,u,.145),w(p,high,0,.145),trim,-2);
   quad(w(P,sill,0,0),w(p,sill,0,.145),w(q,sill,u,.145),w(Q,sill,u,0),concrete,-2);
  }
 }
 for(let i=0;i<ring.length;i++){
  const j=(i+1)%ring.length,a=ring[i],b=ring[j],c=inset[i],d=inset[j];
  if(ups[i]<.12)continue;
  const spans=distances(a,b).concat(distances(c,d)).sort((m,n)=>m-n);
  for(let j=1;j<spans.length;j++){
   const x=spans[j-1],y=spans[j];if(y-x<1e-6)continue;
   const A=mix(a,b,x),B=mix(a,b,y),C=mix(c,d,x),D=mix(c,d,y);
   const yA=sky(A),yB=sky(B),sA=yA-thickness,sB=yB-thickness;
   quad(roof(A,sA),roof(A,yA),roof(B,yB),roof(B,sB),trim,2);
   if(inset!==ring)quad(roof(A,sA),roof(B,sB),roof(D,sky(D)-thickness),roof(C,sky(C)-thickness),soffit,3);
  }
  sideWall(c,d,i);
 }
}
