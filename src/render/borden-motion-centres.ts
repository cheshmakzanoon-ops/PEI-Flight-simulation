import {validateCentreRays} from './borden-centre-ray-proof.ts';
import {makeVertexFootprint,orientation,sweepEdge,type Rect} from './screen-sweep.ts';
import * as T from 'three';

type V3=readonly [number,number,number];
type Tri=readonly [V3,V3,V3];
type Box=readonly [number,number,number,number];
type P={x:number;y:number;iw:number;world:V3};
type Projected={p:readonly [P,P,P];xmin:number;xmax:number;ymin:number;ymax:number;area:number};
const CELL:Box=[-38866.87246486078,27761.663306623333,-38819.27066147455,27809.070239400728];
const SEA=Math.fround(-.055);
const CELL_EPS=.000002, SIGN_EPS=1e-8, RAY_EPS=1e-7;
const MAX_SCREEN_KEYS=4096,MAX_PROOF_POINTS=1024;
const extent=[4096,3072] as const;
const val=(x:number)=>Number.isFinite(x);
const good=(v:readonly number[])=>v.every(val);
const inside=(p:V3)=>
 p[0]>CELL[0]+CELL_EPS&&p[0]<CELL[2]-CELL_EPS&&p[2]>CELL[1]+CELL_EPS&&p[2]<CELL[3]-CELL_EPS;
const score=(p:V3)=>{
 const u=(p[0]-CELL[0])/(CELL[2]-CELL[0]),v=(p[2]-CELL[1])/(CELL[3]-CELL[1]);
 return -4+u*(17-13*v);
};
const vertexKey=(p:V3)=>p.join(',');

export type MotionCenter={readonly x:number;readonly y:number;readonly point:V3;
 readonly land:V3;readonly sea:V3;readonly landG:number;readonly seaG:number;readonly tri:number};
export type MotionCenterReference={readonly key:[1231,1992];readonly width:number;readonly height:number;
 readonly eye:readonly number[];readonly view:readonly number[];readonly projection:readonly number[];
 readonly centres:readonly MotionCenter[];readonly examined:number;readonly candidates:number};

/** Pull only signed cell-containing tri owners from actual resident stock.
 * The caller must already hold the detailed shore authority lease. */
export function signedStockCellTriangles(mesh:T.Mesh<T.BufferGeometry>):readonly Tri[]|undefined{
 const g=mesh.geometry,i=g.index,p=g.getAttribute('position');
 if(!i||i.count!==112*112*6||!(p instanceof T.BufferAttribute)||!(p.array instanceof Float32Array)||
    p.count!==113*113||p.itemSize!==3||i.itemSize!==1||g.drawRange.start!==0||g.drawRange.count!==Infinity||
    g.groups.length||!good(mesh.matrixWorld.elements))return;
 const m=mesh.matrixWorld.elements;
 if(![m[0],m[5],m[10],m[15]].every(x=>x===1)||
    [1,2,3,4,6,7,8,9,11,13].some(k=>m[k]!==0))return;
 const source:V3[]=Array.from({length:p.count},(_,j)=>[
  Math.fround(Math.fround(m[12])+p.getX(j)),Math.fround(Math.fround(m[13])+p.getY(j)),Math.fround(Math.fround(m[14])+p.getZ(j)),
 ]);
 if(!source.every(good))return;
 const has:(p:V3,q:V3,v:V3)=>boolean=(p,q,v)=>
  Math.max(p[0],q[0],v[0])>=CELL[0]&&Math.min(p[0],q[0],v[0])<=CELL[2]&&
  Math.max(p[2],q[2],v[2])>=CELL[1]&&Math.min(p[2],q[2],v[2])<=CELL[3];
 const out:Tri[]=[];
 for(let k=0;k<i.count;k+=3){
  const a=source[i.getX(k)],b=source[i.getX(k+1)],c=source[i.getX(k+2)];
  if(!a||!b||!c)return;
  if(has(a,b,c))out.push([a,b,c]);
 }
 return out.length>0&&out.length<=32?out:undefined;
}
export function signedCurtainTriangles(g:T.BufferGeometry):readonly Tri[]|undefined{
 const p=g.getAttribute('position');
 if(g.index||p.count!==58*3||p.itemSize!==3||!(p instanceof T.BufferAttribute)||!(p.array instanceof Float32Array))return;
 const points:V3[]=Array.from({length:p.count},(_,i)=>[p.getX(i),p.getY(i),p.getZ(i)]);
 if(!points.every(good))return;
 return Array.from({length:58},(_,i)=>[points[3*i],points[3*i+1],points[3*i+2]] as const);
}
function cutPlane(P:readonly V3[],value:(p:V3)=>number){
 if(!P.length)return [];
 const Q:V3[]=[];
 let a=P.at(-1)!,av=value(a);
 for(const p of P){
  const v=value(p);
  if((v>=0)!==(av>=0)){
   const s=av/(av-v);
   Q.push(a.map((x,k)=>x+(p[k]-x)*s) as [number,number,number]);
  }
  if(v>=0)Q.push(p);
  a=p;av=v;
 }
 return Q;
}
function groundSubset(ts:readonly Tri[],vp:readonly number[]){
 const coord=(p:V3,i:number)=>p[0]*vp[i]+p[1]*vp[4+i]+p[2]*vp[8+i]+vp[12+i];
 const solid:Tri[]=[];
 for(const tr of ts){
  const scope=[
   (p:V3)=>p[0]-CELL[0],(p:V3)=>CELL[2]-p[0],(p:V3)=>p[2]-CELL[1],(p:V3)=>CELL[3]-p[2],
   (p:V3)=>coord(p,3)-.141,(p:V3)=>coord(p,3)+coord(p,2)-1e-9,(p:V3)=>coord(p,3)-coord(p,2)-1e-9,
  ].reduce<readonly V3[]>((p,f)=>cutPlane(p,f),tr);
  // Clipping changes only the mathematical working domain of the stock
  // faces, never the renderer's geometry or interpolated ground plane.
  for(let i=1;i+1<scope.length;i++){
   const a=scope[0],b=scope[i],c=scope[i+1];
   const area=(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
   if(Math.abs(area)>1e-12)solid.push([a,b,c]);
  }
 }
 return solid;
}
function imagePoint(p:V3,m:readonly number[],w:number,h:number):P|undefined{
 const [x,y,z]=p;
 const a=m[0]*x+m[4]*y+m[8]*z+m[12],b=m[1]*x+m[5]*y+m[9]*z+m[13];
 const c=m[2]*x+m[6]*y+m[10]*z+m[14],d=m[3]*x+m[7]*y+m[11]*z+m[15];
 if(!val(a)||!val(b)||!val(c)||!val(d)||d<=.14||c<=-d||c>=d)return;
 return {x:(a/d*.5+.5)*w,y:(.5-b/d*.5)*h,iw:1/d,world:p};
}
function triangle([a,b,c]:readonly [P,P,P]):Projected|undefined{
 const area=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 if(!Number.isFinite(area)||Math.abs(area)<1e-8)return;
 return {p:[a,b,c],xmin:Math.min(a.x,b.x,c.x),xmax:Math.max(a.x,b.x,c.x),
  ymin:Math.min(a.y,b.y,c.y),ymax:Math.max(a.y,b.y,c.y),area};
}
function pointAt(f:Projected,x:number,y:number){
 const {area,p:[a,b,c]}=f;
 if(x<f.xmin||x>f.xmax||y<f.ymin||y>f.ymax)return;
 const d=((b.x-x)*(c.y-y)-(b.y-y)*(c.x-x))/area;
 const e=((c.x-x)*(a.y-y)-(c.y-y)*(a.x-x))/area;
 const f0=1-d-e;
 if(Math.min(d,e,f0)<-1e-10||Math.max(d,e,f0)>1+1e-10)return;
 const A=d*a.iw,B=e*b.iw,C=f0*c.iw,scale=A+B+C;
 if(scale<=0||!Number.isFinite(scale))return;
 const wp=[0,1,2].map(i=>(A*a.world[i]+B*b.world[i]+C*c.world[i])/scale) as [number,number,number];
 if(!good(wp))return;
 return {point:wp,invW:scale};
}
/**
 * Calculates source-scoped geometric centre ownership. It does
 * not purport to duplicate an arbitrary GPU's Cover texture interpolation.
 * Actual protected colors need a separate native EqualDepth capacity and
 * unchanged sample/opaque order gate.
 */
export function projectBordenCentres(camera:T.PerspectiveCamera,curtain:readonly Tri[],
 ground:readonly Tri[],width:number,height:number):MotionCenterReference|undefined{
 if(curtain.length!==58||ground.length===0||ground.length>32||
    !Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0||
    width>extent[0]||height>extent[1]||
    !good(camera.matrixWorldInverse.elements)||!good(camera.projectionMatrix.elements))return;
 const eye=camera.position.toArray() as [number,number,number];
 if(!good(eye)||eye[1]<=SEA+.25)return;
 const vp=new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).elements;
 const footprint=makeVertexFootprint(camera.projectionMatrix.elements,camera.matrixWorldInverse.elements,width,height);
 if(!footprint)return;
 const bounds=new Map<string,Rect>();
 const bound=(p:V3)=>{
  const k=vertexKey(p),old=bounds.get(k);if(old)return old;
  const r=footprint(p);if(r)bounds.set(k,r);return r;
 };
 const projected=new Map<string,P>(),contours=new Map<string,{a:Rect;b:Rect;sides:number[]}>(),keys=new Set<number>();
 const map=(p:V3)=>{
  const k=vertexKey(p),old=projected.get(k);if(old)return old;
  const v=imagePoint(p,vp,width,height);if(v)projected.set(k,v);
  return v;
 };
 function faces(tris:readonly Tri[],edges:boolean){
  const result:Projected[]=[];
  for(const tr of tris){
   const v=tr.map(map);
   if(v.some(p=>!p))return;
   const p=v as [P,P,P],q=triangle(p);
   if(!q)return;
   result.push(q);
   if(edges)for(let i=0;i<3;i++){
    let a=p[i],b=p[(i+1)%3];
    const c=p[(i+2)%3];
    if(vertexKey(a.world)>vertexKey(b.world))[a,b]=[b,a];
    const key=vertexKey(a.world)+'|'+vertexKey(b.world),old=contours.get(key);
    const ra=bound(a.world),rb=bound(b.world),rc=bound(c.world);
    if(!ra||!rb||!rc)return;
    const side=orientation(ra,rb,rc);
    if(old){
     if(old.sides.length>=2)return;
     old.sides.push(side);
    }else contours.set(key,{a:ra,b:rb,sides:[side]});
   }
  }
  return result;
 }
 const arc=faces(curtain,true),land=faces(groundSubset(ground,vp),false);
 if(!arc||!land?.length||!contours.size)return;
 const rayProof=validateCentreRays(camera,ground,curtain,width,height);if(!rayProof)return;
 for(const {a,b,sides} of contours.values()){
  if(sides.length===2&&sides[0]*sides[1]===-1)continue;
  if(!sweepEdge(a,b,width,height,(x,y)=>{
   keys.add(y*width+x);return keys.size<=MAX_SCREEN_KEYS;
  }))return;
 }
 // Nearest intersection in camera projected depth. Numerical ties must meet
 // at essentially the same surface, otherwise the frame remains stock.
 const rowOwners=(faces:readonly Projected[])=>{
  const out:Array<number[]|undefined>=new Array(height);
  for(let i=0;i<faces.length;i++){
   const q=faces[i],lo=Math.max(0,Math.ceil(q.ymin-.5)),hi=Math.min(height-1,Math.floor(q.ymax-.5));
   for(let row=lo;row<=hi;row++)(out[row]??=[]).push(i);
  }
  return out;
 };
 const arcRows=rowOwners(arc),landRows=rowOwners(land);
 const nearest=(faces:readonly Projected[],ix:readonly number[]|undefined,x:number,y:number)=>{
  if(!ix)return;
  let best:ReturnType<typeof pointAt>,tri=-1;
  for(const k of ix){
   const p=pointAt(faces[k],x,y);if(!p)continue;
   if(!best||p.invW>best.invW){best=p;tri=k;}
  }
  return best&&{...best,tri};
 };
 const centres:MotionCenter[]=[];let examined=0;
 for(const key of keys){
  const x=key%width,y=Math.floor(key/width),q=nearest(arc,arcRows[y],x+.5,y+.5);examined++;
  if(!q||!inside(q.point))continue;
  const land0=nearest(land,landRows[y],x+.5,y+.5);
  if(!land0||land0.invW<=q.invW+RAY_EPS||!inside(land0.point))continue;
  const D=q.point[1]-eye[1];if(D>=-RAY_EPS)continue;
  const t=(SEA-eye[1])/D;
  if(t<=1+RAY_EPS)continue;
  const sea:V3=[eye[0]+t*(q.point[0]-eye[0]),SEA,eye[2]+t*(q.point[2]-eye[2])];
  if(!good(sea)||!inside(sea))continue;
  const landG=score(land0.point),seaG=score(sea);
  if(landG>=-SIGN_EPS||seaG<=SIGN_EPS)continue;
  const certified=rayProof(x,y);
  if(!certified||q.point.some((v,i)=>v<certified.point[i][0]||v>certified.point[i][1]))continue;
  centres.push({x,y,point:q.point,land:land0.point,sea,landG,seaG,tri:q.tri});
  if(centres.length>MAX_PROOF_POINTS)return;
 }
 centres.sort((a,b)=>a.y-b.y||a.x-b.x);
 return {key:[1231,1992],width,height,eye,view:[...camera.matrixWorldInverse.elements],
  projection:[...camera.projectionMatrix.elements],centres,examined,candidates:keys.size};
}
