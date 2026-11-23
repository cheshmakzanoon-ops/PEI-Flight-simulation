import * as THREE from 'three';
import {CoastalGrid, GROUND_LIFT, SURVEY_LOD} from '../sim/coastal-terrain.ts';
import {surveyNormals} from './coastal-normals.ts';
import type {Terrain} from '../sim/terrain.ts';

/**
 * Replace addressed faces in the existing indexed terrain mesh. Do not stack
 * a second surface above a coarse mesh: the measured ground can be lower.
 * Original vertex indices stay valid for World’s neighbouring tile LOD seams.
 */
export function insertCoastalGrid(g:THREE.BufferGeometry,n:number,shape:{x:number;z:number;w:number;d:number},t:Terrain,grid:CoastalGrid){
 const origPos=g.getAttribute('position'),origUv=g.getAttribute('uv'),k0=origPos.count;
 const {nx,nz,spec:s}=grid,positions=new Float32Array((k0+nx*nz)*3),uv=new Float32Array((k0+nx*nz)*2);
 positions.set(origPos.array);uv.set(origUv.array);
 const {x,z,w,d}=shape,cx=x+w/2,cz=z+d/2;
 const vtx=(i:number,j:number)=>k0+j*nx+i;
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
  const wx=grid.x0+i*grid.stepX,wz=grid.z0+j*grid.stepZ,v=vtx(i,j);
  positions.set([wx-cx,grid.indexHeight(i,j)+GROUND_LIFT,wz-cz],v*3);
  const [u,vv]=t.uv(wx,wz);uv[v*2]=u;uv[v*2+1]=vv;
 }
 const index:number[]=[];
 const old=(ix:number,iz:number)=>iz*(n+1)+ix;
 // Near-LOD boundaries lie on the province's own vertex grid. Preserve
 // the adjacent faces' old planes, splitting their edges at all new vertices.
 const near=n===SURVEY_LOD;
 const left=near?s.firstX:Math.max(0,Math.floor(s.firstX*n/SURVEY_LOD)-1);
 const right=near?s.firstX+s.cellsX:Math.min(n,Math.ceil((s.firstX+s.cellsX)*n/SURVEY_LOD)+1);
 const top=near?s.firstZ:Math.max(0,Math.floor(s.firstZ*n/SURVEY_LOD)-1);
 const bottom=near?s.firstZ+s.cellsZ:Math.min(n,Math.ceil((s.firstZ+s.cellsZ)*n/SURVEY_LOD)+1);
 function baseTriangle(a:number,b:number,c:number){
  if(near){
   const tri=[a,b,c];
   for(let k=0;k<3;k++){
    const u=tri[k],v=tri[(k+1)%3],tip=tri[(k+2)%3];
    const ax=u%(n+1),az=Math.floor(u/(n+1)),bx=v%(n+1),bz=Math.floor(v/(n+1));
    if((ax===bx&&(ax===left||ax===right)&&az>=top&&az<=bottom&&bz>=top&&bz<=bottom)||
       (az===bz&&(az===top||az===bottom)&&ax>=left&&ax<=right&&bx>=left&&bx<=right)){
     const startX=(ax-left)*s.sub,startZ=(az-top)*s.sub,dx=bx-ax,dz=bz-az;
     for(let h=0;h<s.sub;h++)index.push(vtx(startX+h*dx,startZ+h*dz),vtx(startX+(h+1)*dx,startZ+(h+1)*dz),tip);
     return;
    }
   }
  }
  index.push(a,b,c);
 }
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){
  if(i>=left&&i<right&&j>=top&&j<bottom)continue;
  const a=old(i,j),b=old(i,j+1),c=old(i+1,j+1),d=old(i+1,j);
  // Only cells adjoining the insert can need their triangle edge split.
  if(near&&i>=left-1&&i<=right&&j>=top-1&&j<=bottom){baseTriangle(a,b,d);baseTriangle(b,c,d);}
  else index.push(a,b,d,b,c,d);
 }
 for(let j=0;j<nz-1;j++)for(let i=0;i<nx-1;i++)index.push(vtx(i,j),vtx(i,j+1),vtx(i+1,j),vtx(i,j+1),vtx(i+1,j+1),vtx(i+1,j));
 if(!near){
  // Coarser LODs retain exactly the same surveyed interior. A ring replaces
  // complete old cells, reaching the existing coarse perimeter including any
  // shared tile edge. Zipper strips have no T-junctions or overlapping faces.
  const seq=(lo:number,hi:number,eq:(v:number)=>number)=>Array.from({length:Math.abs(hi-lo)+1},(_,i)=>eq(lo+i*Math.sign(hi-lo)));
  const ring=(outer:number[],inner:number[])=>{
   let i=0,j=0;
   const emit=(a:number,b:number,c:number)=>{const p=positions;
    const y=(p[b*3+2]-p[a*3+2])*(p[c*3]-p[a*3])-(p[b*3]-p[a*3])*(p[c*3+2]-p[a*3+2]);
    if(y>1e-8)index.push(a,b,c);else if(y < -1e-8)index.push(c,b,a);
   };
   while(i+1<outer.length||j+1<inner.length){
    if(j+1>=inner.length||(i+1<outer.length&&(i+1)*(inner.length-1)<=(j+1)*(outer.length-1))){
     emit(outer[i],inner[j],outer[i+1]);i++;
    }else{emit(outer[i],inner[j],inner[j+1]);j++;}
   }
  };
  ring(seq(left,right,i=>old(i,top)),seq(0,nx-1,i=>vtx(i,0)));
  ring(seq(top,bottom,j=>old(right,j)),seq(0,nz-1,j=>vtx(nx-1,j)));
  ring(seq(left,right,i=>old(i,bottom)),seq(0,nx-1,i=>vtx(i,nz-1)));
  ring(seq(top,bottom,j=>old(left,j)),seq(0,nz-1,j=>vtx(0,j)));
 }
 g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
 // Ordinary land keeps the original derivative-based face shading. Only the
 // small measured footprint receives interpolated survey normals.
 const lighting=surveyNormals(grid),normal=new Int16Array((k0+nx*nz)*3),weight=new Uint8Array(k0+nx*nz);
 for(let i=0;i<k0;i++)normal[i*3+1]=32767;
 normal.set(lighting.normals,k0*3);weight.set(lighting.weight,k0);
 g.setAttribute('normal',new THREE.BufferAttribute(normal,3,true));
 g.setAttribute('surveyWeight',new THREE.BufferAttribute(weight,1,true));g.setIndex(index);
}
