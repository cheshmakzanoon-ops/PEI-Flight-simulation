/** Detached opt-in Cape Bear pane placement comparison. No world placement. */
import * as T from 'three';
import {CAPE_BEAR,makeCapeBearExterior} from './cape-bear-exterior.ts';

const H=.057,K=.943,FV=10.171,CV=11.318,lo=FV+.065,hi=CV-.055,depth=.042;
const OLD=[0,3,4,5,6],V2=[1,2,3,4,7],changed=[0,1,2,5,6,7];
const scopeLabel='sealed-octagonal-backed-iron-panels-and-glazing';
const n0=new T.Vector3(0,1,0),rot=2*Math.PI;
const oldRoleCounts=[156,924,28,806,384,416,88,22];
type V=T.Vector3;
type UV=readonly [number,number];
type Piece={p:number[];n:number[];uv:number[]};
type Parts={positions:number[];data:Map<number,Piece>};
const xy=(i:number)=>new T.Vector3(
 Math.sin(rot*(i+.5)/8)*CAPE_BEAR.lanternRadius,FV,Math.cos(rot*(i+.5)/8)*CAPE_BEAR.lanternRadius);
const facets=Array.from({length:8},(_,i)=>{
 const a=xy(i), b=xy((i+1)%8),t=b.clone().sub(a),l=t.length();
 const n=new T.Vector3(a.x+b.x,0,a.z+b.z).normalize();
 return {a,b,n,t:t.multiplyScalar(1/l),length:l};
});
const local=(i:number,h:number,y:number,inset=0)=>{
 const {a,b,n}=facets[i];
 return a.clone().lerp(b,h).setY(y).addScaledVector(n,inset);
};
/** Only triangles fully inside a single changed authored panel center; side frames never qualify. */
function candidate(p:number[],o:number){
 const e=6e-7;
 for(const i of changed){
  const {a,n,t,length}=facets[i];
  let hit=true;
  for(let j=0;j<3;j++){
   const q=o+j*3,x=p[q]-a.x,y=p[q+1],z=p[q+2]-a.z;
   const h=(x*t.x+z*t.z)/length, d=x*n.x+z*n.z;
   if(y<lo-e||y>hi+e||h<H-e||h>K+e||d< -depth-e||d>e){hit=false;break;}
  }
  if(hit)return i;
 }
 return -1;
}
function repair():Parts{
 const data=new Map<number,Piece>(),positions:number[]=[];
 const sideUV=(v:V):UV=>[v.x+v.z,v.y];
 const triangle=(a:V,b:V,c:V,expected:V,role:number,uv:[UV,UV,UV])=>{
  const norm=b.clone().sub(a).cross(c.clone().sub(a)),sign=norm.dot(expected);
  if(Math.abs(sign)<1e-12)throw new Error('Lantern panel repair winding');
  norm.normalize();
  if(sign<0){norm.negate();[b,c]=[c,b];[uv[1],uv[2]]=[uv[2],uv[1]];}
  let out=data.get(role);if(!out)data.set(role,out={p:[],n:[],uv:[]});
  [a,b,c].forEach((q,i)=>{
   out.p.push(q.x,q.y,q.z);out.n.push(norm.x,norm.y,norm.z);out.uv.push(...uv[i]);
   positions.push(q.x,q.y,q.z);
  });
 };
 const quad=(a:V,b:V,c:V,d:V,n:V,r:number,
  uv:readonly [UV,UV,UV,UV]=[sideUV(a),sideUV(b),sideUV(c),sideUV(d)])=>{
  triangle(a,b,c,n,r,[uv[0],uv[1],uv[2]]);
  triangle(a,c,d,n,r,[uv[0],uv[2],uv[3]]);
 };
 for(const i of changed){
  const {n,t,length:L}=facets[i];
  const A=[local(i,H,lo),local(i,K,lo),local(i,K,hi),local(i,H,hi)];
  if(V2.includes(i)){
   const B=[local(i,H,lo,-depth),local(i,K,lo,-depth),local(i,K,hi,-depth),local(i,H,hi,-depth)];
   for(const [k,rn] of [n0,t.clone().negate(),n0.clone().negate(),t].entries()){
    const j=(k+1)%4;quad(A[k],A[j],B[j],B[k],rn,6);
   }
   quad(B[0],B[1],B[2],B[3],n,7);
  }else{
   quad(A[0],A[1],A[2],A[3],n,3,[[H*L,lo-FV],[K*L,lo-FV],[K*L,hi-FV],[H*L,hi-FV]]);
  }
 }
 return {data,positions};
}
export const CAPE_BEAR_LANTERN_V2=Object.freeze({
 v1Clear:Object.freeze([...OLD]),clear:Object.freeze([...V2]),changed:Object.freeze([...changed]),
 nominalRangeY:Object.freeze([lo,hi]),maximumInset:depth,
 note:'Detached local axis qualitative facet arrangement only, no surveyed current dimensions, paint or site.'
});

/** Both old and corrected geometries share the original exact Mesh/materials.
 * Call `apply(false)` to restore the original pointer, not a copy. Scope IDs are for QA marking.
 * Dispose this instance when done. No external input or scene mutation is performed by this constructor. */
export function makeCapeBearLanternV2(finish=1){
 const original=makeCapeBearExterior(finish),stock=original.mesh.geometry,patch=repair();
 const stream=['position','normal','uv'] as const;
 const old=stream.map(k=>stock.getAttribute(k));
 if(stock.index||stock.groups.length!==8||old.some((a,i)=>!(a.array instanceof Float32Array)||a.itemSize!==(i===2?2:3)))
  throw new Error('Cape Bear V2 only accepts original local V1 streams');
 const position=Array.from(old[0].array);
 const amended=new T.BufferGeometry(),o=[new Float32Array(old[0].array.length),
  new Float32Array(old[1].array.length),new Float32Array(old[2].array.length)];
 const oldTarget:number[]=[],newTarget:number[]=[],removed=new Map<number,number[]>();
 for(const [i,g]of stock.groups.entries()){
  if(g.materialIndex!==i||g.count!==3*oldRoleCounts[i])throw Error('Original Cape Bear role contract');
  amended.addGroup(g.start,g.count,i);
  let writer=g.start;
  for(let v=g.start;v<g.start+g.count;v+=3){
   const face=candidate(position,3*v);
   if(face>=0){
    if(i!==3&&i!==6&&i!==7)throw Error('Cape Bear V2 unexpected panel role');
    const allowed=removed.get(face)??[0,0,0,0,0,0,0,0];allowed[i]++;removed.set(face,allowed);
    oldTarget.push(v);
    continue;
   }
   for(const [a,k]of old.entries())o[a].set(k.array.subarray(v*k.itemSize,(v+3)*k.itemSize),writer*k.itemSize);
   writer+=3;
  }
  const append=patch.data.get(i);
  if(append){
   const a=[append.p,append.n,append.uv];
   for(const [k,r]of old.entries())o[k].set(a[k],writer*r.itemSize);
   const end=writer+append.p.length/3;
   while(writer<end){newTarget.push(writer);writer+=3;}
  }
  if(writer!==g.start+g.count)throw Error('Cape Bear V2 role topology changed count');
 }
 if(removed.size!==6||oldTarget.length!==36||newTarget.length!==36)
  throw new Error('Cape Bear V2 exact localized primitive count expected');
 for(const [i,stats]of removed){
  const open=OLD.includes(i);
  if(stats[3]!== (open?0:2)||stats[6]!== (open?8:0)||stats[7]!== (open?2:0))
   throw new Error('Original Cape Bear role/face incidence mismatched '+i);
 }
 for(const [i,k]of stream.entries())amended.setAttribute(k,new T.BufferAttribute(o[i],old[i].itemSize));
 amended.computeBoundingBox();amended.computeBoundingSphere();
 if(!amended.boundingBox?.equals(stock.boundingBox!)||!amended.boundingSphere?.equals(stock.boundingSphere!))
  throw new Error('Cape Bear V2 exterior hull bounds moved');
 const legacy=original.closedComponentPositions.get(scopeLabel),head=[];
 if(!legacy)throw Error('Cape Bear V2 head component not linked');
 for(let k=0;k<legacy.length;k+=9){
  if(candidate(legacy,k)<0)head.push(...legacy.slice(k,k+9));
 }
 head.push(...patch.positions);
 if(head.length!==legacy.length)throw new Error('Cape Bear V2 coded manifold count');
 const closedComponentPositions=new Map(original.closedComponentPositions);
 closedComponentPositions.set(scopeLabel,head);
 const apply=(active:boolean)=>{original.mesh.geometry=active?amended:stock;};
 apply(true);
 return {...original,closedComponentPositions,apply,originalGeometry:stock,correctedGeometry:amended,
  oldTarget:Object.freeze(oldTarget),newTarget:Object.freeze(newTarget),
  dispose:()=>{amended.dispose();original.dispose();}};
}
