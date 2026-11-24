import {MAPPED_LANE_CANOPY_CORPUS} from './mapped-lane-canopy.generated.ts';
import type {Cover} from '../sim/cover.ts';
import type {Terrain} from '../sim/terrain.ts';
import {project} from '../sim/geo.ts';
import {TREE_PITCH,TREE_TILE_SIDE,treeRandom,treeTileStart} from '../sim/tree-layout.ts';

export const OPEN_LANE_SOURCE=Object.freeze({
 terrain:'661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d',
 cover:'46a4f4736a885576fa0529cd0f91bacdbfd47e3bfd719130ba3446c52c245863',
 coverDecoded:'e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9',
 road:'72528a1b26b68ee345e5047f30f2c9b49a3c18edeaccaf3e759ead296d3276c1',
} as const);
type Pair=readonly [number,number];
export type LaneSeed={readonly tile:Pair;readonly cell:number;readonly xz:Pair;readonly fallback:Pair};
export type DatedOpenLane={
 /** Index in the authenticated NRN atlas and start control of this chord. */
 readonly ordinal:number;readonly segment:number;
 readonly from:Pair;readonly to:Pair;
 /** Adjacent controls of that exact packed row, if the local chord is short at a seed. */
 readonly before?:Pair;readonly after?:Pair;
 readonly roots:readonly LaneSeed[];
};
type RootTest=(x:number,z:number,h:number,w:number)=>boolean;
export type OpenRoadLane={
 /** When no scoped owner is nearby, late approval need not touch the roster. */
 readonly owners:readonly string[];
 readonly size:number;
 forOwner(key:string):RootTest|undefined;
 excludes:RootTest;
};

export function mappedLaneCanopyRequested(options:URLSearchParams){
 return options.has('mappedLaneCanopyStudy')&&options.get('scenery')!=='detail'&&
  !['woodland3D','woodlandView','woodlandBark','woodlandCrownBase','seatedForestShadows','canopyLight',
    'indianRiverReview','surveyRelief','inlandRelief','seatedRoads'].some(k=>options.has(k));
}

/** Identity checks bind compiled evidence to just the matching atlas. The
 * code-only table is not an external or remotely configurable data source. */
export function mappedLaneCanopy(t:Terrain,c:Cover,terrain:string|undefined,road:string|undefined,
 corpus:readonly DatedOpenLane[]=MAPPED_LANE_CANOPY_CORPUS):OpenRoadLane|undefined{
 const p=OPEN_LANE_SOURCE;
 if(TREE_PITCH!==12||TREE_TILE_SIDE!==16||terrain!==p.terrain||road!==p.road||
    c.sourceSha!==p.cover||c.sourceDecodedSha!==p.coverDecoded||!corpus.length||corpus.length>64)return;
 type RootTable=Map<number,Map<number,Pair>>;
 const byOwner=new Map<string,RootTable>(),unique:RootTable=new Map();
 const append=(map:RootTable,x:number,z:number,shape:Pair)=>{
  let a=map.get(x);if(!a)map.set(x,a=new Map());a.set(z,shape);
 };
 const rootTest=(map:RootTable):RootTest=>(x,z,h,w)=>{
  const fallback=map.get(x)?.get(z);
  return !!fallback&&h===fallback[0]&&w===fallback[1];
 };
 let size=0;
 for(const run of corpus){
  if(!Number.isInteger(run.ordinal)||run.ordinal<0||!Number.isInteger(run.segment)||run.segment<0||!run.roots.length)return;
  const a=project(...run.from),b=project(...run.to);
  const len=Math.hypot(b.x-a.x,b.z-a.z),dx=(b.x-a.x)/len,dz=(b.z-a.z)/len;
  if(!Number.isFinite(len)||len<30)return;
  const continuous=(xx:number,zz:number)=>{
   const distance=Math.hypot(xx,zz);
   return Number.isFinite(distance)&&distance>=15&&(xx*dx+zz*dz)/distance>=.996194698; // 5 degrees
  };
  const before=run.before&&project(...run.before),after=run.after&&project(...run.after);
  const haveBefore=run.segment>0&&before&&continuous(a.x-before.x,a.z-before.z);
  const haveAfter=after&&continuous(after.x-b.x,after.z-b.z);
  for(const {tile:[tx,tz],cell,xz:[px,pz],fallback} of run.roots){
   if(++size>64||!Number.isInteger(tx)||!Number.isInteger(tz)||treeTileStart(tx,tz)<0||
      !Number.isInteger(cell)||cell<0||cell>255||unique.get(px)?.has(pz))return;
   const i=tx*16+(cell&15),j=tz*16+(cell>>>4);
   const x=(i+treeRandom(i,j,11))*12,z=(j+treeRandom(i,j,84))*12;
   const h=8.2+treeRandom(i,j,35)*10.8,w=h*(.83+treeRandom(i,j,9)*.35);
   const s=(x-a.x)*dx+(z-a.z)*dz,track=(x-a.x)*dz-(z-a.z)*dx;
   // Beyond strict centreline reserve, adjacent real canopy remains protected.
   if(Math.fround(x)!==px||Math.fround(z)!==pz||Math.fround(h)!==fallback[0]||Math.fround(w)!==fallback[1]||
      s<.02||s>len-.02||
      (s<15&&!haveBefore)||(s>len-15&&!haveAfter)||Math.abs(track)>.9||
      !t.isLand(x,z)||c.sample(t,x,z)!==10||c.distance(t,x,z)<=30)return;
   const key=tx+':'+tz;
   let local=byOwner.get(key);if(!local)byOwner.set(key,local=new Map());
   append(local,px,pz,fallback);append(unique,px,pz,fallback);
  }
 }
 const tests=new Map<string,RootTest>();
 for(const [key,list] of byOwner)tests.set(key,rootTest(list));
 return {owners:[...tests.keys()],size,forOwner:key=>tests.get(key),excludes:rootTest(unique)};
}
