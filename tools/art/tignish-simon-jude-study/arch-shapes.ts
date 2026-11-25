import {ShapeUtils,Vector2} from 'three';
export type P=[number,number];
export type V=[number,number,number];
export type Cut={tag:string,center:P,outline:P[]};
const epsilon=1e-10;
export const plus=(a:V,b:V):V=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const scale=(a:V,s:number):V=>[a[0]*s,a[1]*s,a[2]*s];
export function gothicHalf(y:number,w:number,spring:number,rise:number){
 if(y<=spring)return w;if(y>=spring+rise)return 0;
 const c=(w*w-rise*rise)/(2*w);return Math.max(0,c+Math.sqrt((w-c)**2-(y-spring)**2));
}
export function lancet(w:number,bottom:number,spring:number,rise:number,cx:number,divs=17):P[]{
 const r:P[]=[[cx+w,bottom]],l:P[]=[[cx-w,bottom]];
 for(let i=0;i<=divs;i++){
  const y=spring+i*rise/divs,dx=i===divs?0:gothicHalf(y,w,spring,rise);
  r.push([cx+dx,y]);if(i!==divs)l.push([cx-dx,y]);
 }
 return r.concat(l.reverse());
}
export const area=(p:P[])=>p.reduce((s,a,i)=>s+a[0]*p[(i+1)%p.length][1]-a[1]*p[(i+1)%p.length][0],0)*.5;
export function planarTriangles(contour:P[],holes:P[][]=[]){
 const outer=contour.map(q=>new Vector2(...q)),inside=holes.map(h=>h.map(q=>new Vector2(...q)));
 const result=ShapeUtils.triangulateShape(outer,inside),pts=contour.concat(...holes);
 const signed=(p:P[])=>Math.abs(area(p));
 const total=signed(contour)-holes.reduce((s,h)=>s+signed(h),0);
 if(total<=epsilon)throw Error('An opening exceeds its trim surface');
 const a=result.reduce((s,t)=>s+signed(t.map(i=>pts[i])),0);
 if(Math.abs(a-total)>2e-6)throw Error(`Bridge tessellation failed: ${total} vs ${a}`);
 return result.map(i=>i.map(j=>pts[j]) as [P,P,P]).map(a=>area(a)>0?a:[a[0],a[2],a[1]] as [P,P,P]);
}
export function insetShape(p:P[],center:P,n:number){return p.map(([x,y]):P=>[center[0]+(x-center[0])*n,center[1]+(y-center[1])*n]);}
export function leafLobe(center:P,rx:number,ry:number,n=42){
 // Radial boundary of the union of three round lobes. The ellipsoid scaling
 // is an artistic proportion, but the resulting cusps and all true cut edges
 // exist as geometry, not painted black plaques.
 const [x,y]=center,centers=[Math.PI/2,Math.PI/2+2*Math.PI/3,Math.PI/2+4*Math.PI/3];
 const reach=.477,radius=.530;
 return Array.from({length:n},(_,i):P=>{
  const angle=i*2*Math.PI/n;
  const length=Math.max(...centers.map(c=>{
   const d=c-angle,cross=reach*Math.sin(d);
   return reach*Math.cos(d)+Math.sqrt(radius*radius-cross*cross);
  }));
  return [x+rx*Math.cos(angle)*length,y+ry*Math.sin(angle)*length];
 });
}
export function clipped(p:P[],line:(v:P)=>number){
 const out:P[]=[];
 for(let i=0;i<p.length;i++){
  const a=p[i],b=p[(i+1)%p.length],d=line(a),e=line(b);
  if(d<=0)out.push(a);
  if((d<-1e-9&&e>1e-9)||(e<-1e-9&&d>1e-9)){const t=d/(d-e);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
 }
 return out;
}
export const rect=(l:number,r:number,b:number,t:number):P[]=>[[l,b],[r,b],[r,t],[l,t]];
