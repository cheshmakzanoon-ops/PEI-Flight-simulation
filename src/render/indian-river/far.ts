import {Mesh,MeshStandardMaterial} from 'three';
import {Batch,beam,p,prism,type XY} from './geometry.ts';
import {WING,edgeStations,roofGeometry,upper} from './roof.ts';
import {FIRST_ART_FOOTING,TOWER_CENTRE,TOWER_RADIAL_SURVEY,type P} from './frame.ts';
import {RETAINED_PANES} from './far-panes.generated.ts';
import {OPEN,section} from './facade.ts';

type Tint=readonly [number,number,number];
// Linear working-space averages of C's own generated maps, not photographic pixels.
const paint:Tint=[.68271,.67809,.64602], white:Tint=[.75294,.75294,.67244];
const roof:Tint=[.09999,.03538,.03291], slate:Tint=[.33029,.33924,.34353];
const stone:Tint=[.09269,.09159,.08202], trim:Tint=[.03071,.04092,.03820];
const window:Tint=[.067,.089,.085], door:Tint=[.567,.538,.487];
const crown:Tint=[.455,.454,.426], louver:Tint=[.080,.092,.085];
const TAU=2*Math.PI;
export const ST_MARYS_FAR_LOD=Object.freeze({
  enterDistance:430,exitDistance:395,enterProjectedPx:86,exitProjectedPx:100,validatedThrough:3800,
});
/** Input is actual vertical projected screen size in device pixels. This is an
 * eligibility proposal only; the caller remains responsible for site, cull and
 * any approved/fallback cohort. Defaults to the verified flight tier on bad inputs. */
export function useStMarysFar(previousFar:boolean,distanceM:number,actualProjectedHeightPx:number){
  if(!Number.isFinite(distanceM)||!Number.isFinite(actualProjectedHeightPx)||actualProjectedHeightPx<0)return false;
  const a=ST_MARYS_FAR_LOD;
  return previousFar?distanceM>=a.exitDistance&&actualProjectedHeightPx<=a.exitProjectedPx:
    distanceM>=a.enterDistance&&actualProjectedHeightPx<=a.enterProjectedPx;
}
/** Sub-batches keep a single material while reusing C's roof tessellation exactly. */
function carry(out:Batch,part:Batch,c:Tint){
  const n=out.xyz.length/3;
  for(let i=0;i<part.xyz.length;i++)out.xyz.push(part.xyz[i]);
  for(let i=0;i<part.nrm.length;i++)out.nrm.push(part.nrm[i]);
  for(let i=0;i<part.uv.length;i++)out.uv.push(part.uv[i]);
  for(let q=0;q<part.xyz.length/3;q++)out.color.push(c[0],c[1],c[2]);
  for(const ix of part.index)out.index.push(ix+n);
}
function trig(b:Batch,A:P,B:P,C:P,D:P,N:P,M:Tint){b.poly([A,B,C,D],N,undefined,M);}
function ring(u:number,v:number,y:number,r:number,n:number,a:number,i:number):P{
  const t=a+TAU*i/n; return p(u+r*Math.cos(t),y,v+r*Math.sin(t));
}
function side(b:Batch,u:number,v:number,y0:number,y1:number,r0:number,r1:number,n:number,a:number,t:Tint){
  for(let i=0;i<n;i++){
   const t0=(i+.5)*TAU/n+a;
   const A=ring(u,v,y0,r0,n,a,i),B=ring(u,v,y0,r0,n,a,i+1),C=ring(u,v,y1,r1,n,a,i+1),D=ring(u,v,y1,r1,n,a,i);
   trig(b,A,B,C,D,p(Math.cos(t0),(r0-r1)/Math.max(.012,y1-y0),Math.sin(t0)),t);
  }
}
function cap(b:Batch,u:number,v:number,y:number,r:number,n:number,a:number,t:Tint){
  b.poly(Array.from({length:n},(_,i)=>ring(u,v,y,r,n,a,i)),[0,1,0],undefined,t);
}
function cylinderRim(b:Batch,u:number,v:number,y:number,r0:number,r1:number,n:number,a:number,t:Tint){
  for(let i=0;i<n;i++){
   const A=ring(u,v,y,r0,n,a,i),B=ring(u,v,y,r0,n,a,i+1),C=ring(u,v,y,r1,n,a,i+1),D=ring(u,v,y,r1,n,a,i);
   trig(b,A,B,C,D,r1>r0?[0,-1,0]:[0,1,0],t);
  }
}
const box=(l:number,r:number,b:number,t:number):XY[]=>[[l,b],[r,b],[r,t],[l,t]];
function makeWings(shell:Batch){
  for(let j=0;j<WING.length;j++){
   const c=WING[j],top=new Batch(),rim=new Batch();roofGeometry(c,top,rim);carry(shell,top,roof);carry(shell,rim,trim);
   for(let i=0;i<c.outline.length;i++){
    const A=c.outline[i],B=c.outline[(i+1)%c.outline.length],dx=B[0]-A[0],dz=B[1]-A[1],n=Math.hypot(dx,dz),x=dx/n,z=dz/n;
    const N:P=[z,0,-x],base=FIRST_ART_FOOTING-.078;
    const at=(s:number,y:number):P=>p(A[0]+s*x,y,A[1]+s*z);
    const f=([s,y]:XY)=>at(s,y);
    const stations=edgeStations(c,A,B).map(q=>[Math.hypot(q[0]-A[0],q[1]-A[1]),upper(c,q)] as XY);
    const foundation=FIRST_ART_FOOTING+.456;
    const outer:XY[]=[[0,foundation],[n,foundation],...stations.slice().reverse()];
    const recorded=RETAINED_PANES.filter(p=>p[0]===j&&p[1]===i);
    const cuts=recorded.map(k=>k[3].slice());
    shell.poly(outer.map(f),N,outer,paint,cuts,outer,f);
    cuts.forEach((cut,k)=>shell.poly(cut.map(f),N,cut,recorded[k][2]?door:window));
    const low=box(0,n,base,foundation);
    shell.poly(low.map(f),N,low,stone);
    // An authored stair block only at the existing C threshold, not a new plan detail.
    if(c.role==='nave'&&(A[1]+B[1])*.5<-1.57){
     const lo=n*.50-1.16,hi=n*.50+1.16;
     const R=(y:number,d:number):P[]=>[p(A[0]+lo*x,y,A[1]+lo*z+d),p(A[0]+hi*x,y,A[1]+hi*z+d),p(A[0]+hi*x,y,A[1]+hi*z+.086),p(A[0]+lo*x,y,A[1]+lo*z+.086)];
     prism(shell,R(23.34,-1.02),R(23.555,-1.02),stone);prism(shell,R(23.555,-.73),R(23.985,-.73),stone);
    }
   }
  }
}
function makeTower(b:Batch){
  const [u,v]=TOWER_CENTRE,begin=-Math.PI*.5-TAU/48,turn=-Math.PI*.5-TAU/24;
  // Numeric C flight stages. Their radial segments are intentionally not a generic cone.
  const body=[
   [23.22,29.23,2.671,2.531],[29.23,33.03,2.48,2.401],[33.03,38.04,2.35,2.226],
   [38.04,39.35,2.22,2.107],[39.35,42.19,2.086,1.805],
  ];
  body.forEach(([a,e,r,s],j)=>{
   const n=j===4?12:24, phase=j===4?turn:begin;
   if(j===3) side(b,u,v,a,e,r,s,n,phase,paint);
   else for(let k=0;k<n;k++){
    const a0=phase+k*TAU/n,a1=a0+TAU/n,q=(a0+a1)*.50;
    const lx=Math.cos(a0),lz=Math.sin(a0),rx=Math.cos(a1),rz=Math.sin(a1);
    const N:P=[Math.cos(q),0,Math.sin(q)],w=(r+s)*Math.sin(TAU/n*.5);
    const pp=(x:number,y:number):P=>{const mix=x/w,k=r+(s-r)*(y-a)/(e-a);return p(u+k*(lx+(rx-lx)*mix),y,v+k*(lz+(rz-lz)*mix));};
    const apt=k===0&&j===0?OPEN(w*.50,a+1.60,.555,2.03,'entry'):
      j===4?OPEN(w*.50,a+.341,Math.min(.655,w-.125),1.965,'niche'):
      k%6===0&&j<3?OPEN(w*.50,a+(e-a)*.22,Math.min(j===2?.60:.43,w-.095),(e-a)*(j===2?.61:.51),j===2?'louver':'lancet'):undefined;
    const outline=box(0,w,a,e),cut=apt?section(apt,2):null;
    const F=([x,y]:XY)=>pp(x,y);
    b.poly(outline.map(F),N,outline,j===4?white:paint,cut?[cut]:[],outline,F);
    if(cut)b.poly(cut.map(F),N,cut,apt!.kind==='entry'?door:apt!.kind==='niche'?crown:louver);
   }
   if(j>0&&j<4)cylinderRim(b,u,v,a,body[j-1][3],r,12,phase,trim);
   if(j===4)for(let k=0;k<n;k++){
    const phi=turn+(k+.5)*TAU/n,N=p(Math.cos(phi),0,Math.sin(phi));
    const q=(s:number,y:number,d:number):P=>{
      const r=2.086+(1.805-2.086)*(y-39.35)/2.84;
      return p(u+(r*Math.cos(TAU/n*.5)+d)*N[0]+s*N[2],y,v+(r*Math.cos(TAU/n*.5)+d)*N[2]-s*N[0]);
    };
    // Colors represent the existing recessed niche band/hood. No faux glazing or decals.
    b.poly([q(-.248,41.77,.076),q(.248,41.77,.076),q(0,42.49,.076)],N,undefined,trim);
    b.poly([q(-.215,41.76,.100),q(.215,41.76,.100),q(0,42.426,.102)],N,undefined,white);
   }
  });
  side(b,u,v,23.19,23.86,2.714,2.688,24,0,stone);cylinderRim(b,u,v,23.85,2.688,2.65,24,0,stone);
  for(const [Y,R] of [[29.23,2.553],[33.03,2.430],[38.03,2.258],[39.34,2.148],[42.12,1.849]]){
   side(b,u,v,Y-.097,Y+.025,R+.035,R+.026,12,0,trim);
   side(b,u,v,Y+.019,Y+.156,R+.018,R-.019,12,0,paint);
  }
  const t=TOWER_RADIAL_SURVEY,rad=(y:number)=>t.radiusAt46-t.dropPerMetre*(y-46);
  side(b,u,v,42.154,55.748,rad(42.154),rad(55.748),16,-Math.PI*.5,slate);
  side(b,u,v,55.748,55.92,rad(55.748),.037,12,0,slate);
  side(b,u,v,55.90,56.108,.033,.026,12,0,white);cap(b,u,v,56.108,.026,12,0,white);
  beam(b,p(u-.105,56.026,v),p(u+.105,56.026,v),.026,.025,[0,0,1],white);
}
function caps(b:Batch){
  const u=7.724,v=20.679,theta=Math.PI/8;
  side(b,u,v,39.73,41.16,.70,.70,6,theta,paint);side(b,u,v,41.13,41.93,.694,.694,8,theta,louver);
  side(b,u,v,41.867,42.111,.742,1.044,10,Math.PI/10,white);
  side(b,u,v,42.107,43.475,1.047,.059,10,Math.PI/10,slate);
  side(b,u,v,43.46,44.73,.026,.021,8,0,white);cap(b,u,v,44.73,.021,8,0,white);
  beam(b,p(u-.13,44.51,v),p(u+.13,44.51,v),.026,.023,[0,0,1],white);
  const U=14.35,V=4.16,n=6,phase=Math.PI/n;
  side(b,U,V,23.18,23.74,1.15,1.14,n,phase,stone);
  side(b,U,V,23.27,31.52,1.095,1.095,n,phase,paint);
  side(b,U,V,31.52,35.585,1.21,.028,n,phase,roof);cap(b,U,V,35.585,.028,n,phase,roof);
  side(b,U,V,35.53,35.82,.056,.022,7,0,white);
}
/** An isolated one-draw conical/cross-gable silhouette. No new textures, no
 * runtime dependency on the near art generator, and no map/plane ownership. */
export function buildStMarysFar(){
  const b=new Batch();makeWings(b);makeTower(b);caps(b);
  const g=b.finish();if(!g)throw new Error('empty St Mary’s far shell');
  g.deleteAttribute('uv');g.name='Measured St Mary’s far silhouette';
  const mesh=new Mesh(g,new MeshStandardMaterial({vertexColors:true,roughness:.87,metalness:0}));
  mesh.name='Historic St Mary’s / far detached';mesh.castShadow=false;mesh.receiveShadow=false;
  mesh.userData={exterior:true,placed:false,quality:'far',churchDatum:23.4};return mesh;
}
