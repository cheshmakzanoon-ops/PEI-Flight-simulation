import type * as T from 'three';
type I=readonly [number,number];
type I3=readonly [I,I,I];
type Vec3=readonly [number,number,number];
type Tri=readonly [Vec3,Vec3,Vec3];
const CELL=[-38866.87246486078,27761.663306623333,-38819.27066147455,27809.070239400728] as const;
const SEA=Math.fround(-.055);
const U=(x:number)=>Math.max(1,Math.abs(x))*2**-51;
const exact=(x:number):I=>[x,x];
const out=(lo:number,hi:number):I=>[lo-U(lo),hi+U(hi)];
const add=(a:I,b:I)=>out(a[0]+b[0],a[1]+b[1]);
const sub=(a:I,b:I)=>out(a[0]-b[1],a[1]-b[0]);
const mul=(a:I,b:I)=>{
 const r=a[0]*b[0],s=a[0]*b[1],t=a[1]*b[0],u=a[1]*b[1];
 return out(Math.min(r,s,t,u),Math.max(r,s,t,u));
};
const div=(a:I,b:I)=>{
 if(b[0]<=0&&b[1]>=0)return;
 return mul(a,out(1/b[1],1/b[0]));
};
const sum=(a:I3,b:I3)=>[add(a[0],b[0]),add(a[1],b[1]),add(a[2],b[2])] as const;
const minus=(a:I3,b:I3)=>[sub(a[0],b[0]),sub(a[1],b[1]),sub(a[2],b[2])] as const;
const scale=(a:I3,b:I)=>[mul(a[0],b),mul(a[1],b),mul(a[2],b)] as const;
const dot=(a:I3,b:I3)=>add(add(mul(a[0],b[0]),mul(a[1],b[1])),mul(a[2],b[2]));
const cross=(a:I3,b:I3)=>[sub(mul(a[1],b[2]),mul(a[2],b[1])),sub(mul(a[2],b[0]),mul(a[0],b[2])),sub(mul(a[0],b[1]),mul(a[1],b[0]))] as const;
const wrap=(x:Vec3):I3=>[exact(x[0]),exact(x[1]),exact(x[2])];
const positive=(a:I)=>a[0]>0;
const negative=(a:I)=>a[1]<0;
const between=(p:I,a:number,b:number)=>p[0]>a&&p[1]<b;
const inCell=(p:I3)=>between(p[0],CELL[0],CELL[2])&&between(p[2],CELL[1],CELL[3]);
const upper=(a:I)=>a[1];
type Box=readonly [number,number,number,number];
type Basis={readonly a:I3;readonly b:I3;readonly c:I3;readonly screen?:Box};
function triangle(a:Tri,project:(v:I3)=>readonly [I,I]|undefined):Basis{
 const [P,Q,R]=a.map(wrap),p=project(P),q=project(Q),r=project(R);
 const screen=p&&q&&r?[
  Math.min(p[0][0],q[0][0],r[0][0]),Math.max(p[0][1],q[0][1],r[0][1]),
  Math.min(p[1][0],q[1][0],r[1][0]),Math.max(p[1][1],q[1][1],r[1][1]),
 ] as const:undefined;
 return {a:P,b:minus(Q,P),c:minus(R,P),screen};
}
function projectG(p:I3):I|undefined{
 const u=div(sub(p[0],exact(CELL[0])),sub(exact(CELL[2]),exact(CELL[0])));
 const v=div(sub(p[2],exact(CELL[1])),sub(exact(CELL[3]),exact(CELL[1])));
 if(!u||!v)return;
 return add(exact(-4),mul(u,sub(exact(17),mul(exact(13),v))));
}
const MISS=Symbol('not on forward triangle');
const UNKNOWN=Symbol('plane-seat interval uncertain');

function hit(eye:I3,ray:I3,a:Basis):I|typeof MISS|typeof UNKNOWN{
 const h=cross(ray,a.c),s=minus(eye,a.a),det=dot(a.b,h);
 const u=div(dot(s,h),det);
 if(!u)return UNKNOWN;
 if(negative(u)||u[0]>1)return MISS;
 const q=cross(s,a.b),v=div(dot(ray,q),det);
 if(!v)return UNKNOWN;
 if(negative(v)||v[0]>1)return MISS;
 const t=div(dot(a.c,q),det),w=sub(exact(1),add(u,v));
 if(!t)return UNKNOWN;
 if(negative(w)||upper(t)<=0)return MISS;
 if(!positive(u)||!positive(v)||!positive(w)||!positive(t))return UNKNOWN;
 return t;
}
function nearest(eye:I3,ray:I3,owner:readonly Basis[],x:number,y:number){
 let best:I|undefined;
 for(const tri of owner){
  const b=tri.screen;
  if(b&&(x<b[0]||x>b[1]||y<b[2]||y>b[3]))continue;
  const t=hit(eye,ray,tri);
  if(t===MISS)continue;
  if(t===UNKNOWN)return;
  if(best&&t[0]<=best[1]&&best[0]<=t[1])return;
  if(!best||upper(t)<best[0])best=t;
 }
 return best;
}

/** CPU-only hard proof of supplied binary64 source math, not a model of a
 * driver's filtered and rounded stock Cover shader. It is intended only
 * after actual source/pose pins and a real depth/colour custody gate. */
export function validateCentreRays(camera:T.PerspectiveCamera,ground:readonly Tri[],curve:readonly Tri[],width:number,height:number){
 if(ground.length>32||curve.length!==58||width<=0||height<=0)return;
 const p=camera.projectionMatrix.elements,v=camera.matrixWorld.elements;
 if(!p.every(Number.isFinite)||!v.every(Number.isFinite)||p[0]<=0||p[5]<=0||
    p[11]!==-1||p[15]!==0||[1,2,3,4,6,7,12,13].some(i=>p[i]!==0)||
    [v[3],v[7],v[11],v[15]].some((x,i)=>x!==(i===3?1:0)))return;
 const eye=wrap([v[12],v[13],v[14]]);
 // Invert the same exact binary64 camera basis that defines these outgoing
 // rays, with separately rounded intervals. Positive depth at all three
 // vertices makes every projected triangle point lie in their convex hull.
 const ex=wrap([v[0],v[1],v[2]]),ey=wrap([v[4],v[5],v[6]]),ez=wrap([v[8],v[9],v[10]]);
 const a=cross(ey,ez),b=cross(ez,ex),d=cross(ex,ey),det=dot(ex,a);
 if(!positive(det))return;
 const pixel=(p0:I3):readonly [I,I]|undefined=>{
  const q=minus(p0,eye),D=dot(d,q);
  // det>0, so the sign of the original camera depth agrees with D.
  if(!negative(D))return;
  const W=sub(exact(0),D);
  const tx=div(dot(a,q),W),ty=div(dot(b,q),W);
  if(!tx||!ty)return;
  const nx=sub(mul(exact(p[0]),tx),exact(p[8])),ny=sub(mul(exact(p[5]),ty),exact(p[9]));
  return [mul(add(nx,exact(1)),exact(width*.5)),mul(sub(exact(1),ny),exact(height*.5))];
 };
 const g=ground.map(t=>triangle(t,pixel)),c=curve.map(t=>triangle(t,pixel));
 return (x:number,y:number)=>{
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=width||y>=height)return;
  const nx=div(exact(2*x+1-width),exact(width)),ny=div(exact(height-2*y-1),exact(height));
  if(!nx||!ny)return;
  const u=div(add(nx,exact(p[8])),exact(p[0])),z=div(add(ny,exact(p[9])),exact(p[5]));
  if(!u||!z)return;
  const component=(i:number)=>sub(add(mul(exact(v[i]),u),mul(exact(v[i+4]),z)),exact(v[i+8]));
  const ray:I3=[component(0),component(1),component(2)];
  const landT=nearest(eye,ray,g,x+.5,y+.5),curveT=nearest(eye,ray,c,x+.5,y+.5),seaT=div(sub(exact(SEA),eye[1]),ray[1]);
  if(!landT||!curveT||!seaT||landT[1]>=curveT[0]||curveT[1]>=seaT[0])return;
  const land=sum(eye,scale(ray,landT)),point=sum(eye,scale(ray,curveT)),sea=sum(eye,scale(ray,seaT));
  if(!inCell(land)||!inCell(point)||!inCell(sea))return;
  const landG=projectG(land),seaG=projectG(sea);
  if(!landG||!seaG||!negative(landG)||!positive(seaG))return;
  return {landT,curveT,seaT,point,landG,seaG};
 };
}
