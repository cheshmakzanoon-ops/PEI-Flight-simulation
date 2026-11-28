import {BufferGeometry,Float32BufferAttribute,Group,Mesh,MeshStandardMaterial} from 'three';
import {INN_KENT_STUDY,makeKentGableSpecimen,type InnKentRole} from './inn-kent-gable-study.ts';
import {makeKentGlass} from './inn-kent-glass.ts';
import {makeInnSurface} from './inn-material-experiment.ts';

/** Original, detached interpretation of Province photo #80830 (2016).
 * This uses only a street-facing arrangement, not photographed pixels,
 * modern aperture inventory, metric elevations, or surveyed world assembly. */
export const KENT_LOWER=Object.freeze({
 reference:'Province of Prince Edward Island / C. Stewart, 2016 / 80830 side elevation',
 sourceOwnerHint:'q11220/182; unchanged, no placement authority',
 jointY:INN_KENT_STUDY.displayCutY,
 specimenBottomY:-.40,
 halfWidth:INN_KENT_STUDY.bayWidthM*.5,
 planes:Object.freeze({skin:0,back:-.54,casing:.050,glass:-.144}),
 unmodeled:Object.freeze(['Richmond verandah','Kent annex','rear','steps and grade','complete roof','any site mount']),
} as const);
const bottom=KENT_LOWER.specimenBottomY,joint=KENT_LOWER.jointY,B=KENT_LOWER.halfWidth;
type V=readonly [number,number,number];
type XY=readonly [number,number];
type R='lap'|'case'|'reveal'|'glass'|'hood'|'hoodShadow'|'displayBack';
type Box=Readonly<{name:string;l:number;r:number;b:number;t:number}>;
const OUT=[0,0,1] as const,IN=[0,0,-1] as const,UP=[0,1,0] as const,DOWN=[0,-1,0] as const;
const box=(name:string,x:number,y:number,h:number,w:number):Box=>Object.freeze({name,l:x-w/2,r:x+w/2,b:y,t:y+h});
const full=Object.freeze([
 box('left window',-3.24,.438,1.355,1.83),
 box('right window',3.36,.465,1.330,1.76),
 box('central door and above-door infill',.35,bottom+.017,2.65,1.384),
]);
const openings=Object.freeze(full.map((q,i)=>i===2?q:Object.freeze({name:q.name,l:q.l-.091,r:q.r+.091,b:q.b-.057,t:q.t+.096})));
const hoodReach=.389,hoodRoot=-.021;
/** Composition coordinates relative to the existing display specimen; not measurements. */
export const kentLowerApertures=()=>({clear:full,skinHoles:openings,hoodReach,hoodRoot});
const diff=(a:V,b:V):V=>[b[0]-a[0],b[1]-a[1],b[2]-a[2]];
const cross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a:V,b:V)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
class Panels {
 readonly data=new Map<R,{P:number[];UV:number[]}>();
 face(r:R,q:readonly V[],aim:V,uv:(p:V)=>XY=(p)=>[p[0],p[1]]){
  let a=this.data.get(r);if(!a){a={P:[],UV:[]};this.data.set(r,a);}
  for(let i=1;i<q.length-1;i++){
   const n=cross(diff(q[0],q[i]),diff(q[0],q[i+1]));
   if(Math.hypot(...n)<1e-10)throw Error('collapsed frontage polygon / '+r);
   if(Math.abs(dot(n,aim))<1e-10)throw Error('unresolved frontage face winding / '+r);
   for(const p of dot(n,aim)>0?[q[0],q[i],q[i+1]]:[q[0],q[i+1],q[i]]){
    a.P.push(...p);a.UV.push(...uv(p));
   }
  }
 }
 panel(r:R,l:number,b:number,h:number,t:number,z:number,normal:V=OUT){
  this.face(r,[[l,b,z],[h,b,z],[h,t,z],[l,t,z]],normal);
 }
 solid(r:R,l:number,b:number,h:number,t:number,rear:number,front:number){
  this.panel(r,l,b,h,t,front);this.panel(r,l,b,h,t,rear,IN);
  for(const x of [l,h])this.face(r,[[x,b,rear],[x,b,front],[x,t,front],[x,t,rear]],[x===l?-1:1,0,0],p=>[p[2],p[1]]);
  for(const y of [b,t])this.face(r,[[l,y,rear],[h,y,rear],[h,y,front],[l,y,front]],y===b?DOWN:UP,p=>[p[0],p[2]]);
 }
 ring(r:R,a:Box,back:number,n:Box,face:number){
  this.face(r,[[a.l,a.b,back],[a.r,a.b,back],[n.r,n.b,face],[n.l,n.b,face]],UP,p=>[p[0],p[2]]);
  this.face(r,[[a.r,a.b,back],[a.r,a.t,back],[n.r,n.t,face],[n.r,n.b,face]],[-1,0,0],p=>[p[2],p[1]]);
  this.face(r,[[a.r,a.t,back],[a.l,a.t,back],[n.l,n.t,face],[n.r,n.t,face]],DOWN,p=>[p[0],p[2]]);
  this.face(r,[[a.l,a.t,back],[a.l,a.b,back],[n.l,n.b,face],[n.l,n.t,face]],[1,0,0],p=>[p[2],p[1]]);
 }
}
const inset=(q:Box,d:number):Box=>({...q,l:q.l+d,r:q.r-d,b:q.b+d,t:q.t-d});
function skin(p:Panels){
 const xs=[-B,...openings.flatMap(w=>[w.l,w.r]),B].sort((a,b)=>a-b);
 for(let i=1;i<xs.length;i++){
  const l=xs[i-1],r=xs[i],h=openings.find(w=>(l+r)*.5>w.l&&(l+r)*.5<w.r);
  if(!h){p.panel('lap',l,bottom,r,joint,0);continue;}
  p.panel('lap',l,bottom,r,h.b,0);p.panel('lap',l,h.t,r,joint,0);
 }
 p.panel('displayBack',-B,bottom,B,joint,KENT_LOWER.planes.back,IN);
 for(const x of [-B,B])
  p.face('displayBack',[[x,bottom,-.54],[x,bottom,0],[x,joint,0],[x,joint,-.54]],[x<0?-1:1,0,0],q=>[q[2],q[1]]);
 p.face('displayBack',[[-B,bottom,-.54],[B,bottom,-.54],[B,bottom,0],[-B,bottom,0]],DOWN,q=>[q[0],q[2]]);
 // The frozen upper underside already closes this interface. Do not
 // append a duplicate coplanar top cap or add an invented intermediate ledge.
 for(const side of [-1,1]){
  const c=side*(B-.142), l=c-.119,r=c+.119,z0=.014,z1=.078;
  // Same pilaster cross section and an exact Y joint; no coplanar top.
  p.panel('case',l,bottom,r,joint,z1);
  for(const x of [l,r])p.face('case',[[x,bottom,z0],[x,bottom,z1],[x,joint,z1],[x,joint,z0]],[x===l?-1:1,0,0]);
  p.panel('case',l,bottom,r,joint,z0,IN);
 }
}
function outerCase(p:Panels,h:Box,c:Box){
 const {l,r,b,t}=c,{casing:z,glass}=KENT_LOWER.planes;
 const strips=[[h.l,h.b,l,h.t],[r,h.b,h.r,h.t],[l,h.b,r,b],[l,t,r,h.t]];
 for(const [x,y,X,Y] of strips)p.panel('case',x,y,X,Y,z);
 const reverseNormal=(a:V):V=>[-a[0],-a[1],-a[2]];
 for(const [q,aim] of [
  [[[h.l,h.b,0],[h.r,h.b,0],[h.r,h.b,z],[h.l,h.b,z]],UP],
  [[[h.r,h.b,0],[h.r,h.t,0],[h.r,h.t,z],[h.r,h.b,z]],[-1,0,0]],
  [[[h.r,h.t,0],[h.l,h.t,0],[h.l,h.t,z],[h.r,h.t,z]],DOWN],
  [[[h.l,h.t,0],[h.l,h.b,0],[h.l,h.b,z],[h.l,h.t,z]],[1,0,0]],
 ] as const)p.face('case',q as readonly V[],reverseNormal(aim as V));
 const a=inset(c,.035),s=inset(a,.015);
 p.ring('case',a,z-.061,c,z);
 p.ring('reveal',s,glass,a,z-.061);
 return s;
}
function window(s:Panels,id:number){
 const clear=full[id],seat=outerCase(s,openings[id],clear);
 s.panel('glass',seat.l,seat.b,seat.r,seat.t,KENT_LOWER.planes.glass);
 const l=clear.l-.156,r=clear.r+.155,b=clear.b-.087;
 // Projecting, bevelled sill and short wooden cleats. Both windows visibly
 // have a sill with small supports; sizes and exact construction are art.
 const a:V[]=[[l,b,-.021],[r,b,-.021],[r,b,.167],[l,b,.167]],
   c:V[]=[[l-.011,b+.061,-.021],[r+.011,b+.061,-.021],[r+.011,b+.037,.183],[l-.011,b+.037,.183]];
 s.face('case',c,UP,q=>[q[0],q[2]]);s.face('reveal',a,DOWN,q=>[q[0],q[2]]);
 for(let i=0;i<4;i++)s.face('case',[a[i],a[(i+1)%4],c[(i+1)%4],c[i]],([IN,[1,0,0],OUT,[-1,0,0]] as V[])[i]);
 const center=(clear.l+clear.r)*.5;
 for(const x of [center-.68,center,center+.68]){
  const B=b-.208,T=b-.008, back=-.017,tip=.115,d=.023;
  const u:V[]=[[x-d,B,back],[x-d,T,back],[x-d,T,tip]],
        v:V[]=u.map(([X,y,z])=>[X+2*d,y,z]);
  s.face('case',u,[-1,0,0]);s.face('case',v,[1,0,0]);
  s.face('case',[u[0],v[0],v[1],u[1]],IN);
  s.face('case',[u[1],v[1],v[2],u[2]],UP);
  s.face('case',[u[2],v[2],v[0],u[0]],OUT);
 }
 const cy=clear.t+.091;
 const l0=clear.l-.083,r0=clear.r+.083,l1=clear.l-.054,r1=clear.r+.054;
 const backTop=cy+.343,frontTop=cy+.087,frontLow=cy+.037,backLow=cy+.025;
 // Stiff shallow awning, closed flank and returned underside. Back edges
 // cross the wall slightly to preclude detached sticker-like caps.
 const top:V[]=[[l0,backTop,hoodRoot],[r0,backTop,hoodRoot],[r1,frontTop,hoodReach],[l1,frontTop,hoodReach]];
 const bot:V[]=[[l0,backLow,hoodRoot],[r0,backLow,hoodRoot],[r1,frontLow,hoodReach],[l1,frontLow,hoodReach]];
 s.face('hood',top,UP,q=>[q[0],q[2]]);s.face('hoodShadow',bot,DOWN,q=>[q[0],q[2]]);
 for(let i=0;i<4;i++){
  const j=(i+1)%4;
  s.face(i===0?'hoodShadow':'hood',[top[i],top[j],bot[j],bot[i]],([IN,[1,0,0],OUT,[-1,0,0]] as V[])[i],q=>[q[0]+.52*q[2],q[1]]);
 }
}
function door(p:Panels){
 const h=openings[2],c={...inset(h,.105),b:h.b+.030},seat=outerCase(p,h,c),z=-.068,yBridge=1.814;
 // The blue panel above the white door reads opaque in the source. No
 // inferred transom glass or lettering. The visible inset door lights
 // are represented by a restrained original three-by-four lead layout.
 p.panel('lap',seat.l,yBridge+.044,seat.r,seat.t,z);
 p.solid('case',seat.l,yBridge-.012,seat.r,yBridge+.046,z-.02,.033);
 const l=seat.l+.047,r=seat.r-.047,b=seat.b,t=yBridge-.012;
 const glass={l:l+.184,r:r-.184,b:.694,t:1.511,name:'door light'};
 for(const [x,y,X,Y] of [[l,b,glass.l,t],[glass.r,b,r,t],[glass.l,b,glass.r,glass.b],[glass.l,glass.t,glass.r,t]])
  p.panel('case',x,y,X,Y,z);
 p.panel('glass',glass.l,glass.b,glass.r,glass.t,-.126);
 for(const x of [glass.l,glass.r])p.solid('case',x-.017,glass.b,x+.017,glass.t,-.126,z+.019);
 for(const y of [glass.b,glass.t])p.solid('case',glass.l,y-.018,glass.r,y+.018,-.126,z+.019);
 for(const q of [1/3,2/3]){
  const x=glass.l+q*(glass.r-glass.l);p.solid('case',x-.012,glass.b+.022,x+.012,glass.t-.022,-.126,z+.009);
 }
 for(const q of [.25,.5,.75]){
  const y=glass.b+q*(glass.t-glass.b);p.panel('case',glass.l+.021,y-.012,glass.r-.021,y+.012,z+.008);
 }
 for(const x of [l,r])p.solid('reveal',x-.021,b,x+.021,t,-.139,z+.013);
 // A small moulded door sill ends at the display datum. Nothing is
 // modelled forward of it as exterior steps, curb, landscape or collision.
 p.solid('case',h.l-.03,bottom+.006,h.r+.03,b+.013,-.046,.099);
}
function lowerMaterial(role:R){
 switch(role){
  case 'lap': return makeInnSurface('blueLap');
  case 'case': return makeInnSurface('paintedCase');
  case 'glass': return makeKentGlass();
  case 'hood': return new MeshStandardMaterial({color:0x762f3f,roughness:.86,metalness:0});
  case 'hoodShadow':return new MeshStandardMaterial({color:0x49232c,roughness:.92,metalness:0});
  case 'reveal':return new MeshStandardMaterial({color:0x667178,roughness:.89,metalness:0});
  case 'displayBack':return new MeshStandardMaterial({color:0x616b73,roughness:.91,metalness:0});
 }
}
export function makeFormerKentUpper(){
 return makeKentGableSpecimen({materialFor:(role:InnKentRole)=>role==='glass'?makeKentGlass():
  role==='blueLap'||role==='charcoalRoof'||role==='paintedCase'?makeInnSurface(role):undefined});
}
export function makeKentLowerFacade(){
 const b=new Panels();skin(b);window(b,0);window(b,1);door(b);
 const lower=new Group();lower.name='Detached Kent lower side · 2016 evidence';
 lower.userData={scope:'Historical frontage specimen, no geographic plan, floor, tenant, steps or contact'};
 for(const [r,{P,UV}] of b.data){
  const geom=new BufferGeometry();
  geom.setAttribute('position',new Float32BufferAttribute(P,3));geom.setAttribute('uv',new Float32BufferAttribute(UV,2));
  geom.computeVertexNormals();geom.computeBoundingBox();geom.computeBoundingSphere();
  const m=new Mesh(geom,lowerMaterial(r));m.name='Kent lower / '+r;m.userData={role:r,artOnly:true};lower.add(m);
 }
 return lower;
}
export function makeKentSide2016(){
 const shell=new Group();shell.name='Georgetown Historic Inn – Kent side, dated detached study';
 shell.userData={...KENT_LOWER,placement:false};
 shell.add(makeFormerKentUpper(),makeKentLowerFacade());
 return shell;
}
