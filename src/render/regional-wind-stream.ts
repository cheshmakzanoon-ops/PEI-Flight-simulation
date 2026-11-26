import {project} from '../sim/geo.ts';
/** Only geographic envelopes ride in the startup bundle. Coordinates and art load locally. */
export const WIND_ENVELOPES=[
 {id:'west-cape',lo:project(-64.40378,46.73318),hi:project(-64.36135,46.63429)},
 {id:'east-point-i',lo:project(-62.06445,46.45890),hi:project(-62.02817,46.45311)},
 {id:'hermanville',lo:project(-62.32520,46.45948),hi:project(-62.27831,46.44514)},
] as const;
export type WindFarmId=(typeof WIND_ENVELOPES)[number]['id'];
export type ScenicWindFarmId=WindFarmId|'east-point-ii';
const PHASE_II_ENVELOPE={id:'east-point-ii',lo:project(-62.05100,46.44750),hi:project(-62.02336,46.43613)} as const;
type WindEnvelope={readonly id:ScenicWindFarmId;readonly lo:ReturnType<typeof project>;readonly hi:ReturnType<typeof project>};
export type WindObserver=Readonly<{x:number;y:number;z:number}>;
export type WindFarmArt={groundLightState?():unknown;update(eye:WindObserver,time:number):void;dispose():void;counts:{registered:number;near:number;cruise:number;distant:number}};
export type WindFactory=(id:ScenicWindFarmId)=>WindFarmArt|undefined;
export const WIND_RANGES={prefetch:12300,unload:13900,visible:11400,fadeStart:9000,fadeEnd:11150,near:1150,cruise:4200} as const;
export function windBoundsDistance(eye:WindObserver,b:WindEnvelope){
 const dx=Math.max(b.lo.x-eye.x,0,eye.x-b.hi.x),dz=Math.max(b.lo.z-eye.z,0,eye.z-b.hi.z);
 return Math.hypot(dx,dz);
}
export class RegionalWindStream{
 private phase:'cold'|'pending'|'ready'|'unavailable'='cold';
 private make:WindFactory|undefined;
 private readonly live=new Map<ScenicWindFarmId,WindFarmArt>();
 private readonly rejected=new Set<ScenicWindFarmId>();
 private retired=false;
 private readonly load:()=>Promise<WindFactory|undefined>;
 private readonly bounds:readonly WindEnvelope[];
 constructor(load:()=>Promise<WindFactory|undefined>,phaseII=false){
  this.load=load;this.bounds=phaseII?[...WIND_ENVELOPES,PHASE_II_ENVELOPE]:WIND_ENVELOPES;
 }
 update(eye:WindObserver,time:number){
  if(this.retired)return;
  const finite=Number.isFinite(eye.x)&&Number.isFinite(eye.y)&&Number.isFinite(eye.z)&&Number.isFinite(time);
  for(const b of this.bounds){
   const old=this.live.get(b.id),d=finite?windBoundsDistance(eye,b):Infinity;
   if(d>(old?WIND_RANGES.unload:WIND_RANGES.prefetch)){
    if(old){old.dispose();this.live.delete(b.id);} continue;
   }
   if(this.rejected.has(b.id))continue;
   if(this.phase==='cold'){
    this.phase='pending';
    void Promise.resolve().then(this.load).then(make=>{
     if(this.retired)return;
     this.make=make;this.phase=make?'ready':'unavailable';
    },()=>{if(!this.retired)this.phase='unavailable';});
   }
   if(old)old.update(eye,time);
   else if(this.phase==='ready'){
    try{const a=this.make?.(b.id);if(a){this.live.set(b.id,a);a.update(eye,time);}else this.rejected.add(b.id);}
    catch{this.live.get(b.id)?.dispose();this.live.delete(b.id);this.rejected.add(b.id);}
   }
  }
 }
 diagnostics(){return {phase:this.phase,farms:[...this.live].map(([farm,a])=>({farm,...a.counts,groundLight:a.groundLightState?.()??null})),unavailable:[...this.rejected]};}
 dispose(){this.retired=true;for(const a of this.live.values())a.dispose();this.live.clear();this.make=undefined;}
}
