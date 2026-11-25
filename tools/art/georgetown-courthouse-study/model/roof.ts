import { ShapeUtils,Vector2 } from 'three';
import { project } from '../../sim/geo.ts';
import { GEORGETOWN_COURTHOUSE as M } from './source.generated.ts';

export type Point=Readonly<{x:number;z:number}>; // metres relative to the installed origin
export type Plane=readonly [number,number,number];
export const COURTHOUSE_RING=Object.freeze(M.footprint.map(([lon,lat])=>{
 const a=project(lon,lat);return Object.freeze({x:a.x-M.originXZ[0],z:a.z-M.originXZ[1]});
}));
export const outset=(a:Point,b:Point,t:number):Point=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
export const span=(a:Point,b:Point)=>Math.hypot(b.x-a.x,b.z-a.z);
export const ud=(p:Point)=>[M.worldToUD[0][0]*p.x+M.worldToUD[0][1]*p.z,
 M.worldToUD[1][0]*p.x+M.worldToUD[1][1]*p.z] as const;
export const evalPlane=(p:Point,v:Plane)=>{const [u,d]=ud(p);return v[0]+v[1]*u+v[2]*d;};

const [west,east,southCross,northCross,annex]=M.roof;
const hip=M.hipSouth, seam=M.annexSeam;
const high=[west,east,southCross,northCross,hip] as const;
const EPS=1e-8;
const difference=(a:Plane,b:Plane):Plane=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const lines:Plane[]=[seam];
for(let i=0;i<high.length;i++)for(let j=i+1;j<high.length;j++)lines.push(difference(high[i],high[j]));
export const areaXZ=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
export function planeAt(p:Point,forceHigh=false){
 if(!forceHigh&&evalPlane(p,seam)>0)return annex;
 const bar=[west,east,hip].reduce((a,b)=>evalPlane(p,a)<evalPlane(p,b)?a:b);
 const cross=evalPlane(p,southCross)<=evalPlane(p,northCross)?southCross:northCross;
 return evalPlane(p,cross)>evalPlane(p,bar)?cross:bar;
}
export const roofY=(p:Point,forceHigh=false)=>evalPlane(p,planeAt(p,forceHigh));
function clip(points:readonly Point[],line:Plane,sign:number){
 const r:Point[]=[];for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length],x=evalPlane(a,line)*sign,y=evalPlane(b,line)*sign;
  if(x>=-EPS)r.push(a);
  if((x>EPS&&y<-EPS)||(x<-EPS&&y>EPS))r.push(outset(a,b,x/(x-y)));
 }return r;
}
export function splitEdge(a:Point,b:Point){
 const v=[0,1];for(const f of lines){
  const l=evalPlane(a,f),r=evalPlane(b,f);if(l*r<-EPS){const t=l/(l-r);if(t>EPS&&t<1-EPS)v.push(t);}
 }
 return v.sort((x,y)=>x-y).filter((q,i,k)=>i===0||q-k[i-1]>EPS);
}
export function roofCells(ring:readonly Point[]=COURTHOUSE_RING){
 const source=ShapeUtils.triangulateShape(ring.map(p=>new Vector2(p.x,p.z)),[]), result:{points:Point[];plane:Plane}[]=[];
 for(const indices of source){
  let polys:Point[][]=[indices.map(i=>ring[i])];
  for(const f of lines){
   const drafts:Point[][]=[];
   for(const p of polys){
    const v=p.map(a=>evalPlane(a,f));
    if(Math.min(...v)>=-EPS||Math.max(...v)<=EPS){drafts.push(p);continue;}
    for(const sign of [-1,1]){const q=clip(p,f,sign);if(q.length>=3)drafts.push(q);}
   }
   polys=drafts;
  }
  for(const p of polys){const avg=p.reduce((v,a)=>({x:v.x+a.x/p.length,z:v.z+a.z/p.length}),{x:0,z:0});
   result.push({points:p,plane:planeAt(avg)});
  }
 }
 return result;
}
/** Split the exact wall between the high body and the source-observed lower annex. */
export function annexReturn(){
 const hit:Point[]=[];
 for(let i=0;i<COURTHOUSE_RING.length;i++){
  const a=COURTHOUSE_RING[i],b=COURTHOUSE_RING[(i+1)%COURTHOUSE_RING.length],s=evalPlane(a,seam),t=evalPlane(b,seam);
  if(s*t<-EPS)hit.push(outset(a,b,s/(s-t)));
 }
 if(hit.length!==2)return [];
 const [a,b]=hit,points=splitEdge(a,b).map(s=>outset(a,b,s));
 return points.slice(1).map((q,i)=>({a:points[i],b:q,top:[roofY(points[i],true),roofY(q,true)] as const,
  low:[evalPlane(points[i],annex),evalPlane(q,annex)] as const}));
}
