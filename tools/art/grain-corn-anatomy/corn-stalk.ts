import * as T from 'three';

export type P=[number,number,number];
export type Role=0|1|2|3|4|5|6; // leaf blade, stalk, tassel, husk, canopy top, canopy edge, studio floor
export type FloraBuffer={p:number[];uv:number[];rgb:number[];role:number[];i:number[]};
export const buffer=():FloraBuffer=>({p:[],uv:[],rgb:[],role:[],i:[]});
export const plus=(a:P,b:P):P=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const sub=(a:P,b:P):P=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
export const times=(a:P,k:number):P=>[a[0]*k,a[1]*k,a[2]*k];
export const dot=(a:P,b:P)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const cross=(a:P,b:P):P=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const unit=(x:P)=>times(x,1/Math.hypot(...x));
export const mix=(a:number,b:number,q:number)=>a+(b-a)*q;
export const mix3=(a:P,b:P,q:number):P=>[mix(a[0],b[0],q),mix(a[1],b[1],q),mix(a[2],b[2],q)];
export const clamp=(d:number,lo=0,hi=1)=>Math.max(lo,Math.min(hi,d));
export function hash(a:number,b:number,s=0){
 let n=(Math.imul(a+371,0x9e3779b9)^Math.imul(b+5281,0x85ebca6b)^Math.imul(719+s,0x165667b1))|0;
 n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);
 return ((n^(n>>>16))>>>0)/4294967295;
}
const linear=(j:number)=>{
 const u=j/255;return u<=.04045?u/12.92:Math.pow((u+.055)/1.055,2.4);
};
export const color=(v:number):P=>[linear(v>>>16),linear((v>>>8)&255),linear(v&255)];
export const plant=(g:FloraBuffer,a:P,c:P,r:Role,u:number,v:number)=>{
 const id=g.p.length/3;g.p.push(...a);g.rgb.push(...c);g.role.push(r);g.uv.push(u,v);return id;
};
export const tr=(g:FloraBuffer,a:number,b:number,c:number)=>g.i.push(a,b,c);
export function append(g:FloraBuffer,src:FloraBuffer,x:number,z:number,s:number,yaw:number,shade=1){
 const start=g.p.length/3, c=Math.cos(yaw),a=Math.sin(yaw);
 for(let j=0;j<src.role.length;j++){
   const [u,y,v]=src.p.slice(j*3,j*3+3),rgb=src.rgb.slice(j*3,j*3+3) as P;
   plant(g,[x+s*(u*c-v*a),y*s,z+s*(u*a+v*c)],times(rgb,shade),src.role[j] as Role,src.uv[j*2],src.uv[j*2+1]);
 }
 for(const i of src.i)g.i.push(start+i);
}
export function pack(g:FloraBuffer){
 if(g.p.length/3>=65536)throw Error('Private proof expects U16 draw');
 const geo=new T.BufferGeometry();
 geo.setAttribute('position',new T.Float32BufferAttribute(g.p,3));
 geo.setAttribute('uv',new T.Float32BufferAttribute(g.uv,2));
 geo.setAttribute('pigment',new T.Uint8BufferAttribute(g.rgb.map(d=>Math.round(255*clamp(d))),3,true));
 geo.setAttribute('cornRole',new T.Uint8BufferAttribute(g.role,1));
 geo.setIndex(new T.Uint16BufferAttribute(g.i,1));
 geo.computeVertexNormals();geo.computeBoundingSphere();geo.computeBoundingBox();
 return geo;
}
/** Ring tube along actual curve, ending in real caps, not billboard cylinders. */
function tube(g:FloraBuffer,ps:readonly P[],r:readonly number[],sides:number,col:P,role:Role,ell=1){
 const n=ps.length,step=2*Math.PI/sides,V0=unit(sub(ps.at(-1)!,ps[0]));
 const ref:P=Math.abs(V0[2])>.895?[1,0,0]:[0,0,1];
 const f0=g.p.length/3;
 for(let j=0;j<n;j++){
  const D=unit(sub(ps[Math.min(n-1,j+1)],ps[Math.max(0,j-1)])),U=unit(cross(D,ref)),V=cross(D,U);
  for(let k=0;k<sides;k++){
   const f=step*k,p=plus(ps[j],plus(times(U,r[j]*Math.cos(f)*ell),times(V,r[j]*Math.sin(f))));
   plant(g,p,times(col,.97+.05*Math.sin(f+.83)),role,j/(n-1),k/sides);
  }
 }
 for(let j=1;j<n;j++)for(let k=0;k<sides;k++){
  const a=f0+(j-1)*sides+k,b=f0+(j-1)*sides+(k+1)%sides;
  tr(g,a,b,b+sides);tr(g,a,b+sides,a+sides);
 }
 const first=plant(g,ps[0],col,role,0,.5),last=plant(g,ps.at(-1)!,col,role,1,.5),L=f0+(n-1)*sides;
 for(let j=0;j<sides;j++){tr(g,first,f0+(j+1)%sides,f0+j);tr(g,last,L+j,L+(j+1)%sides);}
}
const TAU=2*Math.PI;
const OCHRE=color(0x9a8050),CANOPYGREEN=color(0x66793d),SAGE=color(0x7f8550),
  RIB=color(0xaaa26a),HUSK=color(0x8c8a4b),DRY=color(0xa18f62),TASSEL=color(0xb6a16c);

export const STALK_ART=Object.freeze({
 seeds:Object.freeze([167,227,383,499,631,883,1097,1337]),
 foliageFractions:Object.freeze([.141,.229,.318,.408,.501,.602,.699,.801,.905]),
 provenance:'Author morphology, length, hue, density and scale; no cultivar, local-condition or calendar inference.',
});

export function makeStalkBuffer(seed:number,lod:'hero'|'edge'='hero',finish:'base'|'weathered'='base'){
 const g=buffer(),hero=lod==='hero',polish=hero&&finish==='weathered',H=1.86+.31*hash(seed,1,6);
 const phase=TAU*hash(seed,85,2),axis=TAU*hash(seed,86,4),senescence=hash(seed,88,7);
 const tilt=.040+.13*hash(seed,32,5);
 const stem=(t:number):P=>[tilt*t*t*Math.cos(phase),H*t,tilt*t*t*Math.sin(phase)];
 tube(g,Array.from({length:hero?9:2},(_,i)=>stem(i/(hero?8:1))),
   Array.from({length:hero?9:2},(_,i)=>.0175-.0075*i/(hero?8:1)),hero?8:3,mix3(CANOPYGREEN,DRY,.30+.24*senescence),1);
 const leafInfo=[];
 const roster=hero?(polish?[.115,.189,.263,.335,.404,.486,.566,.635,.716,.800,.907]:STALK_ART.foliageFractions).map((y,j)=>({y,j})):
   [1,4,7,8].map(j=>({y:STALK_ART.foliageFractions[j],j}));
 for(const {y:fs,j} of roster){
   const a=axis+j*Math.PI+.73*(hash(seed,j,6)-.5)+.13*Math.sin(j*.72+seed);
   const F:P=[Math.cos(a),0,Math.sin(a)],Q:P=[-Math.sin(a),0,Math.cos(a)],root=stem(fs);
   const width=(.059+.013*hash(seed,j,7))*(1-.42*clamp((fs-.64)/.36));
   const length=(.67+.34*Math.sin(2.84*fs)+.12*(hash(seed,j,1)-.5))*(1-.41*clamp((fs-.65)/.35));
   const rise=.42+.17*hash(seed,j,81),drop=Math.min(.39+.29*hash(seed,j,89)+.08*(1-fs),root[1]+rise-.06);
   const twist=.38+1.31*hash(seed,j,13);
   const swing=(.20*hash(seed,j,4)-.10);
   const age=clamp((1-fs)*.49+(hash(seed,j,31)-.5)*.29+.24*senescence);
   const col=mix3(mix3(CANOPYGREEN,SAGE,hash(seed,j,22)*.62),OCHRE,clamp((age-.18)*1.42));
   const cy=(t:number)=>root[1]+rise*t-drop*t*t+.047*Math.sin(Math.PI*t);
   const centre=(t:number):P=>{
     const u=length*(t*(.83+.17*t)),v=swing*Math.sin(Math.PI*t*.87)*t;
     return [root[0]+F[0]*u+v*Q[0],cy(t),root[2]+F[2]*u+v*Q[2]];
   };
   const steps=hero?(polish?9:11):3,crossRows=hero?5:3,first=g.p.length/3;
   let ym=-Infinity;
   for(let i=0;i<steps;i++){
    const t=i/steps,p=centre(t);
    const arch=Math.pow(Math.max(0,Math.sin(Math.PI*t)),.76),half=.009*(1-t)+width*arch*(1-.47*t);
    const theta=(twist*(t-.26)+.13*Math.sin(t*TAU))*Math.sign(swing||1);
    const curl=.17+age*.22;
    for(let k=0;k<crossRows;k++){
     const q=polish?[-1,-.37,0,.37,1][k]:2*k/(crossRows-1)-1;
     const twistAsym=polish?clamp((t-.57)*3.2)*Math.abs(q):0;
     const notch=polish?.21*twistAsym*Math.pow(Math.max(0.,Math.sin(25.7*t+.078*seed+j*.79+(q>0?0.:1.1))),5.):0;
     const wave=(hero?1+.060*Math.sin((t*34+seed*.124)+(q>0?.8:3.4))*Math.abs(q)*arch:1)-notch;
     const side=half*q*wave;
     const yOff=side*Math.sin(theta)-Math.abs(q)*half*curl*(1-.66*t)
       +Math.abs(q*q*q)*half*.13*Math.sin(t*14+seed*.017)
       +(polish?(1.-Math.pow(Math.abs(q),.54))*.011*arch*(1.-.68*t)
          +.024*twistAsym*Math.sin(21.*t+seed*.136+j*.4)*q:0.);
     const p0=plus(p,[Q[0]*side*Math.cos(theta),yOff,Q[2]*side*Math.cos(theta)]);
     ym=Math.max(ym,p0[1]);
     const warm=clamp((age-.28)*.56+t*t*.32+Math.abs(q)*.10);
     const ridge=hero&&q===0?(polish?.25*(1-.76*t):.14*(1-t)):0;
     plant(g,p0,mix3(mix3(col,DRY,warm),RIB,ridge),0,t,(q+1)*.5);
    }
   }
   for(let i=1;i<steps;i++)for(let k=1;k<crossRows;k++){
    const A=first+(i-1)*crossRows+k-1,B=A+1,C=A+crossRows;
    tr(g,A,C,B);tr(g,B,C,C+1);
   }
   const tip=centre(1),end=plant(g,tip,mix3(col,DRY,.42),0,1,.5),R=first+(steps-1)*crossRows;
   for(let k=0;k<crossRows-1;k++)tr(g,R+k,end,R+k+1);
   if(hero){
     // Slim sheath truly overlaps the tapered stem and leaf origin.
     const S=Math.max(0,fs-.044);
     tube(g,[stem(S),stem(fs+.002),stem(fs+.013)],[.0160,.0183,.0126],6,mix3(col,DRY,.28),1);
   }
   leafInfo.push({index:j,root,tip,crestY:ym,heading:a,length,width});
 }
 if(hero){
  const r=stem(.478),a=axis+.28;
  const D=unit([Math.cos(a)*.56,.78,Math.sin(a)*.56]);
  const ear=(t:number)=>plus(r,plus(times(D,.263*t),[0,-.038*t*t,0]));
  tube(g,[0,.15,.32,.58,.78,1].map(ear),[.012,.026,.033,.031,.023,.0039],8,mix3(HUSK,DRY,.33+senescence*.23),3,.84);
  for(let j=0;j<4;j++){
   const a=ear(1),dx=.013*(hash(seed,j,70)-.5),dz=.019*(hash(seed,j,71)-.5);
   tube(g,[a,plus(a,[dx,.025,dz]),plus(a,[dx*2,.031,dz*2])],[.0019,.0011,.00069],3,color(0x80694b),3);
  }
 }
 const stemEnd=stem(1),top=.243+.096*hash(seed,62,41);
 const inflorescence=(t:number):P=>plus(stemEnd,[.067*Math.cos(axis)*t,H*.002+top*t,.067*Math.sin(axis)*t]);
 const silk=mix3(TASSEL,OCHRE,.34*senescence);
 if(hero)tube(g,[stemEnd,inflorescence(.39),inflorescence(.76),inflorescence(1)],
   [.007,.0058,.0049,.0026],6,silk,2);
 else tube(g,[stemEnd,inflorescence(1)],[.007,.003],3,silk,2);
 const branch=hero?8:3;
 for(let j=0;j<branch;j++){
   const z=(j+.62)/(branch+.1),o=inflorescence(.136+.61*z),phi=axis+j*2.39996+(hash(seed,j,54)-.5)*.56;
   const k=(.072+.071*(1-z))*(.83+.28*hash(seed,j,55)),v=.073+.046*hash(seed,j,56);
   const D:P=[k*Math.cos(phi),v,k*Math.sin(phi)],P=plus(o,times(D,.58)),Q=plus(o,D);
   const tasselTint=mix3(TASSEL,DRY,.3+z*.20);
   if(hero)tube(g,[o,P,Q],[.0044,.0030,.00125],5,tasselTint,2);
   else {
    // Literal branch base/tip support with closed minimal subpixel taper.
    const ref:P=Math.abs(D[2])>.91?[1,0,0]:[0,0,1],N=unit(D),A=unit(cross(N,ref)),B=cross(N,A);
    const a0=g.p.length/3;
    for(let n=0;n<3;n++){
      const t=TAU*n/3;plant(g,plus(o,plus(times(A,.0054*Math.cos(t)),times(B,.0054*Math.sin(t)))),tasselTint,2,0,.35*n);
    }
    const tip=plant(g,Q,tasselTint,2,1,.5);
    tr(g,a0,a0+2,a0+1);
    for(let n=0;n<3;n++)tr(g,a0+n,a0+(n+1)%3,tip);
   }
   if(hero&&!polish)for(let q=0;q<2;q++){
    const pt=mix3(P,Q,.23+q*.44),u=phi+(q?-.81:.78);
    tube(g,[pt,plus(pt,[.027*Math.cos(u),.026,.027*Math.sin(u)])],
      [.0022,.00095],3,TASSEL,2);
   }
   if(polish)for(let q=0;q<3;q++){
     const C=mix3(P,Q,.133+.278*q+hash(seed,q+j*5,87)*.071);
     const F=unit(sub(Q,P)),B=unit(cross(F,[0,1,0])),S=unit(cross(F,B));
     const length=.0075+.0051*hash(seed,j+q,431),w=.0026+.0022*hash(seed,j+q,337);
     const n=g.p.length/3,tint=mix3(TASSEL,DRY,.115+.34*hash(seed,j+q,419));
     plant(g,plus(C,times(F,length)),tint,2,1,.5);
     plant(g,plus(C,times(F,-length)),tint,2,0,.5);
     for(const d of [B,S,times(B,-1),times(S,-1)])plant(g,plus(C,times(d,w)),tint,2,.5,0.);
     for(let k=0;k<4;k++){
       const u=n+2+k,vv=n+2+(k+1)%4;
       tr(g,n,u,vv);tr(g,n+1,vv,u);
     }
   }
 }
 return {g,H,stemEnd,tasselTop:inflorescence(1),leafInfo};
}
