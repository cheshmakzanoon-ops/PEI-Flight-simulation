import {ShapeUtils,Vector2} from 'three';
type Pt={x:number;z:number};
type Pair=readonly [number,number];
export interface MeasuredShape {
 readonly anchorXZ:Pair;
 readonly axesXZ:readonly [Pair,Pair];
 readonly roof:readonly {readonly uv:readonly Pair[];readonly plane:readonly [number,number,number]}[];
 readonly walls:readonly ({readonly t:'outer';readonly a:Pair;readonly b:Pair;readonly high:Pair}
  |{readonly t:'interior';readonly a:Pair;readonly b:Pair;readonly low:Pair;readonly high:Pair}
  |{readonly t:'exterior';readonly a:Pair;readonly b:Pair;readonly high:Pair})[];
}
export type MeasuredMassingSink={
 roof:(a:Pt,b:Pt,c:Pt,y:readonly [number,number,number])=>void;
 wall:(a:Pt,b:Pt,below:Pair|undefined,y:Pair)=>void;
};
export function emitMeasuredMassing(ring:readonly Pt[],target:MeasuredMassingSink,shape:MeasuredShape){
 const {anchorXZ:O,axesXZ:[u,v],roof,walls}=shape;
 // The canonical place edges come from the existing owner's ordered ring.
 // Snap only mathematically boundary-coincident vertices, never the measured
 // internal ridge or low-to-high discontinuity.
 function map([a,b]:Pair){
  const p={x:O[0]+a*u[0]+b*v[0],z:O[1]+a*u[1]+b*v[1]};
  let best=p,limit=.00004*.00004;
  for(let i=0;i<ring.length;i++){
   const A=ring[i],B=ring[(i+1)%ring.length],dx=B.x-A.x,dz=B.z-A.z;
   const k=Math.max(0,Math.min(1,((p.x-A.x)*dx+(p.z-A.z)*dz)/(dx*dx+dz*dz)));
   const q={x:A.x+k*dx,z:A.z+k*dz},D=(q.x-p.x)**2+(q.z-p.z)**2;
   if(D<limit){best=q;limit=D;}
  }
  return best;
 }
 for(const f of roof){
  const p=f.uv.map(map);
  const y=f.uv.map(([u,v])=>f.plane[0]+f.plane[1]*u+f.plane[2]*v);
  for(const [a,b,c]of ShapeUtils.triangulateShape(p.map(q=>new Vector2(q.x-O[0],-q.z+O[1])),[]))
   target.roof(p[a],p[b],p[c],[y[a],y[b],y[c]]);
 }
 for(const f of walls){
  const a=map(f.a),b=map(f.b);
  target.wall(a,b,f.t==='interior'?f.low:undefined,f.high);
 }
}
