import type {BufferGeometry,Mesh} from 'three';
import type {OlearyNativeSurface} from './authority.ts';

export type IndustrialStandardView={
 intact:()=>boolean;
 compare:<T>(useMeasured:boolean,draw:(measured:boolean,station?:boolean)=>T,station?:boolean)=>T;
 prepareStation?:(signal:AbortSignal)=>Promise<boolean>;
 stationIntact?:()=>boolean;
 dispose:()=>void;
};
type Conditions={
 current:()=>boolean;
 preparing:()=>boolean;
 flying:()=>boolean;
 ground:()=>OlearyNativeSurface|undefined;
 stage:(permit:()=>boolean,signal:AbortSignal)=>Promise<IndustrialStandardView|undefined>;
};
type GroundEpoch={mesh:Mesh;geometry:BufferGeometry;seams:string};
type Pending={controller:AbortController;epoch:GroundEpoch};

/** Own the Dispatch decision, not the old optional O'Leary actors or the
 * emitted building geometry. One departure may use one verified view. */
export class StandardIndustrialSession{
 private readonly seat:Conditions;
 private checked?:GroundEpoch;
 private pending?:Pending;
 private view?:IndustrialStandardView;
 private armed=false;
 private shown=false;
 private stationPending?:AbortController;
 private stationChecked?:IndustrialStandardView;
 private stationArmed=false;
 private stationShown=false;
 private disposed=false;
 constructor(seat:Conditions){this.seat=seat;}
 private current(){return !this.disposed&&this.seat.current();}
 private preparing(){return this.current()&&this.seat.preparing();}
 private permitted(){return this.preparing()||this.current()&&this.armed&&this.seat.flying();}
 get ready(){
  try{return this.preparing()&&this.view?.intact()===true;}
  catch{return false;}
 }
 get drawn(){return this.shown;}
 get stationDrawn(){return this.stationShown;}
 get stationUnavailable(){return !!this.view?.prepareStation&&this.stationChecked===this.view&&!this.stationPending&&!this.stationReady;}
 get stationReady(){
  try{return this.ready&&this.view?.stationIntact?.()===true;}catch{return false;}
 }
 private stageStation(){
  const view=this.view;
  if(!view?.prepareStation||this.stationChecked===view||this.stationPending||!this.ready)return;
  const c=this.stationPending=new AbortController();this.stationChecked=view;
  const deadline=setTimeout(()=>c.abort(),16000);
  void Promise.resolve().then(()=>{
   if(c.signal.aborted||!this.preparing()||this.view!==view)return false;
   return view.prepareStation?.(c.signal);
  }).catch(()=>false).finally(()=>{
   clearTimeout(deadline);
   if(this.stationPending!==c)return;
   if(!this.preparing()||this.view!==view)this.stopStationOffer();
   else this.stationPending=undefined;
  });
 }
 private stopStationOffer(){
  if(!this.stationPending)return;
  this.stationPending.abort();this.stationPending=undefined;
  // Early takeoff never re-arms in flight. A genuine subsequent dispatch
  // may try again; an exhausted or invalid offer is not retried each frame.
  this.stationChecked=undefined;
 }
 private ground(){
  const has=this.seat.ground(),mesh=has?.fine,seams=has?.seams;
  return mesh&&seams?{mesh,geometry:mesh.geometry,seams}:undefined;
 }
 private sameEpoch(a:GroundEpoch|undefined,b:GroundEpoch){
  return a?.mesh===b.mesh&&a.geometry===b.geometry&&a.seams===b.seams;
 }
 prepare(){
  if(!this.preparing()||this.pending)return;
  const epoch=this.ground();
  if(!epoch)return;
  if(this.sameEpoch(this.checked,epoch)){this.stageStation();return;}
  this.dropView();this.checked=epoch;
  const p=this.pending={controller:new AbortController(),epoch};
  void this.verify(p);
 }
 private async verify(p:Pending){
  const signal=p.controller.signal,deadline=setTimeout(()=>p.controller.abort(),8000);
  let result:IndustrialStandardView|undefined;
  try{
   result=await this.seat.stage(()=>this.permitted()&&this.sameEpoch(this.ground(),p.epoch),signal);
   if(this.pending!==p||signal.aborted||!this.preparing()||!result?.intact())return;
   this.view=result;result=undefined;
  }catch{/** The unmodified building always remains available. */}
  finally{
   try{result?.dispose();}finally{
    clearTimeout(deadline);if(this.pending===p)this.pending=undefined;
   }
  }
 }
 leaveStationDispatch(){if(!this.preparing())this.stopStationOffer();}
 private cancel(){
  if(!this.pending)return;
  this.pending.controller.abort();this.pending=undefined;this.checked=undefined;
 }
 /** Called synchronously by Begin, before the flight object's first frame. */
 authorizeDeparture(){
  this.stationArmed=this.stationReady;
  this.armed=this.ready;this.shown=false;this.stationShown=false;this.cancel();this.stopStationOffer();
  return this.armed;
 }
 stockDeparture(){this.armed=false;this.shown=false;this.stationArmed=false;this.stationShown=false;this.cancel();this.stopStationOffer();}
 draw<T>(paint:()=>T):T{
  this.shown=false;this.stationShown=false;
  const view=this.view;
  if(!this.armed||!view)return paint();
  if(!this.current()||!this.seat.flying()){
   this.armed=false;this.stationArmed=false;return paint();
  }
  return view.compare(true,(measured,station)=>{
   this.shown=measured;this.stationShown=station===true&&measured;
   if(!measured)this.armed=false;
   if(!this.stationShown)this.stationArmed=false;
   return paint();
  },this.stationArmed);
 }
 private dropView(){
  const q=this.view;this.view=undefined;this.armed=false;this.shown=false;
  this.stopStationOffer();this.stationChecked=undefined;this.stationArmed=false;this.stationShown=false;
  q?.dispose();
 }
 dispose(){
  if(this.disposed)return;
  this.disposed=true;this.cancel();this.dropView();
 }
}
