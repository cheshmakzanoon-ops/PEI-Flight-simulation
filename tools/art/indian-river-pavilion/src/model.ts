import * as T from 'three';
import {Batch,beam,cuboid,p,rect,type XY} from './geometry.ts';
import type {P} from './frame.ts';
import {DATUM} from './frame.ts';
import {CUT,PLAN,plane,roofHeight,emitRoof,thickness,roofParts} from './roof.ts';
import {pavilionMaterials,type Materials,type Layer} from './materials.ts';
import {STOCK} from './stock.generated.ts';

export type Quality='hero'|'flight';
const labels:Layer[]=['roof','cedar','trim','reveal','foundation','deck','wood','steel','interior','glass'];
type B=Record<Layer,Batch>;
type Dir='north'|'east'|'south'|'west';
type Opening={a:number,b:number,lo:number,hi:number,mode:'door'|'sash'|'awning'|'upper'};
const H=23.361,Sill=H+.031;
const W=-5.942,E=6.083,S=-5.846,N=6.061;
const [cu,cv]=CUT;
// The elevated clerestory wall is a narrow measured-roof-eave inset.
const UI=cu+.048,VI=cv+.048;
const col=(k:number):readonly [number,number,number]=>[k,k*.995,k*.983];
const pside=(side:Dir,f:number,u:number,y:number):P=>side==='north'||side==='south'?p(u,y,f):p(f,y,u);
const normal=(s:Dir):P=>s==='north'?p(0,0,1):s==='east'?p(1,0,0):s==='south'?p(0,0,-1):p(-1,0,0);
const sign=(s:Dir)=>s==='north'||s==='east'?1:-1;
type Face = {side:Dir; f:number; start:number; end:number; low:number; high:(t:number)=>number; open:Opening[]};
const wallThickness=.177;
function rectangle(b:B,role:Layer,s:Dir,f0:number,f1:number,t0:number,t1:number,h0:number,h1:number,shade=1){
 if(!(t1>t0&&h1>h0&&Math.abs(f1-f0)>.000002))return;
 if(s==='north'||s==='south')cuboid(b[role],t0,t1,h0,h1,Math.min(f0,f1),Math.max(f0,f1),col(shade));
 else cuboid(b[role],Math.min(f0,f1),Math.max(f0,f1),h0,h1,t0,t1,col(shade));
}
function face(b:B,fac:Face,hero:boolean,wall:Layer='cedar'){
 const {side:s,f,start,end,low,high,open}=fac;
 const out=normal(s),k=sign(s),inward=f-k*wallThickness;
 const ring=[[start,low],[end,low],[end,high(end)],[start,high(start)]] as XY[];
 const holes=open.map(o=>rect(o.a,o.b,o.lo,o.hi));
 for(const [depth,role,dir] of [[f,wall,out],[inward,'interior',p(-out[0],0,-out[2])]] as const){
  const to=(q:XY)=>pside(s,depth,q[0],q[1]);
  b[role].poly(ring.map(to),dir,ring,col(.995),holes,ring,to);
 }
 for(const o of open){
  const {a,b:hi}=o;
  const lower=o.lo,upper=o.hi;
  const n0:P=s==='north'||s==='south'?p(1,0,0):p(0,0,1);
  const n1:P=p(-n0[0],0,-n0[2]);
  for(const [q,r,dir] of [[[a,lower],[a,upper],n0],[[hi,upper],[hi,lower],n1],
    [[a,upper],[hi,upper],p(0,-1,0)],[[hi,lower],[a,lower],p(0,1,0)]] as const){
    const v=(depth:number,point:readonly [number,number])=>pside(s,depth,point[0],point[1]);
    b.reveal.poly([v(f,q),v(f,r),v(inward,r),v(inward,q)],dir);
  }
  if(o.mode==='awning'&&hero)awn(b,s,f,o);
  else glazing(b,s,f,o,hero);
 }
}
function glazing(b:B,s:Dir,f:number,o:Opening,hero:boolean){
 const k=sign(s),d=f-.071*k;
 const wide=o.mode==='door'?.105:o.mode==='upper'?.063:.069;
 const depth=(o.mode==='door'?-.101:-.093)*k;
 const set=(role:Layer,t0:number,t1:number,h0:number,h1:number,w=1)=>rectangle(b,role,s,f+k*.022+k*(w-1)*.025,f+depth,t0,t1,h0,h1,w);
 // Overscan the opening only with the casings, never with the glass itself.
 set('trim',o.a-.039,o.a+wide,o.lo-.036,o.hi+.043);
 set('trim',o.b-wide,o.b+.037,o.lo-.036,o.hi+.043);
 set('trim',o.a+wide,o.b-wide,o.lo-.037,o.lo+wide);
 set('trim',o.a+wide,o.b-wide,o.hi-wide,o.hi+.044);
 const left=o.a+wide,right=o.b-wide,bot=o.lo+wide,top=o.hi-wide;
 const y0=bot+.004,y1=top-.003;
 const na=normal(s);
 b.glass.poly([pside(s,d,left,y0),pside(s,d,right,y0),pside(s,d,right,y1),pside(s,d,left,y1)],na,
   [[left,y0],[right,y0],[right,y1],[left,y1]],col(o.mode==='upper'?.96:.93));
 if(o.mode==='door'){
  for(let i=1;i<=3;i++){
   const s0=bot+(top-bot)*i/4;
   rectangle(b,'trim',s,d+k*.019,d-k*.011,left,right,s0-.027,s0+.027,.97);
  }
  if(hero){
   rectangle(b,'reveal',s,d+k*.027,d+k*.009,right-.15,right-.075,bot+.41,bot+.437,.64);
   rectangle(b,'wood',s,d-k*.083,d-k*.115,left-.015,left+.031,bot-.009,top+.013,.81);
  }
 }else if(o.mode==='sash'){
  const dY=o.lo+.64*(o.hi-o.lo);
  rectangle(b,'trim',s,d+k*.034,d-k*.021,left,right,dY-.026,dY+.030,.94);
 }
 if(hero&&o.mode==='upper'){
  for(const t of [left,right])for(const v of [bot,top])rectangle(b,'reveal',s,d+k*.009,d-k*.003,t-.005,t+.008,v-.011,v+.007,.83);
 }
}
function awn(b:B,s:Dir,f:number,o:Opening){
 // Dated rear photos show high top-hung awning units. Model them closed with
 // a shadowed interior rebate, not unmeasured hardware/open angle or routes.
 glazing(b,s,f,o,true);
 const k=sign(s),d=f+.029*k;
 rectangle(b,'trim',s,d,d+.045*k,o.a-.066,o.b+.066,o.lo-.025,o.lo+.010,.91);
 rectangle(b,'reveal',s,d,d+.017*k,o.a+.028,o.b-.029,o.hi+.019,o.hi+.032,.78);
}
const win=(a:number,b:number,lo:number,hi:number,mode:Opening['mode']):Opening=>({a,b,lo,hi,mode});
function reducedFace(b:B,s:Dir,f:number,length:readonly [number,number],list:Opening[],hero:boolean){
 const to=(t:number)=>pside(s,f,t,26.15);
 return face(b,{side:s,f,start:length[0],end:length[1],low:H-.005,
  high:t=>plane(0,to(t)[0],to(t)[2])-thickness+.004,open:list},hero);
}
function spaced(st:number,en:number,n:number,lo:number,hi:number,pad:number,mode:Opening['mode']){
 const w=(en-st)/n;
 return Array.from({length:n},(_,i)=>win(st+i*w+pad,st+(i+1)*w-pad,lo,hi,mode));
}
function lateral(b:B,hero:boolean){
 const broad=[win(-5.74,-4.37,H+.56,25.83,'sash'),win(-4.02,-2.69,H+.56,25.83,'sash')];
 const door=spaced(-2.49,5.92,3,Sill,25.80,.143,'door');
 reducedFace(b,'south',S,[W,E],[...broad,...door],hero);
 reducedFace(b,'west',W,[S,N],[...broad,...door],hero);
 reducedFace(b,'north',N,[W,E],[
  win(-5.73,-4.40,H+.57,25.77,'sash'),win(-4.03,-2.75,H+.57,25.77,'sash'),
  ...spaced(-2.42,3.08,4,25.18,25.79,.072,'awning')
 ],hero);
 reducedFace(b,'east',E,[S,N],[
  win(-5.59,-4.28,H+.57,25.77,'sash'),win(-3.95,-2.62,H+.57,25.77,'sash'),
  ...spaced(-2.32,3.26,4,25.18,25.79,.072,'awning')
 ],hero);
 for(const c of [[W,N],[W,S],[E,N],[E,S]]){
  const [x,z]=c,lo=H-.03,high=plane(0,x,z)-thickness;
  cuboid(b.trim,x-.035,x+.035,lo,high,z-.035,z+.035,col(.974));
 }
 // The projected upper outline has a true two-sided glass lantern. Each upper
 // panel is explicitly seated below its own plane; no faux painted windows.
 const glowLo=26.193,glowHi=27.826,pad=.052;
 face(b,{side:'south',f:VI,start:UI,end:E,low:plane(0,0,VI)-.058,
  high:t=>roofHeight(t,VI)-thickness+.008,
  open:spaced(UI+.11,E-.09,6,glowLo,glowHi,pad,'upper')},hero,'trim');
 face(b,{side:'west',f:UI,start:VI,end:N,low:plane(0,UI,0)-.058,
  high:t=>roofHeight(UI,t)-thickness+.008,
  open:spaced(VI+.105,N-.084,6,glowLo,glowHi,.056,'upper')},hero,'trim');
 // Inset diagonal upper walls intersect the exact lower walls (2cm join band),
 // not both on the same coplanar bearing. Keep their high edge under the
 // measured roof plane; split at the true diagonal for an opaque tight seat.
 const attach=(side:'east'|'north',f:number,start:number,end:number)=>{
  const map=(x:number)=>pside(side,f,x,0);
  const elevation=(x:number)=>{const p=map(x);return roofHeight(p[0],p[2]);};
  const me=(x:number,role:number)=>{const q=map(x);return plane(role,q[0],q[2]);};
  const d0=me(start,1)-me(start,2),d1=me(end,1)-me(end,2);
  const xs=[start,...(d0*d1<0?[start+(end-start)*d0/(d0-d1)]:[]),end];
  const ground=plane(0,0,0)-thickness-.021;
  for(let i=0;i+1<xs.length;i++)face(b,{side,f,start:xs[i],end:xs[i+1],low:ground,
   high:t=>Math.max(elevation(t)-thickness+.004,ground+.008),open:[]},hero,'cedar');
 };
 attach('east',E-.007,VI,N);
 attach('north',N-.007,UI,E);
 // Only a low opaque rim is authored. It is not a solid plinth or
 // evidence about soil beneath the timber deck or the permanent foundation.
 for(const [x0,x1,z0,z1] of [[W+.010,E-.010,S+.009,S+.074],[W+.010,E-.010,N-.072,N-.009],
  [W+.011,W+.069,S+.075,N-.073],[E-.068,E-.011,S+.075,N-.073]]){
  cuboid(b.foundation,x0,x1,H-.163,H-.009,z0,z1,col(.88));
 }
 const floor=rect(W+.015,E-.015,S+.013,N-.013);
 b.interior.poly(floor.map(([x,z])=>p(x,H+.004,z)),p(0,1,0),floor,col(.875));
}
export const steps=[
  [-9.52,22.785],[-9.24,22.928],[-8.96,23.069],[-8.68,23.207],[-8.27,H],
 ] as const;
function deck(b:B,hero:boolean){
 // One watertight stepped envelope. Each tread/riser/outer return is emitted
 // just once, not a stack of coplanar intersecting boxes.
 const x1=E+.055,v1=N+.047,base=22.625;
 const plate=(r:XY[],y:number,color:number,rotate=false)=>b.deck.poly(r.map(([u,v])=>p(u,y,v)),p(0,1,0),
   r.map(([u,v])=>rotate?[v,u]:[u,v]),col(color));
 const edge=(a:XY,c:XY,low:number,high:number,dir:P,k:number)=>{
  if(high<=low||Math.hypot(a[0]-c[0],a[1]-c[1])<1e-6)return;
  b.deck.poly([p(a[0],low,a[1]),p(c[0],low,c[1]),p(c[0],high,c[1]),p(a[0],high,a[1])],dir,undefined,col(k));
 };
 for(const [i,[t,y]] of steps.entries()){
  const next=steps[i+1]?.[0];const previous=i>0?steps[i-1][1]:base;
  const shade=.968+i*.006;
  // The rear wall is attached to the top stage surface, but no invented
  // rear stairs wrap beyond the two accepted approach corridors.
  if(next!==undefined){
   plate(rect(t,x1,t,next),y,shade);
   plate(rect(t,next,next,v1),y,shade-.006,true);
   const bottom=i===0?base:Math.max(base,y-.14);
   edge([x1,t],[x1,next],bottom,y,p(1,0,0),.86);
   edge([t,v1],[next,v1],bottom,y,p(0,0,1),.87);
  }else{
   plate(rect(t,x1,t,v1),y,shade);
   edge([x1,t],[x1,v1],y-.158,y,p(1,0,0),.84);
   edge([t,v1],[x1,v1],y-.158,y,p(0,0,1),.84);
  }
  edge([t,t],[x1,t],previous,y,p(0,0,-1),.865+i*.014);
  edge([t,t],[t,v1],previous,y,p(-1,0,0),.87+i*.014);
  if(hero){
   // Tiny dark underside accent on an embedded board nosing. Insets avoid
   // double coplanar coverage at the common mitred corner.
   cuboid(b.deck,t-.018,x1-.001,y-.032,y-.009,t-.013,t+.008,col(.87));
   cuboid(b.deck,t-.013,t+.008,y-.032,y-.009,t+.009,v1-.002,col(.89));
  }
 }
 // Local platform underside only, kept distinct from soil and the first
 // tread toe. No assumed number of hidden piers or inferred earth plug.
 const rr=rect(steps[4][0],x1,steps[4][0],v1);
 b.deck.poly(rr.map(([u,v])=>p(u,H-.158,v)),p(0,-1,0),rr,col(.68));
}
function structure(b:B,hero:boolean){
 const A=plane(0,0,0)-thickness;
 const column=(u:number,v:number,y:number,t=.13)=>cuboid(b.trim,u-t/2,u+t/2,H+.012,y,v-t/2,v+t/2,col(.89));
 const pts=[[W+.16,S+.15],[W+.18,N-.17],[E-.15,N-.15],[E-.16,S+.16]];
 for(const [i,[u,v]] of pts.entries())column(u,v,A-.002,.165);
 for(const [u,v] of [[-2.48,-2.57],[-2.70,2.67],[2.80,-2.78]]){
  column(u,v,roofHeight(u,v)-thickness-.11,.163);
 }
 for(const [u,v] of [[W+.09,-2.45],[W+.09,.51],[W+.09,3.23],[-2.37,S+.09],[.49,S+.09],[3.27,S+.09]])column(u,v,A,.119);
 const diagonal=roofParts().find(r=>r.role===1)!.ring.filter(([u,v])=>Math.abs(plane(1,u,v)-plane(2,u,v))<1e-6);
 if(diagonal.length===2){
  const [a,c]=diagonal.sort((a,b)=>a[0]-b[0]),alpha=.062;
  const beta=Math.min((E-wallThickness-.096-a[0])/(c[0]-a[0]),(N-wallThickness-.096-a[1])/(c[1]-a[1]));
  const t=(t:number)=>[a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t] as XY;
  const x=t(alpha),y=t(beta);
  const q=([u,v]:XY)=>p(u,roofHeight(u+1e-8,v+1e-8)-thickness-.143,v);
  beam(b.steel,q(x),q(y),.163,.245,p(0,1,0),col(.82));
 }
 // The roof is sheathed by geometry, then actual beam faces below. Repeated
 // glulam is original modelling of the documented structural family.
 for(const {role,ring} of roofParts()){
  const transverse=ring.map(([u,v])=>role===2?u:v),lo=Math.min(...transverse),hi=Math.max(...transverse);
  const step=hero?.69:1.31, inset=.118;
  for(let c=Math.ceil((lo+.18)/step)*step;c<=hi-.14;c+=step){
   const hit:number[]=[];
   for(let i=0;i<ring.length;i++){
    const j=(i+1)%ring.length,a=transverse[i],e=transverse[j];
    if((a<c)!==(e<c)){
     const f=(c-a)/(e-a),k=role===2?1:0;hit.push(ring[i][k]+(ring[j][k]-ring[i][k])*f);
    }
   }
   if(hit.length!==2)continue;
   hit.sort((x,y)=>x-y);
   const side=role===2?[W,E]:[S,N];
   if(c<side[0]+.06||c>side[1]-.06)continue;
   const a=Math.max(hit[0]+inset,(role===2?S:W)+.062),z=Math.min(hit[1]-inset,(role===2?N:E)-.062);
   if(z-a<.34)continue;
   const at=(a:number)=> {
    const u=role===2?c:a,v=role===2?a:c;return p(u,plane(role,u,v)-thickness-(role===0?.082:.111),v);
   };
   beam(b.wood,at(a),at(z),role===0?.086:.115,role===0?.159:.215,p(0,1,0),col(.99));
  }
 }
}
export function buildPavilion(quality:Quality,mats=pavilionMaterials(quality==='hero')){
 const geo=Object.fromEntries(labels.map(k=>[k,new Batch()])) as B;
 const hero=quality==='hero';
 emitRoof(geo.roof,geo.wood,geo.trim);
 lateral(geo,hero);deck(geo,hero);structure(geo,hero);
 const group=new T.Group();group.name='Indian River Pavilion - detached';
 group.userData.seating={
  phase:'detached only; soil-contact qualification not approved',
  studioFloorCGVD2013:H+.004,deckTopCGVD2013:H,
  platformUndersideCGVD2013:H-.158,
  lowestAuthoredTread:{nearToeLocal:-9.52,topCGVD2013:22.785,nominalBottomCGVD2013:22.625},
  permanentFoundationAndUnderdeckSupports:'not surveyed or assigned'
 };
 for(const role of labels){
  const g=geo[role].finish();if(!g)continue;
  const m=new T.Mesh(g,mats[role]);
  m.name='Pavilion '+role;m.userData.role=role;
  m.castShadow=role!=='glass';m.receiveShadow=true;
  if(role==='glass')m.renderOrder=2;
  if(role==='roof')m.renderOrder=1;
  group.add(m);
 }
 return group;
}
/** Exact existing q301 triangle positions recovered read-only from Buildings.generate. */
export function stockShell(){
 const g=new T.BufferGeometry(),positions:number[]=[],colors:number[]=[];
 for(const k of STOCK){positions.push(k[0],k[1]-DATUM,-k[2]);colors.push(k[3],k[4],k[5]);}
 g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
 g.computeVertexNormals();const m=new T.Mesh(g,new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.96}));
 m.castShadow=m.receiveShadow=true;const group=new T.Group();group.name='Original q03230/301 game triangles; neutral light';group.add(m);return group;
}
