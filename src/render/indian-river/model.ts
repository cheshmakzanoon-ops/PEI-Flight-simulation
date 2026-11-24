import * as T from 'three';
import {Batch,beam,p,prism,tube,rect,type XY} from './geometry.ts';
import {band,face,inset,OPEN,section,wall,type Face,type Layer,type Layers,type Opening} from './facade.ts';
import {FIRST_ART_FOOTING,type P} from './frame.ts';
import {WING,edgeStations,roofGeometry,topAt,upper,type Component} from './roof.ts';
import {tower,crossingLantern} from './tower.ts';
import type {ChurchMaterials} from './materials.ts';
export type Quality='hero'|'flight';
const KEYS=['paint','scallop','foundation','redRoof','trim','whiteTrim','reveal','glass','iron','door','metal','relief','figure']as const;
const UPPER_GUTTER=32.66;
function prismaticPier(art:Layers,f:Face,S:number,base:number,top:number,wide=.35,project=.23){
 const ring=(y:number,half:number,dp:number):P[]=>[f.at(S-half,y,.033),f.at(S+half,y,.033),f.at(S+half,y,-dp),f.at(S-half,y,-dp)];
 prism(art.foundation,ring(base,wide*.67,project+.17),ring(base+.29,wide*.67,project+.15));
 prism(art.whiteTrim,ring(base+.28,wide*.59,project+.09),ring(top-.52,wide*.43,project*.79));
 prism(art.whiteTrim,ring(top-.52,wide*.43,project*.79),ring(top,wide*.40,.037));
}
function bargeBoard(art:Layers,c:Component,i:number,f:Face,hero:boolean){
 const A=c.outline[i],B=c.outline[(i+1)%c.outline.length],sc=edgeStations(c,A,B).map(q=>({s:Math.hypot(q[0]-A[0],q[1]-A[1]),y:upper(c,q)}));
 for(let j=0;j+1<sc.length;j++){
  const a=sc[j],b=sc[j+1];if(b.s-a.s<.067)continue;
  const Y=(s:number)=>a.y+(b.y-a.y)*(s-a.s)/(b.s-a.s);
  const cover:XY[]=[[a.s,a.y-.416],[b.s,b.y-.416],[b.s,b.y-.038],[a.s,a.y-.038]];
  const paint=art.scallop;
  const holes:XY[][]=[];
  if(hero){const step=.227,rad=.039,ry=.055;
   for(let s=a.s+.123;s<b.s-.123;s+=step)holes.push(Array.from({length:8},(_,k)=>[s+rad*Math.cos(k*Math.PI/4),Y(s)-.238+ry*Math.sin(k*Math.PI/4)]));
  }
  art.trim.poly(cover.map(q=>f.at(...q,-.033)),f.norm,cover);
  paint.poly(cover.map(q=>f.at(...q,-.057)),f.norm,cover,undefined,holes,cover,q=>f.at(...q,-.057));
  beam(art.trim,f.at(a.s,a.y-.058,-.094),f.at(b.s,b.y-.058,-.094),.133,.095,f.norm);
  beam(art.whiteTrim,f.at(a.s,a.y-.418,-.066),f.at(b.s,b.y-.418,-.066),.061,.048,f.norm);
 }
}
const fns={range:(count:number,a:number,b:number)=>Array.from({length:count},(_,i)=>a+(b-a)*(i+.5)/count)};
function wingWalls(art:Layers,c:Component,hero:boolean){
 for(let i=0;i<c.outline.length;i++){
  const A=c.outline[i],B=c.outline[(i+1)%c.outline.length],fn=face(A,B),L=fn.length, u=(A[0]+B[0])*.5,v=(A[1]+B[1])*.5,op:Opening[]=[];
  const pfr=(p:number)=>p*L,n=c.role;
  const naveFront=n==='nave'&&v<-1.57;
  const naveEast=n==='nave'&&u>13.22&&v<15.2&&fn.norm[0]>.95;
  const naveWest=n==='nave'&&u<2.53&&v<15.2&&fn.norm[0]<-.95;
  const eastGable=n==='crossEast'&&u>17.6&&fn.norm[0]>.84;
  const westGable=n==='crossWest'&&u<-2.32&&fn.norm[0]<-.95;
  const aisleSide=(n==='aisleWest'&&fn.norm[0]<-.95)||(n==='aisleEast'&&fn.norm[0]>.95);
  const annexSide=n==='annex'&&Math.abs(fn.norm[2])>.78&&L>3.8;
  const sideCore=(n==='crossEast'||n==='crossWest')&&Math.abs(fn.norm[2])>.97&&L>3;
  if(naveFront){
   op.push(OPEN(pfr(.50),24.040,1.79,3.23,'entry'),OPEN(pfr(.217),24.89,.78,2.76),OPEN(pfr(.784),24.89,.78,2.76));
   op.push(OPEN(pfr(.50),29.62,4.95,5.72,'traceried'));
   op.push(OPEN(pfr(.447),36.52,.279,1.18,'louver'),OPEN(pfr(.50),36.52,.286,1.77,'louver'),OPEN(pfr(.553),36.52,.279,1.18,'louver'));
  }
  if(naveEast||naveWest){
   const V=naveEast?fns.range(7,5.20,14.62):fns.range(6,5.30,14.50);
   for(const station of V){const s=(station-A[1])/(B[1]-A[1])*L; if(s>0&&s<L)op.push(OPEN(s,29.115,.638,2.95));}
  }
  if(eastGable){
   op.push(OPEN(pfr(.54),27.93,1.73,7.52,'traceried'),OPEN(pfr(.54),24.75,.79,1.96));
   const towardsRidge=Math.abs(A[1]-20.7)<Math.abs(B[1]-20.7)?pfr(.214):pfr(.82);
   op.push(OPEN(towardsRidge,35.83,.35,1.404,'louver'));
  }
  if(westGable){
   for(const s of [.323,.647])op.push(OPEN(pfr(s),28.19,1.60,6.83,'traceried'),OPEN(pfr(s),24.86,.71,1.85));
   op.push(OPEN(pfr(.486),35.39,.333,1.74,'louver'));
  }
  if(aisleSide){
   for(const s of fns.range(4,.37,L-.37))op.push(OPEN(s,24.64,.796,1.83));
  }
  if(annexSide&&fn.norm[2]<0){
   for(const f of [.24,.56,.82])op.push(OPEN(pfr(f),24.70,1.70,1.76,'rect',2));
  }
  const w=wall(art,c,i,op,hero),f=w.face;
  if(naveFront){
   band(art,f,.07,pfr(.274),28.56,.114);band(art,f,pfr(.276),pfr(.716),29.126,.119);band(art,f,pfr(.718),L-.059,28.56,.114);
   beam(art.trim,f.at(pfr(.274),28.56,-.05),f.at(pfr(.276),29.126,-.05),.098,.053,f.norm);
   beam(art.trim,f.at(pfr(.716),29.126,-.05),f.at(pfr(.718),28.56,-.05),.098,.053,f.norm);
   prismaticPier(art,f,.391,23.43,30.77,.37,.195);prismaticPier(art,f,L-.418,23.43,30.70,.37,.203);
   bargeBoard(art,c,i,f,hero);
   // A neutral three-rise studio threshold follows the authored door. It is
   // deliberately not retained as any kind of source of real site grading.
   const rise=.215,steps=3,s=pfr(.5),left=s-1.16,right=s+1.16;
   for(let j=0;j<steps;j++){
    const lo=23.34,up=lo+(j+1)*rise,d=-1.02+j*.29;
    const R=(y:number):P[]=>[f.at(left,y,d),f.at(right,y,d),f.at(right,y,.086),f.at(left,y,.086)];
    prism(art.foundation,R(lo),R(up));
   }
   // Thin authored simple iron handrails seen in dated exterior photography.
   // No candidate rail touches the grade or changes the original stair widths.
   for(const side of [-1,1]){
    const u=s+side*1.066,ds=[-.971,-.71,-.42,-.154],anchors=[23.555,23.77,23.985,23.985];
    const R: P[]=ds.map((d,j)=>f.at(u,anchors[j]+.818,d));
    for(let j=0;j<R.length;j++){
     if(j<R.length-1)beam(art.iron,R[j],R[j+1],.038,.032,p(1,0,0));
     if(j!==1||hero)beam(art.iron,f.at(u,anchors[j]+.004,ds[j]),R[j],.026,.025,f.norm);
    }
   }
   // Narrow threshold square-metal edge; not an extra stair/apron or elevation claim.
   beam(art.trim,f.at(s-.906,24.014,-.031),f.at(s+.906,24.014,-.031),.050,.077,f.norm);
   band(art,f,.073,s-1.25,23.849,.113);band(art,f,s+1.25,L-.089,23.849,.113);
  }else if(aisleSide){
   band(art,f,.031,L-.034,23.849,.106);
   for(const p of fns.range(3,L*.18,L*.83))prismaticPier(art,f,p,23.44,26.08,.23,.12);
  }else if(naveEast||naveWest){
   band(art,f,.05,L-.05,28.70,.096);
  }else if(eastGable||westGable){
   band(art,f,.03,L-.03,27.64,.136);bargeBoard(art,c,i,f,hero);
  }else if(sideCore){
   band(art,f,.03,L-.03,27.68,.115);
  }else if(annexSide){
   band(art,f,.04,L-.05,24.01,.089);
  }
 }
}
function bartizan(art:Layers,hero:boolean){
 // Small right-hand painted bartizan with its own red cap, from the recognized
 // exterior rhythm. Its dimensions are authored, not a fit to sparse raw returns.
 const u=14.35,v=4.16,n=6,r=1.095,base=23.27,eaves=31.52;
 const ring:XY[]=Array.from({length:n},(_,i)=>[u+r*Math.cos((i+.5)*Math.PI*2/n),v+r*Math.sin((i+.5)*Math.PI*2/n)]);
 for(let i=0;i<n;i++){
  const A=ring[i],B=ring[(i+1)%n],f=face(A,B),o=[] as Opening[];
  if(f.norm[0]>.28||f.norm[2]<-.35){o.push(OPEN(f.length*.5,24.78,.442,2.18),OPEN(f.length*.5,28.058,.433,2.18));}
  const box:XY[]=rect(0,f.length,base,eaves),cut=o.map(a=>section(a,hero?10:6));
  art.paint.poly(box.map(q=>f.at(...q)),f.norm,box,undefined,cut,box,q=>f.at(...q));
  for(const a of o)inset(art,f,a,hero);
  band(art,f,.014,f.length-.014,27.43,.141);
  beam(art.trim,f.at(0,eaves-.041,-.042),f.at(f.length,eaves-.041,-.042),.144,.069,f.norm);
 }
 tube(art.foundation,u,v,23.18,23.74,1.15,1.14,n,Math.PI/n);
 tube(art.redRoof,u,v,eaves,35.585,1.21,.028,n,Math.PI/n);
 tube(art.relief,u,v,35.53,35.82,.056,.022,8);
}
function batchGate():Layers{return Object.fromEntries(KEYS.map(n=>[n,new Batch()])) as Layers;}
export function makeMeasuredRoofs(){
 const pack=new T.Group();pack.name='Detached frozen roof envelope, no wall/ornament';
 WING.forEach(c=>{const layer=new Batch();roofGeometry(c,layer);const data=layer.finish();if(!data)return;
  const m=new T.Mesh(data,new T.MeshBasicMaterial());m.name=c.role;pack.add(m);
 });return pack;
}
export function buildChurch(q:Quality,material:ChurchMaterials){
 const hero=q==='hero',art=batchGate(),g=new T.Group();g.name='Historic St Mary’s Indian River | detached exterior '+q;
 for(const c of WING){roofGeometry(c,art.redRoof,art.trim);wingWalls(art,c,hero);}
 tower(art,hero);crossingLantern(art,hero);bartizan(art,hero);
 for(const layer of KEYS){const geo=art[layer].finish();if(!geo)continue;
  const m=new T.Mesh(geo,material[layer]);m.name=layer;m.castShadow=layer!=='glass';m.receiveShadow=true;g.add(m);
 }
 g.userData={exterior:true,placed:false,quality:q,rootAxisDegrees:5.370023860360966,localSurveyDatum:23.40};return g;
}
// Existing packed q03230 row48 outline: comparison under the same detached scene light.
// This is geometry only. It deliberately lacks the real displaced spire and detailed material.
export const STOCK_RING:XY[]=[[-13.503,35.532],[.272,35.907],[1.421,28.305],[5.626,34.688],[16.403,27.662],[17.894,15.11],[15.897,15.203],[15.448,3.297],[13.44,3.28],[13.487,-1.528],[2.125,-1.704],[2.019,4.786],[-.066,4.776],[-.409,14.977],[-2.417,14.959],[-2.751,27.504],[-14.277,27.234]];
export function stockShell(){
 const R=STOCK_RING.slice().reverse(),g=new T.Group(),skin=new Batch(),y=43.72457122802733;
 skin.poly(R.map(q=>p(q[0],y,q[1])),[0,1,0]);
 for(let i=0;i<R.length;i++){
  const a=R[i],b=R[(i+1)%R.length],f=face(a,b);
  skin.poly([p(a[0],23.18,a[1]),p(b[0],23.18,b[1]),p(b[0],y,b[1]),p(a[0],y,a[1])],f.norm);
 }
 const m=new T.Mesh(skin.finish(),new T.MeshStandardMaterial({color:0xa3a49d,roughness:.87}));m.castShadow=true;m.receiveShadow=true;g.add(m);return g;
}
