import type { WaterInset } from './harbour-cover.ts';
import type { Cover } from './cover.ts';
import type { Terrain } from './terrain.ts';

export interface ShoreSegment { ax:number; az:number; bx:number; bz:number }

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
 const mark=(i:number,j:number)=>{if(i>=0&&j>=0&&i<cols&&j<rows)blocks[j*cols+i]=1;};
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
  const px=x+i*dx,pz=z+j*dz,old=cover.legacyDistance(terrain,px,pz),now=harbour.distance(old,px,pz);
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
   if((a>=0)!==(b>=0)&&harbour.distance(0,x+(i+a/(a-b))*dx*div,z+j*dz*div)<-1e-6){mark(i,j-1);mark(i,j);}
  }
  if(j<rows){
   const b=prior(i,j+1);
   if((a>=0)!==(b>=0)&&harbour.distance(0,x+i*dx*div,z+(j+a/(a-b))*dz*div)<-1e-6){mark(i-1,j);mark(i,j);}
  }
 }
 return {ix0,iz0,cols,rows,div,fields,blocks,x,z,dx,dz,nx};
}

/** March the same pixel-centred, signed-distance field the land and water shaders sample. */
export function coastSegments(cover: Cover,terrain: Terrain): ShoreSegment[] {
 const {width:w,height:h,bytes}=cover,result:ShoreSegment[]=[];
 const stepX=(terrain.right-terrain.left)/w,stepZ=(terrain.bottom-terrain.top)/h,locally=cover.waterInsets.map(inset=>harbourSections(cover,terrain,inset));
 for(let j=0;j<h-1;j++)for(let i=0;i<w-1;i++){
  const n=(j*w+i)*2+1;
  const a=bytes[n]-128,b=bytes[n+2]-128,c=bytes[n+2*w+2]-128,d=bytes[n+2*w]-128;
  if((a>=0)===(b>=0)&&(b>=0)===(c>=0)&&(c>=0)===(d>=0))continue;
  if(locally.some(fine=>{
   const x=i-fine.ix0,z=j-fine.iz0;
   return x>=0&&z>=0&&x<fine.cols&&z<fine.rows&&fine.blocks[z*fine.cols+x]>0;
  }))continue;
  contourCell(result,terrain.left+(i+.5)*stepX,terrain.top+(j+.5)*stepZ,stepX,stepZ,a,b,c,d);
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
 return result;
}
