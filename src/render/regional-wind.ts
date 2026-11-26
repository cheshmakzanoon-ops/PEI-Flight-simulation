import * as T from 'three';
import {project} from '../sim/geo.ts';
import type {World} from './world.ts';
import {WIND_STATIONS} from './regional-wind.generated.ts';
import {EAST_POINT_PHASE_II} from './east-point-phase-ii.generated.ts';
import {turbineGeometry,WIND_PROFILE,type WindLod} from './regional-wind-geometry.ts';
import {WIND_RANGES,type WindFarmId,type ScenicWindFarmId,type WindObserver} from './regional-wind-stream.ts';
type Ground=Pick<World,'visualGroundEpoch'|'surface'|'visualGroundHeight'|'terrain'|'cover'>;
export type WindRoot = Readonly<{id:string;x:number;z:number}>;
export interface StaticWindReceiver{update(eye:WindObserver):void;clear():void;dispose():void; readonly state:unknown}
export type StaticWindPrepare=(id:WindFarmId,caster:RegionalWind)=>Promise<StaticWindReceiver|undefined>;
export type WindSocketLease = (owner:ScenicWindFarmId,roots:readonly WindRoot[])=>void;
/** Reproducible instances of the existing deterministic canopy generator whose
 * ground roots are inside actual registered mast steel. No other crown, hedge
 * or wider farm clearing is implied. Keys use submitted Float32 stem XZ, not
 * meters of tolerance. The source rows, checks and exact A/B live in QA. */
const SOCKETS:Record<WindFarmId, readonly WindRoot[]>={
 'west-cape':[{id:'WCW8',x:-91370.59375,z:-23358.2734375},{id:'WCW9',x:-91035.6875,z:-23422.046875},{id:'WCW46',x:-92034.0546875,z:-17491.041015625},{id:'WCW49',x:-91417.4453125,z:-16537.265625}],
 'east-point-i':[],
 'hermanville':[{id:'HCS1',x:67153.21875,z:4938.884765625}],
};
const tau=2*Math.PI,golden=Math.PI*(3-Math.sqrt(5));
const Y=new T.Vector3(0,1,0),Z=new T.Vector3(0,0,1),one=new T.Vector3(1,1,1);
const yaw=-2.62; // A consistent west-facing scenic wind; not live site telemetry.
const yawQ=new T.Quaternion().setFromAxisAngle(Y,yaw);
export function regionalRotorAngle(t:number,index:number,rpm:number){return index*golden-(t%600)*tau*rpm/60;}
function finish(rotor:boolean,clock:{value:number},rpm:number){
 // Standard physically-based lighting uses the same real daylight, sky and
 // tone mapper as the rest of the scene. No texture or global receiver change.
 const m=new T.MeshStandardMaterial({vertexColors:true,roughness:.72,metalness:.055});
 m.name=rotor?'Regional wind composite blades':'Regional wind coated shells';
 m.onBeforeCompile=prog=>{
  prog.vertexShader='varying vec3 windWorldP;\n'+prog.vertexShader;
  if(rotor){
   prog.uniforms.regionalWindClock=clock;
   prog.vertexShader='attribute float regionalPhase;uniform float regionalWindClock;\n'+prog.vertexShader;
   const a='regionalPhase-regionalWindClock*'+(rpm*tau/60).toFixed(10);
   prog.vertexShader=prog.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
    float windA=${a};float wc=cos(windA),ws=sin(windA);mat2 windRot=mat2(wc,ws,-ws,wc);
    objectNormal.yz=windRot*objectNormal.yz;`);
   prog.vertexShader=prog.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.yz=windRot*transformed.yz;');
  }
  prog.vertexShader=prog.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nwindWorldP=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;');
  prog.fragmentShader='varying vec3 windWorldP;\n'+prog.fragmentShader;
  prog.fragmentShader=prog.fragmentShader.replace('#include <opaque_fragment>',`
   float windDepth=distance(cameraPosition,windWorldP);
   // A pupil-sized tower can still cover several pixels at the horizon.
   // Thin, OPAQUE world art uses a fixed screen-space coverage threshold:
   // no sorted transparency, no writes beyond its original opaque silhouette,
   // and no animation-clock noise. Fade reaches zero before CPU retirement.
   if(windDepth>${WIND_RANGES.fadeStart.toFixed(1)}){
    float keep=1.-smoothstep(${WIND_RANGES.fadeStart.toFixed(1)},${WIND_RANGES.fadeEnd.toFixed(1)},windDepth);
    float threshold=fract(52.9829189*fract(dot(floor(gl_FragCoord.xy),vec2(.06711056,.00583715))));
    if(keep<=threshold)discard;
   }
   float windHaze=1.-exp(-windDepth*(.000017+.000010*exp(-max(windWorldP.y,0.)/900.)));
   outgoingLight=mix(outgoingLight,vec3(.55,.66,.72),clamp(windHaze,0.,.85));
   #include <opaque_fragment>`);
 };
 // onBeforeCompile branches on a lexical parameter so program cache keys must differ.
 m.customProgramCacheKey=()=>rotor?'regional-wind-rotor-'+rpm:'regional-wind-shell';
 return m;
}
export class RegionalWind{
 readonly root=new T.Group();
 readonly counts={registered:0,near:0,cruise:0,distant:0};
 private readonly world:Ground;private readonly key:ScenicWindFarmId;
 readonly sites:readonly {id:string;x:number;z:number}[];
 private readonly height:Float64Array;private readonly modes:Int8Array;
 private readonly clock={value:0};private readonly coatings:T.MeshStandardMaterial[];
 private readonly batches:{mast:T.InstancedMesh;rotor:T.InstancedMesh;phase:T.InstancedBufferAttribute}[]=[];
 private readonly pos=new T.Vector3();private readonly matrix=new T.Matrix4();
 private readonly spindle:T.Quaternion;private readonly armX:number;private readonly armZ:number;
 private readonly rootPins:readonly {site:number;pin:WindRoot}[];
 private readonly lease?:WindSocketLease;private socketBits=0;
 private syncSockets(){
  if(!this.lease||!this.rootPins.length)return;
  let bits=0;
  if(this.counts.registered)for(let i=0;i<this.rootPins.length;i++)if(this.modes[this.rootPins[i].site]>=0)bits|=1<<i;
  if(bits===this.socketBits)return;
  this.socketBits=bits;this.lease(this.key,this.rootPins.filter((_,i)=>(bits&(1<<i))!==0).map(v=>v.pin));
 }
 private staticLight?:StaticWindReceiver;private staticJob=false;private dead=false;
 private prepareLight?:StaticWindPrepare;
 lightClock(){return this.clock.value;}
 groundLightState(){return this.staticLight?.state??(this.prepareLight?{phase:this.staticJob?'pending':'cold',activeTiles:0,nearCasters:0}:null);}
 private updateStatic(eye:WindObserver){
  if(this.staticLight){this.staticLight.update(eye);return;}
  if(this.staticJob||!this.prepareLight||!this.root.visible)return;
  // Upper bound before even requesting the optional local evaluator. The
  // 3D art, timer and original canopy lease never depend on ground optics.
  if(!this.sites.some((s,i)=>this.modes[i]===0&&Math.abs(eye.y-this.height[i])<760&&
   (s.x-eye.x)**2+(s.z-eye.z)**2<1000**2))return;
  if(this.key==='east-point-ii')return;
  this.staticJob=true;
  void this.prepareLight(this.key,this).then(a=>{
   if(this.dead)a?.dispose();else{this.staticLight=a;this.prepareLight=undefined;}
  },()=>{this.prepareLight=undefined;});
 }
 private epoch=-1;private lastX=Infinity;private lastY=Infinity;private lastZ=Infinity;
 constructor(id:ScenicWindFarmId,scene:T.Scene,world:Ground,lease?:WindSocketLease,light?:StaticWindPrepare){
  this.prepareLight=id==='east-point-ii'?undefined:light;
  this.key=id;this.world=world;const profile=WIND_PROFILE[id];
  this.sites=windStations(id).map(([id,lon,lat])=>({id,...project(lon,lat)}));
  this.lease=lease;
  this.rootPins=(id==='east-point-ii'?[]:SOCKETS[id]).flatMap(pin=>{
   const site=this.sites.findIndex(s=>s.id===pin.id);
   if(site<0||Math.hypot(this.sites[site].x-pin.x,this.sites[site].z-pin.z)>=profile.towerBase)return [];
   return [{site,pin}];
  });
  this.height=new Float64Array(this.sites.length);this.modes=new Int8Array(this.sites.length).fill(-1);
  this.coatings=[finish(false,this.clock,0),finish(true,this.clock,profile.rpm)];
  this.spindle=yawQ.clone().multiply(new T.Quaternion().setFromAxisAngle(Z,profile.shaftTilt*Math.PI/180));
  this.armX=Math.cos(yaw)*profile.noseX;this.armZ=-Math.sin(yaw)*profile.noseX;
  this.root.name='Registered PEI wind / '+id;
  // Attach only after all inputs and the complete farm have succeeded.
  try{
   for(const lod of [0,1,2] as WindLod[]){
    const g=turbineGeometry(id,lod),phase=new T.InstancedBufferAttribute(new Float32Array(this.sites.length),1);
    g.rotor.setAttribute('regionalPhase',phase.setUsage(T.DynamicDrawUsage));
    const mast=new T.InstancedMesh(g.mast,this.coatings[0],this.sites.length),rotor=new T.InstancedMesh(g.rotor,this.coatings[1],this.sites.length);
    for(const [i,mesh] of [mast,rotor].entries()){
     mesh.count=0;mesh.visible=false;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
     mesh.name=profile.model+(i?' · swept rotor · ':' · tower and fairing · ')+['near','cruise','distant'][lod];this.root.add(mesh);
    }
    this.batches.push({mast,rotor,phase});
   }
   this.root.visible=false;scene.add(this.root);
  }catch(error){this.dispose();throw error;}
 }
 private seat(){
  this.epoch=this.world.visualGroundEpoch;
  for(const [i,s] of this.sites.entries()){
   const y=this.world.visualGroundHeight(s.x,s.z);
   if(!Number.isFinite(y)||!this.world.surface(s.x,s.z).land){this.counts.registered=0;return false;}
   this.height[i]=y;
  }
  this.counts.registered=this.sites.length;return true;
 }
 update(eye:WindObserver,time:number){
  const moved=Math.hypot(eye.x-this.lastX,eye.z-this.lastZ,eye.y-this.lastY)>8;
  const changed=this.world.visualGroundEpoch!==this.epoch;
  if(changed)this.seat();
  this.clock.value=time%600;
  if(!this.counts.registered){this.root.visible=false;this.counts.near=this.counts.cruise=this.counts.distant=0;this.syncSockets();this.staticLight?.clear();return;}
  if(!changed&&!moved){this.staticLight?.update(eye);return;}
  const count=[0,0,0],f=WIND_PROFILE[this.key];
  for(const [i,s] of this.sites.entries()){
   const y=this.height[i],d=Math.hypot(eye.x-s.x,eye.z-s.z,eye.y-(y+.58*f.hub)),prev=this.modes[i];
   const mode=d>WIND_RANGES.visible?-1:d<WIND_RANGES.near+(prev===0?85:0)?0:d<WIND_RANGES.cruise+(prev===1?175:0)?1:2;
   this.modes[i]=mode;if(mode<0)continue;
   const batch=this.batches[mode],at=count[mode]++;
   this.pos.set(s.x,y,s.z);batch.mast.setMatrixAt(at,this.matrix.compose(this.pos,yawQ,one));
   this.pos.set(s.x+this.armX,y+f.hub,s.z+this.armZ);
   batch.rotor.setMatrixAt(at,this.matrix.compose(this.pos,this.spindle,one));
   batch.phase.setX(at,i*golden);
  }
  this.lastX=eye.x;this.lastY=eye.y;this.lastZ=eye.z;
  [this.counts.near,this.counts.cruise,this.counts.distant]=count;
  this.root.visible=count[0]+count[1]+count[2]>0;this.syncSockets();
  for(const [lod,b] of this.batches.entries()){
   const n=count[lod];for(const mesh of [b.mast,b.rotor]){mesh.count=n;mesh.visible=n>0;if(n)mesh.instanceMatrix.needsUpdate=true;}
   if(n)b.phase.needsUpdate=true;
  }
  this.updateStatic(eye);
 }
 dispose(){this.dead=true;this.staticLight?.dispose();this.staticLight=undefined;this.counts.registered=0;this.syncSockets();this.root.removeFromParent();for(const {mast,rotor} of this.batches)for(const mesh of [mast,rotor]){mesh.dispose();mesh.geometry.dispose();}
  for(const m of this.coatings)m.dispose();this.root.clear();}
}
const windStations=(id:ScenicWindFarmId)=>id==='east-point-ii'?EAST_POINT_PHASE_II:WIND_STATIONS[id];
export function createRegionalWind(id:ScenicWindFarmId,scene:T.Scene,world:Ground,lease?:WindSocketLease,light?:StaticWindPrepare):RegionalWind|undefined{
 // The native cover is authenticated by the caller. Check the complete
 // 3-4 m foundation collar at every fixed site rather than accepting one dry center.
 for(const [,lon,lat] of windStations(id)){
  const {x,z}=project(lon,lat);
  for(const [dx,dz] of [[0,0],[-3,-3],[3,3],[-3,3],[3,-3],[-4,0],[4,0],[0,4],[0,-4]]){
   if(world.cover.distance(world.terrain,x+dx,z+dz)<=32||!world.terrain.isLand(x+dx,z+dz)||!world.surface(x+dx,z+dz).land|| !Number.isFinite(world.visualGroundHeight(x+dx,z+dz)))return;
  }
 }
 return new RegionalWind(id,scene,world,lease,light);
}
