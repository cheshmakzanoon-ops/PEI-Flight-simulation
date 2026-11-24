import * as T from 'three';
import {DATUM,type P} from './frame.ts';
export type XY=readonly [number,number];
const white:readonly [number,number,number]=[1,1,1];
export const vec=(p:P)=> new T.Vector3(p[0],p[1]-DATUM,-p[2]);
export const pvec=(v:T.Vector3):P=>[v.x,v.y+DATUM,-v.z];
export const p=(u:number,y:number,v:number):P=>[u,y,v];
export const mix=(a:P,b:P,t:number):P=>p(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t);
export class Batch{
  xyz:number[]=[]; nrm:number[]=[]; uv:number[]=[]; color:number[]=[]; index:number[]=[];
  poly(ps:P[],out?:P,uvs?:XY[],color:readonly number[]=white,holes:XY[][]=[],outline?:XY[],mapping?:(v:XY)=>P){
    if(ps.length<3) return;
    const pe=ps.map(vec);
    let normal:T.Vector3;
    if(out) normal=new T.Vector3(out[0],out[1],-out[2]).normalize();
    else normal=new T.Vector3().subVectors(pe[1],pe[0]).cross(new T.Vector3().subVectors(pe[2],pe[0])).normalize();
    if(normal.lengthSq()<.9) throw new Error('degenerate polygon');
    const tu=Math.abs(normal.y)>.78?(Math.abs(normal.x)<.8?new T.Vector3(1,0,0):new T.Vector3(0,0,1)) : new T.Vector3().crossVectors(new T.Vector3(0,1,0),normal).normalize();
    tu.addScaledVector(normal,-normal.dot(tu)).normalize();
    const tv=new T.Vector3().crossVectors(normal,tu).normalize();
    const defaultUV=pe.map((v):XY=>[v.dot(tu),v.dot(tv)]);
    const ring=outline??defaultUV;
    const asV=(i:XY)=>new T.Vector2(i[0],i[1]);
    let faces:number[][];
    if(!holes.length&&ps.length===3) faces=[[0,1,2]];
    else if(!holes.length&&ps.length===4) faces=[[0,1,2],[0,2,3]];
    else faces=T.ShapeUtils.triangulateShape(ring.map(asV),holes.map(h=>h.map(asV)));
    const allPositions=holes.length ? pe.concat(holes.flatMap(h=>h.map(v=>vec(mapping!(v))))) : pe;
    const allUV=holes.length ? (uvs??ring).concat(holes.flat()) : (uvs??defaultUV);
    const base=this.xyz.length/3;
    for(let i=0;i<allPositions.length;i++){
      const q=allPositions[i];this.xyz.push(q.x,q.y,q.z);this.nrm.push(normal.x,normal.y,normal.z);this.uv.push(...allUV[i]);this.color.push(color[0],color[1],color[2]);
    }
    for(const [a,b,c] of faces){
      const winding=new T.Vector3().subVectors(allPositions[b],allPositions[a]).cross(new T.Vector3().subVectors(allPositions[c],allPositions[a])).dot(normal);
      if(Math.abs(winding)<1e-11) continue;
      this.index.push(base+a,base+(winding>0?b:c),base+(winding>0?c:b));
    }
  }
  finish(){
    if(!this.index.length) return;
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(this.xyz,3));g.setAttribute('normal',new T.Float32BufferAttribute(this.nrm,3));g.setAttribute('uv',new T.Float32BufferAttribute(this.uv,2));g.setAttribute('color',new T.Float32BufferAttribute(this.color,3));g.setIndex(this.index);g.computeBoundingBox();g.computeBoundingSphere();return g;
  }
}
export function rect(a:number,b:number,c:number,d:number):XY[]{return [[a,c],[b,c],[b,d],[a,d]];}
export function cuboid(b:Batch,u0:number,u1:number,y0:number,y1:number,v0:number,v1:number,c=white){
  if(!(u1>u0&&v1>v0&&y1>y0)) throw Error('invalid box');
  const a=p(u0,y0,v0),h=p(u1,y0,v0),j=p(u1,y0,v1),k=p(u0,y0,v1), A=p(u0,y1,v0),H=p(u1,y1,v0),J=p(u1,y1,v1),K=p(u0,y1,v1);
  const normals:P[]=[[0,0,-1],[1,0,0],[0,0,1],[-1,0,0],[0,1,0],[0,-1,0]];
  [[a,h,H,A],[h,j,J,H],[j,k,K,J],[k,a,A,K],[A,H,J,K],[a,k,j,h]].forEach((f,i)=>b.poly(f,normals[i],undefined,c));
}
export function flat(b:Batch,ring:P[],normal:P,shade=white){
  b.poly(ring,normal,undefined,shade);
}
// Rectangular prism around a 3D axis, using caller-specified face normal to orient its width.
export function beam(b:Batch,A:P,B:P,w:number,t:number,face:P=[0,0,1],color=white){
  const aa=vec(A),bb=vec(B),axis=bb.clone().sub(aa);
  if(axis.lengthSq()<1e-8) return;
  axis.normalize();
  const n=vec([face[0],face[1]+DATUM,face[2]]).addScaledVector(axis,-vec([face[0],face[1]+DATUM,face[2]]).dot(axis)).normalize();
  if(n.lengthSq()<.9) throw Error('parallel beam axis');
  const lat=new T.Vector3().crossVectors(axis,n).normalize();
  const corners=(c:T.Vector3)=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([s,d])=>pvec(c.clone().addScaledVector(lat,s*w/2).addScaledVector(n,d*t/2)));
  const a=corners(aa),e=corners(bb);
  const out=(v:T.Vector3)=>p(v.x,v.y,-v.z);
  const sideNormals=[n.clone().negate(),lat,n,lat.clone().negate()];
  for(let i=0;i<4;i++) b.poly([a[i],a[(i+1)%4],e[(i+1)%4],e[i]],out(sideNormals[i]),undefined,color);
  b.poly(a,out(axis.clone().negate()),undefined,color);
  b.poly(e,out(axis),undefined,color);
}
export function prism(b:Batch,low:P[],high:P[],shade=white){
  b.poly(low,p(0,-1,0),undefined,shade); b.poly(high,p(0,1,0),undefined,shade);
  for(let i=0;i<low.length;i++){
    const j=(i+1)%low.length, dU=low[j][0]-low[i][0],dV=low[j][2]-low[i][2];
    const n=new T.Vector3().subVectors(vec(low[j]),vec(low[i])).cross(new T.Vector3().subVectors(vec(high[i]),vec(low[i]))).normalize();
    if(!dU&&!dV) continue;
    b.poly([low[i],low[j],high[j],high[i]],p(n.x,n.y,-n.z),undefined,shade);
  }
}
export function tube(b:Batch,u:number,v:number,y0:number,y1:number,r0:number,r1:number,sides:number,turn=0){
  const ring=(y:number,r:number)=>Array.from({length:sides},(_,i)=>p(u+Math.cos(turn+2*Math.PI*i/sides)*r,y,v+Math.sin(turn+2*Math.PI*i/sides)*r));
  prism(b,ring(y0,r0),ring(y1,r1));
}
