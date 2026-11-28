/** Detached closed roof/rim section in the signed owner's old local coordinates.
 * Original lower ring remains open (to keep its old terrain seat). */
import { ShapeUtils, Vector2 } from 'three';
import type { GroundPoint, RoofRidge, Triangle } from '../../../../src/sim/roof-ridge.ts';
import { ridgeOffset, roofHeight, splitRoofEdge, splitRoofTriangle } from '../../../../src/sim/roof-ridge.ts';
import { project } from '../../../../src/sim/geo.ts';
type XYZ=readonly [number,number,number];
type Weight=readonly [number,number,number];
type V={p:XYZ;w:Weight;r?:boolean};
type Actual={position:Float32Array;top:Float32Array;fit:Int16Array};
type Roof={
 sourceOrdinal:number, sourceOuterRingWGS84:readonly (readonly [number,number])[],
 projectionLocal:{anchorLonLat:readonly [number,number];unitAcrossXZ:readonly [number,number];
  ridgeOriginLocalXZ:readonly [number,number];slopePerLocalMetre:number;peakMOrtho:number},
};
const faces={48:[990,1006,1012],49:[1012,1024,1028]} as const;
const owner=[89807.85854948164,0,4457.559458530726] as const;
const f=Math.fround;
const sameXZ=(a:XYZ,b:XYZ)=>a[0]===b[0]&&a[2]===b[2];
const vertex=(p:XYZ):XYZ=>[f(p[0]),f(p[1]),f(p[2])];
const key=(p:XYZ)=>p.join(',');
const det=(a:GroundPoint,b:GroundPoint,c:GroundPoint)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
const verify:(ok:unknown,m:string)=>asserts ok=(ok,m)=>{if(!ok)throw Error(m);};
function area(p:XYZ,q:XYZ,r:XYZ){
 const [a,b,c]=q.map((u,i)=>u-p[i]),[x,y,z]=r.map((u,i)=>u-p[i]);
 return .5*Math.hypot(b*z-c*y,c*x-a*z,a*y-b*x);
}
const at=(a:Actual,i:number):XYZ=>[a.position[3*i],a.position[3*i+1],a.position[3*i+2]];
function clip(poly:V[],d:(v:V)=>number,rim:boolean){
 const next:V[]=[];
 if(!poly.length)return next;
 for(let j=0;j<poly.length;j++){
  const a=poly[j],b=poly[(j+1)%poly.length],x=d(a),y=d(b);
  if(x>=-1e-8)next.push(Math.abs(x)<=1e-8&&rim?{...a,r:true}:a);
  if(x>1e-8&&y< -1e-8||x< -1e-8&&y>1e-8){
   const t=x/(x-y),mix=<A extends readonly number[]>(a:A,b:A)=>a.map((n,k)=>n+t*(b[k]-n)) as unknown as A;
   next.push({p:mix(a.p,b.p),w:mix(a.w,b.w),r:rim});
  }
 }
 return next;
}
export function planEastRim(q:Roof,a:Actual){
 const row=q.sourceOrdinal as keyof typeof faces,role=faces[row];
 verify(role&&a.position.length===11988*3&&a.top.length===11988&&a.fit.length===11988*3,'unrecognized old face ranges');
 const [first,cap,end]=role;
 const oldTop=at(a,3*cap)[1];
 for(let i=3*first;i<3*cap;i++)verify(a.top[i]===0,'unexpected old wall tag');
 for(let i=3*cap;i<3*end;i++)verify(a.top[i]===1&&at(a,i)[1]===oldTop,'stock cap was not a flat regular plane');
 const fitted=q.projectionLocal,cent=project(...fitted.anchorLonLat);
 const ridge:RoofRidge={origin:{x:cent.x-owner[0]+fitted.ridgeOriginLocalXZ[0],z:cent.z-owner[2]+fitted.ridgeOriginLocalXZ[1]},
  peakM:fitted.peakMOrtho,normal:{x:fitted.unitAcrossXZ[0],z:fitted.unitAcrossXZ[1]},
  leftSlope:fitted.slopePerLocalMetre,rightSlope:fitted.slopePerLocalMetre};
 verify(oldTop>ridge.peakM&&oldTop-ridge.peakM<.05,'unexpected original measured-height relationship');
 const stockRing=Array.from({length:3*(end-cap)},(_,i)=>at(a,3*cap+i));
 const ring=q.sourceOuterRingWGS84.map(w=>{
  const p=project(...w),x=p.x-owner[0],z=p.z-owner[2];
  const nearest=stockRing.reduce((win,n)=>Math.hypot(n[0]-x,n[2]-z)<Math.hypot(win[0]-x,win[2]-z)?n:win);
  verify(Math.hypot(nearest[0]-x,nearest[2]-z)<.001,'signed footprint differs from original F32 roof plan');
  return {x:nearest[0],z:nearest[2]};
 });
 verify(new Set(ring.map(u=>u.x+'/'+u.z)).size===ring.length,'ambiguous snapped outline');
 // Only known shared boundary points may be snapped to a roof edge.
 const edges=ring.map((a,i)=>({i,a,b:ring[(i+1)%ring.length],rim:new Map<number,XYZ>()}));
 function edgeParam(edge:typeof edges[number],p:GroundPoint){
  const {a,b}=edge,x=b.x-a.x,z=b.z-a.z,l=x*x+z*z;
  const t=((p.x-a.x)*x+(p.z-a.z)*z)/l;
  const gap=Math.hypot(p.x-a.x-x*t,p.z-a.z-z*t);
  return {t,gap};
 }
 const worldRoof=(p:GroundPoint)=>vertex([p.x,roofHeight(p,ridge),p.z]);
 function rimPoint(e:typeof edges[number],t:number){
  const {a,b}=e,j=Math.max(0,Math.min(1,t)),ix=Math.round(j*1e9);
  const have=e.rim.get(ix);if(have)return have;
  const p={x:a.x+(b.x-a.x)*j,z:a.z+(b.z-a.z)*j};
  const v=worldRoof(p);e.rim.set(ix,v);return v;
 }
 for(const e of edges){
  rimPoint(e,0);rimPoint(e,1);
  for(const v of splitRoofEdge(e.a,e.b,ridge).slice(1,-1)){
   const at=edgeParam(e,v);verify(at.gap<.000001,'crease does not reach outline');
   rimPoint(e,at.t);
  }
 }
 const through=(p:XYZ)=>({x:p[0],z:p[2]});
 const roofAt=(p:XYZ)=>roofHeight(through(p),ridge);
 const walls:{oldTriangle:number;positions:XYZ[];weights:Weight[]}[]=[];
 for(let tri=first;tri<cap;tri++){
  const p=[at(a,3*tri),at(a,3*tri+1),at(a,3*tri+2)];
  const ed=edges.filter(e=>p.every(x=>edgeParam(e,through(x)).gap<.000006));
  verify(ed.length===1,'wall triangle is not a unique original outline plane');
  const e=ed[0],v:V[]=p.map((p,j)=>({p,w:[+(j===0),+(j===1),+(j===2)]}));
  const insets=p.map(x=>roofAt(x)-x[1]);
  verify(insets.some(x=>x>0)&&insets.some(x=>x<0),'roof cut must not discard the original wall root');
  for(const sign of [-1,1]){
   const lane=clip(v,x=>sign*ridgeOffset(through(x.p),ridge),false);
   const part=clip(lane,x=>roofAt(x.p)-x.p[1],true);
   if(part.length<3)continue;
   const projected=part.map(v=>{
    if(!v.r)return vertex(v.p);
    const at=edgeParam(e,through(v.p));verify(at.gap<.000007,'exact eave left its signed wall edge');
    return rimPoint(e,at.t);
   });
   for(let j=1;j<projected.length-1;j++){
    const P=[projected[0],projected[j],projected[j+1]],W=[part[0].w,part[j].w,part[j+1].w];
    if(area(P[0],P[1],P[2])<1e-7)continue;
    walls.push({oldTriangle:tri,positions:P,weights:W});
   }
  }
 }
 const triangulated=ShapeUtils.triangulateShape(ring.map(v=>new Vector2(v.x,-v.z)),[]);
 const roof:XYZ[][]=[];
 function pointsOnBorder(a:GroundPoint,b:GroundPoint){
  const matches=edges.filter(e=>[a,b].every(v=>edgeParam(e,v).gap<.000002));
  if(matches.length!==1)return [worldRoof(a)];
  const e=matches[0],ta=edgeParam(e,a).t,tb=edgeParam(e,b).t;
  return [rimPoint(e,ta),...[...e.rim].filter(([q])=>q*1e-9>Math.min(ta,tb)+1e-8&&q*1e-9<Math.max(ta,tb)-1e-8)
   .sort(([u],[v])=>(ta<tb?1:-1)*(u-v)).map(([,p])=>p)];
 }
 for(const tri of triangulated)for(const t of splitRoofTriangle(tri.map(i=>ring[i]) as Triangle,ridge)){
  const uv=det(...t)<0?t:[t[0],t[2],t[1]] as Triangle;
  const boundary=uv.flatMap((p,i)=>pointsOnBorder(p,uv[(i+1)%3]));
  if(boundary.length===3){roof.push(boundary);continue;}
  const x=(uv[0].x+uv[1].x+uv[2].x)/3,z=(uv[0].z+uv[1].z+uv[2].z)/3,c=worldRoof({x,z});
  for(let j=0;j<boundary.length;j++){
   const p=boundary[j],q=boundary[(j+1)%boundary.length];
   verify(!sameXZ(p,q)&&area(c,p,q)>1e-7,'roof rim subdivision degenerated');roof.push([c,p,q]);
  }
 }
 const closure=new Map<string,{balance:number;count:number;a:XYZ;b:XYZ}>();
 const use=(p:XYZ,q:XYZ)=>{
  const A=key(p),B=key(q),id=A<B?A+'/'+B:B+'/'+A,old=closure.get(id);
  closure.set(id,{count:(old?.count??0)+1,balance:(old?.balance??0)+(A<B?1:-1),a:p,b:q});
 };
 // Azimuth ordering of some stock DoubleSide wall triangles differs by edge;
 // positional conformity uses incidence not an assumed old face winding.
 for(const q of [...roof,...walls.map(v=>v.positions)])for(let j=0;j<3;j++)use(q[j],q[(j+1)%3]);
 const sealedEdges=[...closure.values()].filter(v=>v.count===1&&
  Math.abs(v.a[1]-roofAt(v.a))<.000004&&Math.abs(v.b[1]-roofAt(v.b))<.000004);
 verify(!sealedEdges.length,'a measured roof-to-wall seam is still open');
 const root=ring.map(p=>{
  const same=Array.from({length:3*(cap-first)},(_,i)=>at(a,3*first+i))
   .filter(v=>v[0]===p.x&&v[2]===p.z);
  verify(same.length>0,'old lower vertex not available');
  return vertex([p.x,Math.min(...same.map(v=>v[1])),p.z]);
 });
 const onOldBottom=(p:XYZ,q:XYZ)=>root.some((a,i)=>{
  const b=root[(i+1)%root.length],w=b.map((v,i)=>v-a[i]),m=w.reduce((s,v)=>s+v*v,0);
  return [p,q].every(c=>{
   const t=w.reduce((n,v,i)=>n+v*(c[i]-a[i]),0)/m;
   return t>=-1e-6&&t<=1+1e-6&&Math.hypot(...c.map((v,i)=>v-a[i]-t*w[i]))<.0004;
  });
 });
 const boundary=[...closure.values()].filter(u=>u.count===1);
 verify(boundary.length>0&&boundary.every(({a,b})=>onOldBottom(a,b)),
  'replacement exposes a boundary outside the original bottom ring: '+JSON.stringify(boundary.filter(({a,b})=>!onOldBottom(a,b)).slice(0,4)));
 verify([...closure.values()].every(v=>v.count<=2),'replacement has an overlapping nonmanifold edge');

 return {sourceOrdinal:row,originalVertices:[3*first,3*end],originalRoofVertices:[3*cap,3*end],
  originalFlatY:oldTop,fitRoofY:ridge.peakM,roof,walls,closedTop:true,unmatchedBottomSegments:boundary.length,sourceRing:edges.map(e=>[...e.rim.values()]),unparented:true};
}
