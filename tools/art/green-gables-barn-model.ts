import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {paint,type Paint} from '../../src/render/green-gables-barn-materials.ts';
import {barnSurvey as S} from './green-gables-barn-reference.ts';

type V=[number,number];
type P=[number,number,number];
type H=readonly [number,number,number];
type Gable=readonly [number,number,number,number,number,number];
type Portal={s:number;w:number;h:number;v?:number;glass?:boolean;brace?:boolean};
const y0=S.nativeGround;
const dot=(a:H,[x,z]:V)=>a[0]+a[1]*x+a[2]*z;
const diff=(a:H,b:H):H=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const neg=(a:H):H=>[-a[0],-a[1],-a[2]];
const delta=(a:V,b:V)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const ceil=(a:V,b:V,s:number):V=>[a[0]+(b[0]-a[0])*s,a[1]+(b[1]-a[1])*s];
const ring=S.plan.map(p=>[p[0],p[1]] as V);
const mapGable=([peak,ridge,l,r,tip,drift]:Gable,axis:0|1):{ridge:H;flanks:readonly [H,H]}=>{
 if(axis===0)return {ridge:[-ridge,-drift,1],flanks:[[peak-ridge*l,tip-drift*l,l],[peak+ridge*r,tip+drift*r,-r]]};
 return {ridge:[-ridge,1,-drift],flanks:[[peak-ridge*l,l,tip-drift*l],[peak+ridge*r,-r,tip+drift*r]]};
};
const P0=mapGable(S.coefficients.uWing,0),P1=mapGable(S.coefficients.vMain,1),P2=mapGable(S.coefficients.approachLow,1),P3=mapGable(S.coefficients.westWallLean,0);
const limits=[[3.34,0,1],[-5.933,1,-.0357],[5.55,1,0],[-2.30,1,0],[4.02,0,1],[-4.56,0,1]] as const;
const cuts:H[]=[...limits,P0.ridge,P1.ridge,P2.ridge,P3.ridge];
for(const p of P0.flanks)for(const q of P1.flanks)cuts.push(diff(p,q));
function crop(r:V[],f:H){
 if(!r.length)return [];
 let a=r[r.length-1],da=dot(f,a);const out:V[]=[];
 for(const b of r){
  const db=dot(f,b);
  if((db>0)!==(da>0)&&Math.abs(db-da)>1.e-10)out.push(ceil(a,b,da/(da-db)));
  if(db>=-1.e-10)out.push(b);a=b;da=db;
 }
 return out.filter((v,i)=>delta(v,out[(i+out.length-1)%out.length])>1.e-8);
}
const planarArea=(r:V[])=>r.reduce((n,v,i)=>{const p=r[(i+1)%r.length];return n+v[0]*p[1]-v[1]*p[0];},0)*.5;
const planFaces=T.ShapeUtils.triangulateShape(ring.map(x=>new T.Vector2(...x)),[]).map(p=>p.map(i=>ring[i]));
function split(p:V[],f:H){
 const a=p.map(x=>dot(f,x));
 if(Math.min(...a)>=-1.e-9||Math.max(...a)<=1.e-9)return [p];
 return [crop(p,f),crop(p,neg(f))].filter(c=>c.length>=3&&Math.abs(planarArea(c))>1.e-8);
}
function panelSet(x:V):[string,H]{
 const [u,v]=x,choose=(r:typeof P0)=>r.flanks[dot(r.ridge,x)<0?0:1];
 // The lower approach's inward edge follows the traced q72 outline.
 // Do not project its low roof beneath the observed upper corner.
 if(v<-3.34&&u>5.933+.0357*v)return ['low approach',choose(P2)];
 if(v<-3.34&&v<-4.02&&u<-5.55)return ['sheltered side lean-to',choose(P3)];
 if(u<2.30||v<-4.02)return ['adjoining gable',choose(P0)];
 if(v>4.56||dot(P1.ridge,x)>=0)return ['long barn gable',choose(P1)];
 const a=choose(P0),b=choose(P1);
 return dot(a,x)>dot(b,x)?['adjoining gable',a]:['long barn gable',b];
}
const roofPatches=planFaces.flatMap(p=>cuts.reduce<V[][]>((acc,h)=>acc.flatMap(r=>split(r,h)),[p])).map(p=>{
 if(planarArea(p)>0)p=p.slice().reverse();
 const x=p.reduce((a,v)=>[a[0]+v[0]/p.length,a[1]+v[1]/p.length] as V,[0,0] as V);
 return {p,role:panelSet(x)};
});
export const barnOutline=ring;
export function nominalFloor(u:number,v:number){
 // A detached display grade reflecting the trends in nearby 2020 DTM only.
 // Not an authored overlay or part of the geographic world.
 return 14.47-.069*Math.max(0,Math.min(18,v-2))-.030*Math.max(0,-v-3)+.004*Math.min(8,u)-y0;
}
const mark=(p:V)=>p.map(a=>Math.round(a*1.e6)).join(',');
function segment(p:V){
 for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length],nv=[b[0]-a[0],b[1]-a[1]],length=delta(a,b);
  const k=((p[0]-a[0])*nv[0]+(p[1]-a[1])*nv[1])/length;
  if(k>=-2.e-6&&k<=length+2.e-6&&Math.abs((p[0]-a[0])*nv[1]-(p[1]-a[1])*nv[0])/length<2.e-6)return i;
 }
 return -1;
}
const openings:Record<number,Portal[]>={
  5:[{s:4.2,w:1.22,h:1.58,brace:true},{s:8.95,w:1.28,h:1.51,brace:true},{s:13.10,w:.86,h:.99,v:2.36,glass:true},{s:21.20,w:3.36,h:2.84,brace:true},{s:29.0,w:1.28,h:1.98,brace:true}],
  4:[{s:3.59,w:2.32,h:2.56,brace:true},{s:3.59,w:.76,h:.91,v:4.5,glass:true}],
  2:[{s:5.24,w:1.08,h:1.91,brace:true},{s:12.21,w:1.26,h:.91,v:1.25,glass:true},{s:17.92,w:1.16,h:2.01,brace:true}],
  1:[{s:4.14,w:1.68,h:2.20,brace:true},{s:4.14,w:.65,h:.64,v:4.36,glass:true}],
  6:[{s:2.26,w:1.06,h:1.93,brace:true}],
};
// Heights are the pinned regular N112 game patch, expressed in the authored local datum.
type EdgeSeat=ReadonlyArray<ReadonlyArray<readonly [span:number,height:number]>>;
type Doors=ReadonlyArray<ReadonlyArray<{readonly s:number;readonly y:number}>>;
export type BarnSeat={readonly grade:EdgeSeat;readonly thresholds:Doors};
export function buildBarn(seat?:BarnSeat){
 const meshes=new Map<Paint,T.BufferGeometry[]>(),counts:Record<string,number>={};
 let role='scene';
 const register=(k:Paint,geom:T.BufferGeometry)=>{
  const a=meshes.get(k)??[];
  a.push(geom);meshes.set(k,a);
  counts[role]=(counts[role]??0)+(geom.index?.count??geom.getAttribute('position').count)/3;
 };
 const face=(k:Paint,a:P,b:P,c:P,uv?:[V,V,V])=>{
  const x=new T.Vector3(...b).sub(new T.Vector3(...a)),y=new T.Vector3(...c).sub(new T.Vector3(...a));
  if(x.cross(y).lengthSq()<1.e-12)return;
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute([...a,...b,...c],3));g.computeVertexNormals();
  if(!uv){
   const aY=Math.abs(x.y),aX=Math.abs(x.x),aZ=Math.abs(x.z);
   const p=(g:P):V=>aY>Math.max(aX,aZ)?[g[0],g[2]]:aX>aZ?[g[2],g[1]]:[g[0],g[1]];
   uv=[p(a),p(b),p(c)];
  }
  g.setAttribute('uv',new T.Float32BufferAttribute(uv.flat(),2));register(k,g);
 };
 const extrudePlane=(k:Paint,r:V[],edge:(x:V)=>P)=>{
  if(r.length<3)return;
  for(let i=1;i<r.length-1;i++)face(k,edge(r[0]),edge(r[i]),edge(r[i+1]),[r[0],r[i],r[i+1]]);
 };
 const flat=(k:Paint,p:V[],h:H,below=0)=>{
  const u=Math.hypot(h[1],h[2]),along=u>1e-5?[-h[2]/u,h[1]/u]:[1.,0.],xx=u>1e-5?h[1]/u:0,zz=u>1e-5?h[2]/u:1;
  const uv=(x:V):V=>[x[0]*along[0]+x[1]*along[1],(x[0]*xx+x[1]*zz)*Math.sqrt(1+u*u)];
  const map=(x:V):P=>[x[0],dot(h,x)-y0-below,x[1]];
  for(let i=1;i<p.length-1;i++){
   const [a,b,c]=below>0?[p[0],p[i+1],p[i]]:[p[0],p[i],p[i+1]];
   face(k,map(a),map(b),map(c),[uv(a),uv(b),uv(c)]);
  }
 };
 const edgeCache=new Map<string,{ends:[V,V];h:H;role:string}[]>();
 for(const t of roofPatches){
  const [name,h]=t.role;role=name;
  flat('roof',t.p,h);flat('soffit',t.p,h,.139);
  for(let i=0;i<t.p.length;i++){
   const a=t.p[i],b=t.p[(i+1)%t.p.length],k=[mark(a),mark(b)].sort().join('|');
   if(delta(a,b)<1.e-6)continue;
   const prior=edgeCache.get(k)??[];prior.push({ends:[a,b],h,role:name});edgeCache.set(k,prior);
  }
 }
 const ringLen=ring.map((a,i)=>delta(a,ring[(i+1)%ring.length]));
 const edge=(i:number)=>{
  const a=ring[i],b=ring[(i+1)%ring.length],len=ringLen[i],ux=(b[0]-a[0])/len,uz=(b[1]-a[1])/len;
  const out=planarArea(ring)<0?[-uz,ux]:[uz,-ux];
  const map=(s:number,h:number,inward=0):P=>[a[0]+ux*s-out[0]*inward,h,a[1]+uz*s-out[1]*inward];
  const span=(x:V)=>(x[0]-a[0])*ux+(x[1]-a[1])*uz;
  const uv=(w:V,depth=0)=>map(w[0],w[1],depth);
  const nominal=(s:number)=>{const c=map(s,0);return nominalFloor(c[0],c[2]);};
  const fitted=seat?.grade[i];
  const alt=(s:number)=>{
   if(!fitted?.length)return nominal(s);
   let j=1;while(j<fitted.length-1&&s>fitted[j][0])j++;
   const [u,a]=fitted[j-1],[v,b]=fitted[j];
   return a+Math.max(0,Math.min(1,(s-u)/(v-u)))*(b-a)-.045;
  };
  const winding=planarArea(ring)<0?-1:+1;
  const cc=(p:V[])=>winding<0?p:p.slice().reverse();
  // Paint the outer wall only. MeshLight and depth use correctly oriented faces.
  const tile=(k:Paint,p:V[],d=0)=>extrudePlane(k,cc(p),x=>uv(x,d));
  return {uv,alt,nominal,map,span,tile,len,breaks:fitted?.map(k=>k[0])??[]};
 };
 // Only one face may be visible at each fascia edge; exterior widths stay
 // wholly inside the already-submitted stock massing.
 const cover=(a:P,b:P,c:P,d:P,k:Paint)=>{
  face(k,a,b,c);face(k,a,c,d);
 };
 const slots=new Map<number,{s:number;d:number;ring:number;code:Portal}[]>();
 for(const [i,list] of Object.entries(openings)){
  const ring=Number(i),e=edge(ring),k=[];
  for(const s of list){
   if(s.s-s.w/2<.1||s.s+s.w/2>e.len-.1)continue;
   const measured=s.glass?undefined:seat?.thresholds[ring]?.find(q=>q.s===s.s);
   k.push({s:s.s,d:measured?.y??(e.nominal(s.s)+(s.v??.035)),ring,code:s});
  }
  slots.set(ring,k);
 }
 let unpaired=0,internalSteps=0;
 for(const list of edgeCache.values()){
  const {ends:[a,b],h}=list[0],mid=ceil(a,b,.5),j=segment(mid);
  if(j<0){
   if(list.length<2){unpaired++;continue;}
   let alt=list[1].h;
   if(Math.abs(dot(h,mid)-dot(alt,mid))<.002)continue;
   internalSteps++;role='roof level joins';
   const map=(u:V,g:H):P=>[u[0],dot(g,u)-y0,u[1]];
   const c=map(a,h),d=map(b,h),w=map(a,alt),z=map(b,alt);
   if(dot(h,mid)>dot(alt,mid))cover(w,z,d,c,'charcoal');else cover(c,d,z,w,'charcoal');
   continue;
  }
  const e=edge(j),v=[e.span(a),e.span(b)].sort((a,b)=>a-b),[L,R]=v,eta=(s:number)=>{const [x,_,z]=e.map(s,0);return dot(h,[x,z])-y0;};
  if(R-L<1.e-6)continue;
  role='outer roof edge';
  e.tile('roofEdge',[[L,eta(L)-.15],[R,eta(R)-.15],[R,eta(R)+.002],[L,eta(L)+.002]]);
  role='outer wall';
  const parts=[L,...e.breaks.filter(s=>s>L+1e-7&&s<R-1e-7),R];
  for(let k=0;k+1<parts.length;k++){
   const [L,R]=[parts[k],parts[k+1]];
  for(const [k,tab] of [['stone',[e.nominal(L)-.96,e.nominal(R)-.96,e.alt(R)+.29,e.alt(L)+.29]],['cedar',[e.alt(L)+.29,e.alt(R)+.29,eta(R)-.09,eta(L)-.09]]] as const){
   let faces:V[][]=[[[L,tab[0]],[R,tab[1]],[R,tab[2]],[L,tab[3]]]];
   for(const {s,d,code:w} of slots.get(j)??[]){
    const p:[H,H,H,H]=[[-s+w.w/2,1,0],[s+w.w/2,-1,0],[-d,0,1],[d+w.h,0,-1]];
    faces=faces.flatMap(v=>{let u=v;const out:V[][]=[];
     for(const c of p){const a=crop(u,neg(c));if(a.length>=3)out.push(a);u=crop(u,c);if(u.length<3)break;}
     return out;
    });
   }
   for(const c of faces)e.tile(k,c,.086);
  }
  }
 }
 for(const [j,sub] of slots){
  const e=edge(j);role='closed door and windows';
  for(const {s,d,code:{w,h,glass,brace}} of sub){
   const L=s-w/2,R=s+w/2,B=d,Y=d+h;
   const rectangle=(k:Paint,l:number,r:number,b:number,t:number,dep:number)=>e.tile(k,[[l,b],[r,b],[r,t],[l,t]],dep);
   const front=.085,back=.198;
   rectangle(glass?'glass':'red',L,R,B,Y,back);
   // Cast physically by joining the front surround to the seated closed
   // panel. An oblique shot cannot see sky along the raking side of a gap.
   const pl=(s:number,h:number)=>e.map(s,h,front),pr=(s:number,h:number)=>e.map(s,h,back);
   const edgeReturn=(k:Paint,p:P,q:P,r:P,s:P)=>cover(p,q,r,s,k);
   edgeReturn('charcoal',pl(L,B),pr(L,B),pr(L,Y),pl(L,Y));
   edgeReturn('charcoal',pr(R,B),pl(R,B),pl(R,Y),pr(R,Y));
   edgeReturn('soffit',pl(L,Y),pr(L,Y),pr(R,Y),pl(R,Y));
   edgeReturn('frame',pr(L,B),pl(L,B),pl(R,B),pr(R,B));
   // The repeated inner lips have real box thickness and no outward plan growth.
   rectangle('charcoal',L+.075,L+.102,B+.020,Y-.076,.146);
   rectangle('charcoal',R-.102,R-.075,B+.020,Y-.076,.146);
   rectangle('charcoal',L+.097,R-.100,Y-.141,Y-.117,.151);
   // Inset board reveals and hung fascia, all within the stock exterior.
   for(const [v,W] of [[L,L+.092],[R-.092,R]] as const)rectangle(glass?'redEnd':'roofEdge',v,W,B,Y,.024);
   rectangle(glass?'redEnd':'roofEdge',L,R,Y-.090,Y,.018);
   if(glass){
    for(const q of [s-.020,s+.016])rectangle('redEnd',q-.011,q+.011,B+.071,Y-.06,.158);
    rectangle('redEnd',L+.079,R-.079,B+.47*(Y-B),B+.47*(Y-B)+.035,.157);
    rectangle('frame',L,R,B,B+.065,.021);
   }else{
    for(const q of [B+.085,Y-.145])rectangle('redEnd',L+.088,R-.085,q,q+.110,.157);
    if(w>1.70)rectangle('roofEdge',s-.023,s+.023,B+.025,Y-.04,.176);
    if(brace){
     for(const z of w>2.?[L,s]:[L]){
      const W=(R-L)/(w>2?2.:1.),c=[[z+.094,B+.13],[z+W-.116,Y-.19],[z+W-.114,Y-.09],[z+.091,B+.244]] as V[];
      e.tile('redEnd',c,.158);
     }
    }
    rectangle('iron',s+.104,s+.155,B+h*.53,B+h*.53+.052,.144);
   }
  }
 }
 const out=new T.Group();
 for(const [k,parts] of meshes){
  const merged=mergeGeometries(parts.map(m=>m.index?m.toNonIndexed():m));
  if(!merged)throw Error('Unable to merge '+k+' barn art');
  merged.computeBoundingSphere();
  const mesh=new T.Mesh(merged,paint(k));mesh.name=k;mesh.castShadow=true;mesh.receiveShadow=true;out.add(mesh);
  for(const p of parts)p.dispose();
 }
 out.name='Green Gables Barn and joined roof witness · authored exterior';
 return {model:out,counts,unpaired,internalSteps,roofPatches:roofPatches.length};
}
