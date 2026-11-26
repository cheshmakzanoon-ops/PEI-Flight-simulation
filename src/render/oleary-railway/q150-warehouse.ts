/**
 * Detached O'Leary q20213/150 main shed form, not connected to the simulator.
 * Three matte, asset-free original material families. Nothing added for a
 * doorway, sign, annex, false eave count, paint scheme or adjacent property.
 */
import * as T from 'three';
import {Q150} from './q150-plan.generated.ts';

type V2=readonly [number,number];
type V3=readonly [number,number,number];
type Roof=typeof Q150.body.high|typeof Q150.body.low;
type Role='roof'|'sheet'|'mineral';
export type Q150NativeSeat={
 height:(x:number,z:number)=>number;
 /** Independent stock facet crossings of the full local seat segment. */
 knots:(a:V2,b:V2)=>readonly number[];
};
const roles:Role[]=['roof','sheet','mineral'];
const [X,Z]=Q150.frame.gameOrigin,U=Q150.frame.gameU,V=Q150.frame.gameV,DATUM=32,FLANGE=.107,BASE=.365;
const interpolate=(a:V2,b:V2,f:number):V2=>[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];
const UVworld=([u,v]:V2):V2=>[u*U[0]+v*V[0],u*U[1]+v*V[1]];
const coord=(p:V2,y:number):V3=>{const [x,z]=UVworld(p);return [x,y-DATUM,z];};
const under=(r:Roof,v:number)=>r.gameYPeak-r.planeRisePerCrossM*Math.abs(v-r.ridgeV);
const split=(a:number,b:number,at:readonly number[])=>[a,...at.filter(v=>v>a&&v<b).sort((x,y)=>x-y),b];
const outward=(a:V2,b:V2):V3=>{
 const u=b[1]-a[1],v=a[0]-b[0],n=UVworld([u,v]);return [n[0],0,n[1]];
};
const up:V3=[0,1,0],down:V3=[0,-1,0];

export function buildDetachedQ150Warehouse(grade:Q150NativeSeat){
 const data=Object.fromEntries(roles.map(role=>[role,{pos:[]as number[],rgb:[]as number[]}])) as Record<Role,{pos:number[];rgb:number[]}>;
 // The old atlas/reference image is not used as a texture or spectral
 // palette. These muted values are authored material assumptions only.
 const c={
  roof:new T.Color(0x889191),ridge:new T.Color(0x969b98),
  exposedLip:new T.Color(0x818685),eaveShadow:new T.Color(0x727776),
  sheet:new T.Color(0x9ea5a1),base:new T.Color(0x8b8b82),baseTop:new T.Color(0x96968c)
 };
 const baseSegments:{a:V2;b:V2;reference:string;role:Role}[]=[];
 const inGame=(q:V2):V2=>{const [x,z]=UVworld(q);return [X+x,Z+z];};
 const ground=(q:V2)=>{const [x,z]=inGame(q);const y=grade.height(x,z);
  if(!Number.isFinite(y)||y<30.5||y>33)throw Error('Missing bounded original q150 ground facet');return y;
 };
 const locCut=(a:V2,b:V2)=>grade.knots(inGame(a),inGame(b));
 const knots=(...arr:readonly number[][])=>[0,...arr.flat().filter(f=>f>1.e-8&&f<1-1.e-8).sort((a,b)=>a-b),1].filter((p,i,vs)=>i===0||p-vs[i-1]>1.e-8);
 function face(role:Role,a:V3,b:V3,c0:V3,wanted:V3,color:T.Color){
  const p=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],q=[c0[0]-a[0],c0[1]-a[1],c0[2]-a[2]];
  const orient=(p[1]*q[2]-p[2]*q[1])*wanted[0]+(p[2]*q[0]-p[0]*q[2])*wanted[1]+(p[0]*q[1]-p[1]*q[0])*wanted[2];
  if(Math.abs(orient)<1.e-10)throw Error('Degenerate q150 authored face');
  for(const xyz of orient>0?[a,b,c0]:[a,c0,b]){data[role].pos.push(...xyz);data[role].rgb.push(color.r,color.g,color.b);}
 }
 function quad(role:Role,a:V3,b:V3,c0:V3,d:V3,side:V3,color:T.Color){
  face(role,a,b,c0,side,color);face(role,a,c0,d,side,color);
 }
 function lineFace(role:Role,a:V2,b:V2,lo:(p:V2)=>number,hi:(p:V2)=>number,color:T.Color,n=outward(a,b)){
  quad(role,coord(a,lo(a)),coord(b,lo(b)),coord(b,hi(b)),coord(a,hi(a)),n,color);
 }
 function roofBand(r:Roof,role:Role,u0:number,u1:number,v0:number,v1:number,offset:number,side:V3,color:T.Color){
  const p0:V2=[u0,v0],p1:V2=[u1,v0],p2:V2=[u1,v1],p3:V2=[u0,v1];
  if(u1-u0<.002||v1-v0<.002)return;
  quad(role,...([p0,p1,p2,p3].map(p=>coord(p,under(r,p[1])+offset)) as [V3,V3,V3,V3]),side,color);
 }
 function upper(r:Roof,which:'high'|'low'){
  const [one,two,three]=r.outer,u0=one[0],u1=two[0],v0=one[1],v1=three[1],R=r.ridgeV;
  const [wo,wt,wh]=r.wall,a=wo[0],b=wt[0],d=wo[1],e=wh[1];
  // A narrow folded ridge piece shares the fitted roof planes: its
  // uppermost point never lifts the measured-support silhouette.
  const t=split(v0,v1,[R-.125,R,R+.125]);
  for(let k=0;k<t.length-1;k++){
   const vv=[t[k],t[k+1]] as const;
   roofBand(r,'roof',u0,u1,...vv,0,up,k===1||k===2?c.ridge:c.roof);
  }
  const lo=(p:V2)=>under(r,p[1])-FLANGE,hi=(p:V2)=>under(r,p[1]);
  lineFace('roof',[u0,v0],[u1,v0],lo,hi,c.exposedLip);
  lineFace('roof',[u1,v1],[u0,v1],lo,hi,c.exposedLip);
  for(const [u,reverse] of [[u0,true],[u1,false]] as const){
   if(which==='low'&&reverse)continue; // no copied joints at the common seat
   const xs=split(v0,v1,[R]);
   for(let i=0;i<xs.length-1;i++){
    const pa:V2=[u,xs[i]],pb:V2=[u,xs[i+1]];
    lineFace('roof',reverse?pb:pa,reverse?pa:pb,lo,hi,c.exposedLip);
   }
  }
  // Draw the two true overhang returns, dark from their own downward
  // normals and not from an invented world contact/AO pass.
  roofBand(r,'roof',u0,u1,v0,d,-FLANGE,down,c.eaveShadow);
  roofBand(r,'roof',u0,u1,e,v1,-FLANGE,down,c.eaveShadow);
  for(const [loU,hiU] of [[u0,a],[b,u1]] as const)for(const [loV,hiV] of [[d,R],[R,e]] as const)roofBand(r,'roof',loU,hiU,loV,hiV,-FLANGE,down,c.eaveShadow);
 }
 function wallGround(r:Roof,a:V2,b:V2,eaved:boolean,label:string){
  const list=knots([...locCut(a,b)]),thick=eaved?BASE:-.083;
  for(let i=0;i<list.length-1;i++){
   const p=interpolate(a,b,list[i]),q=interpolate(a,b,list[i+1]);
   const f=(n:V2)=>ground(n)+thick;
   const g=(n:V2)=>under(r,n[1])-FLANGE+.010;
   if(Math.min(g(p)-f(p),g(q)-f(q))<3.5)throw Error('Unsupported q150 shed wall height');
   lineFace('sheet',p,q,f,g,c.sheet);
   if(!eaved)baseSegments.push({a:p,b:q,reference:label,role:'sheet'});
  }
 }
 function mineral(ua:number,ub:number,v:number){
  // Only the visibly raised trail-facing sill family from the dated
  // observation, not a count or placement of guessed isolated posts.
  const outer=v+.057,endA:V2=[ub,outer],endB:V2=[ua,outer],innerA:V2=[ub,v],innerB:V2=[ua,v];
  const fs=knots([...locCut(endA,endB)],[...locCut(innerA,innerB)]);
  for(let i=0;i<fs.length-1;i++){
   const s=fs[i],t=fs[i+1],p=interpolate(endA,endB,s),q=interpolate(endA,endB,t),
    a=interpolate(innerA,innerB,s),b=interpolate(innerA,innerB,t),
    ya=ground(a)+BASE,yb=ground(b)+BASE;
   quad('mineral',coord(p,ground(p)-.083),coord(q,ground(q)-.083),coord(q,yb),coord(p,ya),outward(p,q),c.base);
   quad('mineral',coord(p,ya),coord(q,yb),coord(b,yb),coord(a,ya),up,c.baseTop);
   baseSegments.push({a:p,b:q,reference:'dated trail-side sill, opaque continuous geometry',role:'mineral'});
  }
  for(const [x,side] of [[ua,-1],[ub,1]]as const){
   const p:V2=[x,v],q:V2=[x,outer];const h=ground(p)+BASE;
   const n:V3=[side*U[0],0,side*U[1]];
   quad('mineral',coord(p,ground(p)-.083),coord(q,ground(q)-.083),coord(q,h),coord(p,h),n,c.base);
   baseSegments.push({a:p,b:q,reference:'buried sill end return',role:'mineral'});
  }
 }
 function walls(r:Roof,which:'high'|'low'){
  const [a,b,c0,d]=r.wall;
  wallGround(r,a,b,false,which+' opposite wall');
  wallGround(r,c0,d,true,which+' visible facing wall');
  for(const [u,reverse] of [[a[0],true],[b[0],false]]as const){
   if((which==='high'&&!reverse)||(which==='low'&&reverse))continue;
   const v=split(a[1],c0[1],[r.ridgeV]);
   for(let j=0;j<v.length-1;j++){
    const p:V2=[u,v[j]],q:V2=[u,v[j+1]];wallGround(r,reverse?q:p,reverse?p:q,false,which+' exterior gable end');
   }
  }
 }
 const H=Q150.body.high,L=Q150.body.low,join=H.wall[1][0];
 upper(H,'high');upper(L,'low');walls(H,'high');walls(L,'low');
 // Two evidence-backed roof bands meet in a simple opaque plane. The
 // actual join detail is unknown: no fasteners, loading bay or side shed.
 wallGround(H,[join,H.wall[1][1]],[join,L.wall[0][1]],false,'conservative revealed step beside lower body');
 const v=split(L.wall[0][1],L.wall[3][1],[L.ridgeV,H.ridgeV]);
 for(let j=0;j<v.length-1;j++){
  const a:V2=[join,v[j]], b:V2=[join,v[j+1]];
  const lo=(p:V2)=>under(L,p[1])-.014,hi=(p:V2)=>under(H,p[1])-FLANGE+.010;
  if(Math.min(hi(a)-lo(a),hi(b)-lo(b))<.35)throw Error('The two signed roof bands no longer meet safely');
  lineFace('sheet',a,b,lo,hi,c.sheet);
 }
 const visibleV=H.wall[3][1];if(L.wall[3][1]!==visibleV)throw Error('Date-qualified continuous rail-facing side was lost');
 mineral(H.wall[0][0],L.wall[1][0],visibleV);
 const group=new T.Group();group.name='O’Leary q150 original two-level warehouse study';group.position.set(X,DATUM,Z);
 const memory:{q:T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;g:T.BufferGeometry;shader:T.MeshStandardMaterial;
  p:T.Float32BufferAttribute;col:T.Float32BufferAttribute;n:T.BufferAttribute;nv:number;count:number}[]=[];
 for(const role of roles){
  const m=data[role],g=new T.BufferGeometry(),p=new T.Float32BufferAttribute(m.pos,3),col=new T.Float32BufferAttribute(m.rgb,3);
  g.setAttribute('position',p);g.setAttribute('color',col);g.computeVertexNormals();g.computeBoundingSphere();
  const shader=new T.MeshStandardMaterial({vertexColors:true,roughness:role==='mineral'?.89:role==='roof'?.72:.77,metalness:role==='mineral'?0:.11,side:T.FrontSide});
  shader.name='q150 original '+role;
  const q=new T.Mesh(g,shader);q.name='q150 '+role;group.add(q);
  const n=g.getAttribute('normal') as T.BufferAttribute;memory.push({q,g,shader,p,col,n,nv:n.version,count:p.count});
 }
 let dead=false;
 return {group,baseSegments,exactOwner:Q150.scope,
  intact(){return !dead&&group.children.length===3&&group.position.x===X&&group.position.y===DATUM&&group.position.z===Z&&memory.every((a,i)=>
   group.children[i]===a.q&&a.q.parent===group&&a.q.geometry===a.g&&a.q.material===a.shader&&a.q.visible&&
   a.shader.visible&&!a.shader.transparent&&a.shader.opacity===1&&a.shader.vertexColors&&
   !a.shader.map&&!a.shader.envMap&&!a.q.castShadow&&!a.q.receiveShadow&&a.q.matrixAutoUpdate&&a.q.matrixWorldAutoUpdate&&
   a.q.position.lengthSq()===0&&a.q.quaternion.w===1&&a.q.scale.x===1&&a.q.scale.y===1&&a.q.scale.z===1&&
   a.g.index===null&&!a.g.groups.length&&a.g.getAttribute('position')===a.p&&a.p.count===a.count&&a.p.version===0&&
   a.g.getAttribute('normal')===a.n&&a.n.version===a.nv&&a.g.getAttribute('color')===a.col&&a.col.version===0);},
  dispose(){if(dead)return;dead=true;group.removeFromParent();for(const q of memory){q.g.dispose();q.shader.dispose();}}};
}
