import type {CoastalGrid} from '../sim/coastal-terrain.ts';
import {CLIFF_SPLIT} from '../sim/east-cliff.ts';

// Integer space for winding and adjacency: half a promoted grid step.
export const CLIFF_UNITS=2*CLIFF_SPLIT;
interface CliffLayout {
 points:Uint16Array;
 indices:Uint16Array;
 edges?:readonly number[][]; // N, E, S, W, each in increasing X or Z
}
function vertices(g:CoastalGrid){
 const w=(g.nx-1)*CLIFF_UNITS+1;
 const points:number[]=[],lookup=new Map<number,number>();
 const add=(x:number,z:number)=>{
  const key=z*w+x,old=lookup.get(key);if(old!==undefined)return old;
  const id=points.length/2;points.push(x,z);lookup.set(key,id);return id;
 };
 return {add,points,width:w};
}

/** Leave the original mesh alone except for replaced cells and the three
 * precise edge splits where new 4× boundaries meet a retained triangle.
 */
function nearCliff(g:CoastalGrid):CliffLayout{
 const {add,points}=vertices(g),{nx,nz,cliff}=g;
 if(!cliff)throw Error('Missing optional cliff source');
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++)add(i*CLIFF_UNITS,j*CLIFF_UNITS);
 const index:number[]=[];
 const area=(a:number,b:number,c:number)=>(points[b*2+1]-points[a*2+1])*(points[c*2]-points[a*2])-
                                        (points[b*2]-points[a*2])*(points[c*2+1]-points[a*2+1]);
 function strip(a:number,b:number,c:number){
  // A retained face is a single plane; even at a concave mask corner, its
  // convex polygon after edge subdivision is triangulated with no new slope.
  const q=[a,b,c],ring:number[]=[];
  for(let k=0;k<3;k++){
   const l=q[k],r=q[(k+1)%3],lx=points[l*2],lz=points[l*2+1],rx=points[r*2],rz=points[r*2+1];
   ring.push(l);
   const x=Math.min(lx,rx)/CLIFF_UNITS,z=Math.min(lz,rz)/CLIFF_UNITS;
   const split=(lx===rx&&(cliff!.active(x-1,z)||cliff!.active(x,z)))||
               (lz===rz&&(cliff!.active(x,z-1)||cliff!.active(x,z)));
   if(split)for(let s=1;s<CLIFF_SPLIT;s++)ring.push(add(lx+s*(rx-lx)/CLIFF_SPLIT,lz+s*(rz-lz)/CLIFF_SPLIT));
  }
  let rem=area(a,b,c);
  while(ring.length>3){
   let done=false;
   for(let k=0;k<ring.length;k++){
    const a=ring[(k+ring.length-1)%ring.length],b=ring[k],c=ring[(k+1)%ring.length],face=area(a,b,c);
    if(face<=0||face>=rem)continue;  // do not strand a line of collinear points
    index.push(a,b,c);ring.splice(k,1);rem-=face;done=true;break;
   }
   if(!done)throw Error('Cliff splice left an invalid transition face');
  }
  index.push(ring[0],ring[1],ring[2]);
 }
 for(let j=0;j<nz-1;j++)for(let i=0;i<nx-1;i++){
  const a=j*nx+i,b=a+nx,c=b+1,d=a+1;
  if(!cliff.active(i,j)){strip(a,b,d);strip(b,c,d);continue;}
  const x=i*CLIFF_UNITS,z=j*CLIFF_UNITS;
  for(let l=0;l<CLIFF_UNITS;l+=2)for(let k=0;k<CLIFF_UNITS;k+=2){
   const a=add(x+k,z+l),b=add(x+k,z+l+2),c=add(x+k+2,z+l+2),d=add(x+k+2,z+l);
   index.push(a,b,d,b,c,d);
  }
 }
 return finish(points,index);
}
function finish(points:number[],index:number[]|Uint16Array,edges?:CliffLayout['edges']):CliffLayout{
 if(points.length/2>=65535)throw Error('East Point terrain vertex budget exceeded');
 return {points:Uint16Array.from(points),indices:index instanceof Uint16Array?index:Uint16Array.from(index),edges};
}

const cached=new WeakMap<CoastalGrid,CliffLayout>();
/** Decoder of the loss-bounded, continuous full-patch triangle plan. Only
 * touched positions exist. Dense offline reference samples never enter RAM.
 */
function distantCliff(g:CoastalGrid):CliffLayout {
 const old=cached.get(g);if(old)return old;
 const {nx,nz,cliff}=g;if(!cliff)throw Error('Missing optional cliff source');
 const {stream,triangles,bits}=cliff.source,{add,points,width:w}=vertices(g);
 const step=g.spec.sub*CLIFF_UNITS,depthLimit=2*Math.log2(g.spec.sub*CLIFF_SPLIT)+1;
 const index=new Uint16Array(triangles*3),flags=new Map<number,boolean>();let p=0,cursor=0;
 function emit(a:number,b:number,c:number,depth:number){
  const mid=(a+b)/2;
  if(depth<depthLimit){
   let split=flags.get(mid);
   if(split===undefined){split=!!(stream[p>>3]&(1<<(p&7)));flags.set(mid,split);p++;}
   if(split){emit(c,a,mid,depth+1);emit(b,c,mid,depth+1);return;}
  }
  for(const pos of [a,b,c])index[cursor++]=add(pos%w,Math.floor(pos/w));
 }
 const w1=(nx-1)*CLIFF_UNITS,z1=(nz-1)*CLIFF_UNITS;
 for(let z=0;z<z1;z+=step)for(let x=0;x<w1;x+=step){
  const a=z*w+x,b=a+step*w,c=b+step,d=a+step;
  emit(b,d,a,0);emit(d,b,c,0);
 }
 if(p!==bits||cursor!==index.length)throw Error('Invalid distant East Point topology');
 const edges:number[][]=[[],[],[],[]];
 for(let i=0;i<points.length/2;i++){
  const x=points[2*i],z=points[2*i+1];
  if(z===0)edges[0].push(i);if(x===w1)edges[1].push(i);if(z===z1)edges[2].push(i);if(x===0)edges[3].push(i);
 }
 for(let side=0;side<4;side++)edges[side].sort((a,b)=>points[2*a+side%2]-points[2*b+side%2]);
 const result=finish(points,index,edges);cached.set(g,result);return result;
}
export function cliffLayout(g:CoastalGrid,near:boolean){return near?nearCliff(g):distantCliff(g);}
