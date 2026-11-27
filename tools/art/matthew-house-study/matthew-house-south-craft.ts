/** Original, detached place-specific details for Matthew House (Canadian Register id 19170).
 * No photos, image samplers, packaged elevations, scene hooks or atlas writes.
 *
 * The South craft builder is a human-scale reference STUDY, not a known surveyed
 * sash or projection width. Its caller supplies a bound and storey datums.
 * Roof faces are supplied separately by a source-qualified caller. In particular
 * a lone stable eave/slope does not generate its opposite side or fill /130.
 */
import * as THREE from 'three';

type P=readonly [number,number,number];
type V=readonly [number,number];
type O={p:P,u:number,v:number};
type Band={lo:number;hi:number;bottom:number;top:number};
type Side={o:P,x:P,n:P};
type Kind=0|1|2|3|4|5|6;
const W:Kind=0, TILE:Kind=1, FRAME:Kind=2, GLASS:Kind=3, STONE:Kind=4, ROOF:Kind=5, RECESS:Kind=6;
const finite=(v:number)=>Number.isFinite(v);
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const add=(a:P,b:P):P=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const r=(a:P,b:P):P=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const scale=(a:P,n:number):P=>[a[0]*n,a[1]*n,a[2]*n];
const dot=(a:P,b:P)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:P,b:P):P=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=(p:P):P=>{const h=Math.hypot(...p);if(h<1e-9||!finite(h))throw new Error('Degenerate Matthew House surface');return scale(p,1/h);};
const U:P=[0,1,0];
const XP:P=[1,0,0],ZP:P=[0,0,1];
const zero:P=[0,0,0];
const uniq=(a:number[])=>[...new Set(a)].sort((x,y)=>x-y);
const point=(s:Side,x:number,y:number,d=0):P=>add(s.o,add(scale(s.x,x),add(scale(U,y),scale(s.n,d))));
function face(a:P,b:P):Side{const x=norm(r(b,a));return {o:a,x,n:norm(cross(x,U))};}
class Batch{
 readonly pos:number[]=[]; readonly normal:number[]=[]; readonly uv:number[]=[];
 readonly roles:number[]=[]; readonly tonal:number[]=[];
 add(a:O,b:O,c:O,role:Kind,shade=1,guide?:P){
  let n=cross(r(b.p,a.p),r(c.p,a.p));
  if(guide&&dot(n,guide)<0){[b,c]=[c,b];n=scale(n,-1);}
  n=norm(n);
  for(const x of [a,b,c]){
   if(!x.p.every(finite)||!finite(x.u+x.v+shade))throw new Error('Non-finite Matthew House geometry');
   this.pos.push(...x.p);this.normal.push(...n);this.roles.push(role);this.uv.push(x.u,x.v);this.tonal.push(shade);
  }
 }
 qt(a:O,b:O,c:O,d:O,k:Kind,t=1,n?:P){this.add(a,b,c,k,t,n);this.add(a,c,d,k,t,n);}
 box(s:Side,a:number,b:number,y:number,z:number,back:number,front:number,k:Kind,c=1){
  if(b-a<1e-6||z-y<1e-6||front-back<1e-6)return;
  this.rect(s,a,b,y,z,front,k,c);
  const at=(x:number,y:number,v:number)=>({p:point(s,x,y,v),u:x-a,v:y});
  const sides:(readonly [O,O,O,O,P])[]=[
   [at(a,y,front),at(a,y,back),at(a,z,back),at(a,z,front),scale(s.x,-1)],
   [at(b,y,back),at(b,y,front),at(b,z,front),at(b,z,back),s.x],
   [at(a,z,back),at(b,z,back),at(b,z,front),at(a,z,front),U],
   [at(a,y,front),at(b,y,front),at(b,y,back),at(a,y,back),scale(U,-1)]
  ];
  for(const [a,b,e,f,n] of sides){ this.qt(a,b,e,f,k,c*.96,n); }
  // Back faces of outward ornament are entirely behind the skin.
 }
 rect(s:Side,a:number,b:number,y:number,z:number,dep:number,k:Kind,c=1){
  if(b-a<1e-6||z-y<1e-6)return;
  const at=(x:number,y:number)=>({p:point(s,x,y,dep),u:dot(point(s,x,y,dep),XP)+.31*dot(point(s,x,y,dep),ZP),v:y});
  this.qt(at(a,y),at(b,y),at(b,z),at(a,z),k,c,s.n);
 }
 geometry(){
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(this.pos,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(this.normal,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(this.uv,2));
  g.setAttribute('matthewRole',new THREE.Float32BufferAttribute(this.roles,1));
  g.setAttribute('matthewShade',new THREE.Float32BufferAttribute(this.tonal,1));
  g.computeBoundingBox();g.computeBoundingSphere();
  return g;
 }
}
function wall(b:Batch,s:Side,x0:number,x1:number,y0:number,y1:number,holes:Band[],k:Kind=W){
 const X=uniq([x0,x1,...holes.flatMap(q=>[q.lo,q.hi])]),Y=uniq([y0,y1,...holes.flatMap(q=>[q.bottom,q.top])]);
 for(let j=0;j<Y.length-1;j++)for(let i=0;i<X.length-1;i++){
  const x=(X[i]+X[i+1])*.5,y=(Y[j]+Y[j+1])*.5;
  if(!holes.some(q=>x>q.lo&&x<q.hi&&y>q.bottom&&y<q.top))b.rect(s,X[i],X[i+1],Y[j],Y[j+1],0,k);
 }
}
function inset(b:Batch,s:Side,a:Band,paired:boolean,near:boolean){
 const m=a.hi-a.lo,n=a.top-a.bottom;
 const skinClear=Math.min(point(s,a.lo,a.bottom)[2],point(s,a.hi,a.bottom)[2]);
 const depth=Math.min(.112,m*.16,Math.max(.009,(skinClear-.001)/Math.max(s.n[2],.01)));
 const at=(x:number,y:number,d:number)=>({p:point(s,x,y,d),u:x,v:y});
 const {lo,hi,bottom:bt,top:tp}=a;
 const wallK:Kind=near?RECESS:FRAME;
 // Four jambs connect the actual hole to the solid glass plane, not an
 // overlapping clear decal; runs in one opaque draw in both sizes.
 b.qt(at(lo,bt,0),at(lo,bt,-depth),at(lo,tp,-depth),at(lo,tp,0),wallK,.91,s.x);
 b.qt(at(hi,bt,-depth),at(hi,bt,0),at(hi,tp,0),at(hi,tp,-depth),wallK,.88,scale(s.x,-1));
 b.qt(at(lo,bt,-depth),at(hi,bt,-depth),at(hi,bt,0),at(lo,bt,0),wallK,.97,U);
 b.qt(at(lo,tp,0),at(hi,tp,0),at(hi,tp,-depth),at(lo,tp,-depth),wallK,.90,scale(U,-1));
 const trim=Math.min(near?.05:.061,m*.10),yMid=lerp(bt,tp,.49);
 b.rect(s,lo,hi,bt,tp,-depth,GLASS,.91);
 // The sash is visibly stepped even at the oblique west side. Medium keeps
 // the actual glass aperture and silhouette rather than a black flat decal.
 for(const x of [lo,hi-trim])b.box(s,x,x+trim,bt,tp,-depth,-depth*.54,FRAME);
 for(const y of [bt,yMid-trim*.4,tp-trim*.72])b.box(s,lo,hi,y,y+trim*.72,-depth,-depth*.53,FRAME);
 if(paired){
  const mid=(lo+hi)*.5;
  b.box(s,mid-trim*.52,mid+trim*.52,bt,tp,-depth,-depth*.33,FRAME,1.0);
 }
 if(near){
  const e=.045,hy=Math.min(.082,n*.055);
  b.box(s,lo-e,lo+.008,bt-e,tp+.015,0,.032,FRAME,.98);
  b.box(s,hi-.008,hi+e,bt-e,tp+.015,0,.032,FRAME,.98);
  b.box(s,lo-e,hi+e,bt-e,bt+hy*.32,-.014,.085,FRAME,1.013);
  b.box(s,lo-e,hi+e,tp+.001,tp+hy,.0,.052,FRAME,1.01);
 }
}
/** Tapering wood wind brace; the cut edge profile is original. Coordinates
 * describe a shallow narrow bracket, not a scanned carving. */
function bracket(b:Batch,s:Side,x:number,y:number,d:number,k:number){
 const vv:V[]=[[0,0],[.052,0],[.050,-.039],[.035,-.074],[.040,-.143],[.016,-.217],[0,-.232]];
 const L=vv.map(([u,v])=>({p:point(s,x-k*.039,y+v*k,d+u*k),u,v}));
 const Rr=vv.map(([u,v])=>({p:point(s,x+k*.039,y+v*k,d+u*k),u,v}));
 for(let j=1;j<vv.length-1;j++){b.add(L[0],L[j],L[j+1],FRAME,.93,scale(s.x,-1));
  b.add(Rr[0],Rr[j],Rr[j+1],FRAME,.96,s.x);}
 for(let j=0;j<vv.length-1;j++)b.qt(L[j],Rr[j],Rr[j+1],L[j+1],FRAME,.985);
}
function medallion(b:Batch,s:Side,x:number,y:number,d:number,radius:number){
 const steps=24;
 const ring=Array.from({length:steps},(_,i)=>{
  const a=i*Math.PI*2/steps+.25*Math.PI;
  const rr=radius*(.77+.19*Math.cos(4*a));
  return [Math.cos(a)*rr,Math.sin(a)*rr] as V;
 });
 const ot=(p:V,z:number,f:number)=>({p:point(s,x+f*p[0],y+f*p[1],z),u:p[0],v:p[1]});
 const center:O={p:point(s,x,y,d+.009),u:0,v:0};
 for(let i=0;i<steps;i++){
  const a=ring[i],c=ring[(i+1)%steps];
  b.add(center,ot(a,d+.009,.80),ot(c,d+.009,.80),FRAME,.995,s.n);
  b.qt(ot(a,d+.009,.80),ot(a,d,1),ot(c,d,1),ot(c,d+.009,.80),FRAME,.91,s.n);
 }
}
function lace(b:Batch,s:Side,a:V,z:V,w:number,limit:readonly [V,V,V]){
 const dx=z[0]-a[0],dy=z[1]-a[1],h=Math.hypot(dx,dy);
 if(h<1e-6)return;
 const x=-dy*w/h*.5,y=dx*w/h*.5;
 let ps:V[]=[[a[0]+x,a[1]+y],[a[0]-x,a[1]-y],[z[0]-x,z[1]-y],[z[0]+x,z[1]+y]];
 for(let k=0;k<3&&ps.length>=3;k++){
  const A=limit[k],B=limit[(k+1)%3],next:V[]=[];
  const v=(q:V)=>(B[0]-A[0])*(q[1]-A[1])-(B[1]-A[1])*(q[0]-A[0]);
  for(let i=0;i<ps.length;i++){
   const p=ps[i],q=ps[(i+1)%ps.length],l=v(p),k=v(q);
   if(l>=0)next.push(p);
   if(l*k<0){const t=l/(l-k);next.push([lerp(p[0],q[0],t),lerp(p[1],q[1],t)]);}
  }
  ps=next.filter((p,i)=>Math.hypot(p[0]-next[(i+next.length-1)%next.length][0],p[1]-next[(i+next.length-1)%next.length][1])>1e-8);
 }
 if(ps.length<3)return;
 const cp=(q:V,d:number)=>({p:point(s,q[0],q[1],d),u:q[0],v:q[1]});
 for(let i=1;i<ps.length-1;i++){
  const [a,b0,c]=[ps[0],ps[i],ps[i+1]];
  const area=(b0[0]-a[0])*(c[1]-a[1])-(b0[1]-a[1])*(c[0]-a[0]);
  if(Math.abs(area)>1e-8)b.add(cp(a,.058),cp(b0,.058),cp(c,.058),FRAME,1.012,s.n);
 }
 for(let i=0;i<ps.length;i++){
  const j=(i+1)%ps.length;
  b.qt(cp(ps[i],.008),cp(ps[j],.008),cp(ps[j],.058),cp(ps[i],.058),FRAME,.94);
 }
}
function bayProfile(c:number,half:number,depth:number,y:number):[P,P,P,P]{
 return [[c-half,y,0],[c-half*.66,y,depth],[c+half*.66,y,depth],[c+half,y,0]];
}
function loft(b:Batch,l:[P,P,P,P],h:[P,P,P,P],k:Kind,c=1){
 for(let i=0;i<3;i++){
  const j=i+1;
  const o=(p:P)=>({p,u:p[0]+.33*p[2],v:p[1]});
  b.qt(o(l[i]),o(l[j]),o(h[j]),o(h[i]),k,c,ZP);
 }
}
function bayBody(b:Batch,c:number,wide:number,depth:number,base:number,eave:number,near:boolean){
 const L=eave-base,half=wide*.5,H=(n:number)=>base+n*L;
 const profile=(a:number,d:number,v:number)=>bayProfile(c,half*a,depth*d,H(v));
 loft(b,profile(1,1,0),profile(1,1,.084),STONE,.98);
 loft(b,profile(1,1,.084),profile(1,1,.205),W);
 loft(b,profile(1,1,.205),profile(1.009,1.032,.210),FRAME,.99);
 loft(b,profile(1.009,1.032,.210),profile(1,1,.216),FRAME,.98);
 const faceWindowBand=(lo:number,hi:number,loWin:number,hiWin:number,d:number,upper:boolean)=>{
  const p=profile(1,d,0);
  for(let i=0;i<3;i++){
   const s=face(p[i],p[i+1]),n=Math.hypot(p[i+1][0]-p[i][0],p[i+1][2]-p[i][2]);
   // Break a wide sash into two lights, and a narrow chamfer into one.
   // Source photos support the contrast; dimensions are authored in envelope.
   const h={lo:n*(i===1?.15:.18),hi:n*(i===1?.85:.82),bottom:loWin,top:hiWin};
   wall(b,s,0,n,lo,hi,[h],upper?TILE:W);
   inset(b,s,h,i===1,near);
   if(near&&!upper&&i===1){
    const plateY=lerp(hiWin,hi,.58),rad=Math.min(.062,n*.073);
    b.box(s,n*.15,n*.85,hiWin+.062,hi-.027,0,.032,FRAME,.975);
    for(const a of [.26,.4,.60,.74])medallion(b,s,n*a,plateY,.033,rad);
    bracket(b,s,n*.115,hi-.015,.021,.91);bracket(b,s,n*.885,hi-.015,.021,.91);
   }
  }
 };
 faceWindowBand(H(.216),H(.478),H(.233),H(.424),1,false);
 loft(b,profile(1,1,.478),profile(1.009,1.032,.484),FRAME,1.0);
 loft(b,profile(1.009,1.032,.484),profile(1.006,1.027,.493),FRAME,1.0);
 loft(b,profile(1.006,1.027,.493),profile(1,.77,.585),TILE,.994);
 loft(b,profile(1,.77,.585),profile(1,.77,.60),FRAME,1.0);
 faceWindowBand(H(.60),H(.935),H(.646),H(.885),.77,true);
 loft(b,profile(1,.77,.935),profile(1.008,.812,.947),FRAME);
 loft(b,profile(1.008,.812,.947),profile(1.01,.826,.970),FRAME,.994);
 for(const[p,t] of [[profile(1.01,.826,.970),profile(1.01,.826,.973)] as const])loft(b,p,t,FRAME,.88);
 // Discrete flat tops are under the overhanging face eave; they do not
 // speculate about the adjacent roof faces or outside lot.
 const k=profile(1.01,.826,.973);
 const vx=(p:P)=>({p,u:p[0],v:p[2]});
 b.qt(vx(k[0]),vx(k[1]),vx(k[2]),vx(k[3]),FRAME,.93,U);
}
const vertexShader=String.raw`
attribute float matthewRole,matthewShade;
varying vec3 mPos,mNormal;
varying vec2 mUv;
varying float mRole,mShade;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){
  vec4 p=modelMatrix*vec4(position,1.);
  mPos=p.xyz;mUv=uv;mRole=matthewRole;mShade=matthewShade;
  mNormal=normalize(mat3(modelMatrix)*normal);
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
  #include <logdepthbuf_vertex>
}
`;
const fragmentShader=String.raw`
uniform vec3 matthewSun;
varying vec3 mPos,mNormal;
varying vec2 mUv;
varying float mRole,mShade;
#include <common>
#include <logdepthbuf_pars_fragment>
float mn(vec2 p){
 p=fract(p*vec2(.1031,.1099));
 p+=dot(p,p.yx+33.33);
 return fract((p.x+p.y)*p.x);
}
float cont(vec2 p){
 vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(mn(i),mn(i+vec2(1.,0.)),f.x),mix(mn(i+vec2(0.,1.)),mn(i+1.),f.x),f.y);
}
float member(float q,float px,float w){
 float t=abs(fract(q+.5)-.5);
 return (1.-smoothstep(w,w+max(px,.002),t))*(1.-smoothstep(.36,.96,px));
}
void main(){
 #include <logdepthbuf_fragment>
 vec2 dw=max(fwidth(mUv),vec2(.0001));
 vec3 n=normalize(mNormal),s=normalize(matthewSun);
 vec3 poi=normalize(cameraPosition-mPos);
 float stain=cont(vec2(mUv.x*.61,mUv.y*.43));
 float grain=cont(mUv*vec2(16.,2.4));
 float cool=.25+.75*clamp(dot(s,n),0.,1.);
 vec3 coat=vec3(.742,.747,.705)*(.971+.051*stain+.025*grain);
 float rows=member(mUv.y/.153,dw.y/.153,.035);
 vec3 col=coat*(1.-.075*rows);
 if(mRole>.5&&mRole<1.5){
  float r=mUv.y/.134;
  float q=mUv.x/.218+mod(floor(r),2.)*.5;
  float wave=.15*cos(6.2831853*q);
  float rim=member(r+wave,max(dw.y/.134,dw.x/.218),.04);
  float lap=member(q,dw.x/.218,.023);
  col=coat*vec3(.96,.967,.955)*(1.-.127*rim-.065*lap);
 }else if(mRole>1.5&&mRole<2.5){
  col=vec3(.812,.814,.766)*(.978+.037*stain-.019*grain);
 }else if(mRole>3.5&&mRole<4.5){
  float s=cont(mUv*vec2(2.2,3.9));
  col=vec3(.332,.293,.248)*(.80+.17*stain+.14*s);
 }else if(mRole>4.5&&mRole<5.5){
  col=vec3(.102,.107,.100)*(.875+.165*stain+.06*grain)
       *(1.-.060*member(mUv.y/.162,dw.y/.162,.04));
 }else if(mRole>5.5){
  col=vec3(.481,.479,.431)*(.88+.085*stain);
 }
 col*=mShade*(.71+.27*cool)+vec3(.014,.021,.028)*(1.-cool);
 if(mRole>2.5&&mRole<3.5){
  vec3 rr=reflect(-poi,n);
  float sky=smoothstep(-.19,.53,rr.y),f=pow(1.-clamp(dot(poi,n),0.,1.),3.);
  float fogged=cont(vec2(mPos.x*.47+mPos.z*.35,mUv.y*.40));
  vec3 interior=mix(vec3(.027,.030,.026),vec3(.055,.060,.053),fogged*.55);
  vec3 glass=mix(vec3(.105,.119,.108),vec3(.36,.445,.490),sky);
  col=mix(interior,glass,.33+.40*f)*mShade;
 }
 gl_FragColor=vec4(max(col,0.),1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}
`;
export type MatthewArtQuality='near'|'mid';
export type MatthewSouthCraftEnvelope={
 /** Local meters; accepts an explicit source-bound display frame, never an in-game placement. */
 readonly width:number;
 readonly bottom:number;
 readonly eave:number;
 /** Hard limit for signed outward volume; if not supported, no mount. */
 readonly depthLimit:number;
 /** Optional ONLY when the caller has source-backed end orientation and height, not inferred from photo. */
 readonly measuredGableEnd?:{readonly left:number;readonly right:number;readonly peakX:number;readonly peakY:number};
};
export type MatthewMeasuredRoofFace={
 readonly id:string;readonly sourceEvidence:string;
 /** Exact local physical measured role face; no photo-derived positions. */
 readonly triangle:readonly [P,P,P];
};
function guard(e:MatthewSouthCraftEnvelope){
 const {width,bottom,eave,depthLimit:d}=e;
 if(![width,bottom,eave,d].every(finite)||!(width>=6.8&&width<=16&&eave-bottom>=4.6&&eave-bottom<=10.2&&d>=.32&&d<=1.45))
  throw new Error('Bad Matthew House detached craft envelope');
 const g=e.measuredGableEnd;
 if(g&&(![g.left,g.right,g.peakX,g.peakY].every(finite)||!(g.left>=-width*.5&&g.right<=width*.5&&g.peakX>g.left+.5&&g.peakX<g.right-.5&&g.peakY>eave+.65&&g.peakY<eave+9)))
  throw new Error('No valid source-bound gable receiver');
}
function addFront(b:Batch,e:MatthewSouthCraftEnvelope,q:MatthewArtQuality){
 guard(e);const near=q==='near';
 const {width:w,bottom:y,eave:h}=e;
 const s:Side={o:zero,x:XP,n:ZP};
 const yB=y+.30,depth=(e.depthLimit-.105)/1.04;
 const center=w*.217,bayWidth=w*.286;
 // Background wall is just behind both bays and its face shared only where
 // visible. No extra interior/driveway, historic porch or stock tree in scope.
 b.rect(s,-w*.5,w*.5,y,yB,-.003,STONE,.98);
 b.rect(s,-w*.5,w*.5,yB,h,-.003,W,1);
 for(const c of [-center,center])bayBody(b,c,bayWidth,depth,y,h,near);
 const trim=Math.max(.069,w*.0095);
 b.box(s,-w*.5,-w*.5+trim,yB,h,-.004,.043,FRAME);
 b.box(s,w*.5-trim,w*.5,yB,h,-.004,.043,FRAME);
 b.box(s,-w*.5,w*.5,h-.117,h,-.003,.087,FRAME,.965);
 const g=e.measuredGableEnd;
 if(g){
  const t=(x:number,u:number,dep=0)=>({p:point(s,x,u,dep),u:x,v:u});
  b.add(t(g.left,h,-.003),t(g.right,h,-.003),t(g.peakX,g.peakY,-.003),TILE,1,ZP);
  const P=(f:number,x:number)=>[lerp(g.peakX,x,f),lerp(g.peakY,h,f)] as V;
  const A=P(.435,g.left),B=P(.435,g.right);
  const limit:readonly [V,V,V]=[[g.left,h],[g.right,h],[g.peakX,g.peakY]];
  lace(b,s,A,B,near?.084:.109,limit);
  lace(b,s,[g.left,h],[g.peakX,g.peakY],.118,limit);
  lace(b,s,[g.right,h],[g.peakX,g.peakY],.118,limit);
  const tip=P(.12,g.peakX),oj=[lerp(A[0],B[0],.50),A[1]] as V;
  lace(b,s,oj,tip,.086,limit);
  for(const z of [[.18,.32],[.33,.205],[.67,.205],[.82,.32]]){
   const summit=P(z[1],z[0]<.5?g.left:g.right);
   lace(b,s,[lerp(A[0],B[0],z[0]),A[1]],summit,.064,limit);
  }
 }
}
function addRoof(b:Batch,faces:readonly MatthewMeasuredRoofFace[]){
 if(faces.length>512||new Set(faces.map(f=>f.id)).size!==faces.length)throw new Error('Invalid detached roof face roster');
 for(const f of faces){
  if(!f.id||!f.sourceEvidence||f.triangle.length!==3)throw new Error('Missing source-labelled roof role');
  const t=f.triangle.map(p=>({p,u:p[0],v:p[2]}));const n=cross(r(t[1].p,t[0].p),r(t[2].p,t[0].p));
  if(Math.abs(n[1])<1e-7)throw new Error('A wall is not a qualified roof patch');
  b.add(t[0],t[1],t[2],ROOF,1,U);
 }
}
function output(b:Batch,sun:THREE.Vector3,q:MatthewArtQuality){
 if(!sun.toArray().every(finite)||sun.lengthSq()<1e-5)throw new Error('Missing finite scene sunlight');
 const g=b.geometry();
 const mat=new THREE.ShaderMaterial({
  uniforms:{matthewSun:{value:sun.clone().normalize()}},vertexShader,fragmentShader,side:THREE.FrontSide,depthWrite:true,
  depthTest:true,transparent:false,vertexColors:false,alphaTest:0,toneMapped:true
 });
 const mesh=new THREE.Mesh(g,mat);
 mesh.name='Matthew House · detached south elevation craft';
 mesh.userData=Object.freeze({detachedArchitecturalStudy:true,quality:q,noTerrainNoPlacement:true,nearRoofOnlyFromCaller:true});
 const cap=q==='near'?6000:2400;
 if(g.attributes.position.count/3>cap){g.dispose();mat.dispose();throw new Error('Matthew House detached draw budget exceeded');}
 return {mesh,dispose(){g.dispose();mat.dispose();},triangles:g.attributes.position.count/3};
}
/** Detached only. Supplied roof triangles, if any, are emitted verbatim inside their
 * frozen scope; uncovered geometry remains absent. No body, neighbor, or run-time selection. */
export function createMatthewSouthCraftStudy(e:MatthewSouthCraftEnvelope,sun:THREE.Vector3,q:MatthewArtQuality='near',roof:readonly MatthewMeasuredRoofFace[]=[]){
 if(q!=='near'&&q!=='mid')throw new Error('Unknown Matthew House art tier');
 const b=new Batch();addFront(b,e,q);addRoof(b,roof);return output(b,sun,q);
}
