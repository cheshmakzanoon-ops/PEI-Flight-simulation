/** Private prototype: replace only complete admitted original near cells;
 * never retriangulate any outside face (including the stationary collar).
 * Squares share one canonical vertex lattice; outside edges retain the two
 * original vertex IDs, hence exact old UV/position interpolation and no
 * T-junction. No material, scene, contact, props or projection mutations.
 */
import * as T from 'three';
const N=112,B=N+1;
type XY=readonly [number,number];
type Tri=readonly [XY,XY,XY];
type Height=(u:number,v:number)=>number|undefined;
const area=(a:XY,b:XY,d:XY)=>(b[0]-a[0])*(d[1]-a[1])-(b[1]-a[1])*(d[0]-a[0]);
const same=(a:XY,b:XY)=>a[0]===b[0]&&a[1]===b[1];
const isBetween=(p:XY,a:XY,b:XY)=>!same(p,a)&&!same(p,b)&&
 p[0]>=Math.min(a[0],b[0])&&p[0]<=Math.max(a[0],b[0])&&p[1]>=Math.min(a[1],b[1])&&p[1]<=Math.max(a[1],b[1]);
function fill(old:Tri,points:readonly XY[]):Tri[]{
 let tris:Tri[]=[old];
 for(const p of points){
  if(old.some(a=>same(p,a)))continue;
  let next:Tri[]=[],done=false;
  for(const t of tris){
   const e=t.map((a,i)=>area(a,t[(i+1)%3],p));
   if(e.some(x=>x>0)){next.push(t);continue;}
   if(e.every(x=>x<0)){const [a,b,c]=t;next.push([a,b,p],[b,c,p],[c,a,p]);done=true;continue;}
   const k=e.findIndex((x,i)=>x===0&&isBetween(p,t[i],t[(i+1)%3]));
   if(k<0)throw Error('Duplicate or uncovered lattice point');
   const a=t[k],b=t[(k+1)%3],c=t[(k+2)%3];
   next.push([a,p,c],[p,b,c]);done=true;
  }
  if(!done)throw Error('Private triangulation lost a supported point');
  tris=next;
 }
 // Improve shapes by integer Delaunay flips on strictly convex inner edges.
 // Keep the candidate on its original parent triangle; no flip can move
 // a parent-boundary edge or its original interpolation direction.
 const id=(p:XY)=>p.join(':');
 const key=(p:XY,r:XY)=>[id(p),id(r)].sort().join('|');
 const incircle=(a:XY,b:XY,c:XY,d:XY)=>{
  const [[x,y],[u,v],[k,l]]=[a,b,c].map(p=>[p[0]-d[0],p[1]-d[1]]);
  return (x*x+y*y)*(u*l-v*k)-(u*u+v*v)*(x*l-y*k)+(k*k+l*l)*(x*v-y*u);
 };
 let stop=false;
 for(let iter=0;iter<200&&!stop;iter++){
  const edges=new Map<string,{j:number,a:XY,b:XY,c:XY}>();stop=true;
  scan: for(let j=0;j<tris.length;j++)for(let i=0;i<3;i++){
   const a=tris[j][i],b=tris[j][(i+1)%3],c=tris[j][(i+2)%3],k=key(a,b),e=edges.get(k);
   if(e){
    const d=e.c;const n=area(c,d,b),m=area(d,c,a);
    if(n>=0||m>=0||incircle(a,b,c,d)>=0)continue;
    tris[j]=[c,d,b];tris[e.j]=[d,c,a];stop=false;break scan;
   }else edges.set(k,{j,a,b,c});
  }
  if(iter===199&&!stop)throw Error('Private triangulation did not converge');
 }
 if(tris.some(([a,b,c])=>area(a,b,c)>=0)||
    tris.reduce((s,[a,b,c])=>s+area(a,b,c),0)!==area(...old))throw Error('Private triangulation area/winding mismatch');
 return tris;
}
function stockOrni(g:T.BufferGeometry){
 const keys=Object.keys(g.attributes).sort();
 if(keys.join(',')!=='normal,position,uv'||g.groups.length!==0||g.drawRange.start!==0||g.drawRange.count!==Infinity||
   !g.index||!(g.index.array instanceof Uint16Array)||g.index.count!==N*N*6)return false;
 const a=['position','normal','uv'] as const;
 return a.every((k,j)=>{
  const d=g.getAttribute(k);
  return d instanceof T.BufferAttribute&&!d.normalized&&d.count===B*B&&
   d.array instanceof Float32Array&&d.itemSize===[3,3,2][j];
 });
}
export function stageIntactTerrainCells(stock:T.BufferGeometry, cells:readonly XY[], sub:number, bare:Height){
 if(!stockOrni(stock)||!Number.isInteger(sub)||sub<2||sub>8||!cells.length||cells.length>64)
  throw Error('Unexpected exact regular parent or private scope cap');
 const has=(i:number,j:number)=>allowed.has(j*N+i)&&i>=2&&i<N-2&&j>=2&&j<N-2;
 const allowed=new Set(cells.map(([i,j])=>j*N+i));
 if(allowed.size!==cells.length||cells.some(([i,j])=>!Number.isInteger(i)||!Number.isInteger(j)||!has(i,j)))throw Error('Ineligible scope');
 const old=stock.attributes.position as T.BufferAttribute;
 const orig=stock.index!.array as Uint16Array, f=[];
 const row=new Map<number,{id:number,weight:number,delta:number,old:number,new:number}>();
 const extraPos:number[]=[],extraNormal:number[]=[],extraUV:number[]=[];
 const changed:Set<number>=new Set(),scopes:Array<{cell:XY,oldAt:number,newAt:number,newCount:number}>=[],delta=[Infinity,-Infinity];
 const ramp=(x:number,z:number)=>{
  const i=Math.floor(x),j=Math.floor(z);let d=.5;
  for(let v=j-1;v<=j+1;v++)for(let u=i-1;u<=i+1;u++)if(!has(u,v))
   d=Math.min(d,Math.hypot(Math.max(u-x,x-u-1,0),Math.max(v-z,z-v-1,0)));
  const k=2*d;return k*k*(3-2*k);
 };
 const make=(kx:number,kz:number)=>{
  const g=kz*(N*sub+1)+kx,existing=row.get(g);
  if(existing)return existing.id;
  const U=kx/sub,V=kz/sub, i=Math.floor(U),j=Math.floor(V),u=U-i,v=V-j,k=j*B+i;
  const w=ramp(U,V),oa=old.getY(k),ob=old.getY(k+1),oc=old.getY(k+B),od=old.getY(k+B+1);
  const p=u+v<=1?oa+(ob-oa)*u+(oc-oa)*v:od+(oc-od)*(1-u)+(ob-od)*(1-v);
  if(w===0){
   if(u||v)throw Error('A subdivided stationary boundary would touch stock');
   row.set(g,{id:k,weight:0,delta:0,old:p,new:p});
   return k;
  }
  const s=bare(U/N,V/N);
  if(s===undefined||!Number.isFinite(s)||s<0||s>160)throw Error('Missing or incompatible public overview support');
  const Y=Math.fround(p+(s+.12-p)*w);delta[0]=Math.min(delta[0],Y-p);delta[1]=Math.max(delta[1],Y-p);
  const onCorner=u===0&&v===0;
  const X=u?old.getX(k)+(old.getX(k+1)-old.getX(k))*u:old.getX(k);
  const Z=v?old.getZ(k)+(old.getZ(k+B)-old.getZ(k))*v:old.getZ(k);
  const id=B*B+extraPos.length/3;extraPos.push(X,Y,Z);
  const normal=stock.getAttribute('normal'),uv=stock.getAttribute('uv');
  // Regular unaltered normals; the original material already uses exact new face derivatives.
  extraNormal.push(normal.getX(k),normal.getY(k),normal.getZ(k));
  extraUV.push(onCorner?uv.getX(k):uv.getX(k)+(uv.getX(k+1)-uv.getX(k))*u,
               onCorner?uv.getY(k):uv.getY(k)+(uv.getY(k+B)-uv.getY(k))*v);
  row.set(g,{id,weight:w,delta:Y-p,old:p,new:Y});return id;
 };
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){
  const k=j*B+i,pos=(j*N+i)*6,current=[k,k+B,k+1,k+B,k+B+1,k+1];
  if(current.some((v,q)=>orig[pos+q]!==v))throw Error('Wrong original regular triangle topology');
  if(!has(i,j)){f.push(...current);continue;}
  changed.add(pos/3);changed.add(pos/3+1);
  const A:XY=[0,0],C:XY=[0,sub],P:XY=[sub,0],Q:XY=[sub,sub];
  const a:XY[]=[],b:XY[]=[];
  const can=(u:number,v:number)=>{
   if((u===0||u===sub)&&(v===0||v===sub))return true;
   if((u===0&&!has(i-1,j))||(u===sub&&!has(i+1,j))||(v===0&&!has(i,j-1))||(v===sub&&!has(i,j+1)))return false;
   return true;
  };
  for(let v=0;v<=sub;v++)for(let u=0;u<=sub;u++)if(can(u,v)){
   const t:XY=[u,v];
   if(u+v<=sub)a.push(t);
   if(u+v>=sub)b.push(t);
  }
  const n=f.length;
  for(const t of [...fill([A,C,P],a),...fill([C,Q,P],b)])for(const [u,v] of t)f.push(make(i*sub+u,j*sub+v));
  scopes.push({cell:[i,j],oldAt:pos,newAt:n,newCount:f.length-n});
 }
 const g=new T.BufferGeometry(), add=(k:string,rest:number[],size:number)=>{
  const v=new Float32Array(B*B*size+rest.length);
  v.set(stock.getAttribute(k).array as Float32Array);v.set(rest,B*B*size);
  g.setAttribute(k,new T.BufferAttribute(v,size));
 };
 add('position',extraPos,3);add('normal',extraNormal,3);add('uv',extraUV,2);
 if(g.attributes.position.count>65535)throw Error('Private index budget');
 g.setIndex(new T.BufferAttribute(Uint16Array.from(f),1));g.computeBoundingSphere();
 return {geometry:g,row,changed,scopes,delta,extraVertices:extraPos.length/3};
}
