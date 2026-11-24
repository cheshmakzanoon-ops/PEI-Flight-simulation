import {Batch,p,rect,type XY} from './geometry.ts';
import type {P} from './frame.ts';
export type Plane=readonly [uSlope:number,vSlope:number,zCGVD2013:number];
export type Role='nave'|'crossWest'|'crossEast'|'aisleWest'|'aisleEast'|'annex';
export type Component={role:Role;outline:XY[];planes:readonly Plane[]};
export const h=(a:Plane,q:XY)=>a[0]*q[0]+a[1]*q[1]+a[2];
export const plus=(a:XY,b:XY,t:number):XY=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
export const EPS=1e-8;
function diff(a:Plane,b:Plane):Plane{return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
export function clip(q:XY[],a:Plane):XY[]{
  // q inside the analytic half-plane a<=0. Intersections shared up to float roundoff.
  if(q.length<3)return [];
  const out:XY[]=[];
  for(let i=0;i<q.length;i++){
    const s=q[i],t=q[(i+1)%q.length],sh=h(a,s),th=h(a,t);
    if(sh<=EPS)out.push(s);
    if((sh< -EPS&&th>EPS)||(sh>EPS&&th< -EPS))out.push(plus(s,t,sh/(sh-th)));
  }
  return out.filter((s,i)=>{
    const prior=out[(i+out.length-1)%out.length];return Math.hypot(s[0]-prior[0],s[1]-prior[1])>3e-8;
  });
}
export const upper=(c:Component,q:XY)=>Math.min(...c.planes.map(a=>h(a,q)));
export function contains(c:Component,q:XY,tolerance=EPS){
 return c.outline.every((s,i)=>{const t=c.outline[(i+1)%c.outline.length];return (t[0]-s[0])*(q[1]-s[1])-(t[1]-s[1])*(q[0]-s[0])>=-tolerance;});
}
const rounded=(q:readonly number[])=>q as Plane;
// Main/cross/aisle regression planes come from qualified narrow native patches.
// Rear hip shoulders are additional constrained interpretations of the sparse rear returns.
// Peripheral closure lines are for this detached envelope only, not an as-built footprint.
const navePlanes=[
 rounded([1.24450,-.00400,30.41620]),rounded([-1.24520,-.00860,49.76640]),
 rounded([1.0076,-.6742,50.4321]),rounded([-.9951,-.6310,64.7138]),
 rounded([.6763,-.9746,61.1271]),rounded([-.5345,-1.0104,71.2590]),
];
const naveOutline=navePlanes.reduce((p,a)=>clip(p,[-a[0],-a[1],32.49-a[2]]),rect(2.102,13.49,-1.685,35.44));
export const WING:readonly Component[]=[
 {role:'nave',outline:naveOutline,planes:navePlanes},
 {role:'crossWest',outline:rect(-2.467,7.769,15.11,26.02),planes:[rounded([-.0321,1.3172,12.3562]),rounded([.0042,-1.2940,66.4358])]},
 {role:'crossEast',outline:[[7.769,15.12],[18.03,15.12],[18.40,20.18],[18.34,24.81],[16.887,26.10],[7.769,26.10]],planes:[rounded([.036,1.2959,12.1419]),rounded([-.01408,-1.25773,65.68142])]},
 {role:'aisleWest',outline:rect(-.195,2.321,4.765,15.21),planes:[rounded([.6911,.0006,27.3094])]},
 {role:'aisleEast',outline:rect(13.28,15.42,3.39,15.31),planes:[rounded([-.5976,-.0121,36.7468])]},
 {role:'annex',outline:[[-14.16,27.35],[-2.27,27.45],[.29,28.17],[.13,35.76],[-13.51,35.64]],planes:[rounded([-.0113,1.1138,-1.9295]),rounded([-.0013,-1.1410,69.8010])]},
];
export function topAt(u:number,v:number,b=WING){
 const point:XY=[u,v]; let y=-Infinity;
 for(const k of b) if(contains(k,point))y=Math.max(y,upper(k,point));
 return y;
}
export function edgeStations(c:Component,a:XY,b:XY){
  const ss=[0,1];
  for(let n=0;n<c.planes.length;n++) for(let m=n+1;m<c.planes.length;m++){
    const d=diff(c.planes[n],c.planes[m]),A=h(d,a),B=h(d,b); const t=A/(A-B);
    if(t>.00001&&t<.99999)ss.push(t);
  }
  return [...new Set(ss.sort((a,b)=>a-b))].map(s=>plus(a,b,s));
}
export function roofGeometry(c:Component,roof:Batch,fascia?:Batch){
  for(const a of c.planes){
    const poly=c.planes.reduce((v,b)=>b===a?v:clip(v,diff(a,b)),c.outline);
    if(poly.length<3)continue;
    // For opposing slopes the v-oriented material courses are rotated to follow the eaves.
    const cX=Math.hypot(a[0],a[1]);const C=cX>.01?(a[0]/cX):1,S=cX>.01?(a[1]/cX):0;
    const uv=poly.map(q=>[-q[0]*S+q[1]*C,(q[0]*C+q[1]*S)*Math.hypot(cX,1)] as XY);
    roof.poly(poly.map(q=>p(q[0],h(a,q),q[1])),p(-a[0],1,-a[1]),uv);
    if(fascia)fascia.poly(poly.map(q=>p(q[0],h(a,q)-.085,q[1])),p(a[0],-1,a[1]),uv);
  }
  if(!fascia)return;
  for(let i=0;i<c.outline.length;i++){
    const a=c.outline[i],b=c.outline[(i+1)%c.outline.length],n:P=[b[1]-a[1],0,a[0]-b[0]];
    const ss=edgeStations(c,a,b);
    for(let j=0;j+1<ss.length;j++){
      const s=ss[j],t=ss[j+1],ys=upper(c,s),yt=upper(c,t);
      // A physical, narrow under-edge overlap leaves the survey top untouched;
      // avoids two independent sky-side subpixel raster edges at wall junctions.
      const r=Math.hypot(n[0],n[2]),du=.043*n[0]/r,dv=.043*n[2]/r;
      const q=(k:XY,y:number,d:number)=>p(k[0]+du*d,y,k[1]+dv*d);
      fascia.poly([q(s,ys-.114,1),q(t,yt-.114,1),q(t,yt-.018,1),q(s,ys-.018,1)],n);
      fascia.poly([q(s,ys-.024,-1),q(t,yt-.024,-1),q(t,yt-.018,1),q(s,ys-.018,1)],[0,1,0]);
      fascia.poly([q(s,ys-.131,-1),q(t,yt-.131,-1),q(t,yt-.114,1),q(s,ys-.114,1)],[0,-1,0]);
    }
  }
}
