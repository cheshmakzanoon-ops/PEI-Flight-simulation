import { readCoastalPack } from './coastal-packs.ts';
import { clamp,project } from './geo.ts';
import { BAYWALK_COURT as spec } from './baywalk-native.generated.ts';

export interface BaywalkCourtData {
 readonly shore:Uint8Array;
 readonly y:Int16Array;
}
export function loadBaywalkCourt(base:string,fetcher:typeof fetch=fetch,ms=2100){
 return readCoastalPack<BaywalkCourtData>(base+spec.asset,fetcher,ms,spec,b=>{
  const dv=new DataView(b),size=spec.width*spec.height;
  if(dv.getUint32(0,true)!==0x54434e42||dv.getUint32(4,true)!==1||dv.getUint32(8,true)!==spec.width||
    dv.getUint32(12,true)!==spec.height||dv.getUint32(16,true)!==0||20+size*3!==b.byteLength)throw Error('Invalid north Baywalk court format');
  const shore=new Uint8Array(b,20,size),y=new Int16Array(size);
  for(let j=0;j<spec.height;j++)for(let i=0;i<spec.width;i++){
   const k=j*spec.width+i,h=dv.getInt16(20+size+2*k,true);
   if(h<-230||h>1200||(i===0||j===0||i===spec.width-1||j===spec.height-1)&&shore[k]!==0)
    throw Error('North Baywalk field exceeds its registered bounds');
   y[k]=h;
  }
  return {shore,y};
 });
}
export const BAYWALK_ANCHOR=project(...spec.anchor);
const [a,b,c,d]=spec.xz;
export class BaywalkNative {
 readonly bounds:readonly [number,number,number,number]=[BAYWALK_ANCHOR.x+a,BAYWALK_ANCHOR.z+b,BAYWALK_ANCHOR.x+c,BAYWALK_ANCHOR.z+d];
 readonly width=spec.width;readonly height=spec.height;readonly step=spec.step;
 readonly x0=this.bounds[0];readonly z0=this.bounds[1];readonly x1=this.bounds[2];readonly z1=this.bounds[3];
 readonly data:BaywalkCourtData;constructor(data:BaywalkCourtData){this.data=data;}
 intersects(x0:number,z0:number,x1:number,z1:number){return x0<this.x1&&x1>this.x0&&z0<this.z1&&z1>this.z0;}
 inside(x:number,z:number){return x>this.x0&&x<this.x1&&z>this.z0&&z<this.z1;}
 sample(array:Uint8Array|Int16Array,x:number,z:number){
  const u=clamp((x-this.x0)/this.step,0,this.width-1),v=clamp((z-this.z0)/this.step,0,this.height-1);
  const i=Math.min(this.width-2,Math.floor(u)),j=Math.min(this.height-2,Math.floor(v)),k=j*this.width+i,fx=u-i,fz=v-j;
  return (1-fz)*(array[k]*(1-fx)+array[k+1]*fx)+fz*(array[k+this.width]*(1-fx)+array[k+this.width+1]*fx);
 }
 signed(x:number,z:number){
  return this.inside(x,z)?(this.sample(this.data.shore,x,z)-128)*spec.shoreQuantum:-1;
 }
 heightM(x:number,z:number){return this.sample(this.data.y,x,z)*.01;}
 restored(prior:number,x:number,z:number){return prior<0&&this.signed(x,z)>0;}
 /** The candidate cannot create new water or alter an already positive
  * stock field. Keep old dry material/road/planting rules away from the court. */
 distance(prior:number,x:number,z:number){
  if(prior>=0||!this.inside(x,z))return prior;
  const v=this.signed(x,z);
  return v>0?v:prior;
 }
}
export function supportedBaywalkCourt(coverSha:string|undefined,terrainSha:string|undefined,decodedCover:string|undefined){
 return coverSha===spec.pinCoverSha&&terrainSha===spec.pinTerrainSha&&decodedCover===BAYWALK_COVER_DECODED_SHA;
}

// This exact decoded NRN network and the surveyed atlas are jointly required.
export const BAYWALK_ROAD_SHA='72528a1b26b68ee345e5047f30f2c9b49a3c18edeaccaf3e759ead296d3276c1';
export const BAYWALK_ROAD_ORDINAL=2803,BAYWALK_ROAD_FLAGS=9;
export const BAYWALK_COVER_DECODED_SHA='e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9';
