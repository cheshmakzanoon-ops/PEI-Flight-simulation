import type { Cover } from '../sim/cover.ts';
import { verifyDecodedCover } from '../sim/cover-proof.ts';
import { NEARSHORE_FOAM_COVER, NEARSHORE_FOAM_REACHES } from './nearshore-foam.ts';

type Eye = Readonly<{x:number;y:number;z:number}>;
/** A conservative trigger around the existing pinned shader domains, not
 * source shoreline, bathymetry or changed 3D geometry. */
export function inNearshoreLocalView(eye:Eye){
 return Number.isFinite(eye.y)&&eye.y>-18&&eye.y<436&&
  NEARSHORE_FOAM_REACHES.some(r=>(eye.x-r.origin[0])**2+(eye.z-r.origin[1])**2<1140**2);
}

export class StandardNearshore {
 private proof:'cold'|'waiting'|'ready'|'stock'='cold';
 private since:number|undefined;
 private gain=0;
 private readonly readCover:()=>Promise<string|undefined>;
 constructor(cover:Cover,readCover=()=>verifyDecodedCover(cover)){this.readCover=readCover;}
 get state(){return {proof:this.proof,gain:this.gain};}
 update(eye:Eye,seconds:number,playing:boolean,retain:boolean){
  if(!retain||!inNearshoreLocalView(eye)||!Number.isFinite(seconds)){
   this.since=undefined;this.gain=0;return 0;
  }
  if(this.proof==='cold'&&playing){
   this.proof='waiting';
   void Promise.resolve().then(this.readCover).then(h=>{
    this.proof=h===NEARSHORE_FOAM_COVER?'ready':'stock';
   },()=>{this.proof='stock';});
  }
  if(this.proof!=='ready')return 0;
  if(this.since===undefined){
   if(!playing)return 0;
   this.since=seconds;
  }
  const a=Math.min(1,Math.max(0,(seconds-this.since)/.42));
  this.gain=a*a*(3-2*a);
  return this.gain;
 }
}
