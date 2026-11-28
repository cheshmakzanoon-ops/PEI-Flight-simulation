/** Offline fixed snapshots for the exact two- and three-sash/trim studies.
 * No LOD override, installation, live distances or runtime geometry updates. */
import * as T from 'three';
import {EAST_FOG_COMBINED_ROLES as R} from './east-fog-combined-surface.ts';
import type {FogShell} from './east-fog-gable-shell.ts';
import {studyEastFogCornice} from './east-fog-cornice-study.ts';
import {eastFogAuthoredSashes} from './east-fog-authored-sashes.ts';
import {EAST_FOG_DATED_REAR_ROLES as DATED} from './east-fog-dated-rear-ensemble.ts';
import {eastFogTowerwardSash} from './east-fog-towerward-sash.ts';
import {FIXED_PROOF_LOD_METRES,solidTuckPlan,stageScale,trimWeight} from './solid-lod-math.ts';

const INSET=.140,eps=2e-6;
type PitchBasis=Readonly<{u0:number;u1:number;v0:number;v1:number;ridgeU:number;ridgeY:number;pitch:number;floor:number}>;
const requireProof=(v:unknown,why:string)=>{if(!v)throw Error(why);};
export const boxInset=(u:number,y:number,v:number,b:PitchBasis)=>
 Math.min(u-b.u0,b.u1-u,v-b.v0,b.v1-v,y-b.floor,b.ridgeY-b.pitch*Math.abs(u-b.ridgeU)-y);
export const sashMove=(d:number)=>INSET*(1-trimWeight(d));
function attr(g:T.BufferGeometry,k:string,n:number,row:number){
 const a=g.getAttribute(k);
 requireProof(a instanceof T.BufferAttribute&&!(a instanceof T.InstancedBufferAttribute)&&!a.normalized&&a.array instanceof Float32Array&&a.itemSize===row&&
  a.count===n&&a.array.length===n*row,'unsupported close detail source words: '+k);
 return a;
}
const schema=[['position',3],['normal',3],['color',3],['clad',1]] as const;
const view=(a:ArrayBufferView)=>new Uint32Array(a.buffer,a.byteOffset,a.byteLength/4);
const equal=(a:ArrayBufferView,b:ArrayBufferView)=>{
 const u=view(a),v=view(b);
 return u.length===v.length&&u.every((x,i)=>x===v[i]);
};
export function buildProofSecondaryFog(combined:T.BufferGeometry,plan:FogShell,distance:number){
 requireProof(FIXED_PROOF_LOD_METRES.includes(distance),'only fixed proof snapshots are supported');
 requireProof(!(combined instanceof T.InstancedBufferGeometry)&&!Object.keys(combined.morphAttributes).length&&
  !combined.morphTargetsRelative&&!combined.index&&combined.drawRange.start===0&&combined.drawRange.count===Infinity&&
  combined.groups.length===0&&Object.keys(combined.attributes).length===4,'unsupported close detail source layout');
 const n=combined.getAttribute('position')?.count;
 if(n!==R.end&&n!==DATED.end)throw Error('unsupported close detail source length');
 const dated=n===DATED.end;
 const actual=studyEastFogCornice(plan);
 let sash:T.BufferGeometry|undefined,first:T.BufferGeometry|undefined,out:T.BufferGeometry|undefined;
 try{
  sash=eastFogAuthoredSashes(plan).geometry;
  if(dated)first=eastFogTowerwardSash(plan).geometry;
  for(const [k,size] of schema){
   const a=attr(combined,k,n,size).array as Float32Array;
   const b=attr(actual.bulk,k,402,size).array;
   const w=attr(sash,k,1584,size).array;
   const e=attr(actual.geometry,k,1122,size).array;
   requireProof(equal(a.subarray(R.envelope[0]*size,R.envelope[1]*size),b)&&
    equal(a.subarray(R.sash2[0]*size,R.cornice[0]*size),w)&&
    equal(a.subarray(R.cornice[0]*size,R.end*size),e.subarray(actual.base*size))&&
    (!first||equal(a.subarray(DATED.towerward[0]*size,DATED.towerward[1]*size),attr(first,k,792,size).array)),
    'authored ABI drift: '+k);
  }
  const prescribed=solidTuckPlan(plan,actual),scale=stageScale(prescribed,distance)!;
  const move=sashMove(distance),[ox,oz]=plan.originXZ,cc=Math.cos(plan.yaw),ss=Math.sin(plan.yaw);
  out=combined.clone();
  const pos=attr(out,'position',n,3),nor=attr(out,'normal',n,3);
  if(move!==0){
   const sections:readonly (readonly [number,number])[]=dated?
    [[R.sash2[0],R.cornice[0]],DATED.towerward]:[[R.sash2[0],R.cornice[0]]];
   for(const [begin,end] of sections)for(let i=begin;i<end;i++){
    pos.setX(i,pos.getX(i)+cc*move);pos.setZ(i,pos.getZ(i)-ss*move);
   }
  }
  if(scale!==1){
   const n=new T.Vector3();
   for(const range of prescribed.ranges){
    const [x,,z]=range.center,begin=R.cornice[0]+range.first-actual.base,end=R.cornice[0]+range.end-actual.base;
    for(let i=begin;i<end;i++){
     pos.setX(i,x+(pos.getX(i)-x)*scale);pos.setZ(i,z+(pos.getZ(i)-z)*scale);
     n.set(nor.getX(i),nor.getY(i)*scale,nor.getZ(i)).normalize();
     nor.setXYZ(i,n.x,n.y,n.z);
    }
   }
  }
  const proof=(start:number,end:number,i:0|1)=>{
   const group=plan.body[i],[u0,u1,v0,v1]=group.box;
   const b={u0,u1,v0,v1,ridgeU:group.ridgeU,ridgeY:group.ridgeY,pitch:group.pitch,floor:plan.planeBottom};
   let clearance=Infinity;
   for(let j=start;j<end;j++){
    const x=pos.getX(j)-ox,z=pos.getZ(j)-oz;
    clearance=Math.min(clearance,boxInset(cc*x-ss*z,pos.getY(j),ss*x+cc*z,b));
   }
   return clearance-eps;
  };
  const clearance={sashes:proof(R.sash2[0],R.cornice[0],1),
   trimTower:proof(R.cornice[0],R.cornice[0]+360,0),trimPoint:proof(R.cornice[0]+360,R.end,1),
   ...(dated?{towerward:proof(...DATED.towerward,1)}:{})};
  if(distance>=600)requireProof(Object.values(clearance).every(v=>v>.003),'far decoration not inside exact opaque shell');
  out.computeBoundingSphere();out.computeBoundingBox();
  const geometry=out;out=undefined;
  return {geometry,distance,sashTranslation:move,trimScale:scale,clearance,
   scope:'fixed offline interior projection only; needs native station LOD and cast comparison'};
 }finally{out?.dispose();sash?.dispose();first?.dispose();actual.geometry.dispose();actual.bulk.dispose();}
}
