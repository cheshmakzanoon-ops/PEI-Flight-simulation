import {PAVILION_ROOF} from './roof-evidence.generated.ts';
import {Batch,p,type XY} from './geometry.ts';
import type {P} from './frame.ts';
export const PLAN:readonly XY[]=PAVILION_ROOF.ownerRing;
export const CUT=PAVILION_ROOF.cut;
export const plane=(role:number,u:number,v:number)=>{
 const c=PAVILION_ROOF.coeff[role];return c[0]*u+c[1]*v+c[2];
};
export const roofHeight=(u:number,v:number)=>u>=CUT[0]&&v>=CUT[1]
 ?Math.max(plane(1,u,v),plane(2,u,v)):plane(0,u,v);
type Side='west'|'north'|'east'|'south';
export const thickness=.094;
export function cut(poly:readonly XY[],positive:(x:XY)=>number,tol=1e-8):XY[]{
 const r:XY[]=[];
 for(let i=0;i<poly.length;i++){
  const b=poly[i],a=poly[(i+poly.length-1)%poly.length],Fa=positive(a),Fb=positive(b);
  if((Fa>=0)!==(Fb>=0)){
   const t=Fa/(Fa-Fb),q:XY=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];
   if(!r.length||Math.hypot(q[0]-r.at(-1)![0],q[1]-r.at(-1)![1])>tol)r.push(q);
  }
  if(Fb>=0&&(!r.length||Math.hypot(b[0]-r.at(-1)![0],b[1]-r.at(-1)![1])>tol))r.push(b);
 }
 if(r.length>1&&Math.hypot(r[0][0]-r.at(-1)![0],r[0][1]-r.at(-1)![1])<=tol)r.pop();
 return r;
}
const [x,y]=CUT;
const on=(a:XY,b:XY)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const U=(q:XY)=>q[0]-x,V=(q:XY)=>q[1]-y;
export function roofParts():{role:0|1|2; ring:XY[]}[]{
 const L= (q:XY)=>plane(1,q[0],q[1])-plane(2,q[0],q[1]);
 const high=cut(cut(PLAN,U),V);
 return [
  {role:0,ring:cut(PLAN,q=>-U(q))}, {role:0,ring:cut(cut(PLAN,U),q=>-V(q))},
  {role:1,ring:cut(high,L)}, {role:2,ring:cut(high,q=>-L(q))},
 ];
}
const outerSide=(a:XY,b:XY):Side|undefined=>{
 for(const [i,side] of ['north','east','south','west'].entries()){
  const pp=PLAN[i],q=PLAN[(i+1)%PLAN.length];
  const w=(x:XY)=>Math.abs((q[0]-pp[0])*(x[1]-pp[1])-(q[1]-pp[1])*(x[0]-pp[0]))<2e-6;
  if(w(a)&&w(b))return side as Side;
 }
 return undefined;
};
export function emitRoof(top:Batch,under:Batch,edge:Batch) {
 for(const {role,ring}of roofParts()){
  const h=(a:XY)=>plane(role,a[0],a[1]);
  top.poly(ring.map(q=>p(q[0],h(q),q[1])),p(-PAVILION_ROOF.coeff[role][0],1,-PAVILION_ROOF.coeff[role][1]),ring);
  under.poly(ring.map(q=>p(q[0],h(q)-thickness,q[1])),p(PAVILION_ROOF.coeff[role][0],-1,PAVILION_ROOF.coeff[role][1]),
    ring.map(([u,v])=>role===2?[v,u]:[u,v]));
  for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length];
   if(on(a,b)<1e-7)continue;const s=outerSide(a,b);
   if(!s&&!(role!==0&&((Math.abs(a[0]-CUT[0])+Math.abs(b[0]-CUT[0])<1e-7)||(Math.abs(a[1]-CUT[1])+Math.abs(b[1]-CUT[1])<1e-7))))continue;
   const n:P=s==='east'?[1,0,0]:s==='north'?[0,0,1]:s==='west'||Math.abs(a[0]-CUT[0])+Math.abs(b[0]-CUT[0])<1e-7?[-1,0,0]:[0,0,-1];
   edge.poly([p(a[0],h(a),a[1]),p(b[0],h(b),b[1]),p(b[0],h(b)-thickness,b[1]),p(a[0],h(a)-thickness,a[1])],n);
  }
 }
}
