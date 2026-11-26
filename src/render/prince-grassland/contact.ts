// Candidate-only physical sampler for exact, spatially signed original cells.
// It may be used only after authenticating the existing owner and source.
import type {BufferGeometry} from 'three';
const N=112,S=N+1;
type Cell=readonly [number,number];
export type ContactScope=Readonly<{cell:Cell;newAt:number;newCount:number}>;

/** In-footprint continuous blend: no collision collar outside the exact
 * signed mesh union. The inner core follows the actual submitted triangles. */
export function patchContactFromDraw(geometry:BufferGeometry,scopes:readonly ContactScope[]){
 const p=geometry.getAttribute('position'),index=geometry.index;
 if(!index||p?.itemSize!==3||p.count<S*S||!scopes.length||scopes.length>64)return;
 const x=Float64Array.from({length:S},(_,i)=>p.getX(i)),
  z=Float64Array.from({length:S},(_,i)=>p.getZ(i*S));
 for(let i=0;i<S;i++)if(!Number.isFinite(x[i]+z[i])||
   (i>0&&(x[i]<=x[i-1]||z[i]<=z[i-1])))return;
 const cells=new Map<number,ContactScope>();
 let end=0;
 for(const desc of scopes){
  const [i,j]=desc.cell,{newAt,newCount}=desc,key=j*N+i;
  if(!Number.isInteger(i)||!Number.isInteger(j)||i<2||j<2||i>=N-2||j>=N-2||
   cells.has(key)||!Number.isSafeInteger(newAt)||!Number.isSafeInteger(newCount)||
   newCount<=0||newCount%3||newAt<end||newAt%3||newAt+newCount>index.count)return;
  for(let k=newAt;k<newAt+newCount;k++)if(index.getX(k)<0||index.getX(k)>=p.count)return;
  cells.set(key,desc);end=newAt+newCount;
 }
 const located=(v:number,axis:Float64Array)=>{
  if(!Number.isFinite(v)||v<axis[0]||v>=axis[N])return -1;
  let a=0,b=N;
  while(b-a>1){const m=(a+b)>>1;if(axis[m]<=v)a=m;else b=m;}
  return a;
 };
 const weight=(u:number,v:number,i:number,j:number)=>{
  let gap=.5;
  for(let row=j-1;row<=j+1;row++)for(let col=i-1;col<=i+1;col++)
   if(!cells.has(row*N+col))gap=Math.min(gap,Math.hypot(Math.max(col-u,u-col-1,0),Math.max(row-v,v-row-1,0)));
  const r=gap*2;return r*r*(3-2*r);
 };
 return (lx:number,lz:number,stock:number,dry:boolean,runway:boolean)=>{
  if(!dry||runway||!Number.isFinite(stock))return stock;
  const i=located(lx,x),j=located(lz,z);
  if(i<0||j<0)return stock;
  const found=cells.get(j*N+i);
  if(!found)return stock;
  const wx=i+(lx-x[i])/(x[i+1]-x[i]),wz=j+(lz-z[j])/(z[j+1]-z[j]),w=weight(wx,wz,i,j);
  if(w<=0)return stock;
  const stop=found.newAt+found.newCount;
  for(let k=found.newAt;k<stop;k+=3){
   const a=index.getX(k),b=index.getX(k+1),c=index.getX(k+2);
   const bx=p.getX(b)-p.getX(a),bz=p.getZ(b)-p.getZ(a),cx=p.getX(c)-p.getX(a),cz=p.getZ(c)-p.getZ(a);
   const ax=lx-p.getX(a),az=lz-p.getZ(a),area=bx*cz-bz*cx;
   if(!(area<-1e-12))continue;
   const v=(ax*cz-az*cx)/area,u=(bx*az-bz*ax)/area;
   if(v< -1e-9||u< -1e-9||v+u>1+1e-9)continue;
   const y=(1-v-u)*p.getY(a)+v*p.getY(b)+u*p.getY(c);
   return Number.isFinite(y)?stock+(y-stock)*w:stock;
  }
  return stock;
 };
}
