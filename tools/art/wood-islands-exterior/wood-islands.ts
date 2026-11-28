/** Original detached post-relocation Wood Islands exterior. Local metres; no site placement. */
import * as T from 'three';
import {woodMaterial} from './wood-material.ts';
type P=[number,number,number];
type UV=[number,number];
type R=0|1|2|3|4|5|6|7|8|9|10|11;
interface Aperture {u:number; y:number; w:number; h:number; top?:'pediment'|'simple'; kind?:'door'|'boarded'; tint?:number; }
type Plane={
 o:P; u:P; n:P; half?:(y:number)=>number;
 y0:number;y1:number; outline:readonly UV[]; role:R;
};
const add=(a:P,b:P):P=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a:P,b:P):P=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul=(a:P,s:number):P=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a:P,b:P)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:P,b:P):P=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const len=(a:P)=>Math.hypot(...a);
const unit=(a:P)=>mul(a,1/len(a));
const mid=(a:P,b:P)=>mul(add(a,b),.5);
const Vec=(x:number,y:number,z:number):P=>[x,y,z];
const UP: P=[0,1,0], ZERO:P=[0,0,0];
export const woodDimensions=Object.freeze({towerBaseM:6.3,towerTopM:4.02,skirt:.28,towerTopY:12.14,
 overallY:16.46,houseWidth:4.8,houseNominalLength:8,houseRidge:7.60,houseEave:4.48,
 houseEnd:-11.05,annexWidth:3.26,annexZ0:-13.38,annexRoof:3.98,walkTop:.62});
const K=woodDimensions;
const th=(y:number)=>K.towerBaseM*.5+(K.towerTopM-K.towerBaseM)*.5*(y-K.skirt)/(K.towerTopY-K.skirt);
const sideNs:P[]=[[1,0,0],[0,0,1],[-1,0,0],[0,0,-1]];
const sideUs:P[]=[[0,0,-1],[1,0,0],[0,0,1],[-1,0,0]];
const rect=(l:number,t:number,r:number,b:number):UV[]=>[[l,t],[r,t],[r,b],[l,b]];
const colors=[0xd3d1c6,0x8f3a34,0x903a34,0x682a2b,0x3d4e57,0xc9c8bb,
  0x5f6058,0x303436,0x8b503b,0x515047,0x706857,0x586348].map(x=>new T.Color(x).toArray() as P);
const shade=(a:number,b:number)=>Math.sin(a*91.839+b*327.09)*.5+.5;

class Art {
 readonly p:number[]=[];readonly n:number[]=[];readonly t:number[]=[];
 readonly r:number[]=[];readonly c:number[]=[];
 readonly apertures:{face:string;u:number;y:number;w:number;h:number;kind:string;recess:number}[]=[];
 private defaults(p:P,n:P):UV{
  if(Math.abs(n[1])>.46)return [p[2],p[0]];
  return [Math.abs(n[0])>Math.abs(n[2])?p[2]:p[0],p[1]];
 }
 tri(a:P,b:P,c:P,role:R,dir?:P,tex?:readonly UV[],norms?:readonly P[],tone=1){
  let nn=cross(sub(b,a),sub(c,a));
  const s=len(nn);if(!(s>1e-10)||!Number.isFinite(s))throw Error('degenerate authored face');
  const q=[a,b,c],v=tex?[...tex]:undefined,smooth=norms?[...norms]:undefined;
  if(dir&&dot(nn,dir)<0){[q[1],q[2]]=[q[2],q[1]];nn=mul(nn,-1);
   if(v)[v[1],v[2]]=[v[2],v[1]];
   if(smooth)[smooth[1],smooth[2]]=[smooth[2],smooth[1]];
  }
  const n=unit(nn),rgb=mul(colors[role],tone);
  for(let i=0;i<3;i++){this.p.push(...q[i]);this.n.push(...(smooth?.[i]??n));
   this.t.push(...(v?.[i]??this.defaults(q[i],n)));this.r.push(role);this.c.push(...rgb);}
 }
 quad(a:P,b:P,c:P,d:P,r:R,n?:P,uv?:readonly UV[],smooth?:readonly P[],tone=1){
  this.tri(a,b,c,r,n,uv?.slice(0,3),smooth?.slice(0,3),tone);
  this.tri(a,c,d,r,n,uv&&[uv[0],uv[2],uv[3]],smooth&&[smooth[0],smooth[2],smooth[3]],tone);
 }
 box(a:P,b:P,r:R,tone=1){
  const [x,y,z]=a,[X,Y,Z]=b;
  this.quad([x,y,z],[X,y,z],[X,Y,z],[x,Y,z],r,[0,0,-1],undefined,undefined,tone);
  this.quad([x,y,Z],[X,y,Z],[X,Y,Z],[x,Y,Z],r,[0,0,1],undefined,undefined,tone);
  this.quad([x,y,z],[x,y,Z],[x,Y,Z],[x,Y,z],r,[-1,0,0],undefined,undefined,tone);
  this.quad([X,y,z],[X,y,Z],[X,Y,Z],[X,Y,z],r,[1,0,0],undefined,undefined,tone);
  this.quad([x,y,z],[X,y,z],[X,y,Z],[x,y,Z],r,[0,-1,0],undefined,undefined,tone);
  this.quad([x,Y,z],[X,Y,z],[X,Y,Z],[x,Y,Z],r,[0,1,0],undefined,undefined,tone);
 }
 beam(a:P,b:P,w:number,d:number,r:R,tone=1){
  const q=unit(sub(b,a)),u=unit(cross(q,Math.abs(q[1])>.91?[1,0,0]:UP)),v=unit(cross(q,u));
  const four=(p:P)=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([i,j])=>add(add(p,mul(u,i*w*.5)),mul(v,j*d*.5)));
  const L=four(a),R=four(b);
  for(let i=0;i<4;i++){const j=(i+1)%4;this.quad(L[i],L[j],R[j],R[i],r,sub(mid(L[i],L[j]),a),undefined,undefined,tone);}
  this.quad(L[0],L[1],L[2],L[3],r,mul(q,-1),undefined,undefined,tone);
  this.quad(R[0],R[1],R[2],R[3],r,q,undefined,undefined,tone);
 }
 planar(q:Plane,nm:string,windows:readonly Aperture[]){
  const point=([u,y]:UV,d=0)=>add(add(q.o,mul(q.u,u)),add([0,y,0],mul(q.n,(q.half?.(y)??0)+d)));
  const w=windows.map(a=>rect(a.u-a.w*.5,a.y,a.u+a.w*.5,a.y+a.h));
  const v=(s:readonly UV[])=>s.map(t=>new T.Vector2(t[0],t[1]));
  const all=[...q.outline,...w.flat()],faces=T.ShapeUtils.triangulateShape(v(q.outline),w.map(v));
  const area=(s:readonly UV[])=>Math.abs(s.reduce((sum,a,i)=>{const b=s[(i+1)%s.length];return sum+a[0]*b[1]-a[1]*b[0];},0))*.5;
  const measure=faces.reduce((sum,ids)=>sum+area(ids.map(i=>all[i])),0);
  if(Math.abs(measure-area(q.outline)+w.reduce((s,a)=>s+area(a),0))>1e-8)throw Error('unseated open wall, '+nm);
  for(const t of faces){const [a,b,c]=t.map(k=>all[k]);this.tri(point(a),point(b),point(c),q.role,q.n,[a,b,c]);}
  for(const [i,a]of windows.entries()){
   const g=w[i],skip=.113,inner=.027;
   this.apertures.push({face:nm,u:a.u,y:a.y,w:a.w,h:a.h,kind:a.kind??'sash',recess:skip});
   for(let s=0;s<4;s++){
    const t=(s+1)%4,edgeMid=mid(point(g[s]),point(g[t])),centre=point([a.u,a.y+a.h*.5],-skip/2);
    const n=sub(centre,edgeMid);
    this.quad(point(g[s]),point(g[t]),point(g[t],-skip),point(g[s],-skip),7,n);
   }
   const panel=(u:number,b:number,v:number,t:number,d:number,r:R)=>{const v0=rect(u,b,v,t);
     const A=v0.map(a=>point(a,d));this.quad(A[0],A[1],A[2],A[3],r,q.n,v0);};
   const cap=(u:number,b:number,v:number,t:number,d0:number,d1:number,r:R)=>{
     const c=rect(u,b,v,t),A=c.map(p=>point(p,d0)),B=c.map(p=>point(p,d1));this.quad(B[0],B[1],B[2],B[3],r,q.n,c);
     for(let k=0;k<4;k++){const s=(k+1)%4;this.quad(A[k],A[s],B[s],B[k],r,sub(mid(A[k],A[s]),point([(u+v)*.5,(b+t)*.5],d0)));}
   };
   const l=a.u-a.w*.5,r=a.u+a.w*.5,t=a.y+a.h,b=a.y;
   // Recess ends exactly on the inlaid glass/panel plane. Casing bars overlap the wall's cut edge.
   if(a.kind==='door'){
    panel(l,b,r,t,-skip,a.tint===1?1:6);
    const q=a.w*.20;
    for(const k of [-1,1])cap(a.u+k*q-.015,b+.19,a.u+k*q+.015,t-.22,-skip,-skip+.016,3);
    cap(a.u+a.w*.32-.024,b+.89,a.u+a.w*.32+.024,b+.924,-skip,-skip+.029,9);
   }else{
    const cut=a.kind==='boarded'?t-a.h*.41:t;
    panel(l,b,r,cut,-skip,4);
    if(cut<t)panel(l,cut,r,t,-skip,1);
    const four=[l+inner,r-inner,b+inner,cut-inner];
    cap(l,b,r,b+.043,-skip,-skip+.029,5);
    cap(l,cut-.04,r,cut,-skip,-skip+.029,5);
    cap(l,b,l+.035,cut,-skip,-skip+.028,5);
    cap(r-.035,b,r,cut,-skip,-skip+.028,5);
    cap(a.u-.013,b+.02,a.u+.013,cut-.02,-skip,-skip+.028,5);
    for(const f of [.34,.665]){const y=b+(cut-b)*f;cap(four[0],y-.014,four[1],y+.014,-skip,-skip+.030,5);}
   }
   const wCas=a.kind==='door'?.094:.073;
   cap(l-wCas,b-.024,l+.013,t+.066,-.030,.047,1);
   cap(r-.013,b-.024,r+wCas,t+.066,-.030,.047,1);
   cap(l-wCas-.026,t-.008,r+wCas+.026,t+.077,-.029,.059,1);
   cap(l-wCas-.023,b-.046,r+wCas+.023,b+.010,-.008,.080,1);
   if(a.top==='pediment'){
    const u=a.u,base=t+.061, wing=a.w*.5+wCas+.038, ridge=base+.108;
    const A=[point([u-wing,base],-.023),point([u+wing,base],-.023),point([u,ridge],-.023)];
    const B=[point([u-wing,base],.077),point([u+wing,base],.077),point([u,ridge],.077)];
    this.tri(B[0],B[1],B[2],1,q.n);
    for(let k=0;k<3;k++){const j=(k+1)%3;this.quad(A[k],A[j],B[j],B[k],1,sub(mid(A[k],A[j]),point([u,base+.036],-.018)));}
   }
  }
 }
 geometry(){
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(this.p,3));
  g.setAttribute('normal',new T.Float32BufferAttribute(this.n,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(this.t,2));
  g.setAttribute('paintRole',new T.Uint8BufferAttribute(this.r,1,false));
  g.setAttribute('pigment',new T.Float32BufferAttribute(this.c,3));
  g.computeBoundingBox();g.computeBoundingSphere();
  return g;
 }
}

function shell(a:Art){
 a.box([-3.13,0,-3.13],[3.13,.287,3.13],6);
 a.box([-2.37,0,K.houseEnd+.023],[2.37,.30,-2.96],6);
 a.box([-.99,0,K.annexZ0+.028],[2.18,.276,K.houseEnd+.027],6);
 const t0=K.skirt,t1=K.towerTopY,windows:Aperture[][]=[
  [{u:-.38,y:9.58,w:.68,h:1.48,top:'pediment'},{u:-.60,y:5.02,w:.65,h:1.40,top:'pediment'},
   {u:-.55,y:K.walkTop,w:.91,h:1.98,kind:'door',top:'pediment'},
   {u:.86,y:.97,w:.43,h:1.10,top:'simple'}],
  [{u:.92,y:1.63,w:.57,h:1.42,top:'pediment',kind:'boarded'},{u:.73,y:4.22,w:.61,h:1.60,top:'pediment'}],
  [{u:-.31,y:9.32,w:.69,h:1.57,top:'pediment'}],[]];
 for(let s=0;s<4;s++){
  const reach=th(t0),cap=th(t1);
  a.planar({o:ZERO,u:sideUs[s],n:sideNs[s],half:th,y0:t0,y1:t1,role:0,
   outline:[[-reach,t0],[reach,t0],[cap,t1],[-cap,t1]]},'tower-'+s,windows[s]);
 }
 const y0=.288,e=K.houseEave,z0=K.houseEnd;
 for(const side of [-1,1]){
  const normal:P=[side,0,0],along:P=[0,0,side<0?1:-1],q=(z:number)=>z*along[2];
  const arr=(u:number,y:number,w:number,h:number)=>({u:q(u),y,w,h,top:'simple' as const});
  const windows=side<0?[-9.63,-7.59,-5.44].map((z,i)=>arr(z,1.11,i===1?.56:.66,i===1?1.48:1.75)):
   [arr(-4.40,1.11,.70,1.80)];
  a.planar({o:[side*2.4,0,0],u:along,n:normal,y0,y1:e,role:0,
   outline:[[q(z0),y0],[q(-th(y0)+.043),y0],[q(-th(e)+.043),e],[q(z0),e]]},side<0?'wing-road':'wing-entry',windows);
  // Red paint over quiet metal runoff strips, with the eaves physically under flashing.
  a.beam([side*2.60,4.29,z0-.21],[side*2.60,4.29,-th(e)+.142],.105,.115,2,.93);
  a.beam([side*2.456,.29,z0+.37],[side*2.456,4.26,z0+.37],.045,.045,2,.91);
 }
 a.planar({o:[0,0,z0],u:[-1,0,0],n:[0,0,-1],y0,y1:K.houseRidge,role:0,
  outline:[[-2.4,y0],[2.4,y0],[2.4,e],[0,K.houseRidge],[-2.4,e]]},'observed wing gable',[
    {u:-.88,y:5.05,w:.69,h:.94,top:'simple'},{u:.85,y:5.03,w:.67,h:.96,top:'simple'},
    {u:1.88,y:1.33,w:.51,h:1.54,top:'simple'}
  ]);
 const an0=K.annexZ0, back=K.houseEnd+.12, cy=.59,aw=K.annexWidth*.5;
 const lo=cy-aw,hi=cy+aw, ey=2.67,annext=.271;
 for(const s of [-1,1]){
  const u:P=[0,0,s<0?1:-1],v=(z:number)=>z*u[2];
  a.planar({o:[cy+s*aw,0,0],u,n:[s,0,0],outline:rect(Math.min(v(an0),v(back)),annext,Math.max(v(an0),v(back)),ey),
    y0:annext,y1:ey,role:0},s>0?'entry apron':'annex return',s>0?[{u:v(-12.06),y:.65,w:.84,h:1.89,kind:'door',tint:1,top:'simple'}]:[]);
 }
 a.planar({o:[cy,0,an0],u:[-1,0,0],n:[0,0,-1],y0:annext,y1:K.annexRoof,role:0,
  outline:[[-aw,annext],[aw,annext],[aw,ey],[0,K.annexRoof],[-aw,ey]]},'annex end plain observed',[]);
 function roof(origin:number,half:number,peak:number,eave:number,end:number,next:(y:number)=>number,material:R){
  const slope=(peak-eave)/half,x=half+.18,Y=peak-x*slope;
  for(const s of [-1,1]){
   const A:P=[origin,peak,end],B:P=[origin+s*x,Y,end],C:P=[origin+s*x,Y,next(Y)],D:P=[origin,peak,next(peak)];
   const N:P=[s*slope,1,0],uv:UV[]=[[0,-end],[Math.hypot(x,peak-Y),-end],[Math.hypot(x,peak-Y),-next(Y)],[0,-next(peak)]];
   a.quad(A,B,C,D,material,N,uv);
   a.quad(sub(A,[0,.124,0]),sub(B,[0,.124,0]),sub(C,[0,.124,0]),sub(D,[0,.124,0]),5,[0,-1,0],uv);
   a.quad(A,sub(A,[0,.124,0]),sub(B,[0,.124,0]),B,2,[0,0,-1]);
   a.quad(B,sub(B,[0,.124,0]),sub(C,[0,.124,0]),C,2,[s,0,0]);
  }
  a.beam([origin,peak+.013,end-.019],[origin,peak+.013,next(peak)+.023],.079,.039,2,.93);
 }
 roof(0,2.4,K.houseRidge,e,z0-.19,y=>-th(y)+.062,3);
 roof(cy,aw,K.annexRoof,ey,an0-.15,()=>back,3);
 a.box([-.57,6.94,-8.27],[-.12,9.13,-7.80],8);
 a.box([-.61,9.09,-8.31],[-.08,9.20,-7.76],8,.88);
 a.box([-.52,9.20,-8.22],[-.16,9.224,-7.84],7);
 // Small detached landings at observed access sides. No current approach ramp or site stairs are implied.
 function landing(x0:number,x1:number,z0:number,z1:number,y:number){
  const width=z1-z0;
  a.box([x0,y-.102,z0],[x1,y,z1],10,.93);
  for(const z of [z0+.09,z1-.09]){
   a.box([x1-.098,.009,z-.043],[x1-.009,y+.77,z+.043],10);
   a.box([x0+.085,y-.025,z-.041],[x0+.16,y+.77,z+.041],10);
   a.beam([x0+.13,y+.72,z],[x1-.04,y+.72,z],.072,.078,10,.97);
   a.beam([x0+.13,y+.23,z],[x1-.04,y+.69,z],.048,.047,10);
   a.beam([x1-.04,y+.23,z],[x0+.13,y+.68,z],.046,.045,10,.9);
  }
  for(let s=0;s<3;s++){
   const x=x1+s*.24,h=y*(3-s)/4;
   a.box([x, .015,z0+.07],[x+.241,h,z1-.07],10,.94+.03*s);
  }
  a.beam([x1-.04,y+.72,z0+.09],[x1+.68,.77,z0+.09],.071,.072,10);
  a.beam([x1-.04,y+.72,z1-.09],[x1+.68,.77,z1-.09],.071,.072,10);
  a.box([x1+.61,.018,z0+.051],[x1+.692,.77,z0+.127],10);
  a.box([x1+.61,.018,z1-.127],[x1+.692,.77,z1-.051],10);
  return width;
 }
 landing(2.99,4.09,-.19,1.33,K.walkTop);
 landing(2.19,3.21,-12.79,-11.36,.65);
}
function cupola(a:Art){
 const prof:[[number,number],...[number,number][]]=[
  [12.14,2.01],[12.25,2.024],[12.37,2.042],[12.51,2.089],[12.66,2.165],
  [12.78,2.278],[12.872,2.39],[12.938,2.486],[13.007,2.486]];
 function n(s:number,i:number){
  const L=prof[Math.max(0,i-1)],R=prof[Math.min(prof.length-1,i+1)];
  return unit(add(sideNs[s],[0,-(R[1]-L[1])/(R[0]-L[0]),0]));
 }
 const pro=(s:number,j:number,k:number)=>{const [y,t]=prof[j];return add(add([0,y,0],mul(sideNs[s],t)),mul(sideUs[s],k*t));};
 for(let s=0;s<4;s++)for(let j=0;j+1<prof.length;j++){
  a.quad(pro(s,j,-1),pro(s,j,1),pro(s,j+1,1),pro(s,j+1,-1),5,sideNs[s],undefined,
   [n(s,j),n(s,j),n(s,j+1),n(s,j+1)]);
 }
 a.box([-2.52,12.989,-2.52],[2.52,13.102,2.52],1);
 a.box([-2.49,13.10,-2.49],[2.49,13.168,2.49],9);
 // Four instrumentally visible architectural bays per facing; joined closed solid posts/rails.
 for(let s=0;s<4;s++){
  const on=(t:number,y:number,inset=0):P=>add(add([0,y,0],mul(sideNs[s],2.407-inset)),mul(sideUs[s],t));
  const A=2.407,stride=A/2;
  for(let i=0;i<4;i++){
   const L=-A+i*stride,R=L+stride, y0=13.23,y1=13.992;
   if(i===0)a.beam(on(L,13.146),on(L,14.038),.112,.108,1);
   if(i<3)a.beam(on(R,13.144),on(R,14.038),.081,.087,1,.92+shade(i,s)*.10);
   a.beam(on(L,y0),on(R,y0),.076,.091,1);
   a.beam(on(L,y1),on(R,y1),.077,.099,1,1.04);
   a.beam(on(L+.045,y0+.025,.015),on(R-.045,y1-.024,.015),.069,.042,1,.89+.16*shade(i,s+3));
   a.beam(on(L+.045,y1-.025,-.014),on(R-.045,y0+.024,-.014),.069,.042,1,.89+.15*shade(i+4,s));
  }
 }
 a.box([-1.087,13.165,-1.087],[1.087,13.68,1.087],1,.945);
 const N=8,at=(r:number,y:number,j:number):P=>[r*Math.cos((j+.5)*2*Math.PI/N),y,r*Math.sin((j+.5)*2*Math.PI/N)];
 const ring=(y:number,Y:number,r:number,R:number,k:R)=>{
  for(let j=0;j<N;j++){const b=(j+1)%N;const A=at(r,y,j),B=at(r,y,b),C=at(R,Y,b),D=at(R,Y,j);
   a.quad(A,B,C,D,k,[A[0]+B[0],Y===y?1:.06,A[2]+B[2]]);
  }
 };
 ring(13.622,13.797,1.267,1.234,2);
 for(let j=0;j<N;j++)a.tri([0,13.622,0],at(1.267,13.622,j),at(1.267,13.622,(j+1)%N),2,[0,-1,0]);
 ring(15.013,15.110,1.234,1.298,2);
 for(let j=0;j<N;j++){
  const b=(j+1)%N,p=at(1.234,13.78,j),q=at(1.234,13.78,b),v=at(1.234,15.049,b),w=at(1.234,15.049,j);
  const n=unit([p[0]+q[0],0,p[2]+q[2]]),d=mul(n,-.036);
  a.quad(add(p,d),add(q,d),add(v,d),add(w,d),4,n,[[0,0],[1,0],[1,1],[0,1]]);
  a.beam(p,w,.055,.066,2);
  a.beam(p,q,.047,.066,2);
  a.beam(v,w,.068,.073,2);
 }
 ring(15.085,15.143,1.327,1.392,2);
 ring(15.143,15.25,1.392,1.10,2);
 ring(15.25,15.413,1.10,.65,2);
 ring(15.413,15.532,.65,.27,2);
 ring(15.532,15.641,.27,.099,2);
 const sphere=new T.SphereGeometry(.188,12,8).toNonIndexed(),p=sphere.getAttribute('position'),roundNormal=sphere.getAttribute('normal');
 for(let i=0;i<p.count;i+=3){
  const t=[i,i+1,i+2],N=t.map(j=>[roundNormal.getX(j),roundNormal.getY(j),roundNormal.getZ(j)] as P);
  const q=t.map(j=>[p.getX(j),p.getY(j)+15.78,p.getZ(j)] as P);
  a.tri(q[0],q[1],q[2],2,N[1],undefined,N);
 }
 sphere.dispose();
 a.beam([0,15.53,0],[0,16.46,0],.037,.037,2);
 a.beam([-.431,16.294,0],[.483,16.294,0],.032,.04,7);
 a.tri([.483,16.294,0],[.267,16.381,0],[.267,16.209,0],7,[0,0,1]);
 a.tri([-.262,16.294,0],[-.443,16.363,0],[-.431,16.211,0],7,[0,0,1]);
 // Reverse faces for thin vane sheet; no occupied duplicate coplanar front faces in FrontSide.
 a.tri([.483,16.294,0],[.267,16.381,0],[.267,16.209,0],7,[0,0,-1]);
 a.tri([-.262,16.294,0],[-.443,16.363,0],[-.431,16.211,0],7,[0,0,-1]);
}

export function makeWoodIslandsDetached(){
 const a=new Art();shell(a);cupola(a);const geometry=a.geometry(),material=woodMaterial();
 const mesh=new T.Mesh(geometry,material);mesh.name='Wood Islands Light, detached observed exterior study';
 mesh.castShadow=false;mesh.receiveShadow=false;
 let done=false;
 return {mesh,geometry,material,apertures:Object.freeze(a.apertures),dimensions:K,dispose(){
  if(done)return;done=true;mesh.removeFromParent();geometry.dispose();material.dispose();
 }};
}
/** Preview-only matte studio land. Not part of the landmark asset and not mapped. */
export function woodStudioGround(){
 const a=new Art(),d=510;
 a.quad([-d,-.007,-d],[-d,-.007,d],[d,-.007,d],[d,-.007,-d],11,UP);
 return a.geometry();
}
