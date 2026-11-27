type OpticalView={ready:()=>boolean;begin:()=>undefined|(()=>void);dispose:()=>void};
type Job={ctl:AbortController;timer:ReturnType<typeof setTimeout>};

/** Visual-only river, lake or coast admission. The exact route's Dispatch
 * can preflight a scene while stock is visible; Begin decides the flight. */
export class OpticalDeparture<Flight extends object,View extends OpticalView>{
 private job?:Job;
 private checked=false;
 private candidate?:View;
 private active?:{flight:Flight;view:View};
 private readonly dispatch:()=>boolean;
 constructor(dispatch:()=>boolean){this.dispatch=dispatch;}
 get ready(){return this.candidate?.ready()===true;}
 get unavailable(){return this.checked&&!this.job&&!this.ready;}
 prepare(load:(signal:AbortSignal)=>Promise<View|undefined>){
  if(this.checked||!this.dispatch())return;
  this.checked=true;
  const ctl=new AbortController(),job:Job=this.job={ctl,timer:setTimeout(()=>this.refuse(job),8500)};
  void this.finish(load,job);
 }
 private refuse(job:Job){
  if(this.job!==job)return;
  this.job=undefined;clearTimeout(job.timer);job.ctl.abort();
 }
 private async finish(load:(signal:AbortSignal)=>Promise<View|undefined>,job:Job){
  let result:View|undefined;
  try{
   result=await load(job.ctl.signal);
   if(this.job!==job||job.ctl.signal.aborted||!this.dispatch()||!result?.ready())return;
   this.candidate=result;result=undefined;
  }catch{/** An unavailable optic leaves the original visible. */}
  finally{
   clearTimeout(job.timer);if(this.job===job)this.job=undefined;result?.dispose();
  }
 }
 beginFlight(flight:Flight,fromDispatch:boolean){
  if(this.job)this.refuse(this.job);
  this.closeFlight();
  const q=this.candidate,allowed=fromDispatch&&this.dispatch()&&this.ready;this.candidate=undefined;
  if(q&&allowed){this.active={flight,view:q};return true;}
  q?.dispose();return false;
 }
 beginDraw(flight:Flight,eligible:boolean){
  const q=this.active;if(!q)return;
  if(q.flight!==flight||!eligible){this.closeFlight();return;}
  try{const end=q.view.begin();if(end)return end;}
  catch{/** A withdrawn receiver does not re-arm within this flight. */}
  this.closeFlight();
 }
 closeFlight(){const q=this.active;this.active=undefined;q?.view.dispose();}
 reset(){
  if(this.job)this.refuse(this.job);
  this.closeFlight();const q=this.candidate;this.candidate=undefined;q?.dispose();this.checked=false;
 }
}
