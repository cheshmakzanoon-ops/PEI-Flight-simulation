import * as T from 'three';
type P=[number,number,number];
type UV=[number,number];
export type Plane=(u:number,y:number,d:number)=>P;
/** One indexed-as-input triangle stream per semantic part and material. */
export class Batch {
 data:number[]=[];uv:number[]=[];tones:number[]=[];
 readonly name:string;readonly mat:T.Material;
 constructor(name:string,mat:T.Material) { this.name=name;this.mat=mat; }
 triangle(a:P,b:P,c:P,expected:P,shade=1,coords:[UV,UV,UV]=[[0,0],[1,0],[1,1]]) {
  const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
  if(Math.hypot(nx,ny,nz)<1e-8)return;
  if(nx*expected[0]+ny*expected[1]+nz*expected[2]<0){
   [b,c]=[c,b];coords=[coords[0],coords[2],coords[1]];
  }
  this.data.push(...a,...b,...c);coords.forEach(q=>this.uv.push(...q));this.tones.push(shade,shade,shade,shade,shade,shade,shade,shade,shade);
 }
 quad(a:P,b:P,c:P,d:P,normal:P,shade=1,tex:[UV,UV,UV,UV]=[[0,0],[1,0],[1,1],[0,1]]) {
  this.triangle(a,b,c,normal,shade,[tex[0],tex[1],tex[2]]);this.triangle(a,c,d,normal,shade,[tex[0],tex[2],tex[3]]);
 }
 // A rectangular faced solid in a caller's wall plane, with its own reveal depth.
 // Size and offset must be positive. The same box intentionally renders under all incident angles.
 box(place:Plane,x0:number,x1:number,y0:number,y1:number,back:number,front:number,n:P,shade=1) {
  this.roundBox(place,x0,x1,y0,y1,back,front,n,shade,0);
 }
 roundBox(PP:Plane,x0:number,x1:number,y0:number,y1:number,back:number,front:number,n:P,shade=1,chamfer=.006) {
  const sx=x1-x0,sy=y1-y0,dz=front-back;if(sx<=0||sy<=0||dz<=0)throw Error('invalid detail dimensions '+this.name);
  const e=Math.min(chamfer,sx*.22,sy*.22,dz*.45),mk=(d:number,ext:number)=>{
   const x=x0+ext,X=x1-ext,y=y0+ext,Y=y1-ext;
   return [PP(x,y,d),PP(X,y,d),PP(X,Y,d),PP(x,Y,d)]as [P,P,P,P];
  };
  const [p,q,r,s]=mk(front,e),[A,B,C,D]=mk(front-e,0),[a,b,c,d]=mk(back,0);
  const u0=(x0+.071)*.29,u1=(x1+.071)*.29,v0=(y0+.11)*.44,v1=(y1+.11)*.44;
  this.quad(p,q,r,s,n,shade,[[u0,v0],[u1,v0],[u1,v1],[u0,v1]]);
  this.quad(a,b,c,d,[-n[0],-n[1],-n[2]],shade*.79);
  const axes=[PP(x0+1,y0,0),PP(x0,y0+1,0)],origin=PP(x0,y0,0);
  const u: P=axes[0].map((c,i)=>c-origin[i])as P,v:P=axes[1].map((c,i)=>c-origin[i])as P;
  const outward=[v.map(c=>-c)as P,u,v,u.map(c=>-c)as P];
  const F=[p,q,r,s],E=[A,B,C,D],G=[a,b,c,d];
  for(let i=0;i<4;i++){const j=(i+1)%4,k=outward[i];this.quad(G[i],G[j],E[j],E[i],k,shade*.90);
   if(e>0)this.quad(E[i],E[j],F[j],F[i],[k[0]+n[0],k[1]+n[1],k[2]+n[2]],shade*.96);}
 }
 attach(g:T.BufferGeometry,shade=1) {
  const src=g.index?g.toNonIndexed():g,pt=src.getAttribute('position'),uv=src.getAttribute('uv');
  for(let j=0;j<pt.count;j++){this.data.push(pt.getX(j),pt.getY(j),pt.getZ(j));this.uv.push(uv?.getX(j)??0,uv?.getY(j)??0);this.tones.push(shade,shade,shade);}
  if(src!==g)src.dispose();g.dispose();
 }
 emit(g:T.Group,shadow=true) {
  if(!this.data.length)throw Error('empty batch '+this.name);
  const m=new T.BufferGeometry();m.setAttribute('position',new T.Float32BufferAttribute(this.data,3));
  m.setAttribute('uv',new T.Float32BufferAttribute(this.uv,2));m.setAttribute('color',new T.Float32BufferAttribute(this.tones,3));
  m.computeVertexNormals();m.computeBoundingBox();m.computeBoundingSphere();
  const o=new T.Mesh(m,this.mat);o.name=this.name;o.castShadow=shadow;o.receiveShadow=true;g.add(o);return o;
 }
}
