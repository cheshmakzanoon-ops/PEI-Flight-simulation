import * as T from 'three';
import { DATUM,type Pt,type UV } from './survey.ts';
type RGB=readonly [number,number,number];
const WHITE:RGB=[1,1,1];
export const point=(u:number,h:number,v:number):Pt=>[u,h,v];
export const toVec=(p:Pt)=>new T.Vector3(p[0],p[1]-DATUM,-p[2]);
const writeNormal=(v:T.Vector3):Pt=>[v.x,v.y,-v.z];
const norm=(p:Pt)=>new T.Vector3(p[0],p[1],-p[2]).normalize();
const toV2=(p:UV)=>new T.Vector2(p[0],p[1]);
export function rect(l:number,r:number,b:number,t:number):UV[]{return [[l,b],[r,b],[r,t],[l,t]]}
export class Batch{
  private xyz:number[]=[]; private nrm:number[]=[]; private tex:number[]=[];
  private col:number[]=[]; private ix:number[]=[];
  /**
   * Explicit front-facing windings. Local metric face coordinates also become UV meters;
   * well-defined planar hole inputs are needed only by the window/ribbon system.
   */
  poly(outline:Pt[],out?:Pt,opt?:{uv?:UV[],xy?:UV[],holes?:UV[][],map?:(uv:UV)=>Pt,tone?:RGB}){
    if(outline.length<3)return;
    const pol=outline.map(toVec);
    let n:T.Vector3;
    if(out)n=norm(out);
    else {
      const o=new T.Vector3();
      for(let i=1;i+1<pol.length;i++)o.add(pol[i].clone().sub(pol[0]).cross(pol[i+1].clone().sub(pol[0])));
      n=o.normalize();
    }
    if(n.lengthSq()<.5)throw Error('degenerate geometry face');
    const tangent=(Math.abs(n.y)>.75?new T.Vector3(1,0,0):new T.Vector3(0,1,0).cross(n))
      .addScaledVector(n,Math.abs(n.y)>.75?-n.x:0).normalize();
    const bitangent=n.clone().cross(tangent).normalize();
    const uv0=pol.map((v):UV=>[v.dot(tangent),v.dot(bitangent)]);
    const holes=opt?.holes??[],xy=opt?.xy??uv0;
    const ixs=(holes.length||pol.length>4)?T.ShapeUtils.triangulateShape(xy.map(toV2),holes.map(h=>h.map(toV2))):
      pol.length===3?[[0,1,2]]:[[0,1,2],[0,2,3]];
    const vertices=holes.length?pol.concat(holes.flatMap(h=>h.map(q=>toVec(opt!.map!(q))))):pol;
    const uv=(opt?.uv??xy).concat(holes.flat()),base=this.xyz.length/3;
    for(let i=0;i<vertices.length;i++){
      const d=vertices[i];this.xyz.push(d.x,d.y,d.z);this.nrm.push(n.x,n.y,n.z);
      this.tex.push(...uv[i]);this.col.push(...(opt?.tone??WHITE));
    }
    for(const [a,b,c] of ixs){
      const w=vertices[b].clone().sub(vertices[a]).cross(vertices[c].clone().sub(vertices[a])).dot(n);
      if(Math.abs(w)<1e-11)continue;
      this.ix.push(base+a,base+(w>=0?b:c),base+(w>=0?c:b));
    }
  }
  geometry(){
    if(!this.ix.length)return;
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(this.xyz,3));
    g.setAttribute('normal',new T.Float32BufferAttribute(this.nrm,3));
    g.setAttribute('uv',new T.Float32BufferAttribute(this.tex,2));
    g.setAttribute('color',new T.Float32BufferAttribute(this.col,3));
    g.setIndex(this.ix);g.computeBoundingBox();g.computeBoundingSphere();
    return g;
  }
}
export class Face {
  readonly axis:'u'|'v'; readonly fixed:number; readonly sign:1|-1;
  constructor(axis:'u'|'v',fixed:number,sign:1|-1){this.axis=axis;this.fixed=fixed;this.sign=sign;}
  get out():Pt{return this.axis==='u'?[0,0,this.sign]:[this.sign,0,0]}
  at(s:number,y:number,depth=0):Pt{
    const n=this.fixed+this.sign*depth;
    return this.axis==='u'?[s,y,n]:[n,y,s];
  }
  draw(b:Batch,shape:UV[],offset=0,holes:UV[][]=[],tone:RGB=WHITE){
    b.poly(shape.map(q=>this.at(...q,offset)),this.out,{xy:shape,uv:shape,holes,map:q=>this.at(...q,offset),tone});
  }
  extrude(b:Batch,shape:UV[],front:number,back:number,tone:RGB=WHITE){
    this.draw(b,shape,front,[],tone);
    for(let i=0;i<shape.length;i++){
      const j=(i+1)%shape.length;
      const a=this.at(...shape[i],front),r=this.at(...shape[j],front),c=this.at(...shape[j],back),d=this.at(...shape[i],back);
      const sg=(this.axis==='u'?this.sign:-this.sign);
      b.poly(sg>0?[a,r,c,d]:[r,a,d,c],undefined,{tone});
    }
  }
}
/** Closed box. Metric UV mapping and outward normals are preserved in exported buffers. */
export function box(b:Batch,u0:number,u1:number,h0:number,h1:number,v0:number,v1:number,tone:RGB=WHITE){
  if(u0>=u1||v0>=v1||h0>=h1)throw Error('invalid box');
  const a=point(u0,h0,v0),c=point(u1,h0,v0),d=point(u1,h0,v1),e=point(u0,h0,v1);
  const A=point(u0,h1,v0),C=point(u1,h1,v0),D=point(u1,h1,v1),E=point(u0,h1,v1);
  const n:Pt[]=[[0,0,-1],[1,0,0],[0,0,1],[-1,0,0],[0,1,0],[0,-1,0]];
  [[a,c,C,A],[c,d,D,C],[d,e,E,D],[e,a,A,E],[A,C,D,E],[e,d,c,a]].forEach((f,i)=>b.poly(f,n[i],{tone}));
}
export function strips(b:Batch,f:Face,min:number,max:number,y0:number,y1:number,prj:number,except:readonly UV[]=[]){
  const q=except.slice().sort((a,b)=>a[0]-b[0]);let x=min;
  for(const [a,z] of q){
    if(a>x)f.extrude(b,rect(x,Math.min(a,max),y0,y1),prj,0);
    x=Math.max(x,z);
  }
  if(x<max)f.extrude(b,rect(x,max,y0,y1),prj,0);
}
export function spoke(b:Batch,f:Face,a:UV,r:UV,wide:number,front:number,back:number){
  const dx=r[0]-a[0],dy=r[1]-a[1],d=Math.hypot(dx,dy);
  const x=-dy*wide/(2*d),y=dx*wide/(2*d);
  f.extrude(b,[[a[0]-x,a[1]-y],[r[0]-x,r[1]-y],[r[0]+x,r[1]+y],[a[0]+x,a[1]+y]],front,back);
}
export function radialBand(b:Batch,v:PyramidRing,w:PyramidRing,tone:RGB=WHITE){
  if(v.points.length!==w.points.length)throw Error('ring mismatch');
  for(let i=0;i<v.points.length;i++){
    const j=(i+1)%v.points.length;
    const cv=toVec(v.points[i]).add(toVec(v.points[j])).multiplyScalar(.5);
    const n=cv.sub(new T.Vector3(v.center[0],cv.y,-v.center[1]));
    const outward=writeNormal(n.normalize());
    b.poly([v.points[i],v.points[j],w.points[j],w.points[i]],outward,{tone});
  }
}
export type PyramidRing={points:Pt[],center:UV};
export function ring(cx:number,cy:number,y:number,r:number,sides:number,theta:number):PyramidRing{
  return {points:Array.from({length:sides},(_,i):Pt=>[cx+r*Math.cos(theta+Math.PI*2*i/sides),y,cy+r*Math.sin(theta+Math.PI*2*i/sides)]),center:[cx,cy]};
}
/** Curved voussoir rims are independent of the wall's triangle tessellation. */
export const archPath=(c:number,s:number,h:number,k:number,n:number):UV[]=>Array.from({length:n+1},(_,i):UV=>{
  const a=Math.PI*(1-i/n);return [c+Math.cos(a)*h,s+Math.sin(a)*k];
});
/** Per-facet physical normals, deliberately not a flat +Y shading approximation. */
export function roofFacet(b:Batch,poly:Pt[]){
 if(poly.length<3)return;
 const g=toVec(poly[0]);
 for(let i=1;i+1<poly.length;i++){
  const v=toVec(poly[i]).sub(g).cross(toVec(poly[i+1]).sub(g));
  if(v.lengthSq()<1e-11)continue;
  if(v.y<0)v.negate();
  b.poly([poly[0],poly[i],poly[i+1]],writeNormal(v.normalize()));
 }
}
