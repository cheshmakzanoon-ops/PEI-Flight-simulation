import type {CoastalGrid} from '../sim/coastal-terrain.ts';

const cache=new WeakMap<CoastalGrid,{normals:Int16Array;weight:Uint8Array}>();
/** Per-vertex lighting from the measured slope, independent of the chosen triangle diagonal.
 * The footprint transform only weights lighting. It never places geometry or classifies land.
 */
export function surveyNormals(g:CoastalGrid){
 const old=cache.get(g);if(old)return old;
 const {nx,nz,stepX,stepZ,spec}=g,normals=new Int16Array(nx*nz*3),weight=new Uint8Array(nx*nz);
 const at=(i:number,j:number)=>g.indexHeight(Math.max(0,Math.min(nx-1,i)),Math.max(0,Math.min(nz-1,j)));
 const native=(u:number,v:number,axis:number)=>{
  const c=spec.nativeCorners;return (c[0][axis]*(1-u)+c[1][axis]*u)*(1-v)+(c[2][axis]*(1-u)+c[3][axis]*u)*v;
 };
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
  // 3×3 Sobel: centered 6.5–6.8 m span with 1:2:1 cross-axis filtering.
  // Meter-aware gradients preserve the large headland faces without making
  // the old coarse terrain, or the survey's regular triangle diagonal, glossy.
  const sx=(at(i+1,j-1)+2*at(i+1,j)+at(i+1,j+1)-at(i-1,j-1)-2*at(i-1,j)-at(i-1,j+1))/(8*stepX);
  const sz=(at(i-1,j+1)+2*at(i,j+1)+at(i+1,j+1)-at(i-1,j-1)-2*at(i,j-1)-at(i+1,j-1))/(8*stepZ);
  const k=j*nx+i,f=32767/Math.hypot(sx,1,sz);
  normals[k*3]=Math.round(-sx*f);normals[k*3+1]=Math.round(f);normals[k*3+2]=Math.round(-sz*f);
  const u=i/(nx-1),v=j/(nz-1),a=native(u,v,0),b=native(u,v,1);
  const edge=Math.min(a,b,spec.nativeShape[0]-1-a,spec.nativeShape[1]-1-b);
  // Zero 8 m outside measured cells and full strength 6 m inside them.
  const blend=Math.min(1,Math.max(0,(edge+8)/14));weight[k]=Math.round(255*blend*blend*(3-2*blend));
 }
 const result={normals,weight};cache.set(g,result);return result;
}
