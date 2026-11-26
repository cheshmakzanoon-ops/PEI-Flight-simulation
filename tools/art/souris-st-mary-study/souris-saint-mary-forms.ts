/** Original detached archaeological-looking study, not survey, scene, or an asset importer. */
import * as T from 'three';

export const MARY_ROLES = ['stone', 'freestone', 'roof', 'copper', 'glass', 'wood','metal'] as const;
export type MaryRole = typeof MARY_ROLES[number];
type V = [number, number, number];
type UV = [number, number];
type P2 = [number, number];
type Arch = { x: number; base: number; spring: number; rise: number; half: number; fill: 'glass'|'wood'; bars?: number; curve?: number };
type Panel = { map: (p: P2, depth: number) => V; out: V; uv?: (p:P2)=>UV };
const E = 13.47;
const L = -10.90, R = 10.88, B = -23.60, F = 25.60;
const TL = -15.60, TR = 15.28, TB = -11.85, TF = 2.08;
const MR = 21.93, CR = 19.03;
const TAU = 2 * Math.PI;
const sub = (a: V, b: V): V => [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot = (a: V, b: V) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross = (a: V, b: V): V => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm = (a: V): V => {
  const s = Math.hypot(...a); if (!(s > 1e-10) || !Number.isFinite(s)) throw Error('Degenerate St Mary study primitive');
  return [a[0]/s,a[1]/s,a[2]/s];
};
const mul = (a: V, s: number): V => [a[0]*s,a[1]*s,a[2]*s];
const lerp = (a: V, b: V, t: number): V => [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const rows = <T>(a: T[]) => a.map((v,i)=>[v, a[(i+1)%a.length]] as const);

export const MARY_STUDY_ENVELOPE = Object.freeze({
  plane: 'synthetic-local-metres-only', front: '+Z (southwest face if site registration eventually qualifies)',
  main: Object.freeze({ left:L,right:R,rear:B,front:F,eave:E,ridge:MR }),
  cross: Object.freeze({ left:TL,right:TR,rear:TB,front:TF,eave:E,ridge:CR }),
  westTower: Object.freeze({ x:-10.94,z:24.37,bodyRadius:3.68,crossTip:30.75 }),
  eastTower: Object.freeze({ x:9.12,z:23.90,bodyRadius:3.30,crossTip:19.01 }),
});
class Batches {
  readonly b = new Map<MaryRole,{v:number[];n:number[];uv:number[]}>(MARY_ROLES.map(r=>[r,{v:[],n:[],uv:[]}])) ;
  tri(r: MaryRole,p: readonly [V,V,V],uv: readonly [UV,UV,UV],out: V) {
    const nn = norm(cross(sub(p[1],p[0]),sub(p[2],p[0]))), forward = dot(nn,out)>0;
    const q=this.b.get(r)!; const face=forward?nn:mul(nn,-1);
    for (const i of forward?[0,1,2]:[0,2,1]) { q.v.push(...p[i]);q.n.push(...face);q.uv.push(...uv[i]); }
  }
  quad(r: MaryRole,p: readonly [V,V,V,V],uv: readonly [UV,UV,UV,UV],out: V) {
    this.tri(r,[p[0],p[1],p[2]],[uv[0],uv[1],uv[2]],out);this.tri(r,[p[0],p[2],p[3]],[uv[0],uv[2],uv[3]],out);
  }
  panel(r: MaryRole, outline: P2[], holes: P2[][], f: Panel, depth: number) {
    const p = [...outline,...holes.flat()];
    const fp = (p: P2) => new T.Vector2(p[0],p[1]);
    const tex = f.uv ?? ((x:P2) => x);
    for (const [a,b,c] of T.ShapeUtils.triangulateShape(outline.map(fp),holes.map(a=>a.map(fp)))) {
      this.tri(r,[f.map(p[a],depth),f.map(p[b],depth),f.map(p[c],depth)],[tex(p[a]),tex(p[b]),tex(p[c])],f.out);
    }
  }
  autoQuad(r: MaryRole,p: readonly [V,V,V,V],out: V) {
    const u=Math.hypot(...sub(p[0],p[1])),v=Math.hypot(...sub(p[0],p[3]));
    this.quad(r,p,[[0,0],[u,0],[u,v],[0,v]],out);
  }
}
const ph = (x:number,e:number,a:number,b:number) => E+(e-E)*(1-Math.abs((2*x-a-b)/(b-a)));
const mainY = (x:number) => ph(x,MR,L,R);
const crossY = (z:number) => ph(z,CR,TB,TF);
const within = (x:number,a:number,b:number) => x>=a&&x<=b;
const bodyTop=(x:number,z:number)=>Math.max(within(x,L,R)&&within(z,B,F)?mainY(x):0,within(x,TL,TR)&&within(z,TB,TF)?crossY(z):0);
const shell = (a:number,b:number,high:number,eave=E):P2[] => [[a,0],[b,0],[b,eave],[(a+b)/2,high],[a,eave]];
const wall = (a:number,b:number,h=E):P2[] => [[a,0],[b,0],[b,h],[a,h]];
function planar(direction:'front'|'rear'|'left'|'right',at:number):Panel {
  if(direction==='front')return {map:([x,y],d)=>[x,y,at+d],out:[0,0,1]};
  if(direction==='rear')return {map:([x,y],d)=>[x,y,at-d],out:[0,0,-1]};
  if(direction==='left')return {map:([z,y],d)=>[at-d,y,z],out:[-1,0,0]};
  return {map:([z,y],d)=>[at+d,y,z],out:[1,0,0]};
}
function arch(a: Arch, edge = 0): P2[] {
  const w=a.half+edge,h=a.rise+edge*.84,s=a.spring;
  const k=(h*h-w*w)/(2*w), radius=w+k, last=Math.acos(k/radius);
  const n=a.curve??5;
  const gate=Array.from({length:n+1},(_,i)=> {
    const angle=last*i/n;
    return [i===n?0:-k+radius*Math.cos(angle),s+radius*Math.sin(angle)] as const;
  });
  // One shared apex with actual tangent break, not circular-headed windows.
  return [[a.x-w,a.base-edge],[a.x+w,a.base-edge],...gate.map(([x,y])=>[a.x+x,y] as P2),
          ...gate.slice(0,-1).reverse().map(([x,y])=>[a.x-x,y] as P2)];
}
function planeInset(q:Batches,f:Panel,a:Arch,edge:number,nose:number,deep:number) {
  const inner=arch(a),outer=arch(a,edge), mid=arch(a,edge*.73); const lip=nose*.57;
  for (const [i,j] of rows(inner.map((_,i)=>i))) {
    const u=inner[i],v=inner[j],ou=outer[i],ov=outer[j],mu=mid[i],mv=mid[j];
    if(edge>.16){
      q.quad('freestone',[f.map(ou,0),f.map(ov,0),f.map(mv,lip),f.map(mu,lip)],[ou,ov,mv,mu],f.out);
      q.quad('freestone',[f.map(mu,lip),f.map(mv,lip),f.map(v,nose),f.map(u,nose)],[mu,mv,v,u],f.out);
    }else q.quad('freestone',[f.map(ou,0),f.map(ov,0),f.map(v,nose),f.map(u,nose)],[ou,ov,v,u],f.out);
    // Map outward wedge and derive exact inward-facing reveal from aperture ring.
    const w=f.map(u,nose),x=f.map(v,nose),y=f.map(v,-deep),z=f.map(u,-deep);
    const into = sub(f.map([u[0]-(v[1]-u[1]),u[1]+(v[0]-u[0])],nose),w);
    q.autoQuad('freestone',[w,x,y,z],into);
  }
  q.panel(a.fill,inner,[],f,-deep);
  const bar=(x0:number,x1:number,y0:number,y1:number)=>{
    if(x0>=x1||y0>=y1) return;
    q.panel(a.fill==='wood'?'wood':'freestone',[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],[],f,-deep+.018);
  };
  if(a.fill==='glass'&&a.bars){
    const w=a.half*.079;
    bar(a.x-w,a.x+w,a.base+.06,a.spring+a.rise*.92);
    const sill=a.spring-a.base;
    for(let i=1;i<a.bars;i++){
      const y=a.base+sill*i/a.bars;bar(a.x-a.half+.035,a.x+a.half-.035,y-.022,y+.022);
    }
  }else if(a.fill==='wood'){
    const lo=a.base+.31,hi=a.spring-.17;
    if(hi>lo) for(const k of [-1,1]) {
      const x0=a.x+a.half*(k*.52-.22),x1=a.x+a.half*(k*.52+.22);
      q.panel('wood',[[x0,lo],[x1,lo],[x1,hi],[x0,hi]],[],f,-deep+.026);
    }
  }
}
function sculptWall(q:Batches,f:Panel,p:P2[],openings:Arch[],border=.23,depth=.29){
  // The wall goes as far as the outer carving; the arch bridges it to the true hole.
  q.panel('stone',p,openings.map(o=>arch(o,border)),f,0);
  for (const a of openings) planeInset(q,f,a,border,.086,depth);
}
const sorted = (...n:number[]) => Array.from(new Set(n)).sort((a,b)=>a-b);
function clip(p:P2[],k:(q:P2)=>number):P2[] {
  const r:P2[]=[];for(const [a,b] of rows(p)){
    const av=k(a),bv=k(b);if(av>=0)r.push(a);
    if(av*bv<0){ const t=av/(av-bv);r.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]); }
  }
  return r;
}
function roofUnion(q:Batches){
  const xs=sorted(TL,L,(R+L)/2,R,TR),zs=sorted(B,TB,(TF+TB)/2,TF,F);
  for (let i=0;i<xs.length-1;i++)for (let j=0;j<zs.length-1;j++){
    const x=xs[i],X=xs[i+1],z=zs[j],Z=zs[j+1],cx=(x+X)/2,cz=(z+Z)/2;
    const m=within(cx,L,R)&&within(cz,B,F),w=within(cx,TL,TR)&&within(cz,TB,TF);
    if(!(m||w))continue;
    const rect:P2[]=[[x,z],[X,z],[X,Z],[x,Z]];
    const past=(a:P2) => mainY(a[0])-crossY(a[1]);
    const emit=(p:P2[],head:(a:P2)=>number,rot:boolean)=>{
      const to=(a:P2):V=>[a[0],head(a),a[1]];
      const uv=(a:P2):UV=>rot?[a[0],Math.hypot(a[1]-(TB+TF)/2,CR-head(a))]:[a[1],Math.hypot(a[0]-(L+R)/2,MR-head(a))];
      for(let k=1;k+1<p.length;k++){
        const [a,b,c]=[p[0],p[k],p[k+1]];
        if(Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))<1e-10)continue;
        q.tri('roof',[to(a),to(b),to(c)],[uv(a),uv(b),uv(c)],[0,1,0]);
      }
    };
    if(m)emit(w?clip(rect,past):rect,a=>mainY(a[0]),false);
    if(w)emit(m?clip(rect,a=>-past(a)):rect,a=>crossY(a[1]),true);
    q.autoQuad('stone',[[x,0,z],[X,0,z],[X,0,Z],[x,0,Z]],[0,-1,0]);
  }
}
function baseRoofEdge(q:Batches,d:'front'|'rear'|'left'|'right',at:number,start:number,end:number,top:(x:number)=>number,isGable:boolean){
  const f=planar(d,at), mm=(start+end)/2;
  // Back wraps and roof eaves are restrained; labels describe materials, not exact slate type.
  for(const [a,b] of (isGable?[[start,mm],[mm,end]]:[[start,end]])){
    const A=top(a),B=top(b), w=isGable?.31:.24, depth=isGable?.255:.355;
    let p0=f.map([a,A-w],depth),p1=f.map([b,B-w],depth), p2=f.map([b,B+.055],depth), p3=f.map([a,A+.055],depth);
    q.autoQuad(isGable?'freestone':'roof',[p0,p1,p2,p3],f.out);
    q.autoQuad('roof',[p3,p2,f.map([b,B],-.035),f.map([a,A],-.035)],[0,1,0]);
    q.autoQuad(isGable?'freestone':'roof',[p0,p1,f.map([b,B-w],-.019),f.map([a,A-w],-.019)],[0,-1,0]);
  }
}
function block(q:Batches,r:MaryRole,x:number,X:number,y:number,Y:number,z:number,Z:number){
  q.autoQuad(r,[[x,y,z],[X,y,z],[X,Y,z],[x,Y,z]],[0,0,-1]);
  q.autoQuad(r,[[x,y,Z],[X,y,Z],[X,Y,Z],[x,Y,Z]],[0,0,1]);
  q.autoQuad(r,[[x,y,z],[x,y,Z],[x,Y,Z],[x,Y,z]],[-1,0,0]);
  q.autoQuad(r,[[X,y,z],[X,y,Z],[X,Y,Z],[X,Y,z]],[1,0,0]);
  q.autoQuad(r,[[x,Y,z],[X,Y,z],[X,Y,Z],[x,Y,Z]],[0,1,0]);
  q.autoQuad(r,[[x,y,z],[X,y,z],[X,y,Z],[x,y,Z]],[0,-1,0]);
}
function buttress(q:Batches,side:'left'|'right',at:number,z:number,tall:number){
  const f=planar(side,at),w=.49;
  const profile:[number,number][]=[[0,.74],[tall*.39,.68],[tall*.49,.48],[tall*.79,.43],[tall*.89,.30],[tall,.09]];
  for(let i=0;i+1<profile.length;i++){
    const [lo,loD]=profile[i],[hi,hiD]=profile[i+1],r=loD-hiD>.09?'freestone':'stone';
    const a=f.map([z-w,lo],loD),b=f.map([z+w,lo],loD),c=f.map([z+w,hi],hiD),d=f.map([z-w,hi],hiD);
    q.autoQuad(r,[a,b,c,d],f.out);
    q.autoQuad('stone',[f.map([z-w,lo],-.035),a,d,f.map([z-w,hi],-.035)],[0,0,-1]);
    q.autoQuad('stone',[f.map([z+w,lo],-.035),b,c,f.map([z+w,hi],-.035)],[0,0,1]);
  }
  const [,deep]=profile.at(-1)!;
  q.autoQuad('freestone',[f.map([z-w,tall],deep),f.map([z+w,tall],deep),f.map([z+w,tall],-.04),f.map([z-w,tall],-.04)],[0,1,0]);
}
function core(q:Batches){
  const g=(x:number,base:number,spring:number,rise:number,half:number,bars=3):Arch=>({x,base,spring,rise,half,bars,fill:'glass'});
  const d=(x:number,half:number,top:number):Arch=>({x,base:.61,spring:top-.96,rise:.96,half,fill:'wood'});
  sculptWall(q,planar('front',F),shell(L,R,MR),[
    g(-4.37,7.47,13.26,1.85,1.02),g(-.13,7.1,14.8,2.32,1.32,4),g(4.11,7.52,13.26,1.85,.99),
    g(-.13,18.82,19.55,.70,.42,1),d(-3.82,.75,4.09),d(-.17,.85,4.76),d(3.49,.74,4.09),
  ]);
  sculptWall(q,planar('rear',B),shell(L,R,MR),[]);
  baseRoofEdge(q,'front',F,L,R,mainY,true);baseRoofEdge(q,'rear',B,L,R,mainY,true);
  for (const [side,at,outer] of [['left',L,TL],['right',R,TR]] as const){
    sculptWall(q,planar(side,outer),shell(TB,TF,CR),[
      g(-8.57,5.65,11.69,1.58,.79),g(-4.99,5.32,12.78,1.80,1.00),g(-1.50,5.65,11.69,1.58,.79),
    ],.21,.27);
    baseRoofEdge(q,side,outer,TB,TF,crossY,true);
    for(const [a,b] of [[B,TB],[TF,F]]) {
      sculptWall(q,planar(side,at),wall(a,b),[]);baseRoofEdge(q,side,at,a,b,()=>E,false);
    }
    // Each named chapel supports three arches; unspecified side bays remain undecorated.
    for(const z of [-20.75,-15.48,6.19,12.2,18.35])buttress(q,side,at,z,11.62);
    for(const z of [TB+.69,TF-.69])buttress(q,side,outer,z,12.70);
  }
  for (const [a,b] of [[TL,L],[R,TR]])for(const [which,z]of [['front',TF],['rear',TB]] as const){
    sculptWall(q,planar(which,z),wall(a,b),[]);baseRoofEdge(q,which,z,a,b,()=>E,false);
  }
  roofUnion(q);
}
const RAD_STEPS=20;
const circle=(x:number,z:number,r:number,y:number,t:number):V=>[x+r*Math.sin(t),y,z+r*Math.cos(t)];
function shaft(q:Batches,opts:{x:number,z:number,r:number,h:number,windows:Readonly<Partial<Record<number,Arch[]>>>}){
  const {x,z,r,h,windows}=opts,delta=TAU/RAD_STEPS,d=2*r*Math.sin(delta/2);
  for(let i=0;i<RAD_STEPS;i++){
    const a=(i-.5)*delta,b=a+delta,no:V=[Math.sin((a+b)/2),0,Math.cos((a+b)/2)], as=windows[i]??[];
    const A=circle(x,z,r,0,a),B=circle(x,z,r,0,b);
    const f:Panel={out:no,uv:([u,y])=>[u+i*d,y],map:([u,y],off)=>{const v=lerp(A,B,u/d);return [v[0]+off*no[0],y,v[2]+off*no[2]];}};
    const localU=as.map(x=>({...x,x:d*x.x}));
    sculptWall(q,f,wall(0,d,h),localU,.096,.23);
    q.tri('stone',[A,B,[x,0,z]],[[i*d,0],[(i+1)*d,0],[i*d,1]],[0,-1,0]);
  }
}
function radial(q:Batches,r:MaryRole,x:number,z:number,shape:ReadonlyArray<readonly [number,number]>,n=RAD_STEPS){
  for(let j=0;j+1<shape.length;j++){
    const [y,r0]=shape[j],[Y,r1]=shape[j+1],dw=Math.hypot(Y-y,r0-r1);
    for(let i=0;i<n;i++){
      const t=(i-.5)*TAU/n,u=t+TAU/n,pc=(rr:number,yy:number,tt:number)=>circle(x,z,rr,yy,tt);
      const M=(t+u)/2,out:V=[Math.sin(M)*(Y-y),r0-r1,Math.cos(M)*(Y-y)];
      const A=pc(r0,y,t),B=pc(r0,y,u),C=pc(r1,Y,u),D=pc(r1,Y,t);
      const a=(i+.15)*TAU*Math.max(r0,r1)/n, b=a+TAU*Math.max(r0,r1)/n, v=y;
      if(r0===0){q.tri(r,[A,C,D],[[a,v],[b,v+dw],[a,v+dw]],out);}
      else if(r1===0){q.tri(r,[A,B,C],[[a,v],[b,v],[a,v+dw]],out);}
      else q.quad(r,[A,B,C,D],[[a,v],[b,v],[b,v+dw],[a,v+dw]],out);
    }
  }
}
function tower(q:Batches,side:'west'|'east'){
  const west=side==='west', {x,z,bodyRadius:r}=west?MARY_STUDY_ENVELOPE.westTower:MARY_STUDY_ENVELOPE.eastTower;
  const o=(xx:number,base:number,spring:number,rise:number,half:number):Arch=>({x:xx,base,spring,rise,half,fill:'glass',bars:3,curve:4});
  const w=west?{
    0:[o(.50,5.15,6.89,.73,.31),o(.50,10.8,12.69,.88,.36),o(.50,17.65,20.53,1.08,.365)],
    17:[o(.50,17.4,20.27,1.0,.32)],
  }:{ 0:[o(.5,4.98,6.32,.72,.30),o(.5,9.4,10.91,.75,.345)],
    2:[o(.5,9.37,10.89,.74,.32)],18:[o(.5,9.37,10.89,.74,.32)],
  };
  const h=west?22.82:13.35;
  shaft(q,{x,z,r,h,windows:w});
  radial(q,'stone',x,z,[[.04,r+.15],[.24,r+.19],[.47,r+.145],[.65,r+.01]]);
  for(const y of west?[7.92,14.31,22.48]:[7.82,12.98]){
    radial(q,'freestone',x,z,[[y-.03,r-.009],[y+.015,r+.12],[y+.16,r+.13],[y+.23,r+.06],[y+.27,r-.008]]);
  }
  const h0=west?22.73:13.25;
  radial(q,'freestone',x,z,[[h0,r-.025],[h0+.11,r+.11],[h0+.29,r+.16],[h0+.4,r+.32],[h0+.49,r+.55],
                           [h0+.64,r+.52],[h0+.72,r+.32],[h0+.86,r+.30]]);
  radial(q,'copper',x,z,west?[[h0+.81,r+.32],[23.83,3.72],[24.27,3.25],[24.92,2.69],[25.39,2.42],
    [25.62,2.34],[27.58,2.32],[27.70,2.58],[27.88,2.69],[28.24,2.60],[28.95,1.75],[29.42,.91],[29.64,.07]]:
    [[h0+.79,r+.32],[14.24,3.48],[14.54,3.10],[15.24,2.24],[15.48,2.08],[15.62,1.97],[16.62,1.11],[17.61,.26],[17.98,.08]],8);
  const Y=west?29.56:17.90;
  crossTip(q,x,z,Y,west?1.19:1.11);
}
function crossTip(q:Batches,x:number,z:number,Y:number,h:number){
  block(q,'metal',x-.064,x+.064,Y,Y+h,z-.065,z+.065);
  block(q,'metal',x-h*.29,x+h*.29,Y+h*.68,Y+h*.78,z-.06,z+.06);
}
export function makeDetachedMaryGeometry(): ReadonlyMap<MaryRole,T.BufferGeometry> {
  const q=new Batches();core(q);tower(q,'west');tower(q,'east');crossTip(q,(L+R)/2,F-.015,MR,.95);
  const out=new Map<MaryRole,T.BufferGeometry>();
  for(const [role,b] of q.b){
    if(!b.v.length||b.n.length!==b.v.length||b.uv.length*3!==b.v.length*2)throw Error('Malformed detached role');
    const g=new T.BufferGeometry();g.name=`Souris.StMary.detached.${role}`;
    g.setAttribute('position',new T.Float32BufferAttribute(b.v,3));g.setAttribute('normal',new T.Float32BufferAttribute(b.n,3));
    g.setAttribute('uv',new T.Float32BufferAttribute(b.uv,2));g.computeBoundingBox();g.computeBoundingSphere();out.set(role,g);
  }
  return out;
}
export function makeDetachedSaintMary(material:(role:MaryRole)=>T.Material):T.Group {
  const group=new T.Group();group.name='Souris.StMary.historic-exterior-approximation.detached';
  group.userData.role='artist-prototype-no-native-seat';
  for(const [role,g]of makeDetachedMaryGeometry()){
    const m=new T.Mesh(g,material(role));m.name=g.name;m.castShadow=true;m.receiveShadow=true;group.add(m);
  }
  return group;
}
/** Exact analytical core envelope for detached QA only. */
export const expectedMaryCoreTop=bodyTop;
