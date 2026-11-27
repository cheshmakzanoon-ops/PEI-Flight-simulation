import * as T from 'three';
import {MCLEAN_UPPER_HIP as hip} from './mclean-upper-hip.generated.ts';
import {createMcLeanHistoricBellStudy,type McLeanBellQuality} from './mclean-historic-bell-study.ts';

type Vec2=readonly [number,number];
type Vec3=readonly [number,number,number];
type Rect=readonly [left:number,right:number,sill:number,head:number];
type Frame={a:Vec2;b:Vec2;t:Vec2;n:Vec2;l:number};
type Loft=Readonly<{top:number;foot:number;stageHeight:number}>;
export const MCLEAN_BODY_ROLES=Object.freeze({
 clapboard:0,bayWood:1,lightTrim:2,mutedTrim:3,opaqueGlass:4,door:5,plinth:6,
 cornice:7,reveal:8,sash:9
} as const);
const COL=[
 0xb4a48d,0x95978a,0xd4c7b0,0x667068,0x596864,0x65584e,0x787367,0x596359,0x776f5d,0x54635c
] as const;
const TOP=Object.freeze(hip.vertices.slice(0,4).map(p=>Object.freeze([p[0],p[2]] as Vec2)));
const H=8.15, D=.48; // relative workbench design; not a surveyed floor or wall length
const sum=(a:Vec3,b:Vec3):Vec3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const delta=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=(v:Vec3):Vec3=>{
 const l=Math.hypot(...v);if(l<1e-8||!Number.isFinite(l))throw Error('invalid body normal');
 return [v[0]/l,v[1]/l,v[2]/l];
};
const neg=(v:Vec3):Vec3=>[-v[0],-v[1],-v[2]];
const U:Vec3=[0,1,0];
const FWD=(f:Frame):Vec3=>[f.n[0],0,f.n[1]];
const LAT=(f:Frame):Vec3=>[f.t[0],0,f.t[1]];
const frame=(a:Vec2,b:Vec2):Frame=>{
 const l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(!(l>.02))throw Error('invalid body frame');
 const t:Vec2=[(b[0]-a[0])/l,(b[1]-a[1])/l];
 return {a,b,l,t,n:[t[1],-t[0]]};
};
const framePt=(f:Frame,s:number,d=0):Vec2=>[f.a[0]+s*f.t[0]+d*f.n[0],f.a[1]+s*f.t[1]+d*f.n[1]];
const pivot=(f:Frame,s:number,y:number,d=0):Vec3=>{
 const p=framePt(f,s,d);return [p[0],y,p[1]];
};
const stages=(p:readonly Vec2[],d:number)=>p.map((x,i):Vec2=>{
 const a=frame(p[(i+3)%4],x).n,b=frame(x,p[(i+1)%4]).n,t=1+a[0]*b[0]+a[1]*b[1];
 if(!(t>.75))throw Error('unsafe roof-derived convex wall');
 return [x[0]+d*(a[0]+b[0])/t,x[1]+d*(a[1]+b[1])/t];
});
const roofOut=(x:Vec2)=>{
 return Math.max(...TOP.map((p,i)=>{const k=frame(p,TOP[(i+1)%4]);return (x[0]-p[0])*k.n[0]+(x[1]-p[1])*k.n[1];}));
};
const linear=(i:number)=>new T.Color(COL[i]);
const R=MCLEAN_BODY_ROLES;
function build(loft:Loft,quality:McLeanBellQuality){
 const near=quality==='near',P=stages(TOP,D),Q=P.map((a,i)=>frame(a,P[(i+1)%4]));
 const fl=loft.foot,ev=loft.top,above=(h:number)=>fl+h;
 const pos:number[]=[],nrm:number[]=[],rgb:number[]=[],tape:number[]=[],role:number[]=[];
 const palette=COL.map((_,i)=>linear(i));
 const pt=(v:Vec3,n:Vec3,sty:number,st:Vec2)=>{
  if(v[1]>ev+1e-5||v[1]<fl-1e-5||roofOut([v[0],v[2]])>1.198)throw Error('body exceeds detached roof envelope');
  const c=palette[sty];pos.push(...v);nrm.push(...n);rgb.push(c.r,c.g,c.b);tape.push(...st);role.push(sty);
 };
 const tri=(a:Vec3,b:Vec3,c:Vec3,wants:Vec3,sty:number,ta:Vec2,tb:Vec2,tc:Vec2)=>{
  let N=unit(cross(delta(b,a),delta(c,a)));
  if(dot(N,wants)<0){[b,c]=[c,b];[tb,tc]=[tc,tb];N=neg(N);}
  pt(a,N,sty,ta);pt(b,N,sty,tb);pt(c,N,sty,tc);
 };
 const quad=(a:Vec3,b:Vec3,c:Vec3,d:Vec3,wants:Vec3,sty:number,t?:readonly [Vec2,Vec2,Vec2,Vec2])=>{
  const st=t??[a,b,c,d].map(p=>[p[0]+p[2]*.77,p[1]-fl] as Vec2);
  tri(a,b,c,wants,sty,st[0],st[1],st[2]);tri(a,c,d,wants,sty,st[0],st[2],st[3]);
 };
 const pane=(k:Frame,a:number,b:number,y:number,Y:number,d:number,sty:number,glazed=false)=>{
  if(b-a<.006||Y-y<.006)return;
  const t=glazed?[[0,0],[0,1],[1,1],[1,0]] as const:[[a,y-fl],[a,Y-fl],[b,Y-fl],[b,y-fl]] as const;
  quad(pivot(k,a,y,d),pivot(k,a,Y,d),pivot(k,b,Y,d),pivot(k,b,y,d),FWD(k),sty,t);
 };
 const shellBox=(k:Frame,a:number,b:number,y:number,Y:number,d0:number,d1:number,sty:number)=>{
  const q=(s:number,j:number,d:number)=>pivot(k,s,j,d),N=FWD(k),L=LAT(k);
  if(b-a<.006||Y-y<.006||d1-d0<.004)return;
  pane(k,a,b,y,Y,d1,sty);
  quad(q(b,y,d0),q(b,Y,d0),q(a,Y,d0),q(a,y,d0),neg(N),sty);
  quad(q(a,y,d0),q(a,Y,d0),q(a,Y,d1),q(a,y,d1),neg(L),sty);
  quad(q(b,y,d1),q(b,Y,d1),q(b,Y,d0),q(b,y,d0),L,sty);
  quad(q(a,Y,d1),q(a,Y,d0),q(b,Y,d0),q(b,Y,d1),U,sty);
  quad(q(a,y,d0),q(a,y,d1),q(b,y,d1),q(b,y,d0),neg(U),sty);
 };
 const panels=(k:Frame,y:number,Y:number,h:readonly Rect[],sty:number)=>{
  const breaks=(a:number[])=>[...new Set(a)].sort((j,k)=>j-k);
  const x=breaks([0,k.l,...h.flatMap(a=>[a[0],a[1]])]),z=breaks([y,Y,...h.flatMap(a=>[a[2],a[3]])]);
  for(const [a,b,c,d] of h)if(a<=0||b>=k.l||c<=y||d>=Y||b-a<.10||d-c<.14)throw Error('out of wall opening');
  for(let m=0;m<x.length-1;m++)for(let n=0;n<z.length-1;n++){
   const s=(x[m]+x[m+1])*.5,v=(z[n]+z[n+1])*.5;
   if(!h.some(([a,b,c,d])=>s>a&&s<b&&v>c&&v<d))pane(k,x[m],x[m+1],z[n],z[n+1],0,sty);
  }
 };
 const mouth=(k:Frame,h:Rect,width:number,depth:number,sty:number)=>{
  const [a,b,c,d]=h;
  const outline=(f:number,z:number)=>[
   pivot(k,a+f,c+f,z),pivot(k,a+f,d-f,z),pivot(k,b-f,d-f,z),pivot(k,b-f,c+f,z)
  ] as const;
  const o=outline(0,.003),i=outline(width,-depth);
  for(let r=0;r<4;r++)quad(o[r],i[r],i[(r+1)%4],o[(r+1)%4],FWD(k),sty);
  return [a+width,b-width,c+width,d-width] as Rect;
 };
 const sashWindow=(k:Frame,h:Rect,div:number,bay=false)=>{
  const [a,b,c,d]=h,l=b-a,sl=d-c;
  const [s,e,y,Y]=mouth(k,h,bay?.072:.078,bay?.085:.098,R.reveal);
  if(e-s<.13)throw Error('glazing below modeled resolution');
  // An opaque dark interior plane is recessed behind the revealed frame.
  pane(k,s,e,y,Y,-(bay?.086:.099),R.opaqueGlass,true);
  const thick=near?.036:.052;
  shellBox(k,a-.027,a+.041,c-.028,d+.031,-.020,.024,R.mutedTrim);
  shellBox(k,b-.041,b+.027,c-.028,d+.031,-.020,.024,R.mutedTrim);
  shellBox(k,a-.027,b+.027,d-.035,d+.033,-.020,.024,R.lightTrim);
  shellBox(k,a-.047,b+.047,c-.048,c+.025,-.018,.054,R.lightTrim);
  for(let j=1;j<div;j++){
   const t=s+j*(e-s)/div;shellBox(k,t-thick*.5,t+thick*.5,y,Y,-.085,-.052,R.sash);
  }
  const mark=y+(Y-y)*.50;
  shellBox(k,s,e,mark-thick*.45,mark+thick*.45,-.089,-.052,R.sash);
  if(near&&div>1){
   const mark2=y+(Y-y)*.77;
   shellBox(k,s,e,mark2-.012,mark2+.012,-.09,-.073,R.sash);
  }
  if(!bay && l>.45&&sl>1.15){
   // Tiny hood shelf, documented trim language not a traced joinery section.
   shellBox(k,a-.035,b+.035,d+.012,d+.060,-.007,.068,R.lightTrim);
  }
 };
 const door=(k:Frame,h:Rect)=>{
  const [a,b,c,d]=h,[s,e,y,Y]=mouth(k,h,.087,.139,R.reveal),t=(s+e)*.5,half=(e-s)/2;
  pane(k,s,e,y,Y,-.141,R.door);
  const side=.14*half,slop=(Y-y)*.20,fx=(e-s)*.18;
  pane(k,s+.029,s+fx,Y-slop-.97,Y-slop-.03,-.139,R.opaqueGlass,true);
  pane(k,e-fx,e-.029,Y-slop-.97,Y-slop-.03,-.139,R.opaqueGlass,true);
  pane(k,s+.035,e-.035,Y-slop+.018,Y-.031,-.138,R.opaqueGlass,true);
  shellBox(k,s,e,Y-slop-.028,Y-slop+.017,-.139,-.119,R.lightTrim);
  shellBox(k,s+fx+.012,s+fx+.048,y,Y-slop,-.14,-.111,R.sash);
  shellBox(k,e-fx-.048,e-fx-.012,y,Y-slop,-.14,-.111,R.sash);
  shellBox(k,t-side,t+side,y+.23,Y-slop-.21,-.140,-.116,R.door);
  shellBox(k,a-.070,a+.035,c-.043,d+.098,-.019,.049,R.lightTrim);
  shellBox(k,b-.035,b+.070,c-.043,d+.098,-.019,.049,R.lightTrim);
  shellBox(k,a-.075,b+.075,d+.015,d+.107,-.022,.058,R.lightTrim);
  shellBox(k,a-.048,b+.048,c-.056,c+.017,-.018,.063,R.plinth);
 };
 const crown=(k:Frame,a:number,b:number,y:number)=>{
  shellBox(k,a,b,y-.125,y-.060,-.013,.094,R.cornice);
  if(near)shellBox(k,a,b,y-.057,y-.017,-.010,.109,R.mutedTrim);
 };
 function bracket(k:Frame,x:number,w:number,ceiling:number){
  const d0=-.014,c=ceiling;
  const profile:readonly Vec2[]=near?[
   [d0,c-.319],[.062,c-.289],[.110,c-.190],[.183,c-.129],[.278,c-.097],[.300,c-.047],[d0,c-.046]
  ]:[[d0,c-.306],[.11,c-.224],[.285,c-.061],[d0,c-.045]];
  const p=(i:number,s:number)=>pivot(k,s,profile[i][1],profile[i][0]);
  const a=x-w/2,b=x+w/2,ff=profile.length;
  for(let j=1;j<ff-1;j++){
   tri(p(0,a),p(j,a),p(j+1,a),neg(LAT(k)),R.cornice,[0,0],[0,0],[0,0]);
   tri(p(0,b),p(j,b),p(j+1,b),LAT(k),R.cornice,[0,0],[0,0],[0,0]);
  }
  for(let j=0;j<ff;j++){
   const n=(j+1)%ff,q=p(j,a),h=p(n,a);
   quad(q,h,p(n,b),p(j,b),unit(cross(delta(h,q),delta(p(j,b),q))),R.cornice);
  }
 }
 function bay(k:Frame,fraction:number){
  const mid=k.l*fraction,wide=k.l*.258,reach=.584;
  const a=mid-wide/2,b=mid+wide/2,g=wide*.302,
   bp=[framePt(k,a,-.017),framePt(k,mid-g,reach),framePt(k,mid+g,reach),framePt(k,b,-.017)];
  const low=above(.395),high=ev-.088;
  const sides=[frame(bp[0],bp[1]),frame(bp[1],bp[2]),frame(bp[2],bp[3])];
  for(let i=0;i<3;i++){
   const s=sides[i],m=i===1?.103:.091;
   const holes:Rect[]=[[m,s.l-m,above(1.24),above(3.40)],[m,s.l-m,above(4.77),above(7.20)]];
   panels(s,low,high,holes,R.bayWood);
   for(const h of holes)sashWindow(s,h,i===1?2:1,true);
   // One settled continuous apron at the inter-storey belt, not a second bay pasted above.
   shellBox(s,.022,s.l-.022,above(3.86),above(4.029),-.014,.102,R.cornice);
   if(near)shellBox(s,.021,s.l-.021,above(3.815),above(3.863),-.006,.080,R.mutedTrim);
   crown(s,.021,s.l-.021,high);
   shellBox(s,.022,s.l-.022,low+.008,low+.118,-.013,.042,R.mutedTrim);
  }
  const cap=(y:number,dir:Vec3)=>{const p=bp.map(q=>[q[0],y,q[1]] as Vec3);quad(p[0],p[1],p[2],p[3],dir,R.bayWood);};
  cap(low,neg(U));cap(high,U);
 }
 function oriel(k:Frame){
  const half=k.l*.115,mid=k.l*.5,h=.248;
  const p=[framePt(k,mid-half,-.016),framePt(k,mid-half,h),framePt(k,mid+half,h),framePt(k,mid+half,-.016)] as const;
  const f=[frame(p[0],p[1]),frame(p[1],p[2]),frame(p[2],p[3])];
  const y=above(4.58),Y=above(7.35),main=f[1],w=main.l;
  const hs:Rect=[.11,w-.11,y+.25,Y-.20];
  panels(main,y,Y,[hs],R.bayWood);sashWindow(main,hs,3,true);
  for(const k of [f[0],f[2]])pane(k,0,k.l,y,Y,0,R.bayWood);
  const c=(z:number)=>p.map(q=>[q[0],z,q[1]] as Vec3),bot=c(y),top=c(Y);
  quad(bot[0],bot[1],bot[2],bot[3],neg(U),R.bayWood);
  quad(top[0],top[1],top[2],top[3],U,R.bayWood);
  shellBox(main,.022,w-.022,y+.005,y+.103,-.012,.046,R.cornice);crown(main,.022,w-.022,Y);
 }
 for(let i=0;i<4;i++){
  const a=Q[i],lo=above(.37),hi=ev,k=a.l;
  const h:Rect[]=[];
  if(i===1)h.push([k*.381,k*.619,above(.49),above(3.73)]);
  if(i===0)for(const x of [.33,.67]){
   const t=k*x,s=Math.min(k*.095,.51);h.push([t-s,t+s,above(4.82),above(7.14)]);
  }
  pane(a,0,k,fl,lo,0,R.plinth);
  panels(a,lo,hi,h,R.clapboard);
  for(const h0 of h)if(i===1)door(a,h0);else sashWindow(a,h0,1);
  // The walls remain closed, including restrained unknown elevations.
  crown(a,.026,k-.026,ev);
  shellBox(a,.033,.109,lo+.01,ev-.121,-.012,.024,R.lightTrim);
  shellBox(a,k-.109,k-.033,lo+.01,ev-.121,-.012,.024,R.lightTrim);
  if(i===1){
   bay(a,.208);bay(a,.792);oriel(a);
   for(const f of near?[.071,.142,.339,.414,.586,.661,.858,.929]:[.104,.337,.662,.895])bracket(a,k*f,.102,ev);
  }else if(i===0){
   for(const f of near?[.085,.26,.5,.74,.915]:[.12,.50,.88])bracket(a,k*f,.096,ev);
  }
 }
 const cap=(y:number,w:Vec3,sty:number)=>{
  const p=P.map(v=>[v[0],y,v[1]] as Vec3);
  quad(p[0],p[1],p[2],p[3],w,sty);
 };
 cap(fl,neg(U),R.plinth);cap(ev,U,R.cornice);
 return {pos,nrm,rgb,tape,role};
}
const shaderInk=/*glsl*/`
varying vec2 mcHouseTape;
varying float mcHouseRole;
float mcHouseWash(vec2 v){
 const float c=.158;
 float q=v.y/c, b=fwidth(q), av=1.-smoothstep(.29,.93,b);
 float course=1.-smoothstep(.025,.135+.43*max(b,.001),min(fract(q),1.-fract(q)));
 float shade=.012*(sin(v.x*.58+v.y*1.18)+.45*sin(v.x*1.61-v.y*.27));
 return 1.+shade-.10*av*course;
}
`;
function makeMaterial(){
 const m=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.89,metalness:0,
  side:T.FrontSide,transparent:false,depthWrite:true,depthTest:true,flatShading:false});
 m.onBeforeCompile=sh=>{
  const x='#include <color_vertex>',y='#include <color_fragment>',b='#include <roughnessmap_fragment>';
  if(sh.vertexShader.split(x).length!==2||sh.fragmentShader.split(y).length!==2||sh.fragmentShader.split(b).length!==2)return;
  sh.vertexShader='attribute vec2 mcHouseBoard;attribute float mcHouseKind;varying vec2 mcHouseTape;varying float mcHouseRole;\n'+
   sh.vertexShader.replace(x,x+'\n mcHouseTape=mcHouseBoard;mcHouseRole=mcHouseKind;');
  sh.fragmentShader=shaderInk+sh.fragmentShader.replace(y,y+/*glsl*/`
 float mcHwash=mcHouseWash(mcHouseTape);
 bool mcHGlass=abs(mcHouseRole-4.)<.25;
 if(mcHouseRole<1.5) diffuseColor.rgb*=mcHwash;
 if(mcHGlass){
    float g=clamp(mcHouseTape.y,0.,1.);
    float b=clamp(mcHouseTape.x,0.,1.);
    float sky=.30*smoothstep(.26,.95,g)+.10*(1.-abs(2.*b-1.));
    diffuseColor.rgb*=.68+sky;
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.090,.121,.123),.22*g);
 }
 `).replace(b,b+'\n if(mcHGlass)roughnessFactor=.61;');
 };
 m.customProgramCacheKey=()=>'mclean-principal-body-studio-v1';
 return m;
}
const ASSET_SCOPE=Object.freeze({
 historicFrontRelativeLabel:'relative studio long side only; cadastral orientation unresolved',
 independentMeasuredPart:'upper 2020 hip only', principalBodyMode:'illustrative current-scene independent body',
 legacyOwner:'q130331/173 untouched', preservedShop:'q130331/170 untouched',
 mount:false, noWesternAnnexOrGlazedPorch:true, noImagePixels:true, noLiveCollisionOrTerrain:true
} as const);
/** Detached roof/body exhibit. Returns no site placement or collider. */
export function createMcLeanPrincipalHistoricStudy(quality:McLeanBellQuality='near'){
 const roof=createMcLeanHistoricBellStudy(quality);
 try{
  const top=roof.mesh.geometry.boundingBox!.min.y;
  const loft=Object.freeze({top,foot:top-H,stageHeight:H});
  const d=build(loft,quality),g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(d.pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(d.nrm,3));
  g.setAttribute('color',new T.Float32BufferAttribute(d.rgb,3));g.setAttribute('mcHouseBoard',new T.Float32BufferAttribute(d.tape,2));
  g.setAttribute('mcHouseKind',new T.Float32BufferAttribute(d.role,1));g.computeBoundingBox();g.computeBoundingSphere();
  const m=makeMaterial(),body=new T.Mesh(g,m),group=new T.Group();
  body.name='McLean House Inn – detached two-storey principal shell';
  group.name='McLean Inn – relative historic principal study';
  body.castShadow=false;body.receiveShadow=false;
  group.add(body,roof.mesh);
  const bodyTriangles=g.getAttribute('position').count/3;
  let closed=false;
  return Object.freeze({group,body,roof:roof.mesh,quality,loft,bodyTriangles,roofTriangles:roof.triangles,scope:ASSET_SCOPE,close(){
   if(closed)return;closed=true;group.removeFromParent();body.removeFromParent();g.dispose();m.dispose();roof.close();
  }});
 }catch(e){roof.close();throw e;}
}
