import {DOWNTOWN_ROWS} from './summerside-roof.generated.ts';
/** Continuous roof envelope inside the original source plan. No semantic facade claims. */
import type {GroundPoint as Pt,Triangle} from '../sim/roof-ridge.ts';
import {NEUTRAL_ATLAS_SHA,NEUTRAL_ROWS} from './neutral-roofs.generated.ts';

export type RoofPlane = readonly [base:number, slopeX:number, slopeZ:number];
const interp=(a:Pt,b:Pt,t:number):Pt=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
const halfArea=(a:Pt,b:Pt,c:Pt)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
const H=(p:Pt,center:Pt,[b,x,z]:RoofPlane)=>b+x*(p.x-center.x)+z*(p.z-center.z);
export const neutralRoofHeight=(p:Pt,center:Pt,planes:readonly RoofPlane[])=>Math.min(...planes.map(a=>H(p,center,a)));
function delta(p:Pt,c:Pt,a:RoofPlane,b:RoofPlane){
 return (a[0]-b[0])+(a[1]-b[1])*(p.x-c.x)+(a[2]-b[2])*(p.z-c.z);
}
export function neutralRoofEdge(a:Pt,b:Pt,c:Pt,planes:readonly RoofPlane[]):Pt[]{
 const t=[0,1];
 for(let i=0;i<planes.length;i++)for(let j=i+1;j<planes.length;j++){
  const p=planes[i],q=planes[j],off=delta(a,c,p,q),end=delta(b,c,p,q);
  if((off<0)===(end<0) || Math.abs(off-end)<1e-12)continue;
  const u=off/(off-end),k=interp(a,b,u);
  if(u>1e-6&&u<1-1e-6&&H(k,c,p)<=neutralRoofHeight(k,c,planes)+1e-7)t.push(u);
 }
 return t.sort((p,q)=>p-q).filter((v,i)=>i===0||v-t[i-1]>1e-6).map(v=>v===0?a:v===1?b:interp(a,b,v));
}
/** Clip the input footprint triangle to each distinct plane's lower hull region. */
export function neutralRoofTriangles(inset:Triangle,c:Pt,planes:readonly RoofPlane[]):Triangle[]{
 const out:Triangle[]=[];
 for(let i=0;i<planes.length;i++){
  const p=planes[i]; let face=[...inset];
  for(let j=0;j<planes.length&&face.length>=3;j++){
   if(i===j)continue;
   const q=planes[j]; const next:Pt[]=[];
   if(p.every((n,k)=>Math.abs(n-q[k])<1e-12)){if(j<i)face=[];continue;}
   for(let k=0;k<face.length;k++){
    const a=face[k],b=face[(k+1)%face.length],d=delta(a,c,p,q),e=delta(b,c,p,q);
    if(d<=0)next.push(a);
    if((d<0&&e>0)||(d>0&&e<0))next.push(interp(a,b,d/(d-e)));
   }
   face=next;
  }
  for(let j=1;j<face.length-1;j++){
   const t:Triangle=[face[0],face[j],face[j+1]];
   if(Math.abs(halfArea(...t))>1e-8)out.push(t);
  }
 }
 return out;
}

type StoredRow=readonly [slot:number,footprintMicrodegrees:readonly number[],datumMM:number,...planes:number[]];
const rows:Readonly<Record<string,readonly StoredRow[]>>=NEUTRAL_ROWS;
const downtown:Readonly<Record<string,readonly StoredRow[]>>=DOWNTOWN_ROWS;
export function readNeutralRoof(atlasHash:string|undefined,tile:string,index:number,outline:readonly (readonly [number,number])[],downtownVerified=false){
 if(atlasHash!==NEUTRAL_ATLAS_SHA)return;
 const original=rows[tile]?.find(q=>q[0]===index);
 const downtownRow=!original&&downtownVerified?downtown[tile]?.find(q=>q[0]===index):undefined;
 const row=original??downtownRow;
 if(!row||row[1].length!==2*outline.length)return;
 const expected=row[1];
 // Coordinates in the shipped atlas are exact 1e-6 degree JSON numbers.
 // A tile/row match alone must not admit an edited, reordered or stale plan.
 if(outline.some(([lon,lat],i)=>lon!==expected[2*i]/1e6||lat!==expected[2*i+1]/1e6))return;
 const [,,datum,...coefficients]=row;
 const planes:RoofPlane[]=[];
 for(let i=0;i<coefficients.length;i+=3)
  planes.push([coefficients[i]*.001,coefficients[i+1]*1e-6,coefficients[i+2]*1e-6]);
 return {datum:datum*.001,planes,downtown:!!downtownRow};
}
