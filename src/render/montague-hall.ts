import {Color,ShapeUtils,Vector2} from 'three';
import {MONTAGUE_HALL} from './montague-hall.generated.ts';

type P=readonly [number,number];
type Point=Readonly<{x:number;z:number}>;
type Writer=(p:Point,y:number,color:Color,u:number,v:number,role:number,style:number)=>void;
export const MONTAGUE_HALL_TILE=MONTAGUE_HALL.tile;
export const MONTAGUE_HALL_ATLAS=MONTAGUE_HALL.atlasSha256;
export const MONTAGUE_HALL_STYLE=47;
export const HALL_ROLES={shingle:0,cement:40,roof:41,parapet:42,gutter:43,wood:44,glass:45,rebate:46};
const r=HALL_ROLES;
const wall=new Color(0x9b8067),base=new Color(0x918d86),metal=new Color(0x49423b),
 edge=new Color(0x514942),glass=new Color(0x454d52),roof=new Color(0x514e48),
 band=new Color(0xaca392),paint=new Color(0x525557),splay=new Color(0xa39b8d);
export function montagueHallModel(hash:string|undefined,tile:string,index:number,fp:readonly P[],holes?:readonly (readonly P[])[]){
 return hash===MONTAGUE_HALL_ATLAS&&tile===MONTAGUE_HALL_TILE&&index===MONTAGUE_HALL.ordinal&&!holes?.length&&
  fp.length===MONTAGUE_HALL.source.length&&fp.every((p,i)=>p[0]===MONTAGUE_HALL.source[i][0]&&p[1]===MONTAGUE_HALL.source[i][1])
  ?MONTAGUE_HALL:undefined;
}
/** Recorded former civic massing and timber/cement construction; no
 * storefront identity, commercial ornament or interior is authored. */
export function emitMontagueHall(plan:typeof MONTAGUE_HALL,ground:(x:number,z:number)=>number,write:Writer){
 const [ox,oz]=plan.originXZ;
 const toWorld=(p:P):Point=>({x:ox+p[0],z:oz+p[1]});
 const coreY=([x,z]:P)=>plan.plane[0]+x*plan.plane[1]+z*plan.plane[2];
 const T=(a:P,b:P,c:P,ya:number,yb:number,yc:number,uv:[P,P,P],col:Color,role:number)=>{
  write(toWorld(a),ya,col,...uv[0],role,MONTAGUE_HALL_STYLE);
  write(toWorld(b),yb,col,...uv[1],role,MONTAGUE_HALL_STYLE);
  write(toWorld(c),yc,col,...uv[2],role,MONTAGUE_HALL_STYLE);
 };
 const rim=plan.ring;
 const n=rim.length;
 const side=(a:P,b:P):P=>{
  const x=b[0]-a[0],z=b[1]-a[1],L=Math.hypot(x,z);
  return [-z*plan.winding/L,x*plan.winding/L];
 };
 const width=.186;
 const inner:P[]=rim.map((p,i)=>{
  const a=side(rim[(i+n-1)%n],p),b=side(p,rim[(i+1)%n]);
  const w=width/(1.+a[0]*b[0]+a[1]*b[1]);
  return [p[0]+(a[0]+b[0])*w,p[1]+(a[1]+b[1])*w];
 });
 const P=(p:P,v:number):[P,number]=>[p,v];
 const quad=(a:[P,number],b:[P,number],c:[P,number],d:[P,number],uv:[P,P,P,P],col:Color,role:number)=>{
  T(a[0],b[0],c[0],a[1],b[1],c[1],[uv[0],uv[1],uv[2]],col,role);
  T(a[0],c[0],d[0],a[1],c[1],d[1],[uv[0],uv[2],uv[3]],col,role);
 };
 for(const [i,j,k] of ShapeUtils.triangulateShape(inner.map(p=>new Vector2(...p)),[])){
  const a=inner[i],b=inner[j],c=inner[k],s=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  if(Math.abs(s)<1e-9)continue;
  const B=s<0?b:c,C=s<0?c:b;
  T(a,B,C,coreY(a),coreY(B),coreY(C),[a,B,C],roof,r.roof);
 }
 const glassFrame=(L:number)=>L>1.28?.087:.056;
 const height=(i:number)=>(i===plan.frontEdge||i===(plan.frontEdge+1)%n)? .34:.24;
 for(let i=0;i<n;i++){
  const j=(i+1)%n,A=rim[i],B=rim[j],C=inner[i],D=inner[j],isFront=i===plan.frontEdge;
  const L=Math.hypot(B[0]-A[0],B[1]-A[1]),dx=(B[0]-A[0])/L,dz=(B[1]-A[1])/L,normal=side(A,B);
  const rise=height(i),rise2=height(j),cap0=coreY(A)+rise,cap1=coreY(B)+rise2;
  const va=coreY(C),vb=coreY(D);
  quad(P(A,cap0),P(C,cap0),P(D,cap1),P(B,cap1),[A,C,D,B],edge,r.parapet);
  quad(P(D,vb),P(D,cap1),P(C,cap0),P(C,va),[[L,0],[L,rise2],[0,rise],[0,0]],metal,r.gutter);
  const spot=(u:number,d=0):P=>[A[0]+dx*u+normal[0]*d,A[1]+dz*u+normal[1]*d];
  const ty=(u:number)=>cap0+(cap1-cap0)*u/L;
  const at=(u:number)=>{const p=toWorld(spot(u));return ground(p.x,p.z);};
  const floorA=at(0),floorB=at(L),foot=(u:number)=>floorA+(floorB-floorA)*u/L-.39,top=Math.min(cap0,cap1);
  const street=Math.max(floorA,floorB);
  const clear=top-street;
  const header=isFront?Math.min(street+2.95,top-2.04):Math.min(street+2.5,top-1.75);
  type F=readonly [number,number,number];
  const V=(x:number,y:number,d=0):F=>[x,y,d];
  const Q=(a:F,b:F,c:F,d:F,col:Color,style:number)=>{
   const pt=(p:F):[P,number]=>P(spot(p[0],p[2]),p[1]);
   const uv=(p:F):P=>[p[0],p[1]-foot(0)];
   quad(pt(a),pt(b),pt(c),pt(d),[uv(a),uv(b),uv(c),uv(d)],col,style);
  };
  const band4=(a:number,b:number,y0:number,y1:number,h0:number,h1:number,col:Color,style:number,d=0)=>{
   if(b-a<.0002||Math.max(h0-y0,h1-y1)<.0002)return;
   Q(V(a,y0,d),V(a,h0,d),V(b,h1,d),V(b,y1,d),col,style);
  };
  const flat=(a:number,b:number,y0:number,h0:number,col:Color,style:number,d=0)=>band4(a,b,y0,y0,h0,h0,col,style,d);
  type Opening={a:number;b:number;y:number;h:number;depth:number;garage:boolean};
  const low:Opening[]=[],high:Opening[]=[];
  if(isFront&&clear>4.13&&L>12){
   const m=.63,usable=L-2*m,pitch=usable/3.;
   for(let k=0;k<3;k++){
    const u=m+(k+.5)*pitch,b=Math.min(3.67,pitch-.62),a=u-b*.5,E=u+b*.5;
    const sill=Math.max(floorA+(floorB-floorA)*(a/L),floorA+(floorB-floorA)*(E/L))+.13;
    const roof=header-.23;
    if(roof-sill>1.5)low.push({a,b:E,y:sill,h:roof,depth:.29,garage:true});
   }
   if(top-header>1.67){
    for(let j=0;j<5;j++){
     const u=.7+(L-1.4)*(j+.5)/5,w=j===2?1.01:.89;
     high.push({a:u-w*.5,b:u+w*.5,y:header+.39,h:top-.54,depth:.186,garage:false});
    }
   }
  }else if(L>4.1&&clear>2.86){
   for(let j=0,n=Math.max(1,Math.floor(L/3.64));j<n;j++){
    const u=.55+(L-1.1)*(j+.5)/n,w=.91;
    if(u-w*.5<.41||u+w*.5>L-.41)continue;
    high.push({a:u-w*.5,b:u+w*.5,y:header+.32,h:top-.52,depth:.16,garage:false});
   }
  }
  const panels=(openings:Opening[],lower:boolean)=>{
   const lowY=lower?foot(0):header,highY=lower?header:ty(0)-.07;
   const ring:P[]=[[0,lowY],[L,lower?foot(L):header],[L,lower?highY:ty(L)-.07],[0,highY]];
   if(Math.max(highY-lowY,(lower?highY:ty(L)-.07)-(lower?foot(L):header))<.001)return;
   // A bay on the downhill end need not clear the foundation at the remote
   // uphill corner. Keep both endpoints of the opening inside its own wall.
   const valid=openings.filter(o=>o.h-o.y>=.48&&
    o.y>(lower?Math.max(foot(o.a),foot(o.b)):header)+.013&&
    o.h<(lower?header:Math.min(ty(o.a),ty(o.b))-.07)-.05);
   const holes:P[][]=valid.map(o=>[[o.a,o.y],[o.b,o.y],[o.b,o.h],[o.a,o.h]]);
   const p=[ring,...holes].flat();
   for(const [a,b,c] of ShapeUtils.triangulateShape(ring.map(v=>new Vector2(...v)),holes.map(h=>h.map(v=>new Vector2(...v))))){
    const pt=(x:P)=>spot(x[0]);
    T(pt(p[a]),pt(p[b]),pt(p[c]),p[a][1],p[b][1],p[c][1],
      [[p[a][0],p[a][1]-foot(0)],[p[b][0],p[b][1]-foot(0)],[p[c][0],p[c][1]-foot(0)]],lower?base:wall,lower?r.cement:r.shingle);
   }
   return valid;
  };
  // Where the rear bank rises beyond the low course, seat the opaque shell
  // through grade without ever extending or regrading the terrain.
  const deck=Math.max(header,Math.max(foot(0),foot(L))+.03);
  if(deck!==header){
   band4(0,L,foot(0),foot(L),ty(0)-.07,ty(L)-.07,wall,r.shingle);
   band4(0,L,ty(0)-.07,ty(L)-.07,cap0,cap1,edge,r.gutter);
   continue;
  }
  const cuts=[...(panels(low,true)??[]),...(panels(high,false)??[])];
  band4(0,L,ty(0)-.07,ty(L)-.07,cap0,cap1,edge,r.gutter);
  for(const {a,b,y,h,depth,garage} of cuts){
   const recess=garage?base:band,thePaint=garage?paint:metal;
   const shoulder=garage?.026:.022,bevel=garage?.067:.042;
   const aa=a+shoulder,bb=b-shoulder,yy=y+shoulder,hh=h-shoulder;
   Q(V(a,y),V(a,h),V(aa,hh,bevel),V(aa,yy,bevel),garage?splay:band,r.rebate);
   Q(V(b,h),V(b,y),V(bb,yy,bevel),V(bb,hh,bevel),garage?splay:band,r.rebate);
   Q(V(a,h),V(b,h),V(bb,hh,bevel),V(aa,hh,bevel),recess,r.rebate);
   Q(V(b,y),V(a,y),V(aa,yy,bevel),V(bb,yy,bevel),garage?splay:band,r.rebate);
   Q(V(aa,yy,bevel),V(aa,hh,bevel),V(aa,hh,depth),V(aa,yy,depth),recess,r.rebate);
   Q(V(bb,hh,bevel),V(bb,yy,bevel),V(bb,yy,depth),V(bb,hh,depth),recess,r.rebate);
   Q(V(aa,hh,bevel),V(bb,hh,bevel),V(bb,hh,depth),V(aa,hh,depth),recess,r.rebate);
   Q(V(bb,yy,bevel),V(aa,yy,bevel),V(aa,yy,depth),V(bb,yy,depth),recess,r.rebate);
   flat(aa,bb,yy,hh,glass,r.glass,depth);
   const k=garage?.094:glassFrame(b-a),d=depth-.011;
   flat(aa,bb,yy,yy+k,thePaint,r.wood,d);
   flat(aa,bb,hh-k,hh,thePaint,r.wood,d);
   flat(aa,aa+k,yy+k,hh-k,thePaint,r.wood,d);
   flat(bb-k,bb,yy+k,hh-k,thePaint,r.wood,d);
   const center=(a+b)*.5;
   const tm=y+(h-y)*(garage?.72:.58);
   flat(aa+k,bb-k,tm-.032,tm+.032,thePaint,r.wood,d-.004);
   flat(center-.025,center+.025,yy+k,hh-k,thePaint,r.wood,d-.006);
   if(garage){
    for(const q of [.25,.75]){
     const mid=a+(b-a)*q;
     flat(mid-.024,mid+.024,yy+k,tm,thePaint,r.wood,d-.006);
    }
    flat(a+.035,b-.035,h-.139,h-.083,band,r.wood,.025);
   }else{
    flat(a-.047,b+.047,y-.09,y-.047,band,r.wood,.003);
   }
  }
 }
}
