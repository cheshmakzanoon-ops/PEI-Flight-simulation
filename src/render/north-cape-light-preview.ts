/** Candidate: optional landmark in the ordinary flight program. Visual only. */
import * as T from 'three';
import {project} from '../sim/geo.ts';
import type {Site} from '../sim/places.ts';
import type {World} from './world.ts';
import {makeNorthCapeDetachedStudy} from '../../tools/art/north-cape-lighthouse/north-cape-lens-draft.ts';

export const NORTH_CAPE_LIGHT_PREVIEW:Site=Object.freeze({
 id:'northcape-light-low',name:'North Cape · lighthouse low pass',region:'Prince County',
 lon:-63.9899933905085,lat:47.056930528550176,heading:270,height:57,
 note:'Virtual offshore course near North Cape. The lighthouse preview is optional; this is not a navigation aid.',
});
const A=project(-63.99689779508974,47.05772217250531),reach=4.4;
const bounds=Object.freeze([A.x-reach,A.z-reach,A.x+reach,A.z+reach] as const);
const SOURCE='661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d';
type Ground=Pick<World,'rollingCanopyOwner'|'rollingCanopyStill'|'visualGroundHeight'|'terrain'|'cover'>;
type Seat=NonNullable<ReturnType<World['rollingCanopyOwner']>>;
type SceneState='idle'|'waiting'|'ready'|'active'|'held';

export function createNorthCapeLightPreview(scene:T.Scene,w:Ground,terrainSHA:string){
 const allowed=(()=>{
  try{return terrainSHA===SOURCE&&w.terrain.isLand(A.x,A.z)&&w.cover.legacyDistance(w.terrain,A.x,A.z)>80;}
  catch{return false;}
 })();
 let phase:SceneState=allowed?'idle':'held';
 let solidDraws=0,paneDraws=0,refusedSelection=false;
 let arm:Seat|undefined,grade:number|undefined,seatStamp:readonly number[]|undefined,tower:ReturnType<typeof makeNorthCapeDetachedStudy>|undefined,
  middle:ReturnType<typeof makeNorthCapeDetachedStudy>|undefined,g:T.LOD|undefined;
 const setVisible=(v:boolean)=>{if(g){if(v&&g.parent===null)scene.add(g);else if(!v)g.removeFromParent();}};
 const dispose=()=>{
  setVisible(false);g?.clear();tower?.dispose();middle?.dispose();g=undefined;tower=undefined;middle=undefined;
  arm=undefined;grade=undefined;seatStamp=undefined;
 };
 const getSeat=()=>{
  const s=w.rollingCanopyOwner(bounds);
  if(s?.key!=='5-0')return;
  const heights:number[]=[];
  for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++)heights.push(w.visualGroundHeight(A.x+i*reach,A.z+j*reach));
  const [floor,ceil]=[Math.min(...heights),Math.max(...heights)];
  if(!heights.every(Number.isFinite)||floor<4||ceil>7||ceil-floor>.30)return;
  return {seat:s,base:floor-.02,stencil:Object.freeze(heights)};
 };
 const sameStamp=(s:readonly number[])=>!!seatStamp&&s.length===seatStamp.length&&s.every((v,i)=>v===seatStamp![i]);
 const matched=()=>{
  try{
   if(!arm||!w.rollingCanopyStill(arm.key,arm.geometry))return false;
   const s=getSeat();
   return s?.seat.geometry===arm.geometry&&s.base===grade&&sameStamp(s.stencil);
  }catch{return false;}
 };
 const available=()=>{try{return !!getSeat();}catch{return false;}};
 return {
  freshDispatch(){
   // A refusal lasts for one selection/flight; a real return to Dispatch starts a new lifecycle.
   solidDraws=0;paneDraws=0;refusedSelection=false;phase=allowed?'idle':'held';dispose();
  },
  get phase(){return phase;},
  get state(){return Object.freeze({phase,mounted:g?.parent===scene,y:grade??null,solidDraws,paneDraws,exactSeatAvailable:available()});},
  dispatch(wanted:boolean,supported:boolean){
   if(!allowed)return;
   if(!wanted){phase='idle';refusedSelection=false;dispose();return;}
   if(refusedSelection)return;
   if(phase==='active'){phase='idle';dispose();}
   if(!supported){phase='waiting';dispose();return;}
   try{
    const s=getSeat();
    if(!s||arm&&(s.seat.geometry!==arm.geometry||s.base!==grade||!sameStamp(s.stencil))){phase='waiting';dispose();return;}
    if(arm&&phase==='ready')return;
    // Stage both meshes while the pilot is in Dispatch; loss of the real
    // visual ground owner never activates a substitute in mid-flight.
    tower=makeNorthCapeDetachedStudy(true);middle=makeNorthCapeDetachedStudy(false);
    for(const q of [tower,middle]){
     q.exterior.onAfterRender=(_r,s)=>{if(s===scene)solidDraws++;};
     q.panes.onAfterRender=(_r,s)=>{if(s===scene)paneDraws++;};
    }
    g=new T.LOD();g.position.set(A.x,s.base,A.z);grade=s.base;arm=s.seat;seatStamp=s.stencil;
    g.addLevel(tower.group,0);g.addLevel(middle.group,780,.06);g.addLevel(new T.Group(),5200,.05);
    phase='ready';
   }catch{phase='held';refusedSelection=true;dispose();}
  },
  begin(wanted:boolean,fromDispatch:boolean,supported:boolean){
   // Arming happens at the ordinary Begin action, never at a late load.
   if(wanted&&supported&&fromDispatch&&phase==='ready'&&matched()){phase='active';return;}
   phase=allowed?'held':'idle';dispose();
  },
  update(wantsFlightDraw:boolean,normalFrame:boolean){
   solidDraws=0;paneDraws=0;
   if(phase!=='active'){setVisible(false);return;}
   if(!wantsFlightDraw||!normalFrame||!matched()){phase='held';dispose();return;}
   setVisible(true);
  },
  dispose,
 };
}
