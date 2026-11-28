import {TREE_PITCH,treeRandom} from '../sim/tree-layout.ts';
import {project} from '../sim/geo.ts';
import {QUEENS_DISPATCH_STAND} from './queens-dispatch-contract.ts';

/** Each independently audited manual Dispatch aperture uses the existing
 * signed height catalogue without starting or reshaping the stream. */
export const DISPATCH_STAND=Object.freeze({
 route:'kings-meadow-low',owner:'28-12',
 sha256:'b97ea5e14d74ddd8cedb900f41d717e592761c63e1131ed8a5895eaebf106171',
 lon:-62.25213570748,lat:46.41897991908,heading:90,aboveSurface:55,
});
export const PRINCE_DISPATCH_STAND=Object.freeze({
 route:'prince-meadow-low',owner:'7-12',
 sha256:'0590eb96ff84ec82282e722c90cbfb83d4dabb3222f4acb3b471ccd4077f222b',
 lon:-63.87977038384,lat:46.4621004046,heading:90,aboveSurface:55,
});
export type DispatchStandPlan=typeof DISPATCH_STAND|typeof PRINCE_DISPATCH_STAND|typeof QUEENS_DISPATCH_STAND;
const choosePlan=(id:string)=>id===DISPATCH_STAND.route?DISPATCH_STAND:id===PRINCE_DISPATCH_STAND.route?PRINCE_DISPATCH_STAND:
 id===QUEENS_DISPATCH_STAND.route?QUEENS_DISPATCH_STAND:undefined;
export function dispatchStandPlan(site:{id:string;lon:number;lat:number;heading:number;height:number}|undefined){
 const p=site&&choosePlan(site.id);
 return p&&site.lon===p.lon&&site.lat===p.lat&&site.heading===p.heading&&site.height===p.aboveSurface?p:undefined;
}
// The exact original 1282-root Miscouche footprint (its separate attached
// density layer) shares 7-12's source, not the Prince aperture. Keep era/plan
// matches strict so a wider prepared roster cannot replace any of its roots.
const miscouche=[-54019.6923,5528.4509,-53584.6204,6005.9102] as const;
export function dispatchStandPlanSeated(p:DispatchStandPlan,x:number,z:number,radius:number){
 if(p===DISPATCH_STAND)return true; // retain the original Kings custody path
 if((p!==PRINCE_DISPATCH_STAND&&p!==QUEENS_DISPATCH_STAND)||!Number.isFinite(radius)||radius<=0||radius>1530)return false;
 const spawn=project(p.lon,p.lat);
 if(x!==spawn.x||z!==spawn.z)return false;
 if(p===QUEENS_DISPATCH_STAND)return true;
 const [west,north,east,south]=miscouche;
 return Math.hypot(Math.max(west-x,x-east,0),Math.max(north-z,z-south,0))>radius;
}
export type SignedHeightView=Readonly<{
 id:string;sha256:string;
 contains(x:number,z:number):boolean;
 /** The original EFI clear height, with original per-stem variation. Zero is no data. */
 height(x:number,z:number,vary:number):number;
}>;
export type StandReplacement=Readonly<{stock:Float32Array;alternate:Float32Array;count:number}>;

/** A previously rounded root is not enough to reproduce the original
 * height interpolation. Recover its unique authored jitter position. */
export function exactStandSeed(px:number,pz:number){
 const x=Math.floor(px/TREE_PITCH),z=Math.floor(pz/TREE_PITCH);
 let found:Readonly<{x:number;z:number;i:number;j:number}>|undefined;
 // A centimeter-scale F32 coordinate can move a root exactly at a
 // grid line to the next cell. Never guess if two candidates agree.
 for(let j=z-1;j<=z+1;j++)for(let i=x-1;i<=x+1;i++){
  const rx=(i+treeRandom(i,j,11))*TREE_PITCH,rz=(j+treeRandom(i,j,84))*TREE_PITCH;
  if(Math.fround(rx)!==px||Math.fround(rz)!==pz)continue;
  if(found)return;
  found={x:rx,z:rz,i,j};
 }
 return found;
}
export function prepareStandReplacement(source:SignedHeightView,stock:Float32Array,x:number,z:number,radius:number):StandReplacement|false|undefined{
 if(stock.length%8||!Number.isFinite(radius)||radius<=0||!Number.isFinite(x)||!Number.isFinite(z))return false;
 const radius2=radius**2;
 let alternate:Float32Array|undefined;
 let count=0;
 for(let k=0;k<stock.length;k+=8){
  const px=stock[k],pz=stock[k+2],d=(px-x)**2+(pz-z)**2;
  if(d>radius2||(d>1120**2&&stock[k+7]>.70)||!source.contains(px,pz))continue;
  const raw=exactStandSeed(px,pz);
  if(!raw)return false; // not an authentic stock generator tuple
  if(!source.contains(raw.x,raw.z))continue; // sub-ULP packed owner boundary
  const h=source.height(raw.x,raw.z,treeRandom(raw.i,raw.j,35));
  if(h===0)continue;
  if(!Number.isFinite(h)||h<2.6||h>30)return false;
  const w=h*(.83+treeRandom(raw.i,raw.j,9)*.35);
  if(Math.fround(h)===stock[k+3]&&Math.fround(w)===stock[k+4])continue;
  alternate??=stock.slice();alternate[k+3]=h;alternate[k+4]=w;
  count++;
 }
 if(alternate)return Object.freeze({stock,alternate,count});
}

type State='other'|'waiting'|'ready'|'stock'|'active';
/** A new *manual* selector choice may prepare. An early click freezes
 * that flight's original behavior, even if the awaited bytes arrive a tick later. */
export class DispatchStand<T> {
 private selection:number;
 private pending?:T;
 private plan?:DispatchStandPlan;
 private mode:State='other';
 constructor(initialSelection:number){this.selection=initialSelection;}
 select(i:number,route:string){
  if(i===this.selection)return;
  this.selection=i;this.pending=undefined;
  this.plan=choosePlan(route);
  this.mode=this.plan?'waiting':'other';
 }
 prepare(i:number,attempt:(plan:DispatchStandPlan)=>T|false|undefined){
  const plan=this.plan;
  if(i!==this.selection||this.mode!=='waiting'||!plan)return;
  let answer:T|false|undefined;
  try{answer=attempt(plan);}catch{answer=false;}
  if(answer===false)this.mode='stock';
  else if(answer!==undefined){this.pending=answer;this.mode='ready';}
 }
 begin(i:number,fromDispatch:boolean,take:(claim:T,plan:DispatchStandPlan)=>boolean){
  const plan=this.plan,pending=i===this.selection&&fromDispatch&&this.mode==='ready'?this.pending:undefined;
  this.leave(i);
  this.mode=plan&&pending!==undefined&&take(pending,plan)?'active':'other';
  return this.mode==='active';
 }
 leave(i:number){this.selection=i;this.pending=undefined;this.plan=undefined;this.mode='other';}
 get state(){return this.mode;}
}
