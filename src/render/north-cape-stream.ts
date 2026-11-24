/** Ordinary mode stages the existing local art; explicit mode keeps the old light treatment. */
export function northCapeMode(q:URLSearchParams):'stock'|'explicit'|'ordinary'{
 if(q.has('stockNorthCapeWind'))return 'stock';
 if(q.has('northCapeWind'))return 'explicit';
 return q.get('scenery')==='detail'||['surveyRelief','inlandRelief','buildingShadows'].some(k=>q.has(k))?'stock':'ordinary';
}
export const NORTH_CAPE_TERRAIN_SHA='661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d';
export const NORTH_CAPE_COVER_DECODED_SHA='e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9';
export const NORTH_CAPE_COVER_SHA='46a4f4736a885576fa0529cd0f91bacdbfd47e3bfd719130ba3446c52c245863';
const reviewedExtent=[-64.47,45.94,-61.93,47.10] as const;
export function northCapeAtlas(terrain:{sha:string;width:number;height:number;bounds:readonly number[]},cover:{sourceSha?:string;width:number;height:number}){
 return terrain.sha===NORTH_CAPE_TERRAIN_SHA&&cover.sourceSha===NORTH_CAPE_COVER_SHA&&
  terrain.width===4096&&terrain.height===2720&&cover.width===4096&&cover.height===2720&&
  terrain.bounds.length===4&&reviewedExtent.every((v,i)=>v===terrain.bounds[i]);
}
const ENTER=8500,LEAVE=9300;
export type CapeEye=Readonly<{x:number;y:number;z:number}>;
export type CapeArt<C extends CapeEye>={
 update(eye:C,time:number):void;
 dispose():void;
};
/** Horizontal hysteresis provides prefetch time without fetching from distant departures.
 * Late callbacks install data only; scene ownership changes on the next eligible frame. */
export class NorthCapeStream<A extends CapeArt<C>,C extends CapeEye>{
 private phase:'idle'|'pending'|'ready'|'unavailable'='idle';
 private armed=false;
 private make:(()=>A)|undefined;
 art:A|undefined;
 private readonly x:number;private readonly z:number;private readonly span:number;
 private readonly load:()=>Promise<(()=>A)|undefined>;
 constructor(x:number,z:number,span:number,load:()=>Promise<(()=>A)|undefined>){
  this.x=x;this.z=z;this.span=span;this.load=load;
 }
 update(eye:C,time:number){
  const {x,y,z}=eye;
  // Transient offscreen or non-finite frames cannot create or retain a scene lease.
  const dx=x-this.x,dz=z-this.z;
  this.armed=Number.isFinite(y)&&Number.isFinite(time)&&dx*dx+dz*dz<=(this.span+(this.armed?LEAVE:ENTER))**2;
  if(!this.armed){
   this.art?.dispose();this.art=undefined;return;
  }
  if(this.phase==='idle'){
   this.phase='pending';
   void Promise.resolve().then(this.load).then(make=>{
    this.make=make;this.phase=make?'ready':'unavailable';
   },()=>{this.phase='unavailable';});
  }
  if(this.phase==='ready'&&!this.art){
   try{this.art=this.make?.();}catch{this.phase='unavailable';}
  }
  this.art?.update(eye,time);
 }
}
