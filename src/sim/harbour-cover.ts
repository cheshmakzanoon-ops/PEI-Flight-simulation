import {QUARTERMASTER} from './quartermaster.generated.ts';
import {readCoastalPack} from './coastal-packs.ts';

/** One ODbL replacement contour. It can expose old land as water but cannot
 * make any previously navigable water look like land. No water height is baked. */
export class HarbourCover {
 readonly plan=QUARTERMASTER;
 readonly bytes:Uint8Array;
 constructor(bytes:Uint8Array){
  if(bytes.byteLength!==QUARTERMASTER.decodedBytes)throw Error('Invalid harbor cover dimensions');
  this.bytes=bytes;
 }
 intersects(x0:number,z0:number,x1:number,z1:number){
  const [l,t,r,b]=this.plan.boundsXZ;return x1>=l&&z1>=t&&x0<=r&&z0<=b;
 }
 distance(old:number,x:number,z:number){
  const {boundsXZ:[l,t,r,b],width:w,height:h}=this.plan;
  if(x<=l||z<=t||x>=r||z>=b)return old;
  const u=(x-l)/(r-l)*(w-1),v=(z-t)/(b-t)*(h-1),i=Math.floor(u),j=Math.floor(v),a=u-i,f=v-j;
  const k=(j*w+i)*2;
  const sample=(offset:number)=>{
   const n=k+offset;
   return (1-f)*(this.bytes[n]*(1-a)+this.bytes[n+2]*a)+f*(this.bytes[n+2*w]*(1-a)+this.bytes[n+2*w+2]*a);
  };
  const weight=sample(1)/255;if(!weight)return old;
  return old+weight*(Math.min(old,(sample(0)-128)*.25)-old);
 }
}
export function loadHarbourCover(base:string,fetcher:typeof fetch=fetch,timeoutMs=1600){
 return readCoastalPack(base+QUARTERMASTER.asset,fetcher,timeoutMs,QUARTERMASTER,b=>new HarbourCover(new Uint8Array(b)));
}
