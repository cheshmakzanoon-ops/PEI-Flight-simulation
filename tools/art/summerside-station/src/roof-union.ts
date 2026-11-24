import {Batch,roofFacet} from './geometry.ts';
import type {Plane,UV} from './survey.ts';
export type Surface={readonly name:string;readonly p:Plane;readonly uv:UV[]};
type H=readonly [number,number,number];
const tol=1e-8, area=(a:readonly UV[])=>Math.abs(a.reduce((tot,[x,y],i)=>{const [rx,ry]=a[(i+1)%a.length];return tot+(x*ry-rx*y)*.5},0));
export const height=(p:Plane,[u,v]:UV)=>p[0]*u+p[1]*v+p[2];
const sub=(a:Plane,b:Plane):H=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const rev=(h:H):H=>[-h[0],-h[1],-h[2]];
export function clip(a:UV[], h:H) {
 const ans:UV[]=[];
 if(a.length<3)return ans;
 for(let i=0;i<a.length;i++){
  const q=a[i],r=a[(i+1)%a.length],d=height(h,q),e=height(h,r),here=d>=0,next=e>=0;
  if(here)ans.push(q);
  if(here!==next){const t=d/(d-e);ans.push([q[0]+t*(r[0]-q[0]),q[1]+t*(r[1]-q[1])]);}
 }
 return area(ans)>tol?ans:[];
}
export function faces(name:string,uv:UV[],p:readonly Plane[]):Surface[]{
 return p.flatMap((z,i)=>{let a=uv;for(let j=0;j<p.length;j++)if(j!==i)a=clip(a,sub(p[j],z));return a.length?[{name,p:z,uv:a}]:[]});
}
const edge=([u,v]:UV,[r,s]:UV):H=>[v-s,r-u,s*u-r*v];  // CCW interior left of line
/** Each group first solves the lower envelope of its convex hip planes. Between assembled volumes,
 * only the highest roof at each XY is retained, with shared analytical seam intersections. */
export function exteriorRoof(s:Surface[]):Surface[]{
 return s.flatMap((roof,i)=>{
  let fragments=[roof.uv];
  for(let j=0;j<s.length;j++){
   const t=s[j];if(i===j||roof.name===t.name)continue;
   const constraints=t.uv.map((a,k)=>edge(a,t.uv[(k+1)%t.uv.length]));
   const diff=sub(t.p,roof.p);
   if(Math.max(Math.abs(diff[0]),Math.abs(diff[1]),Math.abs(diff[2]))<tol){if(i<j)continue;}
   else constraints.push(diff);
   fragments=fragments.flatMap(poly=>{
    const out:UV[][]=[];
    for(const h of constraints){
     const cut=clip(poly,rev(h));if(cut.length)out.push(cut);
     poly=clip(poly,h);if(!poly.length)break;
    }
    return out;
   });
  }
  return fragments.map(uv=>({...roof,uv}));
 });
}
export function addRoof(b:Batch,roof:Surface[]){
 for(const f of roof)roofFacet(b,f.uv.map((uv)=>[uv[0],height(f.p,uv),uv[1]]));
}
