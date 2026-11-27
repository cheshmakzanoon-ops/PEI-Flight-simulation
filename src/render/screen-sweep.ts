/** Detached bounds for the known Borden clip-source expressions. This layer
 * decides what to TEST, never what is allowed to be coloured. */
type I=readonly [number,number];
type V=readonly [number,number,number];
export type Rect={readonly x:I;readonly y:I};
const U32=2**-24,G7=7*U32/(1-7*U32),SUB_PIXEL=.0625;
const ulp64=(x:number)=>Math.max(1,Math.abs(x))*2**-51;
const f=(a:number,b:number):I=>[a-ulp64(a),b+ulp64(b)];
const exact=(v:number):I=>[v,v];
const add=(a:I,b:I)=>f(a[0]+b[0],a[1]+b[1]);
const minus=(a:I,b:I)=>f(a[0]-b[1],a[1]-b[0]);
const mul=(a:I,b:I)=>{
 const p=a[0]*b[0],q=a[0]*b[1],r=a[1]*b[0],s=a[1]*b[1];
 return f(Math.min(p,q,r,s),Math.max(p,q,r,s));
};
const quot=(a:I,b:I)=>b[0]>0?mul(a,f(1/b[1],1/b[0])):undefined;
const union=(a:I,b:I)=>f(Math.min(a[0],b[0]),Math.max(a[1],b[1]));
const mag=(v:I)=>Math.max(Math.abs(v[0]),Math.abs(v[1]));
const boundSum=(raw:readonly I[],m:readonly I[])=>{
 let y:I=exact(0),sizes=0;
 for(let i=0;i<4;i++){
  y=add(y,mul(raw[i],m[i]));sizes+=mag(raw[i])*mag(m[i]);
 }
 const padding=sizes*G7+2**-126;
 return f(y[0]-padding,y[1]+padding);
};
const vec=(m:readonly I[],v:readonly I[])=>[0,1,2,3].map(i=>boundSum(v,[m[i],m[i+4],m[i+8],m[i+12]]));
const combine=(a:readonly I[],b:readonly I[])=>[0,4,8,12].flatMap(k=>vec(a,b.slice(k,k+4)));

export function makeVertexFootprint(P:readonly number[],V:readonly number[],width:number,height:number){
 if(P.length!==16||V.length!==16||!P.every(Number.isFinite)||!V.every(Number.isFinite)||
    !Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0)return;
 const p=P.map(x=>exact(Math.fround(x))),v=V.map(x=>exact(Math.fround(x)));
 const pv=combine(p,v),F=(a:I,m:number)=>mul(a,exact(m));
 return (xyz:V):Rect|undefined=>{
  if(!xyz.every(x=>Number.isFinite(x)&&Math.fround(x)===x))return;
  const W=xyz.map(exact).concat([exact(1)]);
  // The exact public vertex program uses P*V*w. Enclose both likely
  // evaluation associations and the signed dot-error bound.
  const a=vec(pv,W),b=vec(p,vec(v,W));
  const clip=[0,1,2,3].map(i=>union(a[i],b[i]));
  const [X,Y,Z,W1]=clip;
  if(W1[0]<=.14||Z[0]<=-W1[0]||Z[1]>=W1[0])return;
  const ix=quot(X,W1),iy=quot(Y,W1);
  if(!ix||!iy)return;
  const sx=F(add(ix,exact(1)),width*.5),sy=F(minus(exact(1),iy),height*.5);
  return {x:f(sx[0]-SUB_PIXEL,sx[1]+SUB_PIXEL),y:f(sy[0]-SUB_PIXEL,sy[1]+SUB_PIXEL)};
 };
}
export function orientation(a:Rect,b:Rect,c:Rect){
 const v=minus(mul(minus(b.x,a.x),minus(c.y,a.y)),mul(minus(b.y,a.y),minus(c.x,a.x)));
 return v[0]>0?1:v[1]<0?-1:0;
}

/** Superset of pixel squares intersecting convex hull of endpoint rectangles,
 * avoids a large AABB for diagonally projected coast. */
export function sweepEdge(a:Rect,b:Rect,width:number,height:number,write:(x:number,y:number)=>boolean){
 const minY=Math.max(0,Math.ceil(Math.min(a.y[0],b.y[0])-1-1e-9));
 const maxY=Math.min(height-1,Math.floor(Math.max(a.y[1],b.y[1])+1e-9));
 const linear=(x:number,z:number,t:number)=>x+(z-x)*t;
 for(let y=minY;y<=maxY;y++){
  let l=0,h=1;
  const upper=(u:number,v:number,cap:number)=>{
   const d=v-u,n=cap-u;
   if(Math.abs(d)<1e-15)return n>=-1e-12;
   const t=n/d,tol=ulp64(t)*2;
   if(d>0)h=Math.min(h,t+tol);else l=Math.max(l,t-tol);
   return l<=h;
  };
  if(!upper(a.y[0],b.y[0],y+1+1e-10)||!upper(-a.y[1],-b.y[1],-y+1e-10))continue;
  const lo=Math.min(linear(a.x[0],b.x[0],l),linear(a.x[0],b.x[0],h));
  const hi=Math.max(linear(a.x[1],b.x[1],l),linear(a.x[1],b.x[1],h));
  for(let x=Math.max(0,Math.ceil(lo-1-1e-9));x<=Math.min(width-1,Math.floor(hi+1e-9));x++){
   if(!write(x,y))return false;
  }
 }
 return true;
}

/** Conservative fast rejection: a whole world/basis box fails a homogeneous
 * viewport half-space even after the same binary32 clip arithmetic bound.
 * False means "use the slower exact corners or hold", never "overlaps". */
export function makeClipExcluder(P:readonly number[],V:readonly number[],region:readonly [number,number,number,number],width:number,height:number){
 if(P.length!==16||V.length!==16||!P.every(Number.isFinite)||!V.every(Number.isFinite)||
    !region.every(Number.isFinite)||width<=0||height<=0)return;
 const p=P.map(Math.fround),v=V.map(Math.fround);
 const gamma=2*G7+G7*G7;
 const data=(r:number)=>[0,1,2,3].map(j=>{
  let c=0,a=0;
  for(let k=0;k<4;k++){const m=p[r+4*k]*v[4*j+k];c+=m;a+=Math.abs(m);}
  return {c,e:a*gamma+ulp64(a)*8};
 });
 const X=data(0),Y=data(1),Z=data(2),W=data(3);
 const plane=(A:ReturnType<typeof data>,f:number,sgn:1|-1)=>
  A.map((a,i)=>{const c=(a.c-f*W[i].c)*sgn;return {c,e:a.e+Math.abs(f)*W[i].e+ulp64(c)*8};});
 const [l,b,r,t]=region;
 const planes=[plane(X,l-.5/width,1),plane(X,r+.5/width,-1),
  plane(Y,b-.5/height,1),plane(Y,t+.5/height,-1),plane(W,0,1),plane(Z,-1,1),plane(Z,1,-1)];
 return (coords:readonly [I,I,I])=>{
  for(const bits of planes){
   let top=bits[3].c,margin=bits[3].e;
   for(let k=0;k<3;k++){
    const d=bits[k],s=coords[k];
    top+=d.c*(d.c<0?s[0]:s[1]);margin+=d.e*mag(s);
   }
   margin+=ulp64(Math.abs(top)+margin)*12;
   if(top+margin<0)return true;
  }
  return false;
 };
}
