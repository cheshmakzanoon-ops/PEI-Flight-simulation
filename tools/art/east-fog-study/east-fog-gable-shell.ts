/** Declared geometry-only, detached two-gable envelope. No captured images, apertures,
 * terrain, contact/shadow, mount, loader, source fit, new trim, or palette choices. */
import * as T from 'three';
export type FogRole='low-tower-side'|'high-point-side';
export type FogBody=Readonly<{id:FogRole;box:readonly[u0:number,u1:number,v0:number,v1:number];
  ridgeU:number;ridgeY:number;pitch:number}>;
export type FogShell=Readonly<{body:readonly[FogBody,FogBody];planeBottom:number;originXZ:readonly[number,number];yaw:number}>;
type P=readonly[number,number,number];
type Side='roof'|'wall'|'floor';
type Patch={loop:P[];kind:Side;body:FogRole};
const E=1e-9;
const ensure=(value:unknown,reason:string)=>{if(!value)throw Error(reason);};
const fin=(x:number)=>Number.isFinite(x);
const qkey=(p:P)=>p.map(v=>Math.fround(v).toFixed(10)).join('/');
const add=(a:P,b:P,t:number):P=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const pEq=(a:P,b:P)=>a.every((v,i)=>Math.abs(v-b[i])<E);
const ny=(a:P,b:P,c:P)=>new T.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]).cross(new T.Vector3(c[0]-a[0],c[1]-a[1],c[2]-a[2]));
const yAt=(b:FogBody,u:number)=>b.ridgeY-b.pitch*Math.abs(u-b.ridgeU);
function verify(plan:FogShell){
 const [L,H]=plan.body,base=plan.planeBottom;
 ensure(L.id==='low-tower-side'&&H.id==='high-point-side'&&L.box[3]===H.box[2]&&H.ridgeY-L.ridgeY>.7,'unqualified role order, seam or crest');
 ensure(fin(base)&&plan.originXZ.every(fin)&&fin(plan.yaw),'nonfinite position');
 for(const b of plan.body){
  const [u0,u1,v0,v1]=b.box;
  ensure([...b.box,b.ridgeU,b.ridgeY,b.pitch].every(fin)&&u1-u0>=2.5&&u1-u0<=12&&v1-v0>=2&&v1-v0<=22&&
    u0+.25<=b.ridgeU&&b.ridgeU<=u1-.25&&.18<=b.pitch&&b.pitch<=1.3,'invalid or unsupported body envelope');
  ensure(Math.min(yAt(b,u0),yAt(b,u1))-base>.8,'eave intersects base');
 }
 ensure(Math.min(L.box[1],H.box[1])-Math.max(L.box[0],H.box[0])>1.0,'bodies do not have a connected plan seam');
}
function allCuts(L:FogBody,H:FogBody){
 const nodes=[...new Set([L.box[0],L.ridgeU,L.box[1],H.box[0],H.ridgeU,H.box[1]])].sort((a,b)=>a-b);
 const cross=[];
 for(let k=0;k+1<nodes.length;k++){
  const a=nodes[k],b=nodes[k+1],m=(a+b)/2;
  if(!present(L,m)||!present(H,m))continue;
  const x=yAt(L,a)-yAt(H,a),y=yAt(L,b)-yAt(H,b);
  if(x*y<0&&Math.min(Math.abs(x),Math.abs(y))>E)cross.push(a+(b-a)*x/(x-y));
 }
 return [...nodes,...cross].sort((a,b)=>a-b);
}
const present=(g:FogBody,u:number)=>g.box[0]<=u&&u<=g.box[1];
function pclean(a:P[]){
 const out:P[]=[];
 for(const p of a)if(!out.length||!pEq(p,out[out.length-1]))out.push(p);
 if(out.length>1&&pEq(out[0],out[out.length-1]))out.pop();
 return out;
}
export function makeFogGableShell(plan:FogShell){
 verify(plan);
 const [L,H]=plan.body,base=plan.planeBottom,seam=L.box[3],cuts=allCuts(L,H),raw:Patch[]=[];
 const face=(loop:P[],kind:Side,body:FogRole)=>{
  loop=pclean(loop);
  if(loop.length>=3)raw.push({loop,kind,body});
 };
 function end(lo:number,hi:number,z:number,yb:readonly[number,number],yt:readonly[number,number],side:-1|1,b:FogBody){
  const a:P[]=[[lo,yb[0],z],[lo,yt[0],z],[hi,yt[1],z],[hi,yb[1],z]];
  face(side===-1?a:a.reverse(),'wall',b.id);
 }
 const payload:{u:[number,number],toward:-1|1,body:FogRole}[]=[];
 for(let k=0;k+1<cuts.length;k++){
  const a=cuts[k],b=cuts[k+1],m=(a+b)/2;
  for(const g of plan.body){
   if(!present(g,m))continue;
   const [,,v0,v1]=g.box;
   const A=yAt(g,a),B=yAt(g,b);
   face([[a,A,v0],[a,A,v1],[b,B,v1],[b,B,v0]],'roof',g.id);
   face([[a,base,v0],[b,base,v0],[b,base,v1],[a,base,v1]],'floor',g.id);
   if(g===L)end(a,b,v0,[base,base],[A,B],-1,g);else end(a,b,v1,[base,base],[A,B],1,g);
  }
  const f=present(L,m),g=present(H,m);
  if(!f&&!g)continue;
  if(f&&g){
   const o=yAt(H,m)-yAt(L,m);
   if(Math.abs(o)<=E)continue;
   const [top,sub,dir]=o>0?[H,L,-1 as const]:[L,H,1 as const];
   const T0=yAt(top,a),T1=yAt(top,b),S0=Math.min(T0,yAt(sub,a)),S1=Math.min(T1,yAt(sub,b));
   end(a,b,seam,[S0,S1],[T0,T1],dir,top);payload.push({u:[a,b],toward:dir,body:top.id});
  }else{
   const top=f?L:H,d=f?1:-1;
   end(a,b,seam,[base,base],[yAt(top,a),yAt(top,b)],d,top);
   payload.push({u:[a,b],toward:d,body:top.id});
  }
 }
 for(const g of plan.body){
  const [u0,u1,v0,v1]=g.box;
  for(const d of [-1,1]){
   const u=d<0?u0:u1,yt=yAt(g,u);
   const a:P[]=[[u,base,v0],[u,base,v1],[u,yt,v1],[u,yt,v0]];
   face(d<0?a:a.reverse(),'wall',g.id);
  }
 }
 // Vertical step/eave coincident edges get every shared point before the
 // centroid fan. No T-junctions at width steps, equal-height seams, or crossings.
 const seeds=raw.flatMap(f=>f.loop);
 const colors={roof:new T.Color(0x91392f),wall:new T.Color(0xd0ccc0),floor:new T.Color(0x887e71)};
 const ang=plan.yaw,{sin,cos}=Math,s=sin(ang),c=cos(ang),[x0,z0]=plan.originXZ;
 const world=(p:P):P=>[x0+c*p[0]+s*p[2],p[1],z0-s*p[0]+c*p[2]];
 const pos:number[]=[],norm:number[]=[],rgb:number[]=[],clad:number[]=[];
 const ids:{kind:Side;body:FogRole;first:number;end:number}[]=[];
 for(const f of raw){
  const points:P[]=[];
  for(let k=0;k<f.loop.length;k++){
   const a=f.loop[k],b=f.loop[(k+1)%f.loop.length];
   const ex=b[0]-a[0],ey=b[1]-a[1],ez=b[2]-a[2],len=ex*ex+ey*ey+ez*ez;
   if(len<E*E)continue;
   const on=[{t:0,p:a}];
   for(const p of seeds){
    const t=((p[0]-a[0])*ex+(p[1]-a[1])*ey+(p[2]-a[2])*ez)/len;
    if(t>E&&t<1-E&&pEq(p,add(a,b,t)))on.push({t,p});
   }
   on.sort((a,b)=>a.t-b.t);
   for(const v of on)if(!points.length||!pEq(points[points.length-1],v.p))points.push(v.p);
  }
  const center=points.reduce((a,p)=>[a[0]+p[0]/points.length,a[1]+p[1]/points.length,a[2]+p[2]/points.length] as P,[0,0,0]as P);
  const st=pos.length/3,first=world(center),col=colors[f.kind];
  for(let k=0;k<points.length;k++){
   const a=world(points[k]),b=world(points[(k+1)%points.length]),n=ny(first,a,b);
   ensure(n.length()>1e-10,'degenerate envelope exterior');
   n.normalize();
   for(const p of [first,a,b]){
    pos.push(...p);norm.push(n.x,n.y,n.z);rgb.push(col.r,col.g,col.b);clad.push(f.kind==='wall'?1:0);
   }
  }
  ids.push({kind:f.kind,body:f.body,first:st,end:pos.length/3});
 }
 const p=new Float32Array(pos),N=new Float32Array(norm);
 const edge=new Map<string,[number,number]>();let volume=0;
 const vec=(i:number):P=>[p[i],p[i+1],p[i+2]];
 for(let i=0;i<p.length;i+=9){
  const A=vec(i),B=vec(i+3),C=vec(i+6);
  ensure(ny(A,B,C).length()>1e-9,'F32 degenerate');
  for(const [a,b] of [[A,B],[B,C],[C,A]] as [P,P][]){
   const u=qkey(a),v=qkey(b),k=u<v?u+' '+v:v+' '+u;
   const [n,d]=edge.get(k)??[0,0];edge.set(k,[n+1,d+(u<v?1:-1)]);
  }
  volume+=(A[0]*(B[1]*C[2]-B[2]*C[1])+A[1]*(B[2]*C[0]-B[0]*C[2])+A[2]*(B[0]*C[1]-B[1]*C[0]))/6;
 }
 ensure(volume>0&&[...edge.values()].every(([n,s])=>n===2&&s===0),'F32 envelope not a single closed oriented surface');
 const geo=new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(p,3)).setAttribute('normal',new T.BufferAttribute(N,3))
  .setAttribute('color',new T.Float32BufferAttribute(rgb,3)).setAttribute('clad',new T.Float32BufferAttribute(clad,1));
 geo.computeBoundingBox();geo.computeBoundingSphere();
 const geometryReport={triangles:p.length/9,volume,orientationCertifiedEdgeCount:edge.size,base:plan.planeBottom,join:seam,
   certifiedSectors:payload,bodyRectangles:plan.body,positionsLocal:'station-visible model-relative XYZ in meters'};
 return {geo,roles:ids,geometryReport};
}
/** Detached, no owner mount. A caller must separately authenticate original whole
 * stream digests, geometry/LOD/material identities and station transform. */
export function exchangeOnlyFog(stock:T.BufferGeometry,body:T.BufferGeometry,detail:boolean){
 const keep=detail?5055:1440,horns=detail?[8331,8727]:null,expected=detail?8727:1836;
 ensure(stock.index===null&&body.index===null&&stock.attributes.position.count===expected&&
  stock.groups.length===0&&stock.drawRange.start===0&&stock.drawRange.count===Infinity,'unexpected original station/LOD');
 const g=new T.BufferGeometry();
 for(const [k,size]of [['position',3],['normal',3],['color',3],['clad',1]]as const){
  const a=stock.attributes[k],b=body.attributes[k];
  ensure(a?.itemSize===size&&b?.itemSize===size&&a.array instanceof Float32Array&&b.array instanceof Float32Array,'unexpected attribute');
  const sep=(horns?horns[1]-horns[0]:0)*size;
  const output=new Float32Array(keep*size+b.array.length+sep);
  output.set(a.array.subarray(0,keep*size));output.set(b.array,keep*size);
  if(horns)output.set(a.array.subarray(horns[0]*size,horns[1]*size),keep*size+b.array.length);
  g.setAttribute(k,new T.BufferAttribute(output,size));
 }
 g.computeBoundingBox();g.computeBoundingSphere();
 return g;
}
