import * as T from 'three';
import {MarshPatch,type MarshRoot} from './marsh-patch.ts';
import type {MarshStream} from '../marsh-stream.ts';
import type {World} from '../world.ts';
import type {MarshRootField} from '../marsh-root-field.ts';

const MAX_SRC=108,SAMPLE_STEP=9,MAX_AGL=88;
type Owner={id:string;field:MarshRootField;patch:MarshPatch;origin:T.Vector3};
export class LiveMarshFoliage{
 private owner?:Owner;
 private x=Infinity;
 private z=Infinity;
 private stamp='';
 private wasGround=-1;
 private readonly bounds=[0,0,0,0] as [number,number,number,number];
 constructor(private scene:T.Scene,private world:World,private source:MarshStream,private msaa:boolean,private keepSceneAlpha=false){}
 private release(){
  this.owner?.patch.dispose();this.owner=undefined;
  this.x=this.z=Infinity;this.stamp='';
 }
 private groundSafe(x:number,z:number,r:number){
  const w=this.world,b=[x-r,z-r,x+r,z+r] as const;
  if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(r)||r<0||r>1.)return false;
  const signature=w.visualGroundSignature(b);
  if(!signature||/(?:g|\*|-);/.test(signature)||
   w.terrain.surveyGrids.some(q=>q.x0<b[2]&&q.x1>b[0]&&q.z0<b[3]&&q.z1>b[1])||
   w.cover.waterInsets.some(q=>q.intersects(...b)))return false;
  for(const xx of [x-r,x,x+r])for(const zz of [z-r,z,z+r]){
   const d=w.cover.distance(w.terrain,xx,zz),c=w.cover.sample(w.terrain,xx,zz);
   if(d<39||(c!==30&&c!==90))return false;
  }
  return true;
 }
 update(eye:T.Vector3,clock:number,enabled:boolean){
  const w=this.world;
  if(!enabled||!Number.isFinite(clock)){
   this.owner?.patch.observe(eye,0,clock,.46,false);return;
  }
  const local=this.source.nearestField(eye.x,eye.z,MAX_SRC);
  if(!local){this.release();return;}
  const agl=eye.y-w.visualGroundHeight(eye.x,eye.z);
  if(!Number.isFinite(agl)||agl<0||agl>MAX_AGL){
   this.owner?.patch.observe(eye,agl,clock,.46,false);return;
  }
  const prior=this.owner;
  if(!prior||prior.id!==local.id||Math.max(Math.abs(eye.x-prior.origin.x),Math.abs(eye.z-prior.origin.z))>127){
   this.release();
   const a=new T.Vector3(Math.round(eye.x/32)*32,0,Math.round(eye.z/32)*32);
   a.y=w.visualGroundHeight(a.x,a.z);
   const patch=new MarshPatch(a,(x,z,rad,id)=>local.field.permits(x,z,rad,id)&&this.groundSafe(x,z,rad),{sun:w.sun,msaa:this.msaa,keepSceneAlpha:this.keepSceneAlpha});
   this.scene.add(patch.group);
   this.owner={...local,patch,origin:a};
  }
  const owner=this.owner!,moved=Math.hypot(eye.x-this.x,eye.z-this.z)>=SAMPLE_STEP;
  if(moved){
   this.x=eye.x;this.z=eye.z;
   this.bounds[0]=this.x-MAX_SRC;this.bounds[1]=this.z-MAX_SRC;
   this.bounds[2]=this.x+MAX_SRC;this.bounds[3]=this.z+MAX_SRC;
  }
  if(moved||this.wasGround!==w.visualGroundEpoch){
   const stamp=w.visualGroundSignature(this.bounds);
   this.wasGround=w.visualGroundEpoch;
   if(moved||this.stamp!==stamp){
    this.stamp=stamp;
    const roots:MarshRoot[]=[];
    for(const q of owner.field.distributed(this.x,this.z)){
     if(!this.groundSafe(q.x,q.z,q.permittedRadius))continue;
     const y=w.visualGroundHeight(q.x,q.z)+.005;
     if(!Number.isFinite(y))continue;
     roots.push({...q,y});
    }
    owner.patch.admission(roots);
   }
  }
  owner.patch.observe(eye,agl,clock,.46,true);
 }
 diagnostics(){return this.owner?{id:this.owner.id,...this.owner.patch.state}:null;}
}
