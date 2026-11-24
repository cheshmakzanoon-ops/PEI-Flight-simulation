import * as T from 'three';
import {Batch,box,point,rect,roofFacet,toVec} from './geometry.ts';
import {ANNEX_E,ANNEX_W,DATUM,NAVE_E,NAVE_W,OWNER,TOWER_CAP,plane,type Plane,type Pt,type UV} from './survey.ts';
import {material,roles,type Role} from './materials.ts';

type RGB=readonly [number,number,number];
const WHITE:RGB=[1,1,1];
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const plinth=7.15,siding=7.77;
const naveHeight=(u:number,v:number)=>Math.min(plane(NAVE_W,u,v),plane(NAVE_E,u,v));
const sideRoof:[number,number,number,number]=[-5.21,5.47,-13.39,3.40];
const CapPlanes:Plane[]=(()=>{
 const [u,v,r,k,g]=TOWER_CAP;
 return [[k,0,r-k*u],[-k,0,r+k*u],[0,g,r-g*v],[0,-g,r+g*v]];
})();
const capH=(u:number,v:number)=>Math.min(...CapPlanes.map(p=>plane(p,u,v)));
const annexHeight=(u:number,v:number)=>Math.min(plane(ANNEX_W,u,v),plane(ANNEX_E,u,v));
const tEdge:UV[]=rect(-1.94,1.80,2.78,6.76);
const annexSide:UV[]=rect(-1.82,1.85,-17.11,-12.66);

/** Metric face parameter with the same hard wall line at every roof/detail LOD. */
class Run {
 readonly a:UV;readonly b:UV;readonly ux:number;readonly vz:number;
 readonly du:number;readonly dv:number;readonly len:number;
 constructor(a:UV,b:UV){this.a=a;this.b=b;this.len=Math.hypot(b[0]-a[0],b[1]-a[1]);
  this.ux=(b[0]-a[0])/this.len;this.vz=(b[1]-a[1])/this.len;
  this.du=-this.vz;this.dv=this.ux;
 }
 get normal():Pt{return [this.du,0,this.dv]}
 at(s:number,y:number,extrusion=0):Pt{return [this.a[0]+s*this.ux+this.du*extrusion,y,this.a[1]+s*this.vz+this.dv*extrusion]}
 face(b:Batch,shape:UV[],z=0,holes:UV[][]=[],tone:RGB=WHITE){
  b.poly(shape.map(([s,y])=>this.at(s,y,z)),this.normal,{xy:shape,uv:shape,holes,map:([s,y])=>this.at(s,y,z),tone});
 }
 prism(b:Batch,shape:UV[],top:number,bottom:number,tone:RGB=WHITE){
  this.face(b,shape,top,[],tone);
  for(let i=0;i<shape.length;i++){
   const x=shape[i],q=shape[(i+1)%shape.length];
   for(const seq of [[this.at(...q,top),this.at(...x,top),this.at(...x,bottom),this.at(...q,bottom)]]){
    const m=(x[0]+q[0])*.5,n=(x[1]+q[1])*.5;
    const ds=q[0]-x[0],dh=q[1]-x[1],depth=Math.hypot(ds,dh);
    const cc=shape.reduce((h,p)=>[h[0]+p[0]/shape.length,h[1]+p[1]/shape.length], [0,0]);
    let dx=-dh/depth,dy=ds/depth;
    if((m-cc[0])*dx+(n-cc[1])*dy<0){dx=-dx;dy=-dy;}
    if(depth>.00001)b.poly(seq,[this.ux*dx,dy,this.vz*dx],{tone});
   }
  }
 }
 surround(b:Batch,outer:UV[],inner:UV[],front:number,back:number,tone:RGB=WHITE){
  // Physically connected rake bevels, not an alpha ring. Adjacent loops share the same endpoints.
  const k=outer.length;
  for(let i=0;i<k;i++){
   const j=(i+1)%k;
   const q=[this.at(...outer[i],front),this.at(...outer[j],front),this.at(...inner[j],back),this.at(...inner[i],back)];
   const n=toVec(q[1]).sub(toVec(q[0])).cross(toVec(q[2]).sub(toVec(q[0])));
   if(n.lengthSq()<1e-14)continue;
   const out=new T.Vector3(this.du,.03,-this.dv);
   if(n.dot(out)<0)n.negate();n.normalize();b.poly(q,[n.x,n.y,-n.z],{tone});
  }
 }
 /** Sleeve points normals into the actual masonry/wood cut, so a grazing ray cannot escape past a liner. */
 returning(b:Batch,cut:UV[],inner:number,depth:number){
  const cen=cut.reduce((r,p)=>[r[0]+p[0]/cut.length,r[1]+p[1]/cut.length],[0,0]);
  for(let k=0;k<cut.length;k++){
   const A=cut[k],C=cut[(k+1)%cut.length],ds=C[0]-A[0],dy=C[1]-A[1],len=Math.hypot(ds,dy);
   if(len<1e-7)continue;
   let a=-dy/len,c=ds/len;
   if(a*(cen[0]-A[0])+c*(cen[1]-A[1])<0){a=-a;c=-c;}
   b.poly([this.at(...A,inner),this.at(...C,inner),this.at(...C,depth),this.at(...A,depth)],[this.ux*a,c,this.vz*a],{tone:[.75,.74,.70]});
  }
 }
 straight(b:Batch,a:UV,c:UV,width:number,front:number,back=front-.019,tone:RGB=WHITE){
  const dx=c[0]-a[0],dy=c[1]-a[1],d=Math.hypot(dx,dy),x=-dy*width/(2*d),y=dx*width/(2*d);
  if(d>1e-5)this.prism(b,[[a[0]+x,a[1]+y],[c[0]+x,c[1]+y],[c[0]-x,c[1]-y],[a[0]-x,a[1]-y]],front,back,tone);
 }
}

function clip(poly:UV[],p:Plane):UV[]{
 const out:UV[]=[];let a=poly.at(-1)!,z=plane(p,...a);
 for(const b of poly){
  const y=plane(p,...b),keep=y<=1e-10;
  if((z<=1e-10)!==keep){const t=z/(z-y);out.push([lerp(a[0],b[0],t),lerp(a[1],b[1],t)])}
  if(keep)out.push(b);a=b;z=y;
 }
 return out;
}
function exactTop(poly:UV[],planes:Plane[],batch:Batch){
 for(const p of planes){let pts=poly.slice();
  for(const q of planes){if(p===q)continue;pts=clip(pts,[p[0]-q[0],p[1]-q[1],p[2]-q[2]]);if(pts.length<3)break;}
  if(pts.length>=3)roofFacet(batch,pts.map(d=>point(d[0],plane(p,...d),d[1])));
 }
}
function splits(poly:UV[],planes:Plane[]):UV[]{
 return poly.flatMap((v,i)=>{const t=poly[(i+1)%poly.length],sub:number[]=[];
  for(let a=0;a<planes.length;a++) for(let b=a+1;b<planes.length;b++){
   const x=plane(planes[a],...v)-plane(planes[b],...v),y=plane(planes[a],...t)-plane(planes[b],...t);
   const f=x/(x-y);if(f>1e-6&&f<.999999)sub.push(f);
  }
  return [v,...sub.sort((a,b)=>a-b).filter((x,j,q)=>!j||x-q[j-1]>1e-6).map((s):UV=>[lerp(v[0],t[0],s),lerp(v[1],t[1],s)])];
 });
}
const roofAt=(u:number,v:number,h:(u:number,v:number)=>number,off=0):Pt=>[u,h(u,v)+off,v];
function fascia(poly:UV[],planes:Plane[],b:Record<Role,Batch>,frontLow=-.158){
 const pts=splits(poly,planes),h=(u:number,v:number)=>Math.min(...planes.map(p=>plane(p,u,v)));
 const center:UV=poly.reduce((x,y)=>[x[0]+y[0]/poly.length,x[1]+y[1]/poly.length],[0,0]);
 for(let i=0;i<pts.length;i++){
  const a=pts[i],d=pts[(i+1)%pts.length],du=d[0]-a[0],dz=d[1]-a[1],l=Math.hypot(du,dz);
  if(l<1e-6)continue;
  let out:Pt=[dz/l,0,-du/l];if((a[0]-center[0])*out[0]+(a[1]-center[1])*out[2]<0)out=[-out[0],0,-out[2]];
  const [nr,r]=[roofAt(...a,h),roofAt(...d,h)],toward=(x:Pt,t:number):Pt=>[x[0]-out[0]*t,x[1],x[2]-out[2]*t];
  const dp=(p:Pt,y:number):Pt=>[p[0],p[1]+y,p[2]];
  b.fascia.poly([nr,r,dp(r,-.043),dp(nr,-.043)],out);
  b.trim.poly([dp(nr,-.043),dp(r,-.043),dp(r,frontLow),dp(nr,frontLow)],out,{tone:[.81,.81,.78]});
  // Bottom closure spans the observed overhang into the cut gable so grazing views cannot see daylight.
  const c=dp(r,frontLow),e=dp(nr,frontLow);
  b.shadow.poly([e,c,toward(c,.78),toward(e,.78)],[0,-1,0],{tone:[.82,.82,.80]});
  const ap=toward(dp(nr,frontLow+.021),.032),bp=toward(dp(r,frontLow+.021),.032);
  b.trim.poly([ap,bp,dp(bp,-.045),dp(ap,-.045)],out,{tone:[.69,.67,.61]});
 }
}
function prof(cx:number,base:number,spring:number,top:number,r:number,quality=9):UV[]{
 const rise=top-spring,a=(r*r+rise*rise)/(2*r);
 const side=(j:number)=>r-a+Math.sqrt(Math.max(0,a*a-(j/quality*rise)**2));
 const p:UV[]=[[cx-r,base],[cx+r,base],[cx+r,spring]];
 for(let j=1;j<=quality;j++)p.push([cx+side(j),spring+rise*j/quality]);
 for(let j=quality-1;j>=0;j--)p.push([cx-side(j),spring+rise*j/quality]);
 return p;
}
type Feature={kind:'arch'|'door'|'louver'|'ordinary',mid:number,bottom:number,top:number,width:number,crest?:number,pane?:boolean};
const profile=(q:Feature,d=0):UV[]=> q.kind==='arch'?prof(q.mid,q.bottom-d,(q.crest??(q.top-.8)),q.top+d,q.width/2+d):rect(q.mid-q.width/2-d,q.mid+q.width/2+d,q.bottom-d,q.top+d);
function glazing(f:Run,x:Feature,b:Record<Role,Batch>){
 const p=profile(x),opening=profile(x,.011),m=x.mid,y0=x.bottom,y1=x.top,r=x.width/2;
 f.face(b.shadow,profile(x,.095),-.218,[],[.78,.78,.77]);
 f.returning(b.shadow,p,-.009,-.219);
 f.surround(b.trim,profile(x,.091),opening,.033,.010,[.88,.86,.80]);
 f.surround(b.fascia,opening,p,.011,-.102,[.82,.82,.78]);
 f.surround(b.wood,p,profile(x,-.033),-.102,-.140);
 const age=(Math.sin(f.a[0]*25.336+x.mid*6.835)+1)*.5;
 f.face(b.glass,profile(x,-.028),-.149,[],[.88+.12*age,.91+.08*age,.93+.05*age]);
 f.prism(b.trim,rect(m-r-.110,m+r+.12,y0-.076,y0-.012),.102,-.003,[.92,.90,.83]);
 f.prism(b.shadow,rect(m-r-.062,m+r+.075,y0-.104,y0-.078),.067,.003,[.83,.80,.75]);
 if(x.kind==='arch'){
  const sp=x.crest??(y1-.8),e=r*.49,bar=x.pane?.048:.038;
  f.straight(b.wood,[m,y0+.022],[m,sp+.05],bar,-.092);
  [y0+.33,y0+.9,y0+1.48,sp-.16].filter(v=>v<sp-.10).forEach((v)=>f.straight(b.wood,[m-r+.04,v],[m+r-.04,v],.031,-.094));
  f.straight(b.trim,[m,sp+.28],[m-e,sp-.015],.039,-.086);f.straight(b.trim,[m,sp+.28],[m+e,sp-.015],.039,-.086);
  f.straight(b.wood,[m,sp+.28],[m,y1-.057],.038,-.084);
  // Three modest old coloured lights, confined to the upper tracery and solid liner.
  f.face(b.tealGlass,[[m-r*.57,sp+.080],[m-.036,sp+.237],[m-.036,sp+.435],[m-r*.53,sp+.30]],-.140);
  f.face(b.blueGlass,[[m+.036,sp+.217],[m+r*.57,sp+.067],[m+r*.51,sp+.30],[m+.036,sp+.456]],-.140);
  if(y1-sp>.49)f.face(b.roseGlass,[[m-.054,sp+.463],[m+.05,sp+.463],[m+.019,y1-.098],[m-.018,y1-.098]],-.140);
 }else{
  f.straight(b.trim,[m,y0+.022],[m,y1-.024],.041,-.072);f.straight(b.trim,[m-r+.028,(y0+y1)/2],[m+r-.028,(y0+y1)/2],.037,-.073);
 }
}
function door(f:Run,x:Feature,b:Record<Role,Batch>){
 const m=x.mid,w=x.width*.5,y=x.bottom,h=x.top;
 f.face(b.shadow,profile(x,.093),-.218);
 f.returning(b.shadow,profile(x),-.011,-.219);
 f.surround(b.trim,profile(x,.077),profile(x),.046,-.043,[.92,.90,.84]);
 f.surround(b.shadow,profile(x),profile(x,-.035),-.043,-.123);
 f.face(b.wood,profile(x,-.039),-.146);
 for(const xx of [m-w*.89,m+w*.89,m-w*.025,m+w*.025])f.prism(b.trim,rect(xx-.028,xx+.029,y+.03,h-.026),-.113,-.149);
 for(const yy of [y+.19,y+.76,y+1.21,h-.116])f.prism(b.trim,rect(m-w+.04,m+w-.04,yy-.027,yy+.028),-.090,-.149,[.83,.82,.77]);
 f.prism(b.stone,rect(m-w-.046,m+w+.046,y-.100,y+.008),.082,-.10);
 f.prism(b.metal,rect(m+w*.53,m+w*.58,y+.91,y+.982),-.076,-.155);
}
function louver(f:Run,x:Feature,b:Record<Role,Batch>){
 const m=x.mid,r=x.width/2,y=x.bottom,h=x.top;
 f.face(b.shadow,profile(x,.102),-.206);
 f.returning(b.shadow,profile(x),-.010,-.207);
 f.surround(b.trim,profile(x,.068),profile(x),.019,-.04,[.87,.85,.83]);
 for(let i=0;i<7;i++){
  const z=lerp(y+.044,h-.044,i/6),s=.046;
  const a=f.at(m-r+.024,z-s*.5,-.106),c=f.at(m+r-.024,z-s*.5,-.106),d=f.at(m+r-.024,z+s*.5,-.158),e=f.at(m-r+.024,z+s*.5,-.158);
  b.wood.poly([a,c,d,e],[f.du,.36,f.dv],{tone:[.69,.69,.65]});
  f.prism(b.shadow,rect(m-r+.024,m+r-.024,z-.024,z-.019),-.106,-.164);
 }
}
/** Retessellate only the original front entrance tower plane. A paired
 * horizontal-node sweep retains the exact opening silhouettes and avoids a
 * long, needle-like triangle fan between the separated Gothic and louvre cuts.
 * Both bands incident to a row use all of its knots (no T joins at an opening). */
function entrancePanel(f:Run,b:Batch,wall:UV[],holes:UV[][],breaks:number[]){
 const loops=[wall,...holes];
 const edges=loops.flatMap(q=>q.map((a,i)=>[a,q[(i+1)%q.length]] as const));
 const X=(edge:typeof edges[number],y:number)=>{
  const [a,c]=edge;
  if(y===a[1])return a[0];if(y===c[1])return c[0];
  return a[0]+(c[0]-a[0])*(y-a[1])/(c[1]-a[1]);
 };
 const distinct=(a:number[])=>a.sort((x,y)=>x-y).filter((x,i,p)=>!i||x-p[i-1]>1e-9);
 const cuts=distinct(loops.flatMap(g=>g.map(p=>p[1])).concat(breaks));
 const rows=cuts.map(y=>distinct(edges.flatMap(e=>{
  const [a,c]=e,lo=Math.min(a[1],c[1]),hi=Math.max(a[1],c[1]);
  return y<lo||y>hi?[]:lo===hi?[a[0],c[0]]:[X(e,y)];
 })));
 const chain=(knots:number[],l:number,r:number,y:number):UV[]=>{
  if(r-l<1e-9)return [[(l+r)*.5,y]];
  return [l,...knots.filter(x=>x>l+1e-9&&x<r-1e-9),r].map(x=>[x,y]);
 };
 const put=(a:UV,c:UV,d:UV)=>{
  const q=(c[0]-a[0])*(d[1]-a[1])-(c[1]-a[1])*(d[0]-a[0]);
  if(Math.abs(q)>1e-10)f.face(b,[a,c,d]);
 };
 for(let i=1;i<cuts.length;i++){
  const lo=cuts[i-1],hi=cuts[i],mid=(lo+hi)*.5;
  const crossings=edges.filter(([a,c])=>(a[1]<mid)!==(c[1]<mid)).sort((a,c)=>X(a,mid)-X(c,mid));
  if(crossings.length%2)throw Error('invalid entrance panel crossing');
  for(let j=0;j<crossings.length;j+=2){
   const [l,r]=[crossings[j],crossings[j+1]],A=chain(rows[i-1],X(l,lo),X(r,lo),lo),C=chain(rows[i],X(l,hi),X(r,hi),hi);
   // Zipper the two monotone chains without losing interior collinear knots.
   for(let a=0,c=0;a+1<A.length||c+1<C.length;){
    if(c+1===C.length||(a+1<A.length&&A[a+1][0]<=C[c+1][0]))put(A[a],A[++a],C[c]);
    else put(A[a],C[++c],C[c-1]);
   }
  }
 }
}
function wall(f:Run,h:(u:number,v:number)=>number,b:Record<Role,Batch>,set:Feature[]=[], tower=false,northPanel=false){
 const levels:UV[]=[[0,siding],[f.len,siding]];
 for(let j=12;j>=0;j--){const s=f.len*j/12,[u,,v]=f.at(s,0);levels.push([s,h(u,v)-.133]);}
 const holes=set.map(a=>profile(a));
 if(northPanel){const lo=set[0].top,hi=set[1].bottom;entrancePanel(f,b.shingle,levels,holes,[lerp(lo,hi,1/3),lerp(lo,hi,2/3)]);}
 else f.face(b.shingle,levels,0,holes);
 f.prism(b.stone,rect(-.015,f.len+.015,plinth,siding),.021,-.081,[.88,.88,.84]);
 f.prism(b.trim,rect(-.018,f.len+.018,siding-.010,siding+.024),.035,-.015,[.88,.85,.79]);
 for(const s of [.035,f.len-.044]){const [u,,v]=f.at(s,0);f.prism(b.trim,rect(s-.044,s+.056,siding+.026,h(u,v)-.140),.033,-.012,[.98,.98,.96]);}
 if(tower){
  // Age and deepest soffit shadow are geometry, not black paint on an arbitrary panel.
  f.face(b.ornamental,rect(.098,f.len-.125,16.68,17.72),.011,[],[.94,.94,.91]);
  f.prism(b.trim,rect(-.052,f.len+.052,16.620,16.682),.045,-.018,[.92,.91,.88]);
 }
 for(const x of set){if(x.kind==='door')door(f,x,b);else if(x.kind==='louver')louver(f,x,b);else glazing(f,x,b);}
}
const arch=(mid:number,bottom:number,top:number,width=.94,pane=false):Feature=>({kind:'arch',mid,bottom,top,width,crest:top-(pane?.91:.72),pane});
function tapered(b:Batch,u:number,v:number,lo:number,hip:number,end:number,w:number){
 box(b,u-w*.58,u+w*.58,lo,lo+.136,v-w*.58,v+w*.58);
 box(b,u-w*.48,u+w*.48,lo+.134,hip,v-w*.48,v+w*.48);
 const p=rect(u-w*.48,u+w*.48,v-w*.48,v+w*.48),k:Pt=[u,end,v];
 for(let i=0;i<4;i++){
  const j=(i+1)%4;const n:Pt=[[0,0,-1],[1,0,0],[0,0,1],[-1,0,0]][i] as Pt;
  b.poly([point(p[i][0],hip,p[i][1]),point(p[j][0],hip,p[j][1]),k],[n[0],.035,n[2]]);
 }
}
function parapet(b:Record<Role,Batch>){
 // Measured shallow hidden cap is an independent surface. Rails/tooth/finial placement is visually authored.
 exactTop(tEdge,CapPlanes,b.metal);fascia(tEdge,CapPlanes,b,-.121);
 const q=rect(-1.79,1.655,2.970,6.54).reverse();
 const spec=[21.111,21.087,21.035,21.068];
 for(let i=0;i<q.length;i++){
  const p=q[i],n=q[(i+1)%q.length],r=new Run(p,n);
  r.prism(b.fascia,rect(-.054,r.len+.054,18.707,18.821),.076,-.115,[.88,.90,.87]);
  r.prism(b.shadow,rect(-.046,r.len+.046,18.621,18.703),.036,-.073,[.79,.80,.77]);
  r.prism(b.trim,rect(.021,r.len-.021,18.81,19.170),.035,-.084,[.92,.91,.87]);
  for(let j=1;j<=8;j++){
   const s=r.len*j/9;
   r.prism(b.trim,rect(s-.062,s+.062,19.168,19.335+(j%2)*.009),.034,-.087,[.92,.91,.87]);
  }
  tapered(b.trim,...p,18.857,19.888,spec[i],.167);
 }
}
function annex(b:Record<Role,Batch>){
 exactTop(annexSide,[ANNEX_W,ANNEX_E],b.roof);fascia(annexSide,[ANNEX_W,ANNEX_E],b,-.123);
 const shell=rect(-1.56,1.56,-16.87,-12.693).reverse(),t=(u:number,v:number)=>annexHeight(u,v);
 const fn=shell.map((p,i)=>new Run(p,shell[(i+1)%shell.length]));
 wall(fn[0],t,b);
 wall(fn[1],t,b,[{kind:'door',mid:2.83,bottom:siding+.043,top:9.88,width:.80}]);
 wall(fn[2],t,b,[{kind:'ordinary',mid:1.06,bottom:8.59,top:9.95,width:.64}]);
 wall(fn[3],t,b);
}
export function buildStDavids({procedural=true,includeRearPorch=false}={}):T.Group{
 const shelf=Object.fromEntries(roles.map(r=>[r,new Batch()])) as Record<Role,Batch>;
 const gable=rect(...sideRoof);
 exactTop(gable,[NAVE_W,NAVE_E],shelf.roof);fascia(gable,[NAVE_W,NAVE_E],shelf);
 const h=(u:number,v:number)=>naveHeight(u,v),ht=(u:number,v:number)=>Math.min(capH(u,v)+.028,18.855);
 const side=new Map<number,Run>();OWNER.forEach((q,i)=>side.set(i,new Run(q,OWNER[(i+1)%OWNER.length])));
 // The archival north/north-east views corroborate side entrance and four regular side bays.
 const tall=arch(side.get(1)!.len*.5,10.152,14.11,1.02,true);
 for(const i of [0,1,2]){
  const r=side.get(i)!;
  const top:Feature={kind:'louver',mid:r.len*.5,bottom:17.769,top:18.389,width:.735};
  const row=i===1?[tall,top]:i===2?[{kind:'door' as const,mid:r.len*.52,bottom:siding+.026,top:9.82,width:.89},top]:[top];
  wall(r,ht,shelf,row,true,i===1);
 }
 // The tower backs into the main gable. No artificial window on the blind fourth face.
 wall(new Run(OWNER[3],OWNER[0]),ht,shelf,[],true);
 for(const i of [3,4,5,6,7]){
  const r=side.get(i)!;
  const holes=[3,7].includes(i)?[arch(r.len*.51,8.64,11.81,.91)]:[4,6].includes(i)?[.141,.380,.619,.858].map(t=>arch(r.len*t,8.62,11.855,.90)):[];
  wall(r,h,shelf,holes);
 }
 parapet(shelf);
 if(includeRearPorch)annex(shelf);
 const g=new T.Group();g.name='St David’s United Church — detached 2020 exterior study';
 g.userData.datumCGVD2013=DATUM;g.userData.withNominalRearPorch=includeRearPorch;
 for(const r of roles){const q=shelf[r].geometry();if(!q)continue;
  const mesh=new T.Mesh(q,material(r,procedural));mesh.name=r;mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);
 }
 g.updateMatrixWorld(true);
 return g;
}
