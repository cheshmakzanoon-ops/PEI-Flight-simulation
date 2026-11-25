import {dalvayFinish,type DalvayFinish} from './dalvay-exterior-material.ts';
import * as T from 'three';
export type UV=[number,number];
export type P=[number,number,number]; // plan east-like U, game height, plan south-like V
export type Skin=DalvayFinish;
type Bin={pos:number[],color:number[],uv:number[]};
const B=63.5*Math.PI/180,ux=Math.sin(B),uz=-Math.cos(B),vx=Math.cos(B),vz=Math.sin(B);
export function xz(u:number,v:number):UV{return [ux*u+vx*v,uz*u+vz*v];}
export function uv(x:number,z:number):UV{return [ux*x+uz*z,vx*x+vz*z];}
const cache=new Map<number,T.Color>();function col(c:number){let q=cache.get(c);if(!q){q=new T.Color(c);cache.set(c,q);}return q;}
const blank=():Bin=>({pos:[],color:[],uv:[]});
const vec=(p:P)=>new T.Vector3(...p),out=(v:T.Vector3)=>v.toArray() as P;
export class DalvayMesh {
 readonly bins:Record<Skin,Bin>={masonry:blank(),render:blank(),joinery:blank(),shingles:blank(),glazing:blank()};
 triangle(k:Skin,a:P,b:P,c:P,tint:number,tex?:[UV,UV,UV]){
  const bin=this.bins[k],rgb=col(tint);
  for(const [i,q]of[a,b,c].entries()){const p=xz(q[0],q[2]);bin.pos.push(p[0],q[1],p[1]);bin.color.push(rgb.r,rgb.g,rgb.b);bin.uv.push(...(tex?.[i]??[q[0],q[2]]));}
 }
 quad(k:Skin,a:P,b:P,c:P,d:P,t:number,tex?:[UV,UV,UV,UV]){
  this.triangle(k,a,b,c,t,tex&&[tex[0],tex[1],tex[2]]);this.triangle(k,a,c,d,t,tex&&[tex[0],tex[2],tex[3]]);
 }
 poly(k:Skin,p:P[],t:number,tex?:UV[]){for(let i=1;i+1<p.length;i++)this.triangle(k,p[0],p[i],p[i+1],t,tex&&[tex[0],tex[i],tex[i+1]]);}
 box(k:Skin,u0:number,u1:number,v0:number,v1:number,y0:number,y1:number,t:number){
  const p=(u:number,y:number,v:number):P=>[u,y,v],a=p(u0,y0,v0),b=p(u1,y0,v0),c=p(u1,y0,v1),d=p(u0,y0,v1),A=p(u0,y1,v0),B=p(u1,y1,v0),C=p(u1,y1,v1),D=p(u0,y1,v1);
  this.quad(k,a,A,B,b,t,[[u0,y0],[u0,y1],[u1,y1],[u1,y0]]);this.quad(k,b,B,C,c,t,[[v0,y0],[v0,y1],[v1,y1],[v1,y0]]);
  this.quad(k,c,C,D,d,t,[[u1,y0],[u1,y1],[u0,y1],[u0,y0]]);this.quad(k,d,D,A,a,t,[[v1,y0],[v1,y1],[v0,y1],[v0,y0]]);
  this.quad(k,A,D,C,B,t);this.quad(k,a,b,c,d,t);
 }
 rod(k:Skin,p:P,q:P,r0:number,r1:number,tint:number,steps=8){
  const a=vec(p),b=vec(q),d=b.clone().sub(a);if(d.length()<1e-7)return;d.normalize();
  const x=new T.Vector3().crossVectors(Math.abs(d.y)>.84?new T.Vector3(1,0,0):new T.Vector3(0,1,0),d).normalize(),z=new T.Vector3().crossVectors(d,x);
  const pt=(v:T.Vector3,r:number,j:number)=>out(v.clone().addScaledVector(x,Math.cos(2*Math.PI*j/steps)*r).addScaledVector(z,Math.sin(2*Math.PI*j/steps)*r));
  for(let j=0;j<steps;j++)this.quad(k,pt(a,r0,j),pt(a,r0,j+1),pt(b,r1,j+1),pt(b,r1,j),tint);
 }
 // Flat-faced, visibly projecting bargeboard or rail. Normal points toward the viewer of its wall.
 member(p:P,q:P,normal:UV,width:number,depth:number,tint:number){
  const a=vec(p),b=vec(q),d=b.clone().sub(a);if(d.length()<1e-6)return;d.normalize();
  const n=new T.Vector3(normal[0],0,normal[1]).normalize(),side=new T.Vector3().crossVectors(d,n).normalize();
  const v=(v:T.Vector3,w:number,h:number):P=>out(v.clone().addScaledVector(side,w*width*.5).addScaledVector(n,h*depth*.5));
  for(let i=0;i<4;i++){const w=[1,-1,-1,1],h=[1,1,-1,-1],j=(i+1)%4;this.quad('joinery',v(a,w[i],h[i]),v(a,w[j],h[j]),v(b,w[j],h[j]),v(b,w[i],h[i]),tint);}
  this.quad('joinery',v(a,1,1),v(a,-1,1),v(a,-1,-1),v(a,1,-1),tint);this.quad('joinery',v(b,1,1),v(b,1,-1),v(b,-1,-1),v(b,-1,1),tint);
 }
 finish(group:T.Group){
  for(const k of Object.keys(this.bins) as Skin[]){const b=this.bins[k];if(!b.pos.length)continue;
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.pos,3));g.setAttribute('color',new T.Float32BufferAttribute(b.color,3));g.setAttribute('uv',new T.Float32BufferAttribute(b.uv,2));g.computeVertexNormals();g.computeBoundingSphere();
   const m=dalvayFinish(k);
   const mesh=new T.Mesh(g,m);mesh.name=m.name;group.add(mesh);
  }
 }
}
export function clipPoly(p:UV[],fn:(q:UV)=>number,keep=true):UV[]{
 if(!p.length)return [];let a=p[p.length-1],x=fn(a)*(keep?1:-1);const r:UV[]=[];
 for(const b of p){const y=fn(b)*(keep?1:-1);if((x>=0)!==(y>=0)){const t=x/(x-y);r.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}
  if(y>=0)r.push(b);a=b;x=y;}
 return r;
}
const signed=(p:UV[])=>p.reduce((s,a,i)=>s+a[0]*p[(i+1)%p.length][1]-a[1]*p[(i+1)%p.length][0],0)*.5;
const good=(p:UV[])=>p.length>=3&&Math.abs(signed(p))>1e-6;
type Patch={p:UV[],a:number,b:number,c:number,tone:number,directional:'u'|'v',role:string};
export class DalvayRoofs{
 role='joined roof';readonly emitted:{role:string,firstTriangle:number,triangles:number}[]=[];
 readonly list:Patch[]=[];private readonly kit:DalvayMesh;constructor(kit:DalvayMesh){this.kit=kit;}
 plane(p:UV[],samples:[P,P,P],tone:number,along:'u'|'v'){
  const [m,n,o]=samples,D=(n[0]-m[0])*(o[2]-m[2])-(n[2]-m[2])*(o[0]-m[0]);if(Math.abs(D)<1e-8||!good(p))return;
  const a=((n[1]-m[1])*(o[2]-m[2])-(n[2]-m[2])*(o[1]-m[1]))/D,b=((n[0]-m[0])*(o[1]-m[1])-(n[1]-m[1])*(o[0]-m[0]))/D;
  this.list.push({p:signed(p)<0?p.reverse():p,a,b,c:m[1]-a*m[0]-b*m[2],tone,directional:along,role:this.role});
 }
 quad(a:P,b:P,c:P,d:P,t:number,along:'u'|'v'){this.plane([a,b,c,d].map(q=>[q[0],q[2]]),[a,b,c],t,along);}
 // Source planes intersect through actual 2D clipping. All portions below an adjacent roof are omitted.
 build(){
  const clean=(p:UV[])=>{const q=p.filter((v,i)=>Math.hypot(v[0]-p[(i+p.length-1)%p.length][0],v[1]-p[(i+p.length-1)%p.length][1])>1e-7);return good(q)?q:[];};
  const bbox=(p:UV[])=>[Math.min(...p.map(q=>q[0])),Math.max(...p.map(q=>q[0])),Math.min(...p.map(q=>q[1])),Math.max(...p.map(q=>q[1]))];
  function minus(p:UV[],cut:UV[]):UV[][]{
   let inner=p;const emitted:UV[][]=[];
   for(let j=0;j<cut.length&&inner.length;j++){const a=cut[j],b=cut[(j+1)%cut.length],d=(q:UV)=>(b[0]-a[0])*(q[1]-a[1])-(b[1]-a[1])*(q[0]-a[0]);
    const out=clean(clipPoly(inner,d,false));if(out.length)emitted.push(out);inner=clean(clipPoly(inner,d));}
   return emitted;
  }
  const boxes=this.list.map(r=>bbox(r.p));
  for(let i=0;i<this.list.length;i++){const R=this.list[i];let polys=[R.p];
   for(let j=0;j<this.list.length&&polys.length;j++){if(i===j)continue;const Q=this.list[j],a=boxes[i],b=boxes[j];
    if(a[1]<=b[0]+1e-7||b[1]<=a[0]+1e-7||a[3]<=b[2]+1e-7||b[3]<=a[2]+1e-7)continue;
    const f=(p:UV)=>(Q.a-R.a)*p[0]+(Q.b-R.b)*p[1]+Q.c-R.c;
    let cut:UV[];if(Math.abs(Q.a-R.a)+Math.abs(Q.b-R.b)+Math.abs(Q.c-R.c)<1e-8){if(j<i)continue;cut=Q.p;}else cut=clean(clipPoly(Q.p,f));
    if(!good(cut))continue;
    polys=polys.flatMap(p=>{const test=cut.reduce((v,x,k)=>{const y=cut[(k+1)%cut.length];return clipPoly(v,u=>(y[0]-x[0])*(u[1]-x[1])-(y[1]-x[1])*(u[0]-x[0]));},p);return good(test)?minus(p,cut):[p];});
   }
   const start=this.kit.bins.shingles.pos.length/9;for(const p of polys){const pts=p.map(([u,v]):P=>[u,R.a*u+R.b*v+R.c,v]);this.kit.poly('shingles',pts,R.tone,pts.map(q=>R.directional==='v'?[q[2],q[0]*Math.hypot(1,R.a)]:[q[0],q[2]*Math.hypot(1,R.b)]));}
   const triangles=this.kit.bins.shingles.pos.length/9-start;if(triangles)this.emitted.push({role:R.role,firstTriangle:start,triangles});
  }
 }
}
