import type {Vector3} from 'three';
import type {World} from '../world.ts';
import {gradeAtlasMatches,loadBoundedGrade,type BoundedGrade} from '../../sim/bounded-grade.ts';
import {RUSTICO_GRADE} from '../../sim/rustico-grade.generated.ts';
import {verifyDecodedCover} from '../../sim/cover-proof.ts';
import type {createRusticoExterior} from './mount.ts';
import {standardLandAtlasMatches} from '../meadow-standard.ts';
import {CANOPY_FENCE} from '../canopy-fence.generated.ts';

export const RUSTICO_LIGHT_ROUTE='north-rustico-harbour-low';
export function standardRusticoLayers(roads:string|undefined,buildings:string|undefined,walk:string|undefined,parking:string|undefined){
 const p=CANOPY_FENCE.pins;
 return roads===p.road&&buildings===p.buildings&&walk===p.sidewalk&&parking===p.parking;
}

type SitePosition={x:number;y:number;z:number};
type Assembly=ReturnType<typeof createRusticoExterior>;
type Display=ReturnType<Assembly>;
type Prepared={ground:BoundedGrade;assembly:Assembly};
const x0=-7072.27,z0=4946.31;
const inRange=(p:SitePosition)=>[p.x,p.y,p.z].every(Number.isFinite)&&
 Math.hypot(p.x-x0,p.z-z0)<=2600&&p.y<510;

async function within<T>(p:Promise<T>,ms=4500):Promise<T|undefined>{
 let token:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([p,new Promise<undefined>(resolve=>{token=setTimeout(resolve,ms);})]);}
 catch{return undefined;}
 finally{if(token!==undefined)clearTimeout(token);}
}
/** The native seat and exterior always change together before contact queries.
 * Asset completion only arms a data slot; it never touches the live scene. */
export class RusticoStandardFlight {
 private assets?:Prepared;
 private display?:Display;
 private phase:'idle'|'loading'|'ready'|'held'='idle';
 private layers:'pending'|'verified'|'held'='pending';
 private live=false;
 private loadCount=0;
 private routeNear=false;
 private departureStart?:readonly [number,number];
 private missedWindow=false;
 private readonly world:World;
 private readonly base:string;
 private readonly terrainSha:string;
 constructor(world:World,base:string,terrainSha:string){
  this.world=world;this.base=base;this.terrainSha=terrainSha;
 }
 qualifyLayers(ok:boolean){if(this.layers==='pending')this.layers=ok?'verified':'held';}
 get state(){return {phase:this.phase,layers:this.layers,requests:this.loadCount,deferredByProgress:this.missedWindow,seat:this.display?.state.seat??'not near',
  visible:this.live&&this.display?.state.visible===true&&this.world.standardRusticoGroundActive()};}
 clear(){
  this.routeNear=false;this.departureStart=undefined;this.missedWindow=false;this.unmount();
 }
 private unmount(){
  this.display?.hide();
  this.world.dropStandardRusticoGround();
  this.live=false;
 }
 private prepare(){
  const {terrain,cover}=this.world;
  if(!standardLandAtlasMatches(terrain,this.terrainSha,cover)){
   this.phase='held';return;
  }
  this.phase='loading';
  void (async()=>{
   const decoded=await within(verifyDecodedCover(cover),2400);
   if(!this.routeNear){this.phase='idle';return;}
   if(!gradeAtlasMatches(RUSTICO_GRADE,this.terrainSha,cover.sourceSha,decoded)){
    this.phase='held';return;
   }
   this.loadCount++;
   const q=await within(Promise.all([loadBoundedGrade(RUSTICO_GRADE,this.base),import('./mount.ts')]));
   if(!q?.[0]){this.phase='held';return;}
   // Generated meshes and paint atlases are prepared off-scene, not from
   // the first frame that needs to change the contact sampler.
   await new Promise<void>(resolve=>typeof requestIdleCallback==='function'?
    requestIdleCallback(()=>resolve(),{timeout:900}):setTimeout(resolve,0));
   if(!this.routeNear){this.phase='idle';return;}
   try{
    const ground=q[0](terrain,(x,z)=>terrain.atlasElevation(x,z));
    if(!ground||!q[1].prototypeRusticoFit(ground,terrain,cover)){this.phase='held';return;}
    this.assets={ground,assembly:q[1].createRusticoExterior(ground)};
    this.phase='ready';
   }catch{this.phase='held';}
  })();
 }
 before(selected:boolean,retain:boolean,playing:boolean,dispatch:boolean,p:SitePosition,eye:Vector3){
  if(!selected||!inRange(p)){this.clear();return;}
  this.routeNear=true;
  if(dispatch||playing)this.departureStart??=[p.x,p.z];
  // If a slow optional fetch misses the approach, don't swap the landmark
  // into an already-underway close pass. Keep the ready bytes for a restart.
  if(playing&&!this.live&&this.departureStart&&
    Math.hypot(p.x-this.departureStart[0],p.z-this.departureStart[1])>220)this.missedWindow=true;
  if(this.layers!=='verified'){
   if(this.layers==='held')this.phase='held';
   this.unmount();return;
  }
  if(this.phase==='idle'&&(dispatch||playing))this.prepare();
  if(!retain||!this.assets){this.unmount();return;}
  if(this.live){
   if(!this.state.visible)this.unmount();
   return;
  }
  if(!playing||this.missedWindow||!inRange(eye))return;
  // Never raise a measured grade through a nearby low aircraft.
  if(p.y<21&&this.assets.ground.affectsBounds([p.x-12,p.z-12,p.x+12,p.z+12]))return;
  try{
   if(!this.world.stageStandardRusticoNear(this.assets.ground))return;
   this.display??=this.assets.assembly(this.world.scene,this.world);
   if(!this.world.setStandardRusticoGround(true)){this.unmount();return;}
   this.display.update(eye);
   if(!this.display.state.visible){this.unmount();return;}
   this.live=true;
  }catch{this.unmount();this.phase='held';this.assets=undefined;}
 }
 after(selected:boolean,retain:boolean,eye:Vector3){
  if(!this.live)return;
  if(!selected||!retain||!inRange(eye)||!this.world.standardRusticoGroundActive()){this.unmount();return;}
  this.display?.update(eye);
  if(!this.display?.state.visible)this.unmount();
 }
}
