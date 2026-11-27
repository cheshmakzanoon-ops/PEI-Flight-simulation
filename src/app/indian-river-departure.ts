export type RiverCohort={
 /** Exact current owners and linked programs, with no scene or contact change. */
 ready:()=>boolean;
 /** Before the first fixed step, install every role or return false. */
 commit:()=>boolean;
 /** May update genuine current shore/roster state. False withdraws all roles. */
 maintain:()=>boolean;
 /** Restore stock contact and draws synchronously; release owned resources. */
 dispose:()=>void;
};
type Pending={ctl:AbortController;timer:ReturnType<typeof setTimeout>};

/** Separate a selected Dispatch from the lifetime of a genuine flight.
 * A promise resolving after Begin, or a lost owner, cannot rewrite contact
 * under an already airborne aircraft. */
export class IndianRiverDeparture<Flight extends object,Prepared extends RiverCohort=RiverCohort>{
 private job?:Pending;
 private candidate?:Prepared;
 private departure?:{flight:Flight;cohort:Prepared;active:boolean};
 private attempted=false;
 private failed=false;
 private readonly stillDispatch:()=>boolean;
 constructor(stillDispatch:()=>boolean){this.stillDispatch=stillDispatch;}
 get ready(){try{return this.candidate?.ready()===true;}catch{return false;}}
 get unavailable(){return this.failed;}
 get activeCohort(){const d=this.departure;return d?.active?d.cohort:undefined;}
 get cleared(){return this.departure!==undefined;}
 prepare(load:(signal:AbortSignal)=>Promise<Prepared|undefined>){
  if(this.attempted||this.job||!this.stillDispatch())return;
  this.attempted=true;this.failed=false;
  const ctl=new AbortController(),p:Pending=this.job={ctl,timer:setTimeout(()=>this.expire(p),12_000)};
  void this.open(load,p);
 }
 private expire(p:Pending){
  if(this.job!==p)return;
  p.ctl.abort();this.job=undefined;this.failed=true;
 }
 private async open(load:(signal:AbortSignal)=>Promise<Prepared|undefined>,p:Pending){
  let result:Prepared|undefined;
  try{
   result=await load(p.ctl.signal);
   if(this.job!==p||p.ctl.signal.aborted||!this.stillDispatch())return;
   if(!result?.ready()){this.failed=true;return;}
   this.candidate=result;result=undefined;
  }catch{if(this.job===p)this.failed=true;}
  finally{
   clearTimeout(p.timer);if(this.job===p)this.job=undefined;
   result?.dispose();
  }
 }
 private cancel(){
  const q=this.job;if(!q)return;
  this.job=undefined;clearTimeout(q.timer);q.ctl.abort();
 }
 /** Call from the immediate Begin action, while UI still knows its origin. */
 begin(flight:Flight,fromDispatch:boolean){
  this.cancel();this.closeFlight();
  const q=this.candidate,allow=fromDispatch&&this.stillDispatch()&&this.ready;
  this.candidate=undefined;
  if(q&&allow){this.departure={flight,cohort:q,active:false};return true;}
  q?.dispose();return false;
 }
 beforeStep(flight:Flight,retain:boolean,canCommit:boolean){
  const d=this.departure;if(!d)return false;
  if(d.flight!==flight||!retain){this.closeFlight();return false;}
  try{
   if(!d.active)d.active=canCommit&&d.cohort.ready()&&d.cohort.commit();
   else d.active=d.cohort.maintain();
   if(d.active)return true;
  }catch{/** Never advance the flight on a partly admitted cohort. */}
  this.closeFlight();return false;
 }
 closeFlight(){
  const d=this.departure;this.departure=undefined;d?.cohort.dispose();
 }
 resetDispatch(){
  this.cancel();this.closeFlight();
  const q=this.candidate;this.candidate=undefined;q?.dispose();
  this.attempted=false;this.failed=false;
 }
}
