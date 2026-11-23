import type {CoastalGrid} from './coastal-terrain.ts';
import {GROUND_LIFT} from './coastal-terrain.ts';

export interface RoadCutPoint {x:number;z:number;y:number;edge:number}
type Plane=(p:RoadCutPoint)=>number;
const area2=(a:RoadCutPoint,b:RoadCutPoint,c:RoadCutPoint)=>
 (b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);

function clip(poly:readonly RoadCutPoint[],side:Plane,sign=1){
 const answer:RoadCutPoint[]=[];
 if(poly.length<3)return answer;
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],da=side(a)*sign,db=side(b)*sign;
  if(da>=0)answer.push(a);
  if((da>0&&db<0)||(da<0&&db>0)){
   const u=da/(da-db);
   answer.push({x:a.x+(b.x-a.x)*u,z:a.z+(b.z-a.z)*u,
    y:a.y+(b.y-a.y)*u,edge:a.edge+(b.edge-a.edge)*u});
  }
 }
 return answer;
}
function fan(poly:readonly RoadCutPoint[],point:(p:RoadCutPoint)=>RoadCutPoint,out:RoadCutPoint[]){
 const v=poly.map(point);
 for(let j=1;j+1<v.length;j++)if(Math.abs(area2(v[0],v[j],v[j+1]))>1e-8)out.push(v[0],v[j],v[j+1]);
}

/** Spatially restrict exact road clips to terrain patches actually installed.
 * Inputs are a convex 4-vertex ribbon in world X/Z, with prior road grade.
 */
export function cutInlandRoad(quad:readonly RoadCutPoint[],grids:readonly CoastalGrid[]){
 if(!grids.length)return;
 let loX=Infinity,hiX=-Infinity,loZ=Infinity,hiZ=-Infinity;
 for(const p of quad){loX=Math.min(loX,p.x);hiX=Math.max(hiX,p.x);loZ=Math.min(loZ,p.z);hiZ=Math.max(hiZ,p.z);}
 const g=grids.find(a=>loX<a.x1&&hiX>a.x0&&loZ<a.z1&&hiZ>a.z0);
 if(!g)return;
 const output:RoadCutPoint[]=[];
 let inner=[...quad];
 const clipBounds:Plane[]=[p=>p.x-g.x0,p=>g.x1-p.x,p=>p.z-g.z0,p=>g.z1-p.z];
 for(const s of clipBounds){
  const outside=clip(inner,s,-1);
  fan(outside,p=>p,output);
  inner=clip(inner,s);
 }
 if(inner.length<3)return;
 const uv=(p:RoadCutPoint)=>[(p.x-g.x0)/g.stepX,(p.z-g.z0)/g.stepZ] as const;
 const ul=inner.map(uv),imin=Math.max(0,Math.floor(Math.min(...ul.map(p=>p[0]))));
 const jmin=Math.max(0,Math.floor(Math.min(...ul.map(p=>p[1]))));
 const imax=Math.min(g.nx-2,Math.floor(Math.max(...ul.map(p=>p[0]))));
 const jmax=Math.min(g.nz-2,Math.floor(Math.max(...ul.map(p=>p[1]))));
 const place=(p:RoadCutPoint):RoadCutPoint=>{
  const [i,j]=uv(p),edge=Math.min(i,j,g.nx-1-i,g.nz-1-j);
  const a=Math.max(0,Math.min(1,edge/8)),blend=a*a*(3-2*a);
  const base=g.localHeight(i,j)+GROUND_LIFT;
  // Carry the old road's difference from the parent terrain, not its
  // absolute height, into the refined patch. This keeps the inherited
  // edge and avoids ground cutting through on a steep new collar.
  const carry=p.y-(g.parentHeight(p.x,p.z)+GROUND_LIFT);
  const q=Math.max(0,Math.min(1,edge/2)),safe=q*q*(3-2*q);
  const clearance=carry+(Math.max(carry,.03)-carry)*safe;
  const y=edge<=1e-8?p.y:base+clearance+(.06-clearance)*blend;
  return {...p,y};
 };
 for(let j=jmin;j<=jmax;j++)for(let i=imin;i<=imax;i++){
  const x=g.x0+i*g.stepX,z=g.z0+j*g.stepZ;
  let square=clip(inner,p=>p.x-x);
  square=clip(square,p=>x+g.stepX-p.x);
  square=clip(square,p=>p.z-z);
  square=clip(square,p=>z+g.stepZ-p.z);
  if(square.length<3)continue;
  const diag:Plane=p=>1-(p.x-x)/g.stepX-(p.z-z)/g.stepZ;
  fan(clip(square,diag),place,output);
  fan(clip(square,diag,-1),place,output);
 }
 return output;
}
