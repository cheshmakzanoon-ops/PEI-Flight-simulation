import {facet,type CoastalGrid} from '../sim/coastal-terrain.ts';
import type {SurveyLayout} from './coastal-lod.ts';

type Point=readonly [number,number];
type Triangle=readonly [Point,Point,Point];
const cache=new WeakMap<CoastalGrid,Map<number,SurveyLayout>>();

/** The render-only middle-distance bridgehead simplifies the flat interior and retains
 * every sharp measured grade and exact exterior vertex; near contact is untouched. */
export function montagueSurveyLod(grid:CoastalGrid,n:number):SurveyLayout|undefined{
 const {nx,nz,spec}=grid;
 if(spec.id!=='montague-bridgehead-dry-preview'||nx!==129||nz!==129||n!==56)return;
 let variants=cache.get(grid);
 if(!variants){variants=new Map();cache.set(grid,variants);}
 const saved=variants.get(n);if(saved)return saved;
 const step=4;
 const cols=(nx-1)/step,rows=(nz-1)/step;
 const dense=new Uint8Array(cols*rows);
 const p:number[]=[],triangles:number[]=[];
 const known=new Int32Array(nx*nz);known.fill(-1);
 const index=(i:number,j:number)=>{
  const key=j*nx+i,old=known[key];if(old>=0)return old;
  const next=p.length/2;p.push(2*i,2*j);known[key]=next;return next;
 };
 const height=(p:Point)=>grid.indexHeight(...p);
 const threshold=.50;
 const isDense=(x:number,z:number)=>x>=0&&x<cols&&z>=0&&z<rows&&dense[z*cols+x]!==0;
 const edge=(detail:boolean)=>detail?Array.from({length:step},(_,i)=>i):[0];
 function piece(cx:number,cz:number):Triangle[]{
  const i=cx*step,j=cz*step,x=i+step,z=j+step;
  const western=cx===0||isDense(cx-1,cz),eastern=cx===cols-1||isDense(cx+1,cz);
  const northern=cz===0||isDense(cx,cz-1),southern=cz===rows-1||isDense(cx,cz+1);
  if(!western&&!eastern&&!northern&&!southern)return [[[i,j],[i,z],[x,j]],[[i,z],[x,z],[x,j]]];
  // Exterior and any dense neighbour keep the shared original fine vertices.
  const around:Point[]=[
   ...edge(western).map(a=>[i,j+a] as const),
   ...edge(southern).map(a=>[i+a,z] as const),
   ...edge(eastern).map(a=>[x,z-a] as const),
   ...edge(northern).map(a=>[x-a,j] as const),
  ];
  const centre=[i+step/2,j+step/2] as const;
  return around.map((a,j)=>[a,around[(j+1)%around.length],centre]);
 }
 function differs(pieces:Triangle[]){
  for(const tri of pieces){
   const [a,b,c]=tri,dx=b[0]-a[0],dz=b[1]-a[1],du=c[0]-a[0],dv=c[1]-a[1],det=dx*dv-dz*du;
   const y0=height(a),yu=height(b)-y0,yv=height(c)-y0;
   for(let j=Math.min(a[1],b[1],c[1]);j<=Math.max(a[1],b[1],c[1]);j+=.5)
   for(let i=Math.min(a[0],b[0],c[0]);i<=Math.max(a[0],b[0],c[0]);i+=.5){
    const s=((i-a[0])*dv-(j-a[1])*du)/det,t=(dx*(j-a[1])-dz*(i-a[0]))/det;
    if(s<0||t<0||s+t>1)continue;
    const gi=Math.min(nx-2,Math.floor(i)),gj=Math.min(nz-2,Math.floor(j));
    const h=facet(i-gi,j-gj,grid.indexHeight(gi,gj),grid.indexHeight(gi+1,gj),
     grid.indexHeight(gi,gj+1),grid.indexHeight(gi+1,gj+1));
    if(Math.abs(y0+s*yu+t*yv-h)>threshold)return true;
   }
  }
  return false;
 }
 {
  // Promote a whole cell if modifying it would flatten a measured bridgehead.
  // Reconsider neighbours when their stitch template changes, not every tile.
  const pending:number[]=Array.from({length:cols*rows},(_,i)=>i),queued=new Uint8Array(cols*rows);
  queued.fill(1);
  for(let q=0;q<pending.length;q++){
   const id=pending[q],x=id%cols,z=Math.floor(id/cols);queued[id]=0;
   if(dense[id]||!differs(piece(x,z)))continue;
   dense[id]=1;
   for(const [a,b] of [[x-1,z],[x+1,z],[x,z-1],[x,z+1]]){
    if(a<0||a>=cols||b<0||b>=rows)continue;
    const k=b*cols+a;
    if(!dense[k]&&!queued[k]){queued[k]=1;pending.push(k);}
   }
  }
 }
 for(let z=0;z<rows;z++)for(let x=0;x<cols;x++){
  if(isDense(x,z)){
   const x0=x*step,z0=z*step;
   for(let j=z0;j<z0+step;j++)for(let i=x0;i<x0+step;i++){
    const a=index(i,j),b=index(i,j+1),c=index(i+1,j+1),d=index(i+1,j);
    triangles.push(a,b,d,b,c,d);
   }
  }else for(const [a,b,c] of piece(x,z))triangles.push(index(...a),index(...b),index(...c));
 }
 const lookup=new Uint16Array(2*(nx+nz));
 for(let i=0;i<nx;i++){lookup[i]=known[i];lookup[nx+i]=known[(nz-1)*nx+i];}
 for(let j=0;j<nz;j++){lookup[2*nx+j]=known[j*nx];lookup[2*nx+nz+j]=known[j*nx+nx-1];}
 const result:SurveyLayout={points:Uint16Array.from(p),indices:Uint16Array.from(triangles),edgeVertex:(i,j)=>{
  if(j===0)return lookup[i];if(j===nz-1)return lookup[nx+i];
  if(i===0)return lookup[2*nx+j];if(i===nx-1)return lookup[2*nx+nz+j];
  throw Error('Bridgehead LOD only shares its outer perimeter');
 }};
 variants.set(n,result);return result;
}
