import { aerodynamicPolar, airDensity } from './aerodynamics.ts';
import { clamp, damp, wrap, project, RAD } from './geo.ts';
import { RUNWAYS, runwayAt, type Site } from './places.ts';
export type Controls = {pitch:number;roll:number;yaw:number;power:number;brake:boolean};
export type Surface = {height:number;land:boolean;runway:boolean};
export type Sample = (x:number,z:number)=>Surface;
export type Status = 'flying'|'rolling'|'landed'|'stopped';
export interface Flight {
  x:number; y:number; z:number; heading:number; pitch:number; bank:number; gamma:number; speed:number;
  throttle:number; time:number; vertical:number; alpha:number; stalled:boolean; status:Status; notice:string;
}
export const SURVEY_AIRFRAME=Object.freeze({gravity:9.80665,massKg:1450,areaM2:17.2,gearHeightM:1.40});
const {gravity:G,massKg:MASS,areaM2:S,gearHeightM:GEAR}=SURVEY_AIRFRAME;
export const FIXED_STEP=1/90;
export function spawn(site:Site,surface:Sample):Flight{
 const rw=RUNWAYS.find(r=>r.id===site.runway), p=rw?{x:rw.p.x+rw.dx*18,z:rw.p.z+rw.dz*18}:project(site.lon,site.lat);
 const base=surface(p.x,p.z).height;
 return {...p,y:base+(rw?GEAR:site.height),heading:rw?rw.heading:site.heading*RAD,pitch:rw?0:.042,bank:0,gamma:0,speed:rw?0:52,throttle:rw?.03:.56,time:0,vertical:0,alpha:0,stalled:false,status:rw?'rolling':'flying',notice:''};
}
export const neutral:Controls={pitch:0,roll:0,yaw:0,power:0,brake:false};
/** Assist-stabilized, fixed-step point-mass model; visual entertainment, not certified flight dynamics. */
export function step(f:Flight,u:Controls,sample:Sample,dt=FIXED_STEP) {
 if(f.status==='stopped'||!(dt>0&&dt<=.05))return;
 f.time+=dt;
 const pitch=clamp(u.pitch,-1,1),roll=clamp(u.roll,-1,1),yaw=clamp(u.yaw,-1,1);
 f.throttle=clamp(f.throttle+clamp(u.power,-1,1)*.32*dt,0,1);
 const q=.5*airDensity(f.y)*f.speed*f.speed;
 const thrust=Math.min(3600,188000/Math.max(f.speed,24))*f.throttle;
 const onGround=f.status!=='flying';
 const positiveAuthority=.22+.24*clamp((f.speed-36)/23,0,1);
 const targetPitch=onGround?Math.max(0,pitch)*.24:.040+pitch*(pitch>0?positiveAuthority:.48);
 f.pitch=damp(f.pitch,targetPitch,onGround?1.7:1.2,dt);
 f.bank=damp(f.bank,onGround?0:roll*1.12,onGround?5:1.6,dt);
 f.alpha=f.pitch-f.gamma+.024;
 const {cl,cd,separated}=aerodynamicPolar(f.alpha);
 f.stalled=!onGround&&separated;
 const lift=q*S*cl, drag=q*S*cd;
 if(onGround) {
  f.gamma=0; f.vertical=0;
  const rolling=(u.brake?4.5:.23)*Math.min(1,Math.max(0,1-lift/(MASS*G)));
  f.speed=clamp(f.speed+((thrust-drag)/MASS-rolling-(u.brake?1.3:0))*dt,0,160);
  f.heading=wrap(f.heading+(yaw+.35*roll)*clamp(f.speed/12,0,1)*.38*dt);
  if(f.speed>29&&lift>1.025*MASS*G&&pitch>.13){f.status='flying';f.gamma=.035;f.y+=.12;f.notice='';}
 } else {
  f.gamma=clamp(f.gamma+((lift*Math.cos(f.bank)/MASS-G*Math.cos(f.gamma))/Math.max(f.speed,18))*dt,-.95,.7);
  f.speed=clamp(f.speed+((thrust-drag)/MASS-G*Math.sin(f.gamma))*dt,12,145);
  f.heading=wrap(f.heading+(lift*Math.sin(f.bank)/(MASS*Math.max(20,f.speed)*Math.max(.45,Math.cos(f.gamma)))+yaw*.12)*dt);
  f.vertical=f.speed*Math.sin(f.gamma); f.y+=f.vertical*dt;
 }
 const v=f.speed*Math.cos(f.gamma),air=f.status==='flying';
 f.x+=(v*Math.sin(f.heading)+(air?1.9:0))*dt;f.z+=(-v*Math.cos(f.heading)+(air?.35:0))*dt;
 const ground=sample(f.x,f.z);const contact=ground.height+GEAR;
 if(f.status!=='flying') {
  f.y=contact;
  if(!ground.runway&&f.speed>6){f.status='stopped';f.notice='Off runway';}
 } else if(f.y<=contact) {
  f.y=contact;
  if(ground.runway&&f.vertical>-3.7&&Math.abs(f.bank)<.20&&f.speed<47){f.status='landed';f.notice='Touchdown';f.gamma=0;f.vertical=0;}
  else {f.status='stopped';f.notice=ground.land?'Terrain contact':'Water contact';}
 }
}
export const flatRunway:Sample=(x,z)=>({height:0,land:true,runway:!!runwayAt(x,z)});
