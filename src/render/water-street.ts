import {ShapeUtils,Vector2,Color} from 'three';
import {WATER_STREET_PLAN} from './water-street.generated.ts';

type Point=Readonly<{x:number;z:number}>;
type Position=readonly [number,number];
type Plane=readonly [number,number,number];
type Face=readonly [Position,Position,number,number,number,number];
type Step=readonly [Position,Position,Position,Position];
type Roof=Readonly<{p:readonly (readonly (readonly Position[])[])[];y:Plane}>;
type Shell=Readonly<{i:number;source:readonly Position[];originXZ:Position;floorGround:number;
 roofs:readonly Roof[];walls:readonly Face[];steps:readonly Step[]}>;
type Writer=(p:Point,y:number,color:Color,u:number,v:number,role:number,style:number)=>void;
const DATA:readonly Shell[]=WATER_STREET_PLAN.shells;
const byIndex=new Map(DATA.map(r=>[r.i,r]));
export const WATER_STREET_TILE=WATER_STREET_PLAN.tile;
export const WATER_STREET_LAYER=WATER_STREET_PLAN.atlasSha256;
const roles={wall:.0,roof:21.,riser:22.,frame:23.,glass:24.,foundation:25.,metal:26.,plinth:27.};

const stoneTint=[0x938776,0x9b9180,0x766e61,0x8b8173,0xaa967d,0x948879,0xaaa18f].map(x=>new Color(x));
const bodyTint=[0x915e4a,0x9b8b70,0x977564,0x815140,0xa05e43,0x94735e,0x965442].map(x=>new Color(x));
const roofTint=[0x595653,0x55524d,0x585857,0x4c4842,0x55514b,0x515759].map(x=>new Color(x));
const paintTint=[0x554941,0x5f695b,0x555756,0x55483d,0x615a4b,0x555e60,0x69635b].map(x=>new Color(x));
const glass=new Color(0x587078),foundation=new Color(0x777063), oldBitumen=new Color(0x5b5650);
const clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v));
function hash(i:number){const s=Math.sin(i*459.046+1.874)*49204.154;return s-Math.floor(s);}
function y(p:Position,a:Plane){return a[0]+p[0]*a[1]+p[1]*a[2];}

export function waterStreetModel(hash:string|undefined,id:string,ordinal:number,fp:readonly Position[],holes?:readonly (readonly Position[])[]){
 if(id!==WATER_STREET_TILE||hash!==WATER_STREET_LAYER||holes?.length)return;
 const q=byIndex.get(ordinal);
 if(q&&q.source.length===fp.length&&q.source.every((p,i)=>p[0]===fp[i][0]&&p[1]===fp[i][1]))return q;
}
export function emitWaterStreetShell(q:Shell,ground:(x:number,z:number)=>number,write:Writer){
 const [ox,oz]=q.originXZ;
 const pt=([x,z]:Position)=>({x:ox+x,z:oz+z});
 const tri=(a:Point,b:Point,c:Point,h:readonly [number,number,number],uv:readonly [Position,Position,Position],col:Color,role:number,style:number)=>{
  write(a,h[0],col,uv[0][0],uv[0][1],role,style);write(b,h[1],col,uv[1][0],uv[1][1],role,style);write(c,h[2],col,uv[2][0],uv[2][1],role,style);
 };
 const roofStyle=q.i===137?1:q.i===267?2:q.i===326?3:q.i===172?4:0;
 for(const [k,{p,y:beta}] of q.roofs.entries()){
  for(const region of p){
   const a=region.map(r=>r.map(([x,z])=>new Vector2(x,z)));
   const indices=ShapeUtils.triangulateShape(a[0],a.slice(1));
   const coords=a.flat();
   for(const [i,j,k0] of indices){
    const l=coords[i],m=coords[j],n=coords[k0],area=(m.x-l.x)*(n.y-l.y)-(m.y-l.y)*(n.x-l.x);
    if(Math.abs(area)<1e-9)continue;
    const [A,B,C]=(area<0?[l,m,n]:[l,n,m]).map(a=>[a.x,a.y] as Position);
    tri(pt(A),pt(B),pt(C),[y(A,beta),y(B,beta),y(C,beta)],[A,B,C],
     roofTint[(roofStyle+k)%roofTint.length],roles.roof,13+roofStyle);
   }
  }
 }
 const panel=(a:Point,b:Point,c:Point,d:Point,ha:number,hb:number,hc:number,hd:number,
  ua:number,ub:number,va:number,vb:number,vc:number,vd:number,col:Color,role:number,style:number)=>{
  tri(a,b,c,[ha,hb,hc],[[ua,va],[ua,vb],[ub,vc]],col,role,style);
  tri(a,c,d,[ha,hc,hd],[[ua,va],[ub,vc],[ub,vd]],col,role,style);
 };
 // The closing faces belong to measured adjacent roof leaves, not a
 // freestanding cylinder or an artificial tall architectural obstruction.
 for(const [a,b,u,v] of q.steps){
  const span=Math.hypot(a[0]-b[0],a[1]-b[1]),lo0=Math.min(u[0],v[0]),lo1=Math.min(u[1],v[1]),hi0=Math.max(u[0],v[0]),hi1=Math.max(u[1],v[1]);
  if(hi0-lo0<.001&&hi1-lo1<.001)continue;
  panel(pt(a),pt(a),pt(b),pt(b),lo0,hi0,hi1,lo1,0,span,0,hi0-lo0,hi1-lo1,0,
   oldBitumen,roles.riser,13+roofStyle);
 }
 type Opening={a:number;b:number;bottom:number;top:number;frame:number;depth:number;door:boolean};
 for(const [idx,[A,B,heightA,heightB,type,front]] of q.walls.entries()){
  const a=pt(A),b=pt(B),L=Math.hypot(b.x-a.x,b.z-a.z);
  if(L<.012)continue;
  const dx=(b.x-a.x)/L,dz=(b.z-a.z)/L;
  const grA=ground(a.x,a.z),grB=ground(b.x,b.z);
  const bottomA=grA-.37,bottomB=grB-.37,street=Math.max(grA,grB)+.04;
  const high=Math.min(heightA,heightB),remaining=high-street;
  const tint=bodyTint[type].clone().multiplyScalar(.91+.20*hash(q.i*15+(front?idx:0)));
  const stone=stoneTint[type],style=13+type;
  const f=(u:number,inside=0):Point=>({x:a.x+dx*u-dz*inside,z:a.z+dz*u+dx*inside});
  const top=(u:number)=>heightA+(heightB-heightA)*(u/L);
  const lows=(u:number)=>bottomA+(bottomB-bottomA)*(u/L);
  const field=(u0:number,u1:number,y0a:number,y0b:number,y1a:number,y1b:number,out=0,col=tint,role=roles.wall)=>{
   if(u1-u0<.001||Math.max(y1a-y0a,y1b-y0b)<.001)return;
   panel(f(u0,out),f(u0,out),f(u1,out),f(u1,out),y0a,y1a,y1b,y0b,u0,u1,
    y0a-street,y1a-street,y1b-street,y0b-street,col,role,style);
  };
  if(remaining<1.3||L<1.65){
   field(0,L,bottomA,bottomB,heightA,heightB);continue;
  }
  const plinth=street+.34;
  field(0,L,bottomA,bottomB,plinth,plinth,0,foundation,roles.foundation);
  const rows:Opening[][]=[];
  const lowGlass=!!front&&type!==2&&type!==3;
  const bays=Math.max(1,Math.floor((L-.3)/(type===5?2.87:2.65)));
  const pitch=(L-.64)/bays,depth=type===4?.245:type===5?.17:.20;
  const one=(row:Opening[],h0:number,h1:number,retail=false)=>{
   const topClad=high-h1;
   if(h1-h0<.63||topClad<.285)return;
   for(let j=0;j<bays;j++){
    const centre=.32+(j+.5)*pitch,variation=hash(q.i*21+idx*8+j*5);
    const door=retail&&(variation<.26||bays===1&&L<4.7),s=retail?.66:type===4?.43:type===5?.56:.46;
    const width=Math.min(retail?2.29:1.65,Math.max(.54,pitch*s*(.89+.16*variation)));
    if(centre-width/2<.38||centre+width/2>L-.38)continue;
    row.push({a:centre-width/2,b:centre+width/2,bottom:h0,top:h1,frame:retail?.095:.09,depth,door});
   }
  };
  if(lowGlass&&remaining>2.39&&L>3.25){
   const r:Opening[]=[];
   one(r,plinth,Math.min(street+3.08,high-.35),true);
   if(r.length)rows.push(r);
  }else if(type!==3&&L>4.2&&remaining>2.95){
   const r:Opening[]=[];
   // Utility and side elevations intentionally leave masonry between bays.
   if(type!==2||hash(q.i*41+idx)>.45)one(r,street+.96,Math.min(street+2.34,high-.37));
   if(r.length)rows.push(r);
  }
  const upperFloor=type===5?3.15:type===4?3.34:type===2?3.20:2.99;
  if(type!==3&&L>3.2)for(let level=0;level<4;level++){
   const h=street+(lowGlass?3.96:3.91)+level*upperFloor;
   if(h+1.33>high-.32)break;
   const row:Opening[]=[];
   if(type!==2||L>7.5&&level<2)one(row,h,h+(type===4?1.60:1.28),false);
   if(row.length)rows.push(row);
  }
  let course=plinth;
  for(const r of rows){
   const y0=r[0].bottom,y1=r[0].top;
   if(y0>course)field(0,L,course,course,y0,y0);
   let begin=0;
   for(const o of r){
    const u=o.a,v=o.b,t=o.top,l=o.bottom,d=o.depth,k=o.frame;
    field(begin,u,l,l,t,t);
    // Solid 170–245 mm jambs, head and sill. Coplanar faux glass cannot
    // produce the oblique shadow reveal visible in the locked approach.
    const p=f(u),q=f(v),pi=f(u,d),qi=f(v,d);
    panel(p,pi,qi,q,t,t,t,t,u,v,t-street,t-street,t-street,t-street,stone,roles.frame,style);
    panel(pi,p,q,qi,l,l,l,l,u,v,l-street,l-street,l-street,l-street,stone,roles.frame,style);
    panel(p,p,pi,pi,l,t,t,l,u,u+.2,l-street,t-street,t-street,l-street,stone,roles.frame,style);
    panel(qi,qi,q,q,l,t,t,l,v-.2,v,l-street,t-street,t-street,l-street,stone,roles.frame,style);
    field(u,v,l,l,t,t,d,glass,roles.glass);
    const edges=paintTint[type];
    field(u,v,l,l,l+k,l+k,d-.006,edges,roles.metal);
    field(u,v,t-k,t-k,t,t,d-.006,edges,roles.metal);
    field(u,u+k,l+k,l+k,t-k,t-k,d-.006,edges,roles.metal);
    field(v-k,v,l+k,l+k,t-k,t-k,d-.006,edges,roles.metal);
    if(v-u>.78){
     const mid=(u+v)*.5,m=o.door?.031:.022;
     field(mid-m,mid+m,l+k,l+k,t-k,t-k,d-.008,edges,roles.metal);
    }
    if(!o.door&&t-l>1.48){
     const tm=l+(t-l)*.55;
     field(u+k,v-k,tm-.034,tm-.034,tm+.034,tm+.034,d-.009,edges,roles.metal);
    }
    begin=v;
   }
   field(begin,L,y0,y0,y1,y1);course=y1;
  }
  const cornice=clamp(type===4?.24:type===3?.17:.12,.08,.26);
  if(high-course>cornice+.05){
   // A flush articulated cornice stays within the survey outline.
   field(0,L,course,course,top(0)-cornice,top(L)-cornice);
   field(0,L,top(0)-cornice,top(L)-cornice,top(0),top(L),0,stone,roles.frame);
  }else field(0,L,course,course,top(0),top(L));
 }
}
