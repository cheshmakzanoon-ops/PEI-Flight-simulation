/** Original detached exterior, Cape Bear's relocated timber museum light.
 * No site transform, mount, site additions, navigational light, or interiors.
 * Only nominal 12.2m published; all other dimensions are approximate design. */
import * as T from 'three';
export const CAPE_BEAR=Object.freeze({
 height:12.2,baseWidth:5.55,shaftTopWidth:3.10,shaftY0:.32,shaftY1:8.97,
 gallerySize:4.05,galleryY:9.48,railTop:10.33,lanternRadius:1.09,
 sashCenter:[2.34,5.12,7.72] as const, sashWidth:.716,sashHeight:1.38, sashReturn:.14,
 glazedHeadBand:[10.18,11.32] as const,sashFace:[0,1] as const,
 faceMeaning:'local-only, photograph-supported pair of adjacent window-bearing faces; other openings and lower access held',
});
const roles=['shingle','paintedTrim','quietBase','iron','galleryRail','steelRoof','returnShade','backedGlass'] as const;
export type BearRole=typeof roles[number];
type V=T.Vector3;
type Q=readonly [number,number];
type Streams={p:number[];n:number[];uv:number[];tops:number[];parts:Set<string>};
const vec=(x:number,y:number,z:number)=>new T.Vector3(x,y,z);
const up=vec(0,1,0),down=vec(0,-1,0);
const horizontal=[vec(0,0,-1),vec(1,0,0),vec(0,0,1),vec(-1,0,0)];
const τ=2*Math.PI;

class Model{
 readonly streams=new Map<BearRole,Streams>();
 private part='detail';
 readonly component=new Map<string,number[]>();
 private fixedT(a:V,b:V,c:V,n:V,uv:readonly [Q,Q,Q],r:BearRole){
  const t=this.streams.get(r)??{p:[],n:[],uv:[],tops:[],parts:new Set};
  const xs=this.component.get(this.part)??[];
  [a,b,c].forEach((q,i)=>{t.p.push(q.x,q.y,q.z);t.n.push(n.x,n.y,n.z);t.uv.push(...uv[i]);xs.push(q.x,q.y,q.z);});
  t.parts.add(this.part);this.component.set(this.part,xs);this.streams.set(r,t);
 }
 as(label:string,fn:()=>void){const p=this.part;this.part=label;try{fn();}finally{this.part=p;}}
 t(A:V,B:V,C:V,normal:V,r:BearRole,UV:readonly [Q,Q,Q]=[[A.x+A.z,A.y],[B.x+B.z,B.y],[C.x+C.z,C.y]]){
  const n=B.clone().sub(A).cross(C.clone().sub(A));
  if(n.lengthSq()<1e-18)throw Error('Zero triangle '+r+' '+this.part);
  const a=n.dot(normal);
  if(Math.abs(a)<1e-12)throw Error('Ambiguous winding '+r+' '+this.part);
  if(a>0)this.fixedT(A,B,C,n.normalize(),UV,r);
  else this.fixedT(A,C,B,n.negate().normalize(),[UV[0],UV[2],UV[1]],r);
 }
 q(a:V,b:V,c:V,d:V,n:V,r:BearRole,uv:readonly [Q,Q,Q,Q]=[[a.x+a.z,a.y],[b.x+b.z,b.y],[c.x+c.z,c.y],[d.x+d.z,d.y]]){
  this.t(a,b,c,n,r,[uv[0],uv[1],uv[2]]);this.t(a,c,d,n,r,[uv[0],uv[2],uv[3]]);
 }
 cap(ring:readonly V[],n:V,m:BearRole){
  const c=ring.reduce((a,b)=>a.add(b),vec(0,0,0)).divideScalar(ring.length);
  for(let i=0;i<ring.length;i++)this.t(c,ring[i],ring[(i+1)%ring.length],n,m,
   [[c.x,c.z],[ring[i].x,ring[i].z],[ring[(i+1)%ring.length].x,ring[(i+1)%ring.length].z]]);
 }
 sideLoop(a:readonly V[],b:readonly V[],role:BearRole){
  if(a.length!==b.length)throw Error('Ring mismatch');
  for(let i=0;i<a.length;i++){
   const j=(i+1)%a.length,o=vec(a[i].x+a[j].x,0,a[i].z+a[j].z);
   this.q(a[i],a[j],b[j],b[i],o,role);
  }
 }
 section(levels:readonly (readonly[a:number,w:number])[],ring:(y:number,w:number)=>V[],side:BearRole,top=side,bottom=side){
  const r=levels.map(([y,x])=>ring(y,x));
  this.cap(r[0],down,bottom);
  for(let i=1;i<r.length;i++)this.sideLoop(r[i-1],r[i],side);
  this.cap(r.at(-1)!,up,top);
 }
 solidP(a:readonly V[],b:readonly V[],nn:V,role:BearRole,sides=role){
  const center=a.reduce((z,p)=>z.add(p),vec(0,0,0)).divideScalar(a.length);
  const centerB=b.reduce((z,p)=>z.add(p),vec(0,0,0)).divideScalar(b.length);
  const front=center.clone().add(centerB).multiplyScalar(.5);
  this.cap(a,nn,role);this.cap(b,nn.clone().negate(),role);
  for(let i=0;i<a.length;i++){
   const j=(i+1)%a.length,m=a[i].clone().add(a[j]).add(b[i]).add(b[j]).multiplyScalar(.25);
   this.q(a[i],a[j],b[j],b[i],m.sub(front),sides);
  }
 }
 rod(a:V,b:V,rad:number,r:BearRole,N=6,end=rad){
  if(!(rad>0&&N>=4&&a.distanceToSquared(b)>1e-10))throw Error('Bad exterior rod');
  const d=b.clone().sub(a).normalize();
  const x=Math.abs(d.y)>.8?vec(0,0,1):up.clone();
  const u=x.cross(d).normalize(),v=d.clone().cross(u).normalize();
  const dir=(i:number)=>u.clone().multiplyScalar(Math.cos(τ*i/N)).addScaledVector(v,Math.sin(τ*i/N));
  const P=Array.from({length:N},(_,i)=>a.clone().addScaledVector(dir(i),rad));
  const Q=Array.from({length:N},(_,i)=>b.clone().addScaledVector(dir(i),end));
  this.solidP(Q,P,d,r);
 }
 make(){
  const g=new T.BufferGeometry(),p:number[]=[],n:number[]=[],uv:number[]=[];
  const counts:Record<string,number>={}, parts:Record<string,string[]>={};
  for(const [i,r] of roles.entries()){
   const a=this.streams.get(r);
   if(!a)throw Error('Unfilled role '+r);
   g.addGroup(p.length/3,a.p.length/3,i);
   p.push(...a.p);n.push(...a.n);uv.push(...a.uv);counts[r]=a.p.length/9;parts[r]=[...a.parts].sort();
  }
  g.setAttribute('position',new T.Float32BufferAttribute(p,3));
  g.setAttribute('normal',new T.Float32BufferAttribute(n,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  g.computeBoundingBox();g.computeBoundingSphere();
  return {geometry:g,counts,parts};
 }
}
const square=(y:number,w:number)=>[vec(-w,y,-w),vec(w,y,-w),vec(w,y,w),vec(-w,y,w)];
const octagon=(y:number,r:number)=>Array.from({length:8},(_,i)=>{
 const a=τ*(i+.5)/8;return vec(Math.sin(a)*r,y,Math.cos(a)*r);
});
const widthAt=(y:number)=>T.MathUtils.lerp(CAPE_BEAR.baseWidth*.5,CAPE_BEAR.shaftTopWidth*.5,
 (y-CAPE_BEAR.shaftY0)/(CAPE_BEAR.shaftY1-CAPE_BEAR.shaftY0));
const ySlope=(CAPE_BEAR.baseWidth-CAPE_BEAR.shaftTopWidth)*.5/(CAPE_BEAR.shaftY1-CAPE_BEAR.shaftY0);
const wn=(f:number)=>vec(horizontal[f].x,ySlope,horizontal[f].z).normalize();
const tan=(f:number)=>vec(horizontal[f].z,0,-horizontal[f].x);
const p=(f:number,u:number,y:number,d=0)=>vec(0,y,0).addScaledVector(horizontal[f],widthAt(y)).addScaledVector(tan(f),u).addScaledVector(wn(f),d);
const sash= CAPE_BEAR.sashCenter.map(c=>[c-CAPE_BEAR.sashHeight*.5,c+CAPE_BEAR.sashHeight*.5]as const);

function shaft(m:Model){
 const {shaftY0:B,shaftY1:E,sashWidth:s,sashReturn:d}=CAPE_BEAR,F=s*.5;
 const cuts=[B,...sash.flat(),E];
 m.as('sealed-main-tapered-shaft',()=>{
  for(let side=0;side<4;side++){
   const isWindows=side===0||side===1;
   for(let j=0;j<cuts.length-1;j++){
    const y0=cuts[j],y1=cuts[j+1],lo=[-widthAt(y0),-F,F,widthAt(y0)],
     hi=[-widthAt(y1),-F,F,widthAt(y1)];
    const gap=isWindows&&sash.some(w=>w[0]===y0&&w[1]===y1);
    for(let band=0;band<3;band++){
     if(gap&&band===1)continue;
     const u=lo[band],v=lo[band+1],x=hi[band],z=hi[band+1];
     m.q(p(side,u,y0),p(side,v,y0),p(side,z,y1),p(side,x,y1),wn(side),'shingle',
      [[u,y0],[v,y0],[z,y1],[x,y1]]);
    }
    if(!gap)continue;
    const room:Q[]=[[-F,y0],[F,y0],[F,y1],[-F,y1]];
    const P=room.map(w=>p(side,...w)),Q=room.map(w=>p(side,...w,-d)),sides=[up,tan(side).negate(),down,tan(side)];
    for(let i=0;i<4;i++){
     const k=(i+1)%4;m.q(P[i],P[k],Q[k],Q[i],sides[i],'returnShade',
      [[0,0],[P[i].distanceTo(P[k]),0],[P[i].distanceTo(P[k]),d],[0,d]]);
    }
    m.q(Q[0],Q[1],Q[2],Q[3],wn(side),'backedGlass',[[0,0],[s,0],[s,y1-y0],[0,y1-y0]]);
   }
  }
  // Match the facade's three strips exactly along each closed cap edge.
  for(const [y,dir] of [[B,down],[E,up]] as const){
   const ring:V[]=[];
   for(const s of [0,3,2,1])for(const u of [-widthAt(y),-F,F])ring.push(p(s,u,y));
   m.cap(ring,dir,'paintedTrim');
  }
 });
 m.as('sealed-neutral-base-strip',()=>m.section([[0,2.71],[.11,2.718],[.322,2.765]],square,'quietBase'));
}
function shutterSurround(m:Model){
 const F=CAPE_BEAR.sashWidth*.5;
 for(const side of CAPE_BEAR.sashFace)for(const [i,[lo,hi]] of sash.entries()){
  const n=wn(side),tanU=tan(side);const box=(left:number,right:number,y0:number,y1:number,
   z0:number,z1:number,r:BearRole)=>{
   const s:Q[]=[[left,y0],[right,y0],[right,y1],[left,y1]];
   m.solidP(s.map(q=>p(side,...q,z1)),s.map(q=>p(side,...q,z0)),n,r);
  };
  m.as('pale-outer-sash-and-sill',()=>{
   box(-F-.087,-F+.029,lo-.015,hi+.037,-.017,.045,'paintedTrim');
   box(F-.029,F+.087,lo-.015,hi+.037,-.017,.045,'paintedTrim');
   box(-F-.075,F+.075,hi-.033,hi+.065,-.027,.048,'paintedTrim');
   box(-F-.105,F+.105,lo-.074,lo+.022,-.029,.096,'paintedTrim');
  });
  m.as('backed-four-over-four-sashes',()=>{
   const front=-.094,back=-.136;
   box(-.014,.014,lo+.005,hi-.005,back,front,'paintedTrim');
   for(let j=1;j<=3;j++){
    const center=T.MathUtils.lerp(lo,hi,j/4),height=j===2?.046:.025;
    box(-F+.022,F-.022,center-height*.5,center+height*.5,back,front+(j===2?.008:0),'paintedTrim');
   }
  });
  m.as('observed-small-sash-red-pediment-caps',()=>{
   const shoulder=hi+.055,head=hi+.244,w=.492;
   const left=p(side,-w,shoulder,.044),peak=p(side,0,head,.041),right=p(side,w,shoulder,.044);
   const along=n.clone().multiplyScalar(.18);
   const c=[left,peak,right],d=c.map(q=>q.clone().add(along));
   m.solidP(d,c,n,'paintedTrim');
   const M=c.map(q=>q.clone().addScaledVector(up,.025));
   const N=d.map(q=>q.clone().addScaledVector(up,.025));
   for(const j of [0,1]){
    m.solidP([M[j],M[j+1],N[j+1],N[j]],[c[j],c[j+1],d[j+1],d[j]],up,'steelRoof');
   }
  });
 }
}
function gallery(m:Model){
 m.as('sealed-white-layered-gallery',()=>m.section([
  [8.932,1.551],[9.015,1.572],[9.065,1.63],[9.151,1.727],[9.211,1.845],[9.299,1.868],[9.340,2.025],[9.480,2.025]
 ],square,'paintedTrim','quietBase'));
 m.as('sparse-two-horizontal-red-gallery-rails',()=>{
  const ring=square(CAPE_BEAR.galleryY,1.936);
  const corner=ring.map(v=>v.clone());const pairs=[];
  for(let j=0;j<4;j++){
   const a=corner[j],b=corner[(j+1)%4],mid=a.clone().lerp(b,.49+(j%2)*.04);
   pairs.push(a,mid);
   for(const y of [9.835,CAPE_BEAR.railTop]){
    m.rod(vec(a.x,y,a.z),vec(b.x,y,b.z),y>10?.019:.015,'galleryRail',6);
   }
  }
  for(const q of pairs){
   m.rod(q.clone().addScaledVector(up,.009),vec(q.x,CAPE_BEAR.railTop+.016,q.z),.024,'galleryRail',6);
   m.rod(q.clone().addScaledVector(up,.010),q.clone().addScaledVector(up,.042),.039,'iron',6);
  }
 });
}
function lantern(m:Model){
 const r=CAPE_BEAR.lanternRadius,l0=9.512,base=10.171,upper=11.318,fascia=11.548;
 m.as('sealed-octagonal-lantern-drums',()=>{
  m.section([[l0,r+.029],[9.568,r+.026],[9.613,r], [base,r]],octagon,'iron');
  m.section([[upper,r],[11.465,r+.025],[fascia,r+.035]],octagon,'iron');
 });
 const ring=octagon(base,r),Q=octagon(upper,r);
 // Three opaque opposite-side areas are a conservative role inference
 // from the 2019 cupola reciprocity. Exact current facade inventory held.
 const clear=new Set([0,3,4,5,6]);
 function cf(i:number,h:number,y:number,d=0){
  const b=ring[i],k=ring[(i+1)%8],n=vec(b.x+k.x,0,b.z+k.z).normalize();
  return b.clone().lerp(k,h).setY(y).addScaledVector(n,d);
 }
 m.as('sealed-octagonal-backed-iron-panels-and-glazing',()=>{
  const X=[0,.057,.943,1],Y=[base,base+.065,upper-.055,upper],w=.042;
  for(let i=0;i<8;i++){
   const b=ring[i],k=ring[(i+1)%8],n=vec(b.x+k.x,0,b.z+k.z).normalize();
   const U=k.clone().sub(b).normalize();
   for(let y=0;y<3;y++)for(let x=0;x<3;x++){
    const vx=X[x],ux=X[x+1],sy=Y[y],ty=Y[y+1];
    if(clear.has(i)&&y===1&&x===1)continue;
    const w0=[cf(i,vx,sy),cf(i,ux,sy),cf(i,ux,ty),cf(i,vx,ty)];
    const u0=b.distanceTo(k);
    m.q(w0[0],w0[1],w0[2],w0[3],n,'iron',
        [[vx*u0,sy-base],[ux*u0,sy-base],[ux*u0,ty-base],[vx*u0,ty-base]]);
   }
   if(!clear.has(i))continue;
   const w0:Q[]=[[X[1],Y[1]],[X[2],Y[1]],[X[2],Y[2]],[X[1],Y[2]]];
   const A=w0.map(u=>cf(i,...u)),B=w0.map(u=>cf(i,...u,-w));
   for(const [e,rn] of [up,U.clone().negate(),down,U].entries()){
    const j=(e+1)%4;m.q(A[e],A[j],B[j],B[e],rn,'returnShade');
   }
   m.q(B[0],B[1],B[2],B[3],n,'backedGlass');
  }
  for(const [y,n] of [[base,down],[upper,up]]as const)
   m.cap(Array.from({length:8},(_,i)=>X.slice(0,3).map(x=>cf(i,x,y))).flat(),n,'iron');
 });
 m.as('slender-octagonal-vertical-iron-mullions',()=>{
  for(let i=0;i<8;i++){
   const j=(i+1)%8,b=ring[i],k=ring[j],n=vec(b.x+k.x,0,b.z+k.z).normalize();
   m.rod(b.clone(),Q[i].clone(),.025,'iron',6);
   // Discreet lower panels support the reflected light without copying
   // etched marks, plaques or interior workings.
   if(clear.has(i)&&i%2===0){
    const w=[cf(i,.20,9.646,.007),cf(i,.8,9.646,.007),cf(i,.8,9.89,.007),cf(i,.67,9.985,.007),
     cf(i,.33,9.985,.007),cf(i,.20,9.89,.007)];
    m.solidP(w,w.map(p=>p.clone().addScaledVector(n,-.006)),n,'iron');
   }
  }
 });
 m.as('sealed-iron-pyramidal-lantern-cap',()=>{
  const R=1.195,y=fascia-.002,q=11.894;
  m.section([[y,R],[y+.048,R],[q,.216],[q+.025,.121]],octagon,'steelRoof');
  const lo=octagon(y+.056,R-.019),hi=octagon(q+.008,.202);
  for(let j=0;j<8;j++)m.rod(lo[j],hi[j],.011,'steelRoof',5,.007);
 });
 m.as('short-vane-cowl-not-operational',()=>{
  m.rod(vec(0,11.9,0),vec(0,12.084,0),.093,'iron',8,.079);
  let p=[[-.11,12.021],[.083,12.06],[.134,12.111],[.075,12.2],[-.014,12.172],[-.103,12.087]];
  const s=p.map(([x,y])=>vec(x,y,.033)),t=p.map(([x,y])=>vec(x,y,-.033));
  m.solidP(s,t,vec(0,0,1),'iron');
 });
}
function shader(mat:T.MeshStandardMaterial,key:string,detail:T.IUniform<number>,f:string,world=false){
 mat.customProgramCacheKey=()=>key;
 mat.onBeforeCompile=(s)=>{
  s.uniforms.cbFinish=detail;
  s.vertexShader='varying vec2 cbV;\n'+(world?'varying vec3 cbW,cbN;\n':'')+s.vertexShader.replace(
    '#include <begin_vertex>','#include <begin_vertex>\ncbV=uv;\n'+
     (world?'cbW=(modelMatrix*vec4(position,1.)).xyz;cbN=normalize(mat3(modelMatrix)*normal);\n':''));
  s.fragmentShader='uniform float cbFinish;varying vec2 cbV;\n'+(world?'varying vec3 cbW,cbN;\n':'')+s.fragmentShader.replace(
    '#include <color_fragment>','#include <color_fragment>\n'+f);
 };
 return mat;
}
const mat=(color:number,roughness:number,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
export function makeCapeBearMaterials(finish=1){
 const detail={value:T.MathUtils.clamp(finish,0,1)};
 const shingle=shader(mat(0xe0e4de,.84),'cb-shingle-original-1',detail,`
  vec2 a=cbV;
  vec2 footprint=fwidth(a);
  float course=a.y/.137;
  float wind=dot(floor(a/vec2(.217,.137)),vec2(27.17,11.72));
  float ss=fract(sin(wind)*1553.1);
  float seam=1.-smoothstep(.014,.105+clamp(footprint.y/.137,.0,.45),fract(course));
  float res=1.-smoothstep(.018,.125,footprint.y);
  float drift=.54*sin(a.x*.67+a.y*.59)+.46*sin(a.y*2.03-a.x*.39);
  float stagger=.46*mod(floor(course),2.);
  float joint=abs(fract(a.x/.215+stagger)-.5);
  float butt=(1.-smoothstep(.009,.043+footprint.x/.215,joint))*(1.-smoothstep(.79,.99,fract(course)));
  diffuseColor.rgb*=1.+cbFinish*(.016*drift+res*(.052*(ss-.5)-.078*seam-.028*butt));
 `);
 const red=shader(mat(0xb32723,.61,.13),'cb-enamel-original-1',detail,`
  float b=.68*sin(cbV.x*2.4+cbV.y*1.39)+.32*sin(cbV.y*5.8-cbV.x*3.07);
  diffuseColor.rgb*=1.+cbFinish*b*.037;
 `);
 const roof=shader(mat(0x98281f,.72,.16),'cb-roof-original-1',detail,`
  float b=.74*sin(cbV.x*3.35+cbV.y*1.9)+.26*sin(cbV.y*7.8-cbV.x*3.1);
  diffuseColor.rgb*=1.+cbFinish*b*.051;
 `);
 const glass=shader(mat(0x475b60,.46,.21),'cb-opaque-glass-original-1',detail,`
  vec3 n=normalize(cbN),eye=normalize(cameraPosition-cbW);
  float f=pow(1.-clamp(dot(n,eye),0.,1.),3.);
  vec3 r=reflect(-eye,n);
  float br=smoothstep(-.24,.49,r.y);
  vec3 env=mix(vec3(.032,.043,.043),vec3(.212,.298,.345),br);
  float g=(.23+.57*f)*cbFinish;
  diffuseColor.rgb=mix(diffuseColor.rgb,env,g);
 `,true);
 const materials=[shingle,mat(0xe9e6de,.76),mat(0x747976,.87),red,mat(0x743632,.69,.11),
  roof,mat(0xa4a9a5,.86),glass] as const;
 return {materials:[...materials],detail};
}
export function makeCapeBearExterior(finish=1){
 const S=new Model();shaft(S);shutterSurround(S);gallery(S);lantern(S);
 const {geometry,counts,parts}=S.make(),{materials,detail}=makeCapeBearMaterials(finish);
 if(Math.abs(geometry.boundingBox!.min.y)>.000001||Math.abs(geometry.boundingBox!.max.y-CAPE_BEAR.height)>.000002)throw Error('Nominal Cape Bear height moved');
 const mesh=new T.Mesh(geometry,materials);
 mesh.name='Detached historic Cape Bear (local studio only)';
 // No raycaster, application actor, light, or scene furniture is installed.
 return {mesh,detail,counts,parts,closedComponentPositions:S.component,dimension:CAPE_BEAR,
  dispose:()=>{geometry.dispose();materials.forEach(m=>m.dispose());}};
}
