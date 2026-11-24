import {mergeWharfToe} from './basin-wharf-toe.ts';
import {strictArc,type Quad} from './strict-shore-arc.ts';
import type { WaterInset } from './harbour-cover.ts';
import type { Cover } from './cover.ts';
import type { Terrain } from './terrain.ts';

export interface ShoreSegment { ax:number; az:number; bx:number; bz:number; seatedLegacyArc?:ShoreSegment; seatJoin?:readonly [boolean,boolean];baywalk?:true }

function contourCell(result:ShoreSegment[],x:number,z:number,stepX:number,stepZ:number,a:number,b:number,c:number,d:number){
 const mask=(a>=0?1:0)|(b>=0?2:0)|(c>=0?4:0)|(d>=0?8:0);
 if(mask===0||mask===15)return;
 // At mixed cells, perimeter edges locate the texture's bilinear zero crossing.
 const points: ([number,number]|undefined)[]=[
  (a>=0)!==(b>=0)?[x+stepX*a/(a-b),z]:undefined,
  (b>=0)!==(c>=0)?[x+stepX,z+stepZ*b/(b-c)]:undefined,
  (d>=0)!==(c>=0)?[x+stepX*d/(d-c),z+stepZ]:undefined,
  (a>=0)!==(d>=0)?[x,z+stepZ*a/(a-d)]:undefined
 ];
 const add=(p:[number,number],q:[number,number])=>{
  if(Math.hypot(p[0]-q[0],p[1]-q[1])>.01)result.push({ax:p[0],az:p[1],bx:q[0],bz:q[1]});
 };
 if(mask===5||mask===10){
  if(((a+b+c+d)>=0)===(mask===5)){add(points[0]!,points[1]!);add(points[2]!,points[3]!);}
  else{add(points[0]!,points[3]!);add(points[1]!,points[2]!);}
 }else{
  const intersections=points.filter((p):p is [number,number]=>!!p);
  if(intersections.length===2)add(intersections[0],intersections[1]);
 }
}

/** Recompute only affected atlas cells. Border propagation uses exact prior
 * zero crossings so one unmodified neighbour cannot leave a visible crack.
 */
function harbourSections(cover:Cover,terrain:Terrain,harbour:WaterInset){
 const {baseGridIJ:[ix0,iz0,ix1,iz1],boundsXZ:[x,z,right,bottom],width:nx,height:nz,divisions:div}=harbour.plan;
 const cols=ix1-ix0,rows=iz1-iz0,dx=(right-x)/(nx-1),dz=(bottom-z)/(nz-1);
 const fields=new Float32Array(nx*nz),blocks=new Uint8Array(cols*rows);
 const wetToe=cover.wharfToe&&cover.basin===harbour;
 const local=(old:number,px:number,pz:number)=>wetToe?mergeWharfToe(harbour.distance(old,px,pz),px,pz):harbour.distance(old,px,pz);
 const mark=(i:number,j:number)=>{if(i>=0&&j>=0&&i<cols&&j<rows)blocks[j*cols+i]=1;};
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
  const px=x+i*dx,pz=z+j*dz,old=cover.legacyDistance(terrain,px,pz),now=local(old,px,pz);
  fields[j*nx+i]=now;
  if(old<0||now>=0)continue;
  const a=Math.floor(i/div),b=Math.floor(j/div);
  mark(a,b);if(i%div===0)mark(a-1,b);if(j%div===0)mark(a,b-1);
  if(i%div===0&&j%div===0)mark(a-1,b-1);
 }
 const prior=(i:number,j:number)=>cover.bytes[((iz0+j)*cover.width+ix0+i)*2+1]-128;
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  const a=prior(i,j);
  if(i<cols){
   const b=prior(i+1,j);
   if((a>=0)!==(b>=0)&&local(0,x+(i+a/(a-b))*dx*div,z+j*dz*div)<-1e-6){mark(i,j-1);mark(i,j);}
  }
  if(j<rows){
   const b=prior(i,j+1);
   if((a>=0)!==(b>=0)&&local(0,x+i*dx*div,z+(j+a/(a-b))*dz*div)<-1e-6){mark(i-1,j);mark(i,j);}
  }
 }
 // A pinned site can refine an independently witnessed aperture in an
 // unchanged, mixed legacy cell. The wet/dry shader/CPU field itself,
 // and every other inherited coarse chord, are untouched.
 for(const [i,j] of harbour.plan.contourReviewCells??[])mark(i-ix0,j-iz0);
 return {ix0,iz0,cols,rows,div,fields,blocks,x,z,dx,dz,nx};
}

/** Rebuild only cells containing a certified wet-to-dry change. March the
 * continuous sign-equivalent union, not the possibly discontinuous material
 * scalar (which deliberately keeps old wet/dry optics away from new land). */
function baywalkShoreCells(cover:Cover,terrain:Terrain){
 const bank=cover.baywalk,chosen=new Set<number>();
 if(!bank)return chosen;
 const {width:w,height:h}=cover,dx=(terrain.right-terrain.left)/w,dz=(terrain.bottom-terrain.top)/h;
 const locate=(x:number,z:number)=>[(x-terrain.left)/dx-.5,(z-terrain.top)/dz-.5];
 const mark=(i:number,j:number)=>{if(i>=0&&j>=0&&i<w-1&&j<h-1)chosen.add(j*w+i);};
 for(let j=0;j<bank.height;j++)for(let i=0;i<bank.width;i++){
  if(bank.data.shore[j*bank.width+i]<=128)continue;
  const x=bank.x0+i*bank.step,z=bank.z0+j*bank.step,prior=cover.beforeBaywalk(terrain,x,z);
  // Approaching either side of an inherited zero may change its local
  // contour even when the nearest data node is already dry.
  if(prior>1.6)continue;
  const [u,v]=locate(x,z),a=Math.floor(u),b=Math.floor(v);mark(a,b);
  const m=bank.step+.025;
  if((u-a)*dx<m)mark(a-1,b);else if((a+1-u)*dx<m)mark(a+1,b);
  if((v-b)*dz<m)mark(a,b-1);else if((b+1-v)*dz<m)mark(a,b+1);
 }
 return chosen;
}
/** March the same pixel-centred, signed-distance field the land and water shaders sample. */
export type LegacyShoreSelection=(x0:number,z0:number,x1:number,z1:number,i:number,j:number,corners:Quad)=>boolean|'pinned-zero';
export const LEGACY_SHORE_MIN_CHORD_M=1.40;
export function coastSegments(cover: Cover,terrain: Terrain,refine?:LegacyShoreSelection): ShoreSegment[] {
 const {width:w,height:h,bytes}=cover,result:ShoreSegment[]=[];
 const stepX=(terrain.right-terrain.left)/w,stepZ=(terrain.bottom-terrain.top)/h,locally=cover.waterInsets.map(inset=>harbourSections(cover,terrain,inset));
 const court=baywalkShoreCells(cover,terrain);
 const inFine=(i:number,j:number)=>court.has(j*w+i)||locally.some(fine=>{
  const x=i-fine.ix0,z=j-fine.iz0;
  return x>=0&&z>=0&&x<fine.cols&&z<fine.rows&&fine.blocks[z*fine.cols+x]>0;
 });
 // Rendering-only remeshing of literally enumerated original mixed cells.
 // These can adjoin the wet island without extending the authoritative mask.
 const exteriorReview=new Map<number,number>();
 for(const inset of cover.waterInsets)for(const [i,j] of inset.plan.contourReviewCells??[]){
  if(i<0||i>=w-1||j<0||j>=h-1||inFine(i,j))continue;
  const k=(j*w+i)*2+1,dry=bytes[k]>=128;
  if(dry===(bytes[k+2]>=128)&&dry===(bytes[k+w*2]>=128)&&dry===(bytes[k+w*2+2]>=128))continue;
  exteriorReview.set(j*w+i,inset.plan.divisions);
 }
 for(let j=0;j<h-1;j++)for(let i=0;i<w-1;i++){
  const n=(j*w+i)*2+1;
  const a=bytes[n]-128,b=bytes[n+2]-128,c=bytes[n+2*w+2]-128,d=bytes[n+2*w]-128;
  if((a>=0)===(b>=0)&&(b>=0)===(c>=0)&&(c>=0)===(d>=0))continue;
  if(inFine(i,j)||exteriorReview.has(j*w+i))continue;
  const x=terrain.left+(i+.5)*stepX,z=terrain.top+(j+.5)*stepZ;
  const mode=refine?.(x,z,x+stepX,z+stepZ,i,j,[a,b,c,d]);
  if(mode){
   const zero=mode==='pinned-zero';
   const arc=strictArc([a,b,c,d],stepX,stepZ,.047,96,zero ? .09 : LEGACY_SHORE_MIN_CHORD_M,zero);
   if(arc.mode==='exact'&&arc.points.length>2){
    const a=arc.points[0],d=arc.points.at(-1)!;
    const original={ax:x+a[0]*stepX,az:z+a[1]*stepZ,bx:x+d[0]*stepX,bz:z+d[1]*stepZ};
    for(let k=1;k<arc.points.length;k++){
     const p=arc.points[k-1],q=arc.points[k];
     result.push({ax:x+p[0]*stepX,az:z+p[1]*stepZ,bx:x+q[0]*stepX,bz:z+q[1]*stepZ,seatedLegacyArc:original});
    }
    continue;
   }
  }
  contourCell(result,x,z,stepX,stepZ,a,b,c,d);
 }
 for(const fine of locally){
  const {cols,rows,div,fields,blocks,x,z,dx,dz,nx}=fine;
  for(let b=0;b<rows;b++)for(let a=0;a<cols;a++){
   if(!blocks[b*cols+a])continue;
   for(let j=b*div;j<(b+1)*div;j++)for(let i=a*div;i<(a+1)*div;i++){
    const k=j*nx+i;
    contourCell(result,x+i*dx,z+j*dz,dx,dz,fields[k],fields[k+1],fields[k+nx+1],fields[k+nx]);
   }
  }
 }
 for(const [cell,div] of exteriorReview){
  const i=cell%w,j=Math.floor(cell/w),x=terrain.left+(i+.5)*stepX,z=terrain.top+(j+.5)*stepZ;
  const dx=stepX/div,dz=stepZ/div,n=div+1;
  const sample=new Float64Array(n*n);
  for(let j=0;j<n;j++)for(let i=0;i<n;i++)sample[j*n+i]=cover.distance(terrain,x+i*dx,z+j*dz);
  for(let j=0;j<div;j++)for(let i=0;i<div;i++){
   const k=j*n+i;
   contourCell(result,x+i*dx,z+j*dz,dx,dz,sample[k],sample[k+1],sample[k+n+1],sample[k+n]);
  }
 }
 for(const cell of court){
  const i=cell%w,j=Math.floor(cell/w),x=terrain.left+(i+.5)*stepX,z=terrain.top+(j+.5)*stepZ;
  const div=Math.ceil(Math.max(stepX,stepZ)/.28),dx=stepX/div,dz=stepZ/div,n=div+1;
  const sample=new Float64Array(n*n),first=result.length;
  for(let b=0;b<=div;b++)for(let a=0;a<=div;a++){
   const px=x+a*dx,pz=z+b*dz;
   const old=cover.beforeBaywalk(terrain,px,pz);
   sample[b*n+a]=Math.max(old,cover.baywalk!.signed(px,pz));
  }
  for(let b=0;b<div;b++)for(let a=0;a<div;a++){
   const k=b*n+a;
   contourCell(result,x+a*dx,z+b*dz,dx,dz,sample[k],sample[k+1],sample[k+n+1],sample[k+n]);
  }
  for(let i=first;i<result.length;i++)result[i].baywalk=true;
 }
 return result;
}
