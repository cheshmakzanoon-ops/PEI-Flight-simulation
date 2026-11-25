import * as T from 'three';
import {KNIGHT_SEAT} from './souris-knight-seat.ts';

type V=[number,number,number];
type UV=[number,number];
type Batch={p:number[];color:number[];uv:number[]};
const turn=Math.PI*2;
const colors=new Map<number,T.Color>();
const build=():Batch=>({p:[],color:[],uv:[]});
const white=0xedece5,bottomRed=0xa1292c,red=0xa6242a,redDark=0x761e29,redEdge=0xbc3736,
      stone=0x8f715f,sash=0xd2d3ca,reveal=0x776b63,bronze=0x6f6060,window=0x536567;
function point(b:Batch,p:V,c:number,uv:UV=[0,0]){
 let q=colors.get(c);if(!q){q=new T.Color(c);colors.set(c,q);}
 b.p.push(...p);b.color.push(q.r,q.g,q.b);b.uv.push(...uv);
}
function tri(b:Batch,a:V,d:V,e:V,c:number,uv?:[UV,UV,UV]){
 point(b,a,c,uv?.[0]);point(b,d,c,uv?.[1]);point(b,e,c,uv?.[2]);
}
function q(b:Batch,a:V,d:V,e:V,f:V,c:number,uv?:[UV,UV,UV,UV]){
 tri(b,a,d,e,c,uv&&[uv[0],uv[1],uv[2]]);tri(b,a,e,f,c,uv&&[uv[0],uv[2],uv[3]]);
}
function round(r:number,a:number,y:number):V{return [Math.sin(a)*r,y,-Math.cos(a)*r];}
function shell(b:Batch,n:number,r:number,s:number,y:number,z:number,c:number,a0=-Math.PI/n){
 for(let i=0;i<n;i++){const a=a0+turn*i/n,t=a+turn/n;
  q(b,round(r,a,y),round(s,a,z),round(s,t,z),round(r,t,y),c);
 }
}
function disk(b:Batch,n:number,r:number,y:number,c:number,a0=-Math.PI/n){
 for(let i=0;i<n;i++)tri(b,[0,y,0],round(r,a0+turn*(i+1)/n,y),round(r,a0+turn*i/n,y),c);
}
function rod(batch:Batch,a:V,b:V,r:number,c:number,n=6){
 const p=new T.Vector3(...a),v=new T.Vector3(...b),t=v.clone().sub(p).normalize();
 const x=new T.Vector3().crossVectors(Math.abs(t.y)>.9?new T.Vector3(1,0,0):new T.Vector3(0,1,0),t).normalize(),z=new T.Vector3().crossVectors(t,x);
 const f=(v:T.Vector3,j:number):V=>v.clone().addScaledVector(x,r*Math.cos(turn*j/n)).addScaledVector(z,r*Math.sin(turn*j/n)).toArray();
 for(let i=0;i<n;i++)q(batch,f(p,i),f(p,i+1),f(v,i+1),f(v,i),c);
}
function drawable(b:Batch,name:string,mat:T.MeshStandardMaterial){
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.p,3));
 g.setAttribute('color',new T.Float32BufferAttribute(b.color,3));
 g.setAttribute('uv',new T.Float32BufferAttribute(b.uv,2));g.computeVertexNormals();g.computeBoundingSphere();
 const m=new T.Mesh(g,mat);m.name=name;return m;
}
function siding(){
 const m=new T.MeshStandardMaterial({vertexColors:true,roughness:.74,side:T.DoubleSide});
 m.onBeforeCompile=s=>{
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 slMetres;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nslMetres=uv;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 slMetres;').replace('#include <color_fragment>',`#include <color_fragment>
  vec2 px=max(fwidth(slMetres),vec2(.0003));
  float y=slMetres.y/.115, row=floor(y), d=fract(y)*.115;
  float x=slMetres.x+.103*mod(row,2.)+.037*sin(row*1.221), cell=floor(x/.232);
  float u=fract(x/.232)*.232;
  float w=1.-smoothstep(.033,.15,max(px.x,px.y));
  float course=(1.-smoothstep(.001,.005+min(px.y,.015),min(d,.115-d)))*.0052/(.0052+.48*px.y);
  float joint=(1.-smoothstep(.001,.003+min(px.x,.018),min(u,.232-u)))*.003/(.003+.6*px.x);
  float top=exp(-abs(d-.010)/.006)*.008/(.008+px.y);
  float panels=fract(sin(cell*3.17+row*13.23)*437.9)-.5;
  diffuseColor.rgb*=1.+w*(-.218*course-.105*joint+.055*top+.025*panels);
  `);
 };
 m.customProgramCacheKey=()=>'knight-point-siding-original-v1';return m;
}

export const KNIGHT_MODEL={xz:KNIGHT_SEAT.xz,face0:KNIGHT_SEAT.face0,nominalHeight:14.3,baseWidth:KNIGHT_SEAT.width,galleryY:9.94} as const;
type Hole={side:number;bottom:number;top:number;half:number;cap:'gable'|'shed'|'plain';door?:true};

/** Private documentary stand-in. Only the overall height is nominally sourced.
  * Direct cross-checks must pass before any runtime composition can be attempted. */
export function drawKnightTower(floor:(x:number,z:number)=>number){
 const M=KNIGHT_MODEL,[x,z]=M.xz,Y=floor(x,z);
 if(!Number.isFinite(Y))throw Error('No Knight ground');
 const deck=M.galleryY,bodyTop=9.48,wide=M.baseWidth/2,narrow=1.56;
 const out=(y:number)=>T.MathUtils.lerp(wide,narrow,T.MathUtils.clamp(y/bodyTop,0,1));
 const face=(i:number,u:number,y:number,s=0,h=out(y)):V=>{
  const a=M.face0+i*turn/4,v=h+s;
  return [Math.sin(a)*v+Math.cos(a)*u,y,-Math.cos(a)*v+Math.sin(a)*u];
 };
 const grade=(p:V)=>floor(x+p[0],z+p[2])-Y;
 const cl=build(),opaque=build(),pane=build(),optic=build();
 const ext=[0,1,2,3].flatMap(i=>[-wide,wide].map(q=>grade(face(i,q,0))));
 if(ext.some(a=>!Number.isFinite(a)||Math.abs(a)>.55)||Math.max(...ext)-Math.min(...ext)>.65)throw Error('Unverified legacy ground');
 const sill=Math.max(...ext)+.20;
 // Redstone footing is precisely seated to the old virtual ground, never a real foundation survey.
 for(let i=0;i<4;i++)for(let j=0;j<16;j++){
  const a=j/16*2-1,b=(j+1)/16*2-1,low=face(i,a*wide,0),hig=face(i,b*wide,0);
  low[1]=grade(low)-.040;hig[1]=grade(hig)-.040;
  q(opaque,low,face(i,a*out(sill-.09),sill-.09),face(i,b*out(sill-.09),sill-.09),hig,[stone,0x906c5b,0x997a64,0xa48976][(i*7+j*3)%4]);
  q(opaque,face(i,a*out(sill-.09),sill-.09,.012),face(i,a*out(sill),sill,.012),face(i,b*out(sill),sill,.012),face(i,b*out(sill-.09),sill-.09,.012),bottomRed);
 }
 // Three separately observed facade roles. The doorless sash pair and
 // the gabled entrance stack are not opposite interpretations of one wall.
 // The real compass bearing and every opening dimension remain unmeasured.
 const {entrySide:entry,entryReach:reach}=KNIGHT_SEAT,halfDeck=.64;
 const platformCorners=[-.70,0,.70].flatMap(u=>[.015,.41,.80,reach].map(o=>grade(face(entry,u,0,o))));
 if(platformCorners.some(a=>!Number.isFinite(a)||Math.abs(a)>.62))throw Error('Unsafe original shoreline seat');
 const stepBase=Math.max(...platformCorners),landing=Math.max(sill+.16,stepBase+.59);
 const holes:Hole[]=[
  {side:0,bottom:7.74,top:9.02,half:.235,cap:'plain'},
  {side:1,bottom:1.63,top:3.24,half:.235,cap:'gable'},
  {side:1,bottom:4.55,top:6.13,half:.235,cap:'gable'},
  {side:entry,bottom:landing+.023,top:2.72,half:.46,cap:'gable',door:true},
  {side:entry,bottom:4.10,top:5.66,half:.242,cap:'gable'},
  {side:entry,bottom:7.56,top:8.97,half:.235,cap:'plain'}
 ];
 const frame=(side:number,a:number,b:number,c:number,d:number,o:number,col:number,back=o-.04)=>{
  const f=(x:number,y:number,z:number)=>face(side,x,y,z);
  q(opaque,f(a,b,o),f(a,d,o),f(c,d,o),f(c,b,o),col);
  q(opaque,f(a,b,back),f(a,d,back),f(a,d,o),f(a,b,o),col);
  q(opaque,f(c,b,o),f(c,d,o),f(c,d,back),f(c,b,back),col);
  q(opaque,f(a,d,back),f(c,d,back),f(c,d,o),f(a,d,o),col);
  q(opaque,f(a,b,o),f(c,b,o),f(c,b,back),f(a,b,back),col);
 };
 for(let side=0;side<4;side++){
  const list=holes.filter(p=>p.side===side).slice().sort((a,b)=>a.bottom-b.bottom);
  const ys=[sill,...list.flatMap(v=>[v.bottom,v.top]),bodyTop].sort((a,b)=>a-b);
  for(let i=1;i<ys.length;i++){
   const a=ys[i-1],b=ys[i],m=(a+b)/2,cut=list.find(v=>v.bottom<m&&v.top>m);
   const r=out(a),s=out(b),h=cut?.half??0;
   const w=(n:number,t:number,v:number,p:number)=>{
    q(cl,face(side,n,a),face(side,t,b),face(side,p,b),face(side,v,a),white,[[n+side*17,a],[t+side*17,b],[p+side*17,b],[v+side*17,a]]);
   };
   if(cut){w(-r,-s,-h,-h);w(h,h,r,s);}else w(-r,-s,r,s);
  }
 }
 for(const a of holes){
  const {side,bottom:y,top:t,half:w}=a, f=(u:number,v:number,o:number)=>face(side,u,v,o);
  frame(side,-w,y,w,t,-.072,a.door?0x8b3736:window,-.09);
  for(const u of [-w,w]){
   q(opaque,f(u,y,-.08),f(u,t,-.08),f(u,t,.01),f(u,y,.01),reveal);
   frame(side,u-.04,y-.033,u+.04,t+.032,.036,redDark);
  }
  frame(side,-w-.055,y-.040,w+.055,y+.008,.067,bottomRed);
  frame(side,-w-.035,t-.023,w+.035,t+.047,.052,red);
  if(!a.door){
   frame(side,-.012,y,.012,t,-.021,sash);
   for(const s of [.25,.50,.75]){const v=y+s*(t-y),j=s===.5?.016:.010;frame(side,-w,v-j,w,v+j,-.022,sash);}
  }else{
   frame(side,-w+.128,y+.19,w-.100,y+.80,-.029,redDark);
   rod(opaque,f(w-.11,y+.95,-.019),f(w-.11,y+.95,.04),.018,bronze);
  }
  const cap=w+.12,e=t+.098;
  if(a.cap==='shed')q(opaque,f(-cap,e+.085,-.03),f(-cap,e,.16),f(cap,e,.16),f(cap,e+.085,-.03),red);
  else if(a.cap==='gable'){
   const peak=e+(a.door?.31:.26);
   tri(opaque,f(-cap,e,.075),f(0,peak,.075),f(cap,e,.075),white);
   for(const s of [-1,1]){
    q(opaque,f(s*cap,e,-.03),f(0,peak,-.03),f(0,peak,.15),f(s*cap,e,.15),red);
    q(opaque,f(s*cap,e,.15),f(0,peak,.15),f(0,peak-.024,.15),f(s*cap,e-.024,.15),redDark);
   }
  }
 }
 // Short, open timber landing integrated with the observed entry face.
 // Equal authored risers are not the real stair specification or a collision change.
 const stair=(u:number,y:number,o:number)=>face(entry,u,y,o,wide);
 const levels=[{at:-.105,depth:.52,y:landing},{at:.415,depth:.24,y:stepBase+.43},
  {at:.655,depth:.23,y:stepBase+.285},{at:.885,depth:.22,y:stepBase+.143}];
 for(let i=0;i<levels.length;i++){
  const s=levels[i],f=s.at+s.depth,y=s.y,c=i===0?0x866049:0x724c40;
  q(opaque,stair(-halfDeck,y,s.at),stair(-halfDeck,y,f),stair(halfDeck,y,f),stair(halfDeck,y,s.at),c);
  q(opaque,stair(-halfDeck,y-.083,f),stair(-halfDeck,y,f),stair(halfDeck,y,f),stair(halfDeck,y-.083,f),redDark);
 }
 for(const side of [-1,1]){
  // Rear sloping stringers tie the individually open treads to the landing.
  const runner=side*.53;
  rod(opaque,stair(runner,landing-.085,.26),stair(runner,stepBase+.05,1.1),.045,redDark,4);
  const u=side*halfDeck,a=stair(u,landing+.81,.11),b=stair(u,landing+.81,.43),c=stair(u,stepBase+.83,1.12);
  rod(opaque,a,b,.026,red,6);rod(opaque,b,c,.026,red,6);
  for(const [at,y] of [[.13,landing+.81],[.44,landing+.81],[1.055,stepBase+.845]] as const){
   const p=stair(u,0,at);p[1]=grade(p)-.018;
   rod(opaque,p,stair(u,y,at),.033,redDark,6);
  }
 }
 // Four-sided gallery, bracketed cornice, and iron rails kept open at all distances.
 const D=[ [9.37,1.57,white],[9.53,1.60,white],[9.63,1.80,redDark],[9.71,1.85,red],[9.81,1.95,redEdge],[9.87,1.95,red],[deck,1.94,redDark] ] as const;
 for(let i=1;i<D.length;i++)shell(opaque,4,D[i-1][1]*Math.SQRT2,D[i][1]*Math.SQRT2,D[i-1][0],D[i][0],D[i][2],M.face0-Math.PI/4);
 disk(opaque,4,1.94*Math.SQRT2,deck,0x8b655c,M.face0-Math.PI/4);
 for(let k=0;k<4;k++){
  for(const u of [-1.26,-.84,-.42,0,.42,.84,1.26]){
   const b=face(k,u,9.28,.024,1.56),l=face(k,u,9.64,.282,1.56),h=face(k,u,9.64,.024,1.56);
   for(const s of [-1,1]){
    const t=(p:V):V=>[p[0]+Math.cos(M.face0+k*turn/4)*s*.044,p[1],p[2]+Math.sin(M.face0+k*turn/4)*s*.044];
    tri(opaque,t(b),t(l),t(h),redDark);
   }
   rod(opaque,b,l,.025,red,5);
  }
  const f=(u:number,y:number)=>face(k,u,y,0,1.87);
  for(const u of [-1.87,-.91,0,.91])rod(opaque,f(u,deck),f(u,deck+.96),.023,red);
  for(const dy of [.35,.67,.96])rod(opaque,f(-1.87,deck+dy),f(1.87,deck+dy),.019,red);
 }
 // Curved lantern collar/pressed red dome modeled as graded rings rather than a faceted cone.
 const A=M.face0,glassLo=10.86,glassHi=12.20,n=12;
 shell(opaque,36,1.03,1.02,deck,glassLo,red,A);
 shell(opaque,36,1.064,1.04,10.02,10.12,redDark,A);
 shell(opaque,36,1.05,1.05,glassLo-.037,glassLo+.021,redEdge,A);
 for(let i=0;i<n;i++){
  const a=A+i*turn/n,b=a+turn/n;
  q(pane,round(1.006,a,glassLo),round(1.006,a,glassHi),round(1.006,b,glassHi),round(1.006,b,glassLo),0xcbd9d0);
  rod(opaque,round(1.018,a,glassLo),round(1.018,a,glassHi),.019,0xb1b0a2,6);
 }
 const top=[[12.17,1.027],[12.20,1.10],[12.27,1.10],[12.32,1.07],[12.49,.99],[12.65,.85],
  [12.79,.68],[12.89,.51],[12.94,.35],[13.13,.34],[13.17,.38],[13.21,.335],[13.24,.28],[13.27,.16]];
 for(let i=1;i<top.length;i++)shell(opaque,36,top[i-1][1],top[i][1],top[i-1][0],top[i][0],i%4===1?redDark:red,A);
 disk(opaque,36,.16,13.27,redDark,A);
 rod(opaque,[0,13.25,0],[0,M.nominalHeight,0],.022,redDark,8);
 rod(opaque,[-.27,13.879,.06],[.23,13.879,-.05],.015,redDark,6);
 tri(opaque,[.28,13.879,-.06],[.122,13.92,-.032],[.122,13.832,-.032],redEdge);
 for(let i=0;i<12;i++){
  const yg=glassLo+.15+i*.065;const radius=.255+.075*Math.sin((i+.5)*Math.PI/12);
  shell(optic,24,radius,radius*.99,yg,yg+.052,i%3===0?0xc8d7b8:0xb2c1a8,A);
 }
 const g=new T.Group();g.name='Knight Point · original authored exterior';g.position.set(x,Y,z);
 g.add(drawable(cl,'Tapered white shaft',siding()),
  drawable(opaque,'Red brackets, gallery, dome and redstone foot',new T.MeshStandardMaterial({vertexColors:true,roughness:.68,metalness:.10,side:T.DoubleSide})),
  drawable(optic,'Static nominal internal optic',new T.MeshStandardMaterial({vertexColors:true,roughness:.28,metalness:.22,side:T.DoubleSide})),
  drawable(pane,'Separate glazed lantern panes',new T.MeshStandardMaterial({vertexColors:true,roughness:.21,metalness:.11,transparent:true,opacity:.36,depthWrite:false,side:T.FrontSide})));
 g.userData.knightFacadeFamilies=[0,1,2,3].map(side=>holes.filter(q=>q.side===side).map(q=>({cap:q.cap,door:!!q.door,bottom:q.bottom,top:q.top})));
 return g;
}
