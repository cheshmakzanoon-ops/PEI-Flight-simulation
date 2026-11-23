import * as THREE from 'three';
import type { GroundPoint as Pt,Triangle } from '../sim/roof-ridge.ts';
import { farmFootprintKey } from './farm-shells.ts';
import { HOME_ATLAS_SHA,HOME_FORMS } from './home-envelopes.generated.ts';

type P=readonly [height:number,dx:number,dz:number];
type Class=10|11|12;
type Row=readonly [index:number,footprintKey:number,style:Class,front:number,levels:number,...planes:number[]];
const byTile:Readonly<Record<string,readonly Row[]>>=HOME_FORMS;
export interface HomeForm {style:Class;front:number;levels:number;planes:P[];}
export const homeRoofAtlas=(sha:string|undefined)=>sha===HOME_ATLAS_SHA;
export function readHomeEnvelope(tile:string,index:number,outline:readonly (readonly [number,number])[]):HomeForm|undefined{
 const q=byTile[tile];if(!q)return;
 let lo=0,hi=q.length;
 while(lo<hi){const i=(lo+hi)>>>1;if(q[i][0]<index)lo=i+1;else hi=i;}
 const row=q[lo];
 if(!row||row[0]!==index||row[1]!==farmFootprintKey(outline))return;
 const planes:P[]=[];
 for(let k=5;k<row.length;k+=3)planes.push([row[k]*.001,row[k+1]*.000001,row[k+2]*.000001]);
 return {style:row[2],front:row[3],levels:row[4],planes};
}
const mix=(p:Pt,q:Pt,r:number):Pt=>({x:p.x+(q.x-p.x)*r,z:p.z+(q.z-p.z)*r});
const cross=(a:Pt,b:Pt,c:Pt)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
export const homeRoofHeight=(p:Pt,c:Pt,planes:readonly P[])=>{
 let h=Infinity;for(const [b,x,z] of planes)h=Math.min(h,b+x*(p.x-c.x)+z*(p.z-c.z));return h;
};
function clip(points:Pt[],a:P,b:P,c:Pt){
 const off=(p:Pt)=>a[0]-b[0]+(a[1]-b[1])*(p.x-c.x)+(a[2]-b[2])*(p.z-c.z);
 const out:Pt[]=[];
 for(let i=0;i<points.length;i++){
  const p=points[i],q=points[(i+1)%points.length],x=off(p),y=off(q),t=x/(x-y);
  if(x<=1e-9)out.push(p);
  if((x<-1e-9&&y>1e-9)||(x>1e-9&&y<-1e-9))out.push(mix(p,q,t));
 }
 return out;
}
function exactKnots(a:Pt,b:Pt,center:Pt,planes:readonly P[]){
 const knots=[0,1];
 for(let k=0;k<planes.length;k++)for(let h=k+1;h<planes.length;h++){
  const p=planes[k],q=planes[h];
  const val=(v:Pt)=>p[0]-q[0]+(v.x-center.x)*(p[1]-q[1])+(v.z-center.z)*(p[2]-q[2]);
  const x=val(a),y=val(b),t=x/(x-y);
  if(t>1e-6&&t<1-1e-6){
   const v=mix(a,b,t);
   if(p[0]+(v.x-center.x)*p[1]+(v.z-center.z)*p[2]<=homeRoofHeight(v,center,planes)+1e-6)knots.push(t);
  }
 }
 return knots.sort((x,y)=>x-y).filter((x,i,z)=>!i||x-z[i-1]>1e-6);
}
const paints=[0xaca9a2,0xd0cab8,0xa0a59a,0xa1afb5,0xb8b49f,0xaaa18e,0xa6a5a7,0x92695b,
 0xb6b0a1,0x969caa,0xaeb39f,0xcec4aa,0xc3c0b0].map(v=>new THREE.Color(v));
const eaves=[0xc8c3b6,0xa9a291,0x7e8a86,0xa49d8c,0xc3b6a2].map(v=>new THREE.Color(v));
const caps=[0x464746,0x5f5b55,0x4f5255,0x65625c,0x515a59,0x65655c].map(v=>new THREE.Color(v));
const timber=[0x747e72,0x866d58,0x67665d,0x798488,0x796a61].map(v=>new THREE.Color(v));
const foundation=new THREE.Color(0x81796a),well=new THREE.Color(0x6b6359),glass=new THREE.Color(0x42606a);
const soffit=new THREE.Color(0x8a8170);
type Vertex=(p:Pt,y:number,c:THREE.Color,u:number,v:number,flag:number)=>void;
type Corner={p:Pt;y:number;u:number;v:number};
type Opening={l:number;r:number;bottom:number;top:number;door:boolean;recess:boolean;};
export function emitHomeEnvelope(ring:readonly Pt[],center:Pt,base:number,seed:number,model:HomeForm,ground:(x:number,z:number)=>number,write:Vertex){
 const {planes}=model;
 const wall=paints[(seed>>>6)%paints.length],edge=eaves[(seed>>>10)%eaves.length],cover=caps[(seed>>>14)%caps.length];
 const door=timber[(seed>>>12)%timber.length];
 const roof=(p:Pt)=>base+homeRoofHeight(p,center,planes);
 const inset=.18+(seed%7)*.012;
 const skin=.115+(seed%4)*.013;
 const triangle=(a:Corner,b:Corner,c:Corner,co:THREE.Color,style:number)=>{
  write(a.p,a.y,co,a.u,a.v,style);write(b.p,b.y,co,b.u,b.v,style);write(c.p,c.y,co,c.u,c.v,style);
 };
 const quad=(a:Corner,b:Corner,c:Corner,d:Corner,co:THREE.Color,style:number)=>{
  triangle(a,b,c,co,style);triangle(a,c,d,co,style);
 };
 const q=(p:Pt,y:number,u=0,v=0):Corner=>({p,y,u,v});
 const plan=ring.map(p=>new THREE.Vector2(p.x-center.x,center.z-p.z));
 for(const f of THREE.ShapeUtils.triangulateShape(plan,[])){
  const tri:Triangle=[ring[f[0]],ring[f[1]],ring[f[2]]];
  for(const A of planes){
   let part=tri.slice() as Pt[];
   for(const B of planes){if(A!==B)part=clip(part,A,B,center);}
   if(part.length<3)continue;
   const ax=Math.hypot(A[1],A[2]),vx=ax>1e-6?A[2]/ax:0,vz=ax>1e-6?-A[1]/ax:1;
   const proj=(p:Pt)=>{
    const x=p.x-center.x,z=p.z-center.z;
    return q(p,roof(p),vx*x+vz*z,-vz*x+vx*z);
   };
   const a=proj(part[0]);
   for(let i=1;i<part.length-1;i++){
    if(Math.abs(cross(part[0],part[i],part[i+1]))>1e-7)triangle(a,proj(part[i]),proj(part[i+1]),cover,1);
   }
  }
 }
 const clockwise=Math.sign(ring.reduce((v,a,i)=>v+cross(center,a,ring[(i+1)%ring.length]),0));
 const normals=ring.map((a,i)=>{
  const b=ring[(i+1)%ring.length],s=clockwise/Math.max(1e-8,Math.hypot(b.x-a.x,b.z-a.z));
  return {x:(a.z-b.z)*s,z:(b.x-a.x)*s};
 });
 const margin=(p:Pt,i:number)=>(p.x-ring[i].x)*normals[i].x+(p.z-ring[i].z)*normals[i].z;
 const convex=ring.every(p=>normals.every((_,i)=>margin(p,i)>-1e-6));
 let body=ring;
 if(convex){
  const offset=ring.map((p,i)=>{
   const a=normals[(i+ring.length-1)%ring.length],b=normals[i],m=inset/Math.max(.21,1+a.x*b.x+a.z*b.z);
   return {x:p.x+(a.x+b.x)*m,z:p.z+(a.z+b.z)*m};
  });
  if(offset.every(p=>normals.every((_,i)=>margin(p,i)>=-1e-6)))body=offset;
 }else if(normals.every((_,i)=>margin(center,i)>0))body=ring.map(p=>mix(p,center,.031));
 const kept=(p:Pt)=>{
  let hit=false;
  for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length];
   if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)hit=!hit;
  }
  return hit;
 };
 // The two streetward elevations get actual jamb geometry. Sparse
 // background-side panes keep the same residential scale without
 // submitting the most detailed apertures on all four elevations.
 const eligible=body.map((v,i)=>({i,l:Math.hypot(v.x-body[(i+1)%body.length].x,v.z-body[(i+1)%body.length].z)}))
   .filter(a=>a.l>4.6).sort((a,b)=>b.l-a.l);
 const frontSide=model.front>=0?model.front:(eligible[0]?.i??-1);
 const fav=eligible.filter(a=>a.i!==frontSide);
 const flank=fav.find(a=>Math.abs(normals[a.i].x*(normals[frontSide]?.x??0)+normals[a.i].z*(normals[frontSide]?.z??0))<.65)?.i??fav[0]?.i;
 for(let k=0;k<ring.length;k++){
  const j=(k+1)%ring.length,a=ring[k],b=ring[j],A=body[k],B=body[j];
  const pr=exactKnots(a,b,center,planes).concat(exactKnots(A,B,center,planes)).sort((x,y)=>x-y);
  for(let i=1;i<pr.length;i++){
   const x=pr[i-1],y=pr[i];if(y-x<1e-6)continue;
   const p=mix(a,b,x),s=mix(a,b,y),u=mix(A,B,x),v=mix(A,B,y),h=roof(p),g=roof(s);
   quad(q(p,h-skin,x,0),q(p,h,x,skin),q(s,g,y,skin),q(s,g-skin,y,0),edge,3);
   if(body!==ring)quad(q(p,h-skin,x,0),q(s,g-skin,y,0),q(v,roof(v)-skin,y,inset),q(u,roof(u)-skin,x,inset),soffit,2);
  }
  const L=Math.hypot(B.x-A.x,B.z-A.z);if(L<.09)continue;
  const n=normals[k];
  const at=(u:number)=>mix(A,B,u/L);
  const depth=.115+(seed%4)*.013;
  const inboard=(u:number)=>{const v=at(u);return {x:v.x+n.x*depth,z:v.z+n.z*depth};};
  const floor=(p:Pt)=>ground(p.x,p.z);
  const street=Math.max(floor(A),floor(B),floor(mix(A,B,.5)));
  const plinth=street+.36;
  const kneecap=(p:Pt)=>roof(p)-skin;
  const eaveType=Math.min(kneecap(A),kneecap(B),kneecap(mix(A,B,.5)))-street;
  const levels=model.levels===1?1:Math.min(model.levels||2,eaveType>5.65?2:1);
  const opens:Opening[]=[];
  if(L>4.6&&eaveType>2.40){
   const front=k===model.front,recess=k===frontSide||k===flank||body===ring;
   const cols=Math.min(front?3:recess?2:1,Math.max(1,Math.floor((L-.72)/3.05)));
   const spacer=L/(cols+1),main=front?(seed%3===0&&cols>=3?1:0):-1;
   for(let col=0;col<cols;col++){
    const x=(col+1)*spacer + ((seed>>>18)%4-1.5)*.054+(.04*(k%2));
    for(let level=0;level<levels;level++){
     const kindDoor=col===main&&level===0;
     const width=kindDoor?.91:Math.min(1.15,(model.style===10?.95:1.08)+(seed%3)*.055);
     const y=kindDoor?street+.11:street+(level===0?1.08:3.80);
     const tall=kindDoor?2.02:(model.style===10?1.21:1.075+(seed%3)*.015);
     const l=x-width*.5,r=x+width*.5;
     if(l<.37||r>L-.37||y+tall>Math.min(kneecap(at(l)),kneecap(at(r)))-.19||![l,(l+r)*.5,r].every(i=>kept(inboard(i))))continue;
     opens.push({l,r,bottom:y,top:y+tall,door:kindDoor,recess});
    }
   }
  }
  const boundaries=exactKnots(A,B,center,planes).map(t=>t*L);
  for(const o of opens)if(o.recess)boundaries.push(o.l,o.r);
  boundaries.sort((x,y)=>x-y);
  for(let i=1;i<boundaries.length;i++){
   const l=boundaries[i-1],r=boundaries[i];if(r-l<1e-5)continue;
   const p=at(l),v=at(r),left=floor(p)-.69,right=floor(v)-.69;
   const shadeWall=(lo:number,ro:number,hi:number,hj:number,c:THREE.Color,f:number)=>{
    if(hi<=lo&&hj<=ro)return;
    quad(q(p,lo,l,lo-street),q(p,hi,l,hi-street),q(v,hj,r,hj-street),q(v,ro,r,ro-street),c,f);
   };
   let H=left,J=right;
   const cut=opens.filter(o=>o.recess&&l>=o.l-1e-6&&r<=o.r+1e-6).sort((a,b)=>a.bottom-b.bottom);
   for(const o of cut){
    if(o.bottom>plinth&&H<plinth){shadeWall(H,J,plinth,plinth,foundation,-4);H=J=plinth;}
    shadeWall(H,J,o.bottom,o.bottom,o.door?foundation:wall,o.door?-4:0);
    H=J=o.top;
   }
   const headA=kneecap(p),headB=kneecap(v);
   if(H<plinth&&headA>plinth+.10&&headB>plinth+.10){shadeWall(H,J,plinth,plinth,foundation,-4);H=J=plinth;}
   shadeWall(H,J,headA,headB,wall,0);
  }
  for(const o of opens){
   const p=at(o.l),u=at(o.r),v=inboard(o.l),w=inboard(o.r),H=o.bottom,G=o.top;
   if(!o.recess){
    const face=(a:Pt)=>({x:a.x-n.x*.008,z:a.z-n.z*.008});
    const L=face(p),R=face(u);
    if(kept(L)&&kept(R)&&kept(mix(L,R,.5)))quad(q(L,H,0,0),q(L,G,0,1),q(R,G,1,1),q(R,H,1,0),glass,-5);
    continue;
   }
   quad(q(v,H,0,0),q(v,G,0,1),q(w,G,1,1),q(w,H,1,0),o.door?door:glass,o.door?-3:-1);
   quad(q(p,H,0,0),q(p,G,0,1),q(v,G,1,1),q(v,H,1,0),edge,-2);
   quad(q(u,H,0,0),q(w,H,1,0),q(w,G,1,1),q(u,G,0,1),edge,-2);
   quad(q(p,G,0,0),q(u,G,1,0),q(w,G,1,1),q(v,G,0,1),well,-2);
   quad(q(p,H,0,0),q(v,H,0,1),q(w,H,1,1),q(u,H,1,0),edge,-2);
  }
 }
}
