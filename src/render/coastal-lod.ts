import type { CoastalGrid } from '../sim/coastal-terrain.ts';
import { DISTANT_COAST } from './coastal-lod.generated.ts';

export interface SurveyLayout {
 /** Native fine-grid coordinates in half-steps; both coordinates odd only where diagonals cross. */
 points: Uint16Array;
 indices: Uint16Array;
 edgeVertex(i:number,j:number):number;
}
function perimeterLookup(nx:number,nz:number,edge:Uint16Array){
 return (i:number,j:number)=>{
  if(j===0)return edge[i];if(j===nz-1)return edge[nx+i];
  if(i===0)return edge[2*nx+j];if(i===nx-1)return edge[2*nx+nz+j];
  throw Error('Only outer vertices are shared with the terrain transition ring');
 };
}
const cached=new WeakMap<CoastalGrid,SurveyLayout>();
/** Rebuild the versioned binary triangle tree. Each bit, LSB first, requests a
 * split of A–B on the first visit to its shared midpoint; the children are (C,A,midpoint) then (B,C,midpoint). This
 * preserves all fine exterior vertices and both faces of every interior edge.
 */
export function distantCoast(g:CoastalGrid):SurveyLayout{
 const old=cached.get(g);if(old)return old;
 const {nx,nz,spec}=g;
 if(spec.id!=='east-point'&&spec.id!=='west-point')throw Error('Unregistered coastal layout');
 const plan=DISTANT_COAST[spec.id],W=2*nx-1;
 if(plan.nx!==nx||plan.nz!==nz||plan.sha256!==spec.sha256)throw Error('Distant topology does not match the measured terrain');
 const bits=atob(plan.stream),index=new Uint16Array(3*plan.triangles),lookup=new Int32Array(W*(2*nz-1));lookup.fill(-1);
 const points:number[]=[],decided=new Uint8Array(lookup.length);let bit=0,used=0;
 function vertex(k:number){
  const v=lookup[k];if(v>=0)return v;
  const n=points.length/2;lookup[k]=n;points.push(k%W,Math.floor(k/W));return n;
 }
 function emit(a:number,b:number,c:number,depth:number){
  const m=(a+b)/2;
  if(depth<9){
   let q=decided[m];
   if(!q){const k=bit++;q=decided[m]=1+((bits.charCodeAt(k>>3)>>(k&7))&1);}
   if(q===2){emit(c,a,m,depth+1);emit(b,c,m,depth+1);return;}
  }
  index[used++]=vertex(a);index[used++]=vertex(b);index[used++]=vertex(c);
 }
 const at=(x:number,z:number)=>2*(z*W+x);
 for(let j=0;j<nz-1;j+=spec.sub)for(let i=0;i<nx-1;i+=spec.sub){
  const a=at(i,j),b=at(i,j+spec.sub),c=at(i+spec.sub,j+spec.sub),d=at(i+spec.sub,j);
  emit(b,d,a,0);emit(d,b,c,0);
 }
 if(bit!==plan.bits||used!==index.length||points.length/2>=65535)throw Error('Invalid distant terrain topology');
 // The transition ring only needs the perimeter lookup after construction.
 // Do not retain a ~300 kB scratch table for each site between tile LODs.
 const edge=new Uint16Array(2*(nx+nz));
 for(let i=0;i<nx;i++){edge[i]=lookup[at(i,0)];edge[nx+i]=lookup[at(i,nz-1)];}
 for(let j=0;j<nz;j++){edge[2*nx+j]=lookup[at(0,j)];edge[2*nx+nz+j]=lookup[at(nx-1,j)];}
 const result={points:Uint16Array.from(points),indices:index,edgeVertex:perimeterLookup(nx,nz,edge)};
 cached.set(g,result);return result;
}
