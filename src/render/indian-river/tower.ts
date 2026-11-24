import {beam,p,prism,tube,type XY} from './geometry.ts';
import {OPEN,inset,section,type Face,type Layers} from './facade.ts';
import {TOWER_CENTRE,TOWER_RADIAL_SURVEY,type P} from './frame.ts';
const [U,V]=TOWER_CENTRE, TAU=Math.PI*2;
const fold=(r:number,y:number,t:number,u=U,v=V):P=>p(u+r*Math.cos(t),y,v+r*Math.sin(t));
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
type Tier=readonly [y0:number,y1:number,r0:number,r1:number];
const TOWER:readonly Tier[]=[
 [23.22,29.23,2.671,2.531],[29.23,33.03,2.48,2.401],[33.03,38.04,2.35,2.226],[38.04,39.35,2.22,2.107],[39.35,42.19,2.086,1.805]
];
function tangent(t:Tier,k:number,count:number,angle0=-Math.PI*.50):Face{
 const a=angle0+(k-.5)*TAU/count,b=a+TAU/count,c=(a+b)*.5;
 const w=(t[2]+t[3])*Math.sin(TAU/count*.5);
 const norm:P=[Math.cos(c),0,Math.sin(c)];
 return {length:w,norm,at:(s:number,y:number,d=0)=>{
  const r=mix(t[2],t[3],(y-t[0])/(t[1]-t[0])),u0=mix(Math.cos(a),Math.cos(b),s/w)*r,v0=mix(Math.sin(a),Math.sin(b),s/w)*r;
  return p(U+u0-norm[0]*d,y,V+v0-norm[2]*d);
 }};
}
export function tower(art:Layers,hero:boolean){
 const sides=24;
 for(let k=0;k<TOWER.length;k++){
  const q=TOWER[k],n=k===4?12:sides,L=q[1]-q[0];
  for(let i=0;i<n;i++){
   const f=tangent(q,i,n),w=f.length,m=w*.5,b=q[0],top=q[1];
   const niches=k===4,door=(i===0&&k===0),views=(i===0||i===6||i===12||i===18);
   const kind=niches?OPEN(m,b+.341,Math.min(.655,w-.125),1.965,'niche'):door?OPEN(m,b+1.60,.555,2.03,'entry'):views&&k<3?OPEN(m,b+L*.22,Math.min(k===2?.60:.43,w-.095),L*(k===2?.61:.51),k===2?'louver':'lancet'):undefined;
   const outer:XY[]=[[0,b],[w,b],[w,top],[0,top]],holes=kind?[section(kind,hero?10:6)]:[];
   art.paint.poly(outer.map(j=>f.at(...j)),f.norm,outer,undefined,holes,outer,j=>f.at(...j));
   if(!kind)continue;
   if(niches){
     inset(art,f,kind,hero);
     // Pointed pale-painted crown hoods over the dozen genuine recessed niches.
     const W=Math.min(w*.41,.384),Y=42.08, Pk=42.49;
     const hood=(w:number,h:number,d:number):P[]=>[
       f.at(m-w,Y-.31,d),f.at(m,Pk+h,d),f.at(m+w,Y-.31,d)];
     art.trim.poly(hood(W,0,-.075),f.norm);
     const A=f.at(m-W*.87,Y-.33,-.099),B=f.at(m,Pk-.065,-.104),C=f.at(m+W*.87,Y-.33,-.099);
     beam(art.whiteTrim,A,B,.086,.036,f.norm);beam(art.whiteTrim,B,C,.086,.036,f.norm);
     const ang=-Math.PI*.50+i*TAU/n,mid=b+1.24,r=mix(q[2],q[3],(mid-b)/L)-.19,pt=fold(r,mid,ang);
     const y=mid-.62; const color=(i%5)*.024+.89;
     const robe=(Y:number,R:number)=>Array.from({length:hero?7:5},(_,j)=>fold(R,Y,j*TAU/(hero?7:5),pt[0],pt[2]));
     prism(art.figure,robe(y,.143),robe(mid+.485,.111),[color,color,color]);
     if(hero){tube(art.relief,pt[0],pt[2],mid+.448,mid+.669,.135,.101,7,ang);tube(art.figure,pt[0],pt[2],mid+.655,mid+.753,.086,.025,7,ang);}
   }else inset(art,f,kind,hero);
  }
 }
 tube(art.foundation,U,V,23.19,23.86,2.714,2.688,hero?48:24);
 for(const [Y,R0] of [[29.23,2.553],[33.03,2.430],[38.03,2.258],[39.34,2.148],[42.12,1.849]]){
  tube(art.trim,U,V,Y-.097,Y+.025,R0+.035,R0+.026,hero?48:24);
  tube(art.whiteTrim,U,V,Y+.019,Y+.156,R0+.018,R0-.019,hero?48:24);
 }
 // This geometry keeps the observed cone/tip distinct. No historic cross dimensions claimed.
 const s=TOWER_RADIAL_SURVEY,R=(y:number)=>s.radiusAt46-s.dropPerMetre*(y-46);
 const Y0=42.154,Y1=55.748;
 function cone(y0:number,y1:number,r0:number,r1:number,N:number){
  for(let i=0;i<N;i++){
   const a=i*TAU/N-Math.PI*.5,b=(i+1)*TAU/N-Math.PI*.5,m=(a+b)*.5;
   const lo=2*r0*Math.sin(Math.PI/N),hi=2*r1*Math.sin(Math.PI/N);
   const uv:XY[]=[[0,y0],[lo,y0],[lo*.5+hi*.5,y1],[lo*.5-hi*.5,y1]];
   art.metal.poly([fold(r0,y0,a),fold(r0,y0,b),fold(r1,y1,b),fold(r1,y1,a)],p(Math.cos(m),s.dropPerMetre,Math.sin(m)),uv);
   if(hero)beam(art.relief,fold(r0+.011,y0,a),fold(r1+.011,y1,a),.019,.013,p(Math.cos(a),0,Math.sin(a)));
  }
 }
 cone(Y0,51.4,R(Y0),R(51.4),hero?24:16);cone(51.4,Y1,R(51.4),R(Y1),hero?24:16);
 tube(art.metal,U,V,Y1,55.92,R(Y1),.037,12);
 tube(art.relief,U,V,55.90,56.108,.033,.026,12);
 beam(art.relief,p(U-.105,56.026,V),p(U+.105,56.026,V),.026,.025,[0,0,1]);
}
export function crossingLantern(art:Layers,hero:boolean){
 const U=7.724,V=20.679;
 tube(art.paint,U,V,39.73,41.10,.70,.70,hero?8:6,Math.PI/8);
 tube(art.trim,U,V,41.07,41.19,.72,.72,8,Math.PI/8);
 const n=8,base=41.16,top=41.91,r=.694;
 for(let i=0;i<n;i++){
   const a=Math.PI/8+i*TAU/n,b=a+TAU/n;
   const p0=fold(r,base,a,U,V),p1=fold(r,base,b,U,V),f= {length:Math.hypot(p1[0]-p0[0],p1[2]-p0[2]),norm:p(Math.cos((a+b)*.5),0,Math.sin((a+b)*.5)),at:(s:number,y:number,d=0):P=>{
     const w=Math.hypot(p1[0]-p0[0],p1[2]-p0[2]),t=s/w;return p(mix(p0[0],p1[0],t)-d*Math.cos((a+b)*.5),y,mix(p0[2],p1[2],t)-d*Math.sin((a+b)*.5));
   }};
   const ring:XY[]=[[0,base],[f.length,base],[f.length,top],[0,top]];
   const I=OPEN(f.length*.5,base+.07,f.length*.53,.57,'louver'),cut=section(I,hero?10:6);
   art.paint.poly(ring.map(j=>f.at(...j)),f.norm,ring,undefined,[cut],ring,j=>f.at(...j));
   inset(art,f,I,hero);
 }
 // 21 same-strip returns place a broad eave shoulder near 42.10 CGVD;
 // loop shape and nominal widths are shaded geometry, not a definitive as-built fit.
 tube(art.whiteTrim,U,V,41.87,42.032,.742,1.033,10,Math.PI/10);
 tube(art.trim,U,V,42.009,42.112,1.044,1.044,10,Math.PI/10);
 tube(art.metal,U,V,42.107,43.475,1.047,.059,10,Math.PI/10);
 tube(art.relief,U,V,43.46,44.73,.026,.021,8); // rare source max 44.749
 beam(art.relief,p(U-.13,44.51,V),p(U+.13,44.51,V),.026,.023,[0,0,1]);
}
