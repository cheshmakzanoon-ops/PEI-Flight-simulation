import {facet} from './coastal-terrain.ts';

export const PARENT_INTERVALS=112;
export const HRDEM_INTERVALS=384;
export const RELIEF_NODATA=-32768;
const MASK_BYTES=PARENT_INTERVALS**2/8;
const STRIDE=HRDEM_INTERVALS+1;
const RAW_BYTES=MASK_BYTES+STRIDE**2*2;

/** Pair of a guarded parent-cell mask and signed-decimetre 16 m terrain. */
export class ReliefSeed{
 readonly mask:Uint8Array;
 readonly values:Int16Array;
 constructor(buffer:ArrayBuffer,delta=false,cells?:number){
  if(buffer.byteLength!==RAW_BYTES)throw Error('Invalid relief seed length');
  this.mask=new Uint8Array(buffer.slice(0,MASK_BYTES));
  const read=new DataView(buffer,MASK_BYTES);
  const h=this.values=new Int16Array(STRIDE**2);
  for(let j=0;j<STRIDE;j++){
   let value=0;
   for(let i=0;i<STRIDE;i++){
    const k=j*STRIDE+i,raw=read.getInt16(k*2,true);
    value=delta?(value+raw)<<16>>16:raw;h[k]=value;
   }
  }
  if(cells!==undefined){
   let count=0;
   for(let j=0;j<PARENT_INTERVALS;j++)for(let i=0;i<PARENT_INTERVALS;i++)if(this.accepts(i,j)){
    if(i===0||j===0||i===PARENT_INTERVALS-1||j===PARENT_INTERVALS-1)throw Error('Refined cells cannot cross the base seam');
    count++;
   }
   if(count!==cells)throw Error('Relief seed count does not match mask');
  }
 }
 accepts(col:number,row:number){
  if(col<0||row<0||col>=PARENT_INTERVALS||row>=PARENT_INTERVALS)return false;
  const p=row*PARENT_INTERVALS+col;
  return (this.mask[p>>3]&(1<<(p&7)))!==0;
 }
 /** A missing native support value invalidates the interpolation triangle. */
 height(u:number,v:number):number|undefined{
  if(!Number.isFinite(u)||!Number.isFinite(v)||u<0||u>1||v<0||v>1)return;
  const x=u*HRDEM_INTERVALS,z=v*HRDEM_INTERVALS;
  const i=Math.min(HRDEM_INTERVALS-1,Math.floor(x)),j=Math.min(HRDEM_INTERVALS-1,Math.floor(z));
  const k=j*STRIDE+i,a=x-i,b=z-j,h=this.values;
  const nw=h[k],ne=h[k+1],sw=h[k+STRIDE],se=h[k+STRIDE+1];
  if(ne===RELIEF_NODATA||sw===RELIEF_NODATA||(a+b<=1?nw===RELIEF_NODATA:se===RELIEF_NODATA))return;
  return facet(a,b,nw,ne,sw,se)*.1;
 }
}
