/** Private q150 camera witness, never the simulator's collision sampler. */
import type {Mesh,BufferAttribute} from 'three';
import type {Q150NativeSeat} from './q150-warehouse.ts';
type P=readonly [number,number];
type Vec=readonly [number,number,number];
const ix=[31632,31635,31638,31641,32304,32307,32310,32313] as const;
const between=(a:P,b:P):P=>[a[0]-b[0],a[1]-b[1]];
const cross=(a:P,b:P)=>a[0]*b[1]-a[1]*b[0];
const plan=(a:Vec):P=>[a[0],a[2]];
/** The host separately obtains the already pinned original #241 N112 lease. */
export function openWarehouseSeat(mesh:Mesh):Q150NativeSeat|undefined{
 const g=mesh.geometry,i=g.index,p=g.getAttribute('position') as BufferAttribute;
 if(!i||i.count!==75264||p.count!==12769)return;
 const X=mesh.position.x,Z=mesh.position.z,f=(k:number)=>{
  const n=i.getX(k),a=n%113,b=Math.floor(n/113);if(a<=0||a>=112||b<=0||b>=112)throw Error('Unknown q150 ground facet');
  return [X+p.getX(n),p.getY(n),Z+p.getZ(n)] as const;
 };
 const tris=ix.map(q=>[f(q),f(q+1),f(q+2)] as const);
 return {height(x,z){
  for(const [a,b,c]of tris){
   const e=between(plan(b),plan(a)),f=between(plan(c),plan(a)),d=between([x,z],plan(a)),D=cross(e,f);
   const u=cross(d,f)/D,v=cross(e,d)/D;
   if(u>=-1e-10&&v>=-1e-10&&u+v<=1+1e-10)return a[1]+u*(b[1]-a[1])+v*(c[1]-a[1]);
  }
  return NaN;
 },knots(a,b){
  const res:number[]=[],d=between(b,a);
  for(const q of tris)for(let i=0;i<3;i++){
   const p=plan(q[i]),v=between(plan(q[(i+1)%3]),p),h=between(p,a),det=cross(d,v);
   if(Math.abs(det)<1e-10)continue;
   const t=cross(h,v)/det,s=cross(h,d)/det;
   if(t>1e-9&&t<1-1e-9&&s>=-1e-9&&s<=1+1e-9)res.push(t);
  }
  return res.sort((a,b)=>a-b).filter((p,i,l)=>i===0||p-l[i-1]>1e-9);
 }};
}
