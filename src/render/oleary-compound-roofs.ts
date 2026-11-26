import type {GroundPoint as Pt,Triangle} from '../sim/roof-ridge.ts';
import type {RoofPlane} from './neutral-roof.ts';
import {OLEARY_COMPOUND_ROOFS} from './oleary-compound-roofs.generated.ts';

type Part=readonly RoofPlane[];
export type CompoundRoof=Readonly<{datum:number;parts:readonly Part[]}>;
const evalAt=(p:Pt,c:Pt,[base,x,z]:RoofPlane)=>base+x*(p.x-c.x)+z*(p.z-c.z);
const difference=(p:Pt,c:Pt,a:RoofPlane,b:RoofPlane)=>
 (a[0]-b[0])+(a[1]-b[1])*(p.x-c.x)+(a[2]-b[2])*(p.z-c.z);
const lerp=(a:Pt,b:Pt,t:number):Pt=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
const same=(a:RoofPlane,b:RoofPlane)=>a.every((v,i)=>v===b[i]);
const area=(a:Pt,b:Pt,c:Pt)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);

export function compoundRoof(row:number,ring:readonly (readonly [number,number])[]):CompoundRoof|undefined{
 const record=OLEARY_COMPOUND_ROOFS.find(q=>q[0]===row);
 if(!record||ring.length*2!==record[1].length||
   ring.some(([x,z],i)=>x!==record[1][2*i]/1e6||z!==record[1][2*i+1]/1e6))return;
 return {datum:record[2]*1e-3,parts:record[3].map(part=>part.map(([h,x,z])=>[h*1e-3,x*1e-6,z*1e-6]))};
}

export function compoundHeight(p:Pt,c:Pt,parts:readonly Part[]){
 return Math.max(...parts.map(part=>Math.min(...part.map(face=>evalAt(p,c,face)))));
}

function clip(poly:Pt[],f:(p:Pt)=>number):Pt[]{
 if(poly.length<3)return [];
 const out:Pt[]=[];
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],u=f(a),v=f(b);
  if(u<=0)out.push(a);
  if((u<0&&v>0)||(u>0&&v<0))out.push(lerp(a,b,u/(u-v)));
 }
 return out;
}

/** Partition a convex input into all unique roof-face regions. Within a
 * part, its lowest plane wins. Between parts, the highest of those wins.
 * This is exact planar geometry, not a gridded or bilinear heightfield. */
export function compoundRoofTriangles(seed:Triangle,centre:Pt,parts:readonly Part[]):Triangle[]{
 if(parts.length<1||parts.length>3||parts.some(part=>!part.length||part.length>4))return [];
 const output:Triangle[]=[];
 const claim=(polygon:Pt[],index:number,part:Part)=>{
  const face=part[index];
  for(let i=0;i<part.length;i++){
   if(i===index)continue;
   const next=part[i];
   if(same(face,next)){if(i<index)return [];continue;}
   polygon=clip(polygon,p=>difference(p,centre,face,next));
   if(polygon.length<3)return [];
  }
  return polygon;
 };
 for(let i=0;i<parts.length;i++)for(let j=0;j<parts[i].length;j++){
  const face=parts[i][j],primary=claim([...seed],j,parts[i]);
  if(primary.length<3)continue;
  let fragments=[primary];
  for(let a=0;a<parts.length;a++){
   if(a===i)continue;
   const opposite=parts[a];
   const retained:Pt[][]=[];
   for(const p of fragments)for(let k=0;k<opposite.length;k++){
    const other=opposite[k];
    if(a<i&&same(face,other))continue;
    const current=clip(claim(p,k,opposite),x=>difference(x,centre,other,face));
    if(current.length>=3)retained.push(current);
   }
   fragments=retained;
  }
  for(const p of fragments)for(let j=1;j+1<p.length;j++)
   if(Math.abs(area(p[0],p[j],p[j+1]))>1e-8)output.push([p[0],p[j],p[j+1]]);
 }
 return output;
}

/** The wall seam must share every roof-plane change on the original edge.
 * Added bottom points are interpolated from the original endpoint feet. */
export function compoundRoofEdge(a:Pt,b:Pt,c:Pt,parts:readonly Part[]){
 const values=parts.flat(),ts=[0,1];
 for(let i=0;i<values.length;i++)for(let j=i+1;j<values.length;j++){
  const u=difference(a,c,values[i],values[j]),v=difference(b,c,values[i],values[j]);
  if((u<0)===(v<0)||Math.abs(u-v)<1e-12)continue;
  const t=u/(u-v);
  if(t<=1e-6||t>=1-1e-6)continue;
  const p=lerp(a,b,t);
  if(Math.abs(evalAt(p,c,values[i])-compoundHeight(p,c,parts))<1e-7)ts.push(t);
 }
 return ts.sort((x,z)=>x-z).filter((t,i)=>i===0||t-ts[i-1]>1e-6).map(t=>t===0?a:t===1?b:lerp(a,b,t));
}
