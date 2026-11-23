import type {BufferGeometry,BufferAttribute} from 'three';

type ReadHeight=(x:number,z:number)=>number|undefined;
const probes=new WeakMap<BufferGeometry,ReadHeight>();
const limit=(x:number,top:number)=>Math.min(top,Math.max(0,x));

/** Index only the actual replacement/ring triangles, in tile-local X/Z.
 * Ordinary grid points keep the old regular height path. The sampler reads
 * live Y attributes so any shared tile-edge sewing remains authoritative. */
export function indexRenderPatchHeight(g:BufferGeometry,regularCount:number){
 const p=g.getAttribute('position') as BufferAttribute,index=g.getIndex();
 if(!index)return;
 const holds:number[]=[];
 let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
 for(let k=0;k<index.count;k+=3){
  const a=index.getX(k),b=index.getX(k+1),c=index.getX(k+2);
  if(Math.max(a,b,c)<regularCount)continue;
  holds.push(k);
  for(const v of [a,b,c]){
   const x=p.getX(v),z=p.getZ(v);left=Math.min(left,x);right=Math.max(right,x);
   top=Math.min(top,z);bottom=Math.max(bottom,z);
  }
 }
 if(!holds.length)return;
 // Small near bins and bounded far bin counts avoid turning a scenery
 // placement query into a ray against all 32k measured triangles.
 const cells=Math.min(76,Math.max(8,Math.ceil(Math.sqrt(holds.length/6))));
 const sizeX=cells/(right-left),sizeZ=cells/(bottom-top);
 const tile=(x:number,z:number)=>[limit(Math.floor((x-left)*sizeX),cells-1),limit(Math.floor((z-top)*sizeZ),cells-1)];
 const counts=new Uint32Array(cells*cells);
 const insert=(seek:number,visit:(i:number)=>void)=>{
  const a=index.getX(seek),b=index.getX(seek+1),c=index.getX(seek+2);
  const x=[p.getX(a),p.getX(b),p.getX(c)],z=[p.getZ(a),p.getZ(b),p.getZ(c)];
  const [sx,sz]=tile(Math.min(...x),Math.min(...z)),[tx,tz]=tile(Math.max(...x),Math.max(...z));
  for(let j=sz;j<=tz;j++)for(let i=sx;i<=tx;i++)visit(j*cells+i);
 };
 for(const k of holds)insert(k,i=>{counts[i]++;});
 const offsets=new Uint32Array(counts.length+1);
 for(let i=0;i<counts.length;i++)offsets[i+1]=offsets[i]+counts[i];
 const values=new Uint32Array(offsets[counts.length]);
 counts.fill(0);
 for(const k of holds)insert(k,i=>{values[offsets[i]+counts[i]++]=k;});
 probes.set(g,(x,z)=>{
  if(x<left||x>right||z<top||z>bottom)return undefined;
  const [i,j]=tile(x,z),id=j*cells+i;
  for(let q=offsets[id];q<offsets[id+1];q++){
   const k=values[q],a=index.getX(k),b=index.getX(k+1),c=index.getX(k+2);
   const ax=p.getX(a),az=p.getZ(a),bx=p.getX(b)-ax,bz=p.getZ(b)-az,cx=p.getX(c)-ax,cz=p.getZ(c)-az;
   const dx=x-ax,dz=z-az,det=bx*cz-bz*cx;if(Math.abs(det)<1e-12)continue;
   const v=(dx*cz-dz*cx)/det,w=(bx*dz-bz*dx)/det;
   if(v< -1e-8||w< -1e-8||v+w>1+1e-8)continue;
   return p.getY(a)*(1-v-w)+p.getY(b)*v+p.getY(c)*w;
  }
 });
}
export function alteredPatchHeight(g:BufferGeometry,x:number,z:number){
 return probes.get(g)?.(x,z);
}
