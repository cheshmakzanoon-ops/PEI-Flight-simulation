import {Batch,beam,p,type XY} from './geometry.ts';
import {FIRST_ART_FOOTING,type P} from './frame.ts';
import {edgeStations,upper,type Component} from './roof.ts';
export type Layer='paint'|'scallop'|'foundation'|'redRoof'|'trim'|'whiteTrim'|'reveal'|'glass'|'iron'|'door'|'metal'|'relief'|'figure';
export type Layers=Record<Layer,Batch>;
export type Opening=Readonly<{centre:number;bottom:number;width:number;height:number;kind:'traceried'|'lancet'|'louver'|'entry'|'rect'|'niche';bands?:number}>;
export const OPEN=(centre:number,bottom:number,width:number,height:number,kind:Opening['kind']='lancet',bands?:number):Opening=>({centre,bottom,width,height,kind,bands});
export type Face={length:number;at:(s:number,y:number,inward?:number)=>P;norm:P};
export function face(a:XY,b:XY):Face{
 const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),u=dx/length,v=dz/length; const norm=p(v,0,-u);
 return {length,norm,at:(s,y,d=0)=>p(a[0]+s*u-d*v,y,a[1]+s*v+d*u)};
}
const box=(L:number,R:number,B:number,T:number):XY[]=>[[L,B],[R,B],[R,T],[L,T]];
export function section(o:Opening,quality=12,scale=1):XY[]{
 const w=o.width*.5*scale, b=o.bottom-(scale-1)*o.height*.23,H=o.height*scale,c=o.centre;
 if(o.kind==='rect')return box(c-w,c+w,b,b+H);
 const start=o.kind==='entry'?.76:o.kind==='traceried'?.55:.67;
 const f=(t:number)=>(1-t)*(1+.58*t);
 const ring:XY[]=[[c-w,b],[c+w,b],[c+w,b+H*start]];
 for(let i=1;i<=quality;i++){const t=i/quality;ring.push([c+w*f(t),b+H*(start+(1-start)*t)]);}
 for(let i=quality-1;i>=0;i--){const t=i/quality;ring.push([c-w*f(t),b+H*(start+(1-start)*t)]);}
 return ring;
}
function expanded(a:XY[],s:number,y0:number,delta:number):XY[]{return a.map(([x,y])=>{
 const dx=x-s,dy=y-y0,D=Math.hypot(dx,dy)||1;
 return [x+dx/D*delta,y+dy/D*delta];
});}
function border(a:Batch,f:Face,out:XY[],inn:XY[],d:number){
 for(let i=0;i<out.length;i++){
  const k=(i+1)%out.length;
  const A=out[i],B=out[k],C=inn[k],D=inn[i];a.poly([f.at(...A,d),f.at(...B,d),f.at(...C,d),f.at(...D,d)],f.norm,[A,B,C,D]);
 }
}
function joinRing(a:Batch,f:Face,ring:XY[],d0:number,d1:number,towardOpening=true){
 for(let i=0;i<ring.length;i++){
  const k=(i+1)%ring.length,A=ring[i],B=ring[k];
  const e=towardOpening?-1:1;
  const nn=f.at(A[0]+e*(B[1]-A[1]),A[1]-e*(B[0]-A[0]));const O=f.at(...A);
  a.poly([f.at(...A,d0),f.at(...B,d0),f.at(...B,d1),f.at(...A,d1)],p(nn[0]-O[0],nn[1]-O[1],nn[2]-O[2]));
 }
}
const triangleInside=(ring:XY[],x:number,y:number)=>{
 let b=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++)if((ring[i][1]>y)!==(ring[j][1]>y)&&x<(ring[j][0]-ring[i][0])*(y-ring[i][1])/(ring[j][1]-ring[i][1])+ring[i][0])b=!b;
 return b;
};
function glassLines(art:Layers,f:Face,o:Opening,inner:XY[],complex:boolean){
 if(o.kind==='niche')return;
 const S=o.centre,W=o.width,H=o.height,Y=o.bottom;
 const D=.173;
 const points=complex?(o.kind==='traceried'?42:20):12;
 const bar=(a:XY,b:XY,width:number,dep=D)=>beam(art.iron,f.at(...a,dep),f.at(...b,dep),width,.032,f.norm);
 const valid=([x,y]:XY)=>triangleInside(inner,x,y);
 const sweep=(a:XY,b:XY,width:number)=>{
  // Bounded segmentation and analytic centre clipping; stop before the rabbet, not on the outer panel.
  let from:XY|undefined,prev:XY|undefined;
  for(let i=0;i<=points;i++){
   const t=i/points,at:XY=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
   if(valid(at)){from??=at;prev=at;}
   else if(from&&prev){if(from!==prev)bar(from,prev,width);from=undefined;prev=undefined;}
  }
  if(from&&prev&&from!==prev)bar(from,prev,width);
 };
 if(o.kind==='louver'){
  for(let i=1;i<9;i++)sweep([S-W*.50,Y+i*H*.091],[S+W*.50,Y+i*H*.091],.039);
  return;
 }
 if(o.kind==='entry'){
  sweep([S,Y],[S,Y+H*.92],.041);
  if(complex)for(let j=-3;j<=3;j++)if(j) sweep([S+j*W*.113,Y],[S+j*W*.113,Y+H*.90],.013);
  return;
 }
 const columns=o.kind==='traceried'?4:o.kind==='lancet'?2:o.bands??2;
 for(let j=1;j<columns;j++){const u=S+(j/columns-.5)*W;sweep([u,Y],[u,Y+H],columns>2?.060:.030);}
 const rows=complex?(columns>2?5:4):2;
 for(let j=1;j<=rows;j++){const y=Y+j*H/(rows+1);sweep([S-W*.50,y],[S+W*.50,y],columns>2?.033:.024);}
 if(o.kind==='traceried'){
  const interval=W/4,lower=Y+H*.55;
  for(let j=0;j<4;j++){
   const c=S+(j-1.5)*interval,dx=interval*.46;
   const points:XY[]=[[c-dx,lower],[c-dx*.82,lower+H*.072],[c-dx*.42,lower+H*.11],[c,lower+H*(j===0||j===3?.18:.245)],[c+dx*.42,lower+H*.11],[c+dx*.82,lower+H*.072],[c+dx,lower]];
   for(let i=0;i+1<points.length;i++)sweep(points[i],points[i+1],.043);
  }
  if(complex)for(const c of [S-W*.137,S+W*.137]){
   const cy=Y+H*.812,r=W*.075;const ring=Array.from({length:13},(_,i)=>[c+r*Math.cos(i*Math.PI/6),cy+r*.88*Math.sin(i*Math.PI/6)] as XY);
   for(let i=0;i<12;i++)sweep(ring[i],ring[i+1],.027);
  }
 }
}
export function inset(art:Layers,f:Face,opening:Opening,hero:boolean){
 const o=opening,ring=section(o,hero?10:6),ctr=o.bottom+o.height*.42;
 const cap=expanded(ring,o.centre,ctr,o.kind==='traceried'?.154:.081),interior=expanded(ring,o.centre,ctr,.031);
 const thick=o.kind==='traceried'?.245:.203;
 joinRing(art.reveal,f,ring,-.008,thick+.019);
 border(art.whiteTrim,f,cap,ring,-.029);
 joinRing(art.whiteTrim,f,cap,-.029,.003,false);
 const h=ring.length>>1;
 const archOut=expanded(ring,o.centre,ctr,o.kind==='traceried'?.210:.117);
 const archIn=expanded(ring,o.centre,ctr,o.kind==='traceried'?.174:.087);
 // Only the raised hood above the straight jambs is dark; no black outline around the wall foot.
 for(let i=2;i+1<ring.length;i++){
   const j=i+1;art.trim.poly([f.at(...archOut[i],-.055),f.at(...archOut[j],-.055),f.at(...archIn[j],-.055),f.at(...archIn[i],-.055)],f.norm);
 }
 const wallMat=o.kind==='entry'?art.door:o.kind==='louver'||o.kind==='niche'?art.reveal:art.glass;
 wallMat.poly(interior.map(k=>f.at(...k,thick)),f.norm,interior);
 art.reveal.poly(cap.map(k=>f.at(...k,thick+.063)),f.norm,cap);
 if(h)glassLines(art,f,o,ring,hero);
}
function outlineAt(c:Component,a:XY,b:XY,f:Face,base:number){
 const span=edgeStations(c,a,b).map(q=>[Math.hypot(q[0]-a[0],q[1]-a[1]),upper(c,q)] as XY);
 return [[0,base],[f.length,base],...span.reverse()] as XY[];
}
export function wall(art:Layers,c:Component,index:number,openings:Opening[],hero:boolean){
 const a=c.outline[index],b=c.outline[(index+1)%c.outline.length],f=face(a,b),base=FIRST_ART_FOOTING;
 const limit=(s:number)=>upper(c,[a[0]+(b[0]-a[0])*s/f.length,a[1]+(b[1]-a[1])*s/f.length]);
 const open=openings.filter(o=>{
  const q=section(o,hero?10:6);return q.every(k=>k[0]>.08&&k[0]<f.length-.08&&k[1]>=base+.017&&k[1]<limit(k[0])-.125);
 });
 const outer=outlineAt(c,a,b,f,base),holes=open.map(o=>section(o,hero?10:6));
 art.paint.poly(outer.map(k=>f.at(...k)),f.norm,outer,undefined,holes,outer,k=>f.at(...k));
 // Independent opaque timber sheathing inside the exterior wall. It has no
 // matching triangulated apertures or seams. Opaque panes/reveals are in front;
 // this catches real GPU sample gaps at the exterior polygons' tessellation.
 const ss=outer.slice(2).reverse();const insetDepth=.335;
 for(let j=0;j+1<ss.length;j++){
  const [s,sy]=ss[j],[t,ty]=ss[j+1];if(t-s<.00002)continue;
  const S=f.at(s,sy,insetDepth),T=f.at(t,ty,insetDepth);
  const sr=upper(c,[S[0],S[2]]),tr=upper(c,[T[0],T[2]]);
  art.reveal.poly([f.at(s,base+.014,insetDepth),f.at(t,base+.014,insetDepth),f.at(t,tr-.021,insetDepth),f.at(s,sr-.021,insetDepth)],f.norm);
 }
 // Low exposed stone course only spans uninterrupted jambs. Stays a nominal detached contact.
 const seat=[0,...open.filter(o=>o.bottom<base+.50).flatMap(o=>[o.centre-o.width*.53,o.centre+o.width*.53]),f.length];
 for(let n=0;n+1<seat.length;n+=2){
  const a=seat[n],b=seat[n+1];
  if(b-a>.04){const ring=box(a,b,base-.085,base+.46);art.foundation.poly(ring.map(k=>f.at(...k,-.022)),f.norm,ring);}
 }
 for(const o of open)inset(art,f,o,hero);
 return {face:f,openings:open.length};
}
export function band(art:Layers,f:Face,a:number,b:number,y:number,w:number=.105){
 if(!(b>a))return;const q=box(a,b,y-w*.50,y+w*.50);
 art.trim.poly(q.map(k=>f.at(...k,-.052)),f.norm,q);
 beam(art.whiteTrim,f.at(a,y+w*.54,-.045),f.at(b,y+w*.54,-.045),.058,.034,f.norm);
}
