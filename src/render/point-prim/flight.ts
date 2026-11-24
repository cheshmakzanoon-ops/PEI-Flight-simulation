import type {Vector3} from 'three';
import type {World} from '../world.ts';
import type {Buildings,PointPrimDrawLease,PointPrimVerifiedOwner} from '../buildings.ts';
import {verifyDecodedCover} from '../../sim/cover-proof.ts';
import {POINT_PRIM,pointPrimNear,type PointPrimStock} from './admit.ts';
import {POINT_PRIM_GRADE} from './stamp.ts';
import {pointPrimDeadline,preparePointPrimAssets,type PointPrimAssets} from './assets.ts';

type Eye=Pick<Vector3,'x'|'y'|'z'>;
type FlightPosition={x:number;y:number;z:number};
type DataPhase='idle'|'loading'|'ready'|'failed';
/** Per-session preparation can only fill a data slot. Install and rollback
 * the owner and collider together on frame boundaries, never in callbacks. */
export class PointPrimFlight {
 private readonly world:World;
 private readonly base:string;
 private layers:'pending'|'verified'|'changed'='pending';
 private stock?:PointPrimStock;
 private verified?:PointPrimVerifiedOwner;
 private ownerPhase:'idle'|'checking'|'verified'|'failed'='idle';
 private dataPhase:DataPhase='idle';
 private assets?:PointPrimAssets;
 private draw?:PointPrimDrawLease;
 private live=false;
 private requests=0;
 private deferredClearance=false;
 constructor(world:World,base:string){this.world=world;this.base=base;}
 qualifyLayers(ok:boolean){if(this.layers==='pending')this.layers=ok?'verified':'changed';}
 get active(){
  return this.live&&this.draw?.active()===true&&this.draw.present()&&
   this.world.groundGradeInstalled(POINT_PRIM_GRADE.id);
 }
 get state(){return {layers:this.layers,owner:this.ownerPhase,data:this.dataPhase,requests:this.requests,
  active:this.active,deferredClearance:this.deferredClearance,grade:this.world.groundGradeInstalled(POINT_PRIM_GRADE.id),draw:this.draw?.active()===true};}
 /** Called before dispatch starts a different location and before a flight step
  * if range or identity no longer holds. No contact changes while data loads. */
 clear(){
  if(!this.live&&!this.world.groundGradeInstalled(POINT_PRIM_GRADE.id)&&!this.draw?.active())return;
  this.draw?.set(false);this.world.setPointPrimGround(false);this.live=false;
 }
 private replaceStock(stock:PointPrimStock|undefined){
  this.clear();this.draw?.release();this.draw=undefined;
  this.stock=stock;this.verified=undefined;this.ownerPhase='idle';
 }
 private authenticate(b:Buildings,stock:PointPrimStock){
  this.ownerPhase='checking';
  void pointPrimDeadline(Promise.all([b.verifyPointPrim(stock),verifyDecodedCover(this.world.cover)]))
   .then(q=>{
    if(this.stock!==stock)return;
    if(q?.[0]?.present()&&q[1]===POINT_PRIM.coverDecoded){this.verified=q[0];this.ownerPhase='verified';}
    else this.ownerPhase='failed';
   });
 }
 private load(){
  this.dataPhase='loading';this.requests++;
  void preparePointPrimAssets(this.world.terrain,this.base).then(asset=>{
   if(asset){this.assets=asset;this.dataPhase='ready';}else this.dataPhase='failed';
  });
 }
 before(b:Buildings|undefined,p:FlightPosition,eye:Eye,canStart:boolean,retain:boolean){
  this.deferredClearance=false;
  const q=b?.pointPrimSource;
  if(q!==this.stock)this.replaceStock(q);
  const near=retain&&pointPrimNear(p.x,p.y,p.z,eye,this.active);
  if(!near||this.layers!=='verified'||!q||!b){this.clear();return;}
  if(this.ownerPhase==='idle'&&canStart){this.authenticate(b,q);return;}
  if(!this.verified?.present()||(!this.live&&!canStart)){this.clear();return;}
  if(!this.assets){if(this.dataPhase==='idle'&&canStart)this.load();return;}
  if(this.active)return; // Stable per-frame lease; no repeated hash or geometry work.
  // Starting the study must not raise ground through a low/fallen aircraft.
  // Check the actual moved-face envelope enlarged for the aircraft and allow
  // it to start later over open air. Once committed it stays seated on descent.
  const {x,y,z}=p;
  if(y<POINT_PRIM.datum+10&&this.assets.grade.affectsBounds([x-12,z-12,x+12,z+12])){
   this.deferredClearance=true;this.clear();return;
  }
  this.draw??=this.verified.mount(this.assets.group);
  if(!this.draw?.present()||!this.world.stagePointPrimNear(this.assets.grade)){
   this.clear();return;
  }
  // Every observer after this call sees both states or neither. An owner
  // refusal rolls back the tentative patch before the caller can step.
  if(this.world.setPointPrimGround(true)&&this.draw.set(true)){this.live=true;return;}
  this.clear();
 }
 after(p:FlightPosition,eye:Eye,retain:boolean){
  // Physics may advance the vehicle and World/Buildings may evict the owner.
  // This second gate only withdraws; first activation is always pre-physics.
  if(this.live&&(!retain||!this.active||!pointPrimNear(p.x,p.y,p.z,eye,true)))this.clear();
 }
}
