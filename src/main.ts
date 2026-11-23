import {ReliefPacks} from './sim/relief-pack.ts';
import { DIALS, dialAngle } from './render/instruments.ts';
import { equivalentAirspeed } from './sim/aerodynamics.ts';
import * as THREE from 'three';
import { loadAtlas, World } from './render/world.ts';
import { loadForestHeights } from './sim/forest-heights.ts';
import { HedgeStream } from './sim/hedge-stream.ts';
import { ForestStream } from './sim/forest-stream.ts';
import {project as projectSite} from './sim/geo.ts';
import { createAircraft } from './render/aircraft.ts';
import { addMainland } from './render/mainland.ts';
import type {Terrain} from './sim/terrain.ts';
import { addLighthouseScenery } from './render/lighthouses.ts';
import { addBasilica } from './render/basilica.ts';
import { addConfederationBridge } from './render/confederation.ts';
import {addQuartermasterDocks,loadQuartermasterDocks} from './render/quartermaster-docks.ts';
import { Vegetation } from './render/vegetation.ts';
import { Roads } from './render/roads.ts';
import {loadSidewalks,Sidewalks} from './render/sidewalks.ts';
import {SIDEWALKS} from './render/sidewalks.generated.ts';
import {loadParkingSurfaces,ParkingSurfaces} from './render/parking-surfaces.ts';
import {MAPPED_PARKING} from './render/parking-surfaces.generated.ts';
import { Buildings } from './render/buildings.ts';
import { Input } from './app/input.ts';
import { EngineSound } from './app/sound.ts';
import { UI, bootUI, loadMsg, failUI } from './app/ui.ts';
import {windmillOmegaRadS} from './sim/windmilling.ts';
import { spawn, step, setEngineOut, FIXED_STEP } from './sim/flight.ts';
import { SITES } from './sim/places.ts';
import { clamp, RAD, geographic } from './sim/geo.ts';
import './app/style.css';
bootUI();
async function run(){
 const showBuildingShadows=new URLSearchParams(location.search).has('buildingShadows');
 let renderer:THREE.WebGLRenderer;
 try{renderer=new THREE.WebGLRenderer({canvas:document.querySelector<HTMLCanvasElement>('#world')!,antialias:true,alpha:false,logarithmicDepthBuffer:true,powerPreference:'high-performance'});}
 catch{throw Error('WebGL 2 is required. Enable hardware acceleration or open this page in a WebGL 2 browser.');}
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(53,innerWidth/innerHeight,.08,350000),cameraUp=new THREE.Vector3(0,1,0);
 const woodland=loadForestHeights(import.meta.env.BASE_URL),forestStream=new ForestStream(import.meta.env.BASE_URL),hedgeStream=new HedgeStream(import.meta.env.BASE_URL);
 const startPoint=projectSite(SITES[0].lon,SITES[0].lat),warmForest=forestStream.warm(startPoint.x,startPoint.z);
 const worldBase=import.meta.env.BASE_URL+'world/';
 const dockPack=loadQuartermasterDocks(worldBase),mappedSidewalks=loadSidewalks(worldBase),mappedParking=loadParkingSurfaces(worldBase);
 const {terrain,img,cover,sky,bench,southLake,sourisLighting}=await loadAtlas(loadMsg,new URLSearchParams(location.search).has('inlandRelief'));const forestHeights=await woodland;await warmForest;const world=new World(scene,terrain,img,renderer,cover,sky,bench,southLake,sourisLighting,showBuildingShadows,new URLSearchParams(location.search).has('forestFloor'));const vegetation=new Vegetation(scene,terrain,cover,forestHeights,forestStream,hedgeStream,(x,z)=>world.visualGroundHeight(x,z));addConfederationBridge(scene);addBasilica(scene,terrain);addLighthouseScenery(scene,terrain);
 const glCanopy=renderer.getContext();
 if(new URLSearchParams(location.search).has('woodland3D')&&glCanopy.getParameter(glCanopy.SAMPLES)>=2){
  void import('./render/woodland-volume.ts').then(({WoodlandVolume})=>
     vegetation.attachVolume(new WoodlandVolume(scene,45000),world,scene)).catch(()=>{});
 }
 let quartermasterDocks:ReturnType<typeof addQuartermasterDocks>;
 void dockPack.then(p=>quartermasterDocks=addQuartermasterDocks(scene,cover,world.sun,p));
 let mainland:Terrain|undefined;
 const sceneSurface=(x:number,z:number)=>{const s=world.surface(x,z);if(!s.land&&mainland?.isLand(x,z)){s.height=mainland.elevation(x,z)+.18;s.land=true;}return s;};
 const aircraft=createAircraft();scene.add(aircraft.root);const audio=new EngineSound();
 let activeSite=0,f=spawn(SITES[0],sceneSurface),acc=0,view=0,time=0,last=performance.now(),snap=true;
 const names=['Chase','Cockpit','Wide chase'];let ui:UI;
 const pause=()=>{if(ui?.mode==='flight')ui.set('paused');else if(ui?.mode==='paused')ui.set('flight');};
 const cameraCycle=()=>{view=(view+1)%names.length;ui.setCamera(names[view]);snap=true;};
 const input=new Input(code=>{if(!ui)return;
  if(code==='Escape'){
   if(ui.mode==='flight'||ui.mode==='paused')pause();else if(['map','credits','help'].includes(ui.mode))ui.close();
  }
  if(code==='KeyP')pause();
  if(code==='KeyM')ui.toggle('map');if(code==='KeyH')ui.toggle('help');
  if(code==='KeyV'&&ui.mode==='flight')cameraCycle();
  if(code==='KeyR'&&ui.mode==='crash')start(activeSite);
 });
 const reposition=(i:number)=>{activeSite=clamp(i,0,SITES.length-1);f=spawn(SITES[activeSite],sceneSurface);acc=0;snap=true;};
 const start=(i:number)=>{reposition(i);ui.departure(i);};
 ui=new UI(terrain,input,{start,resume:()=>ui.set('flight'),view:cameraCycle,sound:()=>void audio.toggle().then(v=>ui.setSound(v)).catch(()=>{}),pause,restart:()=>start(activeSite),
  engineState:()=>({out:f.engineOut,airborne:f.status==='flying'}),
  practiceFailure:(out:boolean)=>setEngineOut(f,out)});
 const resize=()=>{renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();snap=true;};resize();window.addEventListener('resize',resize);
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&ui.mode==='flight')ui.set('paused');acc=0;last=performance.now();input.clear();});
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();renderer.setAnimationLoop(null);failUI('Your browser lost the graphics context. Reload to restart the atlas; other GPU-heavy tabs can use the same memory.');});
 const layerWarnings:string[]=[];const warn=(layer:string,e:unknown)=>{layerWarnings.push(layer);ui.setWarnings(layerWarnings);console.warn(layer+' layer unavailable',e);};
 let roads:Roads|undefined,buildings:Buildings|undefined,sidewalks:Sidewalks|undefined,parking:ParkingSurfaces|undefined;
 void addMainland(scene).then(t=>mainland=t).catch(e=>warn('Mainland',e));
 const roadReady=Roads.create(scene,terrain,world.buildingShadows,terrain.inlandGrids.length?()=>world.nearInlandGrids():undefined,
  new URLSearchParams(location.search).has('seatedRoads')?world:undefined).then(v=>roads=v).catch(e=>{warn('Road',e);});
 const buildingReady=Buildings.create(scene,terrain,sourisLighting,world.buildingShadows).then(v=>buildings=v).catch(e=>{warn('Building',e);});
 if(cover.sourceSha===SIDEWALKS.pinCoverSha256){
  void Promise.all([mappedSidewalks,roadReady,buildingReady]).then(([paths,street,structures])=>{
   if(paths&&street&&structures&&street.sourceGeometrySha256===SIDEWALKS.pinRoadGeometrySha256&&
      structures.sourceAtlasSha256===SIDEWALKS.pinBuildingAtlasSha256)sidewalks=new Sidewalks(scene,world,paths);
  });
 }
 if(new URLSearchParams(location.search).has('surveyRelief')&&/^e2dce7c86c4b5cd45ea45fb92ed89c2ae504306e4349e1291e627a669630e384$/.test(SIDEWALKS.sha256)){
  void Promise.all([roadReady,buildingReady]).then(async([street,structures])=>{
   const {sha256}=terrain.spec as typeof terrain.spec&{sha256?:string};
   if(!sha256||!street?.sourceGeometrySha256||!structures?.sourceAtlasSha256||!cover.sourceSha)return;
   const stream=await ReliefPacks.open(import.meta.env.BASE_URL,{terrain:sha256,cover:cover.sourceSha,
      road:street.sourceGeometrySha256,buildings:structures.sourceAtlasSha256});
   if(stream)world.enableAdaptiveTerrain(stream);
  });
 }
 if(cover.sourceSha===MAPPED_PARKING.pinCoverSha256&&SIDEWALKS.sha256===MAPPED_PARKING.pinSidewalkSha256){
  void Promise.all([mappedParking,roadReady,buildingReady]).then(([areas,street,structures])=>{
   if(areas&&street&&structures&&street.sourceGeometrySha256===MAPPED_PARKING.pinRoadGeometrySha256&&
      structures.sourceAtlasSha256===MAPPED_PARKING.pinBuildingAtlasSha256)parking=new ParkingSurfaces(scene,world,areas);
  });
 }
 const tgt=new THREE.Vector3(),eye=new THREE.Vector3(),forward=new THREE.Vector3(),up=new THREE.Vector3(),right=new THREE.Vector3(),rot=new THREE.Quaternion(),aim=new THREE.Vector3(),groundY=new THREE.Vector3();
 const liveCasters=(x:number,z:number,d:number,out:THREE.Mesh[])=>buildings?.drawableCasters(x,z,d,out);
 const diagnostic=import.meta.env.DEV||new URLSearchParams(location.search).has('diagnostics');
 const rE=new THREE.Euler(0,0,0,'YXZ');let oldMode=ui.mode;
 renderer.setAnimationLoop((now:number)=>{
  const delta=Math.min(.10,Math.max(0,(now-last)*.001));last=now;time+=delta;
  const u=input.poll(pause);
  if(ui.mode==='dispatch'&&ui.selected!==activeSite)reposition(ui.selected);
  const dispatch=ui.mode==='dispatch',playing=ui.mode==='flight';
  world.prepareAdaptiveTerrain(f.x,f.z,f.y,performance.now());
  if(playing){
   acc+=delta;let n=0;while(acc>=FIXED_STEP&&n++<12){step(f,u,sceneSurface);acc-=FIXED_STEP;}
   if(f.status==='stopped')ui.stop(mainland?.isLand(f.x,f.z)?'Mainland scenery boundary':f.notice);
   const ll=geographic(f.x,f.z),[W,S,E,N]=terrain.spec.bounds;
   if(ll.lon<W-.07||ll.lon>E+.07||ll.lat<S-.04||ll.lat>N+.04){f.status='stopped';ui.stop('Outside the survey area');}
  }else acc=0;
  if(ui.mode!==oldMode){snap=true;oldMode=ui.mode;}
  const cinematic=dispatch||((ui.mode==='map'||ui.mode==='help'||ui.mode==='credits')&&ui.previous==='dispatch');
  const phase=cinematic?(Math.sin(time*.14)*.009):0;
  aircraft.root.position.set(f.x,f.y,f.z);aircraft.root.rotation.set(f.pitch,-f.heading,-f.bank+phase,'YXZ');
  aircraft.setInterior(!cinematic&&view===1);
  if(playing||cinematic)aircraft.setControls(playing?u:{pitch:0,roll:0},delta);
  const propSpeed=f.engineOut?windmillOmegaRadS(f.speed):20+155*f.throttle;
  aircraft.prop.rotation.z+=(ui.mode==='flight'||cinematic)?delta*propSpeed:0;
  aircraft.setProp(f.engineOut?clamp((propSpeed-20)/155,0,1):f.throttle);
  aircraft.needles[0].rotation.z=-dialAngle(DIALS[0],equivalentAirspeed(f.speed,f.y)*1.94384);
  aircraft.setAltitude(f.y*3.280839895);
  aircraft.needles[2].rotation.z=-dialAngle(DIALS[2],f.throttle*100);
  aircraft.needles[3].rotation.z=-dialAngle(DIALS[3],f.vertical*196.85);
  rE.set(f.pitch,-f.heading,-f.bank+phase,'YXZ');rot.setFromEuler(rE);
  forward.set(Math.sin(f.heading),0,-Math.cos(f.heading));right.set(Math.cos(f.heading),0,Math.sin(f.heading));
  if(cinematic){
   // Dispatch backdrop deliberately offsets the aircraft to the right of the pilot desk.
   eye.copy(aircraft.root.position).addScaledVector(forward,-15).addScaledVector(right,8.8);eye.y+=5.5;
   tgt.copy(aircraft.root.position).addScaledVector(forward,5).addScaledVector(right,-9);tgt.y+=1.3;
   up.copy(cameraUp);
  }else if(view===1){
   eye.set(0,.73,-.36).applyQuaternion(rot).add(aircraft.root.position);
   tgt.set(0,-.02,-50).applyQuaternion(rot).add(eye);up.copy(cameraUp).applyQuaternion(rot);
  }else{
   const far=view===2;const distance=(far?37:16.8)*Math.max(1,1.05/camera.aspect);eye.copy(aircraft.root.position).addScaledVector(forward,-distance);eye.y+=far?11:4.2;
   tgt.copy(aircraft.root.position).addScaledVector(forward,far?9:7.8);tgt.y+=far?2.1:1.18+Math.sin(f.pitch)*4.5;
   up.copy(cameraUp);
  }
  eye.y=Math.max(eye.y,world.groundHeight(eye.x,eye.z)+.58);
  if(snap||view===1){camera.position.copy(eye);aim.copy(tgt);}else{
    camera.position.lerp(eye,1-Math.exp(-delta*7));aim.lerp(tgt,1-Math.exp(-delta*10));
  }
  snap=false;camera.up.copy(up);camera.lookAt(aim);camera.updateMatrixWorld();
  groundY.copy(aircraft.root.position);world.update(camera.position,time);
  const eyeAGL=camera.position.y-world.groundHeight(camera.position.x,camera.position.z);
  roads?.update(f.x,f.z,eyeAGL);buildings?.update(f.x,f.z);sidewalks?.update(camera.position.x,camera.position.z,eyeAGL);parking?.update(camera.position.x,camera.position.z,eyeAGL);vegetation.update(f.x,f.z,f.y);vegetation.updateVolume(camera.position.x,camera.position.z,eyeAGL);
  ui.update(f,world.groundHeight(f.x,f.z)-.12);audio.update(f.throttle,f.speed,playing&&!f.engineOut);
  if(world.buildingShadows){
   world.buildingShadows.render(camera.position,world.groundHeight(camera.position.x,camera.position.z),
    buildings?liveCasters:undefined);
  }
  renderer.render(scene,camera);
  if(diagnostic){
   Object.assign(window,{islandAirDiagnostics:{site:SITES[activeSite].id,mode:ui.mode,camera:names[view],x:f.x,z:f.z,altitude:f.y,heading:f.heading,bank:f.bank,speed:f.speed,throttle:f.throttle,engineOut:f.engineOut,
    adaptiveTerrain:world.adaptiveState,forestFloor:world.floorState,buildingShadows:world.buildingShadows?.state??null,hedgerows:{...hedgeStream.state,visible:vegetation.hedgeCount},woodlandStream:forestStream.state,woodlandVolume:vegetation.volumeCount,woodlandGroundedShadows:vegetation.groundedShadowCount,woodlandHeights:forestHeights?.ids??[],rudderAngle:aircraft.rudderAngle(),altitudeAngles:aircraft.altitudeAngles(),controlAngles:aircraft.controlAngles(),inlandSurveys:terrain.inlandGrids.map(g=>g.spec.id),coastalSurveys:terrain.coastalSurveys,coastalRefinements:terrain.coastalRefinements,coastalBenches:world.coastalBenches,shelteredWater:world.shelteredWater,harbourShoreline:cover.harbour?.plan.id??null,quartermasterDocks:quartermasterDocks??null,sourisLighting:sourisLighting?.active.value?sourisLighting.id:null,groundY:world.groundHeight(f.x,f.z),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,roads:!!roads,pavement:roads?.pavementStatus??null,seatedRoads:roads?.seatState??null,sidewalks:sidewalks?.state??null,parking:parking?.state??null,buildings:!!buildings,buildingTiles:buildings?.diagnostics(),mainland:!!mainland,detail:world.detailState(),layerWarnings:layerWarnings.slice()}});
  }
 });
}
run().catch(err=>{console.error(err);failUI(err instanceof Error?err.message:String(err));});
