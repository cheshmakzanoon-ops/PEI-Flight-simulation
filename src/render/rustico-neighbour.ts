import {ShapeUtils,Vector2} from 'three';
import {RUSTICO_NEIGHBOUR as R} from './rustico-neighbour.generated.ts';

type Wgs=readonly [number,number];
type Pt={x:number;z:number};
type Pair=readonly [number,number];
export const RUSTICO_MASSING_TILE=R.tile;
export function matchesRusticoMassing(atlas:string|undefined,chunk:string|undefined,id:string,ordinal:number,
 footprint:readonly Wgs[],height:number,minHeight:number|undefined,holes?:readonly (readonly Wgs[])[]){
 return atlas===R.atlas&&chunk===R.chunk&&id===R.tile&&ordinal===R.ordinal&&!holes?.length&&height===R.record.height&&minHeight===R.record.minHeight&&
  footprint.length===R.record.footprint.length&&R.record.footprint.every((q,i)=>q[0]===footprint[i][0]&&q[1]===footprint[i][1]);
}
export type RusticoMassingSink={
 roof:(a:Pt,b:Pt,c:Pt,y:readonly [number,number,number])=>void;
 wall:(a:Pt,b:Pt,below:Pair|undefined,y:Pair)=>void;
};
export function emitRusticoMassing(ring:readonly Pt[],target:RusticoMassingSink){
 const {anchorXZ:O,axesXZ:[u,v],roof,walls}=R.shape;
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
