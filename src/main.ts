import {greenGablesBarnRequested,greenGablesBarnAtlasMatches,greenGablesBarnGate} from './render/green-gables-barn-gate.ts';
import {GABLES_GRADE} from './sim/gables-grade.generated.ts';
import {gradeAtlasMatches,loadBoundedGrade} from './sim/bounded-grade.ts';
import {CAVENDISH_WATER_CORE as DUNELANDS} from './sim/cavendish-water-core.generated.ts';
import {cavendishAtlasMatches,loadCavendishWaterCore} from './sim/cavendish-water-core.ts';
import {GREEN_GABLES_REVIEW as GABLES} from './render/green-gables-review-spec.ts';
import {fetchProvinceDirectory,provinceFields} from './render/province-fields.ts';
import {cropFieldAtlasMatches,loadFieldPilot} from './render/fields-pilot.ts';
import {sceneryOptions,sceneryReviewBlock} from './app/scenery-profile.ts';
import {NorthCapeScenery} from './render/north-cape.ts';
import {buildNorthBaywalk} from './render/north-baywalk.ts';
import {loadBaywalkCourt,BAYWALK_ROAD_SHA,BAYWALK_ROAD_ORDINAL,BAYWALK_ROAD_FLAGS} from './sim/baywalk-native.ts';
import {loadSpinnakersDeck,buildSpinnakersDeck,spinnakersDeckSurface} from './render/spinnakers-deck.ts';
import {createBasinCannery} from './render/basin-cannery.ts';
import {createBasinFootbridge} from './render/basin-footbridge.ts';
import {createBasinWharf} from './render/basin-wharf.ts';
import {ReliefPacks} from './sim/relief-pack.ts';
import { DIALS, dialAngle } from './render/instruments.ts';
import { equivalentAirspeed } from './sim/aerodynamics.ts';
import * as THREE from 'three';
import {loadBowleyPond} from './sim/bowley-pond.ts';
import { loadAtlas, World } from './render/world.ts';
import { loadForestHeights } from './sim/forest-heights.ts';
import { HedgeStream } from './sim/hedge-stream.ts';
import { ForestStream } from './sim/forest-stream.ts';
import {project as projectSite} from './sim/geo.ts';
import { createAircraft } from './render/aircraft.ts';
import { addMainland } from './render/mainland.ts';
import {OCEAN_Y,type Terrain} from './sim/terrain.ts';
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
 const options=sceneryOptions(location.search),showBuildingShadows=options.has('buildingShadows');
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
 const useBasinBank=!options.has('noBasinBank');
 const useMontague=options.has('montagueFoundationPreview'),useBaywalk=options.has('spinnakersPreview')&&options.has('northBaywalkPreview');
 const preRoadJob=useMontague||useBaywalk?Roads.prepareMontague():undefined;
 const montagueRoadJob=useMontague?preRoadJob:undefined;
 const spinnakersJob=options.has('spinnakersPreview')?loadSpinnakersDeck(worldBase):undefined;
 const preBuildingJob=useBaywalk?Buildings.prepareBaywalk():undefined;
 const baywalkJob=useBaywalk?Promise.all([loadBaywalkCourt(worldBase),spinnakersJob,preRoadJob,preBuildingJob])
  .then(([court,deck,road,buildings])=>court&&deck&&buildings&&road?.digest===BAYWALK_ROAD_SHA&&road.roads[BAYWALK_ROAD_ORDINAL]?.flags===BAYWALK_ROAD_FLAGS?
   {court,deck,road:road.roads[BAYWALK_ROAD_ORDINAL].points}:undefined):undefined;
 const tryBarn=greenGablesBarnRequested(options);
 const tryGreenGables=options.has('greenGablesReview')&&!sceneryReviewBlock('greenGablesReview',options);
 const provinceAllowed=options.has('provinceFieldsReview')&&!sceneryReviewBlock('provinceFieldsReview',options);
 const provinceJob=provinceAllowed?fetchProvinceDirectory(worldBase):undefined;
 const fieldsJob=options.has('cropRowsReview')||provinceAllowed?loadFieldPilot(worldBase):undefined;
 const dunelandsCompatible=options.has('cavendishWaterReview')&&!sceneryReviewBlock('cavendishWaterReview',options);
 const dunelandsJob=dunelandsCompatible?loadCavendishWaterCore(DUNELANDS,worldBase):undefined;
 const gradeJob=options.has('gablesGradeReview')&&!options.has('surveyRelief')&&!options.has('inlandRelief')&&!showBuildingShadows?loadBoundedGrade(GABLES_GRADE,worldBase):undefined;
 const bowleyJob=options.has('bowleySurveyPreview')?loadBowleyPond(worldBase):undefined;
 const {terrain,terrainSha,img,cover,sky,bench,southLake,sourisLighting,basinSand,bankGround,bowley}=await loadAtlas(
   loadMsg,options.has('inlandRelief'),options.has('basinSand'),useBasinBank&&options.has('basinChannel'),montagueRoadJob?.then(q=>!!q?.montagueVerified),options.has('basinWharf'),baywalkJob,bowleyJob,!!fieldsJob||tryGreenGables||tryBarn||!!dunelandsJob||!!gradeJob);
 const useGrade=gradeJob&&gradeAtlasMatches(GABLES_GRADE,terrainSha,cover.sourceSha,cover.sourceDecodedSha)?await gradeJob:undefined;
 const grade=useGrade?.(terrain,(x,z)=>terrain.atlasElevation(x,z));
 const dunelands=dunelandsJob&&cavendishAtlasMatches(DUNELANDS,terrainSha,cover.sourceSha,cover.sourceDecodedSha)?await dunelandsJob:undefined;
 const forestHeights=await woodland;await warmForest;
 const proposedFields=await fieldsJob;
 const cropFields=cropFieldAtlasMatches(terrainSha,cover.sourceSha,cover.sourceDecodedSha)?proposedFields:undefined;
 if(!cropFields)proposedFields?.discard();
 const provinceReader=await provinceJob;
 const fieldStudy=provinceReader&&cropFields?provinceFields(provinceReader,cropFields):undefined;
 const world=new World(scene,terrain,img,renderer,cover,sky,bench,southLake,sourisLighting,
   showBuildingShadows,options.has('forestFloor'),useBasinBank,basinSand,bankGround,options.has('montagueReachOptics'),options.has('legacyShoreArcs'),cover.wharfToe&&!options.has('noBasinWharf'),options.has('shoreFoamDetail'),options.has('northCapeWind'),bowley,options.has('meadowTexture'),options.has('cropRowsReview')&&!fieldStudy?cropFields:undefined,fieldStudy,dunelands?[dunelands]:[],grade);
 const vegetation=new Vegetation(scene,terrain,cover,forestHeights,forestStream,hedgeStream,
   (x,z)=>world.visualGroundHeight(x,z),bankGround?(x,z)=>world.basinPlantedGround(x,z):undefined,options.has('canopyLight')?world.sun:undefined,bowley||dunelands?(x,z)=>world.freshwaterContains(x,z):undefined);
 const northCape=options.has('northCapeWind')?new NorthCapeScenery(scene,world):undefined;
 addConfederationBridge(scene);addBasilica(scene,terrain);addLighthouseScenery(scene,terrain);
 const spinnakers=spinnakersJob?.then(pack=>{
  if(!pack)return;
  const seat=spinnakersDeckSurface(pack),deck=buildSpinnakersDeck(pack,cover,terrain,seat);
  if(deck)return {deck,seat,assembleNorth:cover.baywalk?()=>buildNorthBaywalk(seat,world,options.has('baywalkConcrete')):undefined};
 }).catch(()=>undefined);

 const basinFootbridge=cover.basin&&bankGround&&!options.has('noBasinFootbridge')?
  createBasinFootbridge((x,z)=>world.basinCrossingGround(x,z),(x,z)=>cover.distance(terrain,x,z)>=0):undefined;
 if(basinFootbridge)scene.add(basinFootbridge);
 const basinCannery=cover.basin&&bankGround&&!options.has('noBasinCannery')?createBasinCannery((x,z)=>world.basinCrossingGround(x,z)):undefined;
 if(basinCannery)scene.add(basinCannery);
 const basinWharf=cover.wharfToe&&!options.has('noBasinWharf')?
  createBasinWharf((x,z)=>world.basinCrossingGround(x,z),(x,z)=>cover.distance(terrain,x,z)>=0,OCEAN_Y):undefined;
 if(basinWharf)scene.add(basinWharf);
 const glCanopy=renderer.getContext();
 if(options.has('woodland3D')&&glCanopy.getParameter(glCanopy.SAMPLES)>=2){
  void import('./render/woodland-volume.ts').then(({WoodlandVolume})=>
     vegetation.attachVolume(new WoodlandVolume(scene,45000),world,scene)).catch(()=>{});
 }
 let quartermasterDocks:ReturnType<typeof addQuartermasterDocks>;
 void dockPack.then(p=>quartermasterDocks=addQuartermasterDocks(scene,cover,world.sun,p));
 let mainland:Terrain|undefined;
 const sceneSurface=(x:number,z:number)=>{const s=world.surface(x,z);if(!s.land&&!world.freshwaterContains(x,z)&&mainland?.isLand(x,z)){s.height=mainland.elevation(x,z)+.18;s.land=true;}return s;};
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
 const startRoads=(prepared?:Awaited<typeof montagueRoadJob>)=>Roads.create(scene,terrain,world.buildingShadows,
  terrain.inlandGrids.length?()=>world.nearInlandGrids():undefined,options.has('seatedRoads')?world:undefined,
  cover.montague||cover.baywalk?world:undefined,prepared,world.capeShadow);
 const roadReady=(preRoadJob?preRoadJob.then(startRoads):startRoads()).then(v=>roads=v).catch(e=>{warn('Road',e);});
 const greenGablesGate=tryGreenGables&&terrainSha===GABLES.terrain&&
  cover.sourceSha===GABLES.cover&&cover.sourceDecodedSha===GABLES.coverDecoded?()=>{
   const y=world.visualGroundHeight(...GABLES.centroidXZ);
   return y>=11.26&&y<=13.44;
  }:undefined;
 const barnGate=tryBarn&&greenGablesBarnAtlasMatches(terrainSha,cover.sourceSha,cover.sourceDecodedSha)?greenGablesBarnGate(world):undefined;
 const buildingReady=Buildings.create(scene,terrain,sourisLighting,world.buildingShadows,spinnakers,preBuildingJob,options.has('beaconsfieldReview')&&!sceneryReviewBlock('beaconsfieldReview',options),greenGablesGate,barnGate).then(v=>buildings=v).catch(e=>{warn('Building',e);});
 if(fieldStudy)void Promise.all([roadReady,buildingReady]).then(([r,b])=>{
  fieldStudy.admitted=r?.sourceGeometrySha256==='72528a1b26b68ee345e5047f30f2c9b49a3c18edeaccaf3e759ead296d3276c1'&&
    b?.sourceAtlasSha256==='538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557';
 });
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
  groundY.copy(aircraft.root.position);world.update(camera.position,time);northCape?.update(camera.position,time);
  if(basinFootbridge){
   const dx=camera.position.x-basinFootbridge.position.x,dz=camera.position.z-basinFootbridge.position.z;
   // A 10 m boardwalk needs no near-detail draw at the distant headlands.
   basinFootbridge.visible=dx*dx+dz*dz<3000**2;
  }
  if(basinWharf)basinWharf.visible=Math.hypot(camera.position.x-basinWharf.position.x,camera.position.z-basinWharf.position.z)<3100;
  if(basinCannery)basinCannery.visible=Math.hypot(camera.position.x-basinCannery.position.x,camera.position.z-basinCannery.position.z)<4600;
  const eyeAGL=camera.position.y-world.groundHeight(camera.position.x,camera.position.z);
  roads?.update(f.x,f.z,eyeAGL);buildings?.update(f.x,f.z);sidewalks?.update(camera.position.x,camera.position.z,eyeAGL);parking?.update(camera.position.x,camera.position.z,eyeAGL);vegetation.update(f.x,f.z,f.y);vegetation.updateVolume(camera.position.x,camera.position.z,eyeAGL);
  ui.update(f,world.groundHeight(f.x,f.z)-.12);audio.update(f.throttle,f.speed,playing&&!f.engineOut);
  if(world.buildingShadows){
   world.buildingShadows.render(camera.position,world.groundHeight(camera.position.x,camera.position.z),
    buildings?liveCasters:undefined);
  }
  renderer.render(scene,camera);
  if(diagnostic){
   Object.assign(window,{islandAirDiagnostics:{provinceFields:fieldStudy?.stream.state??null,cropRowsReview:!!world.fieldPilot,beaconsfieldReview:buildings?.beaconsfieldPreviewActive??false,greenGablesReview:buildings?.greenGablesPreviewActive??false,greenGablesBarnReview:buildings?.greenGablesBarnPreviewActive??false,site:SITES[activeSite].id,mode:ui.mode,camera:names[view],x:f.x,z:f.z,altitude:f.y,heading:f.heading,bank:f.bank,speed:f.speed,throttle:f.throttle,engineOut:f.engineOut,
    legacyShore:world.legacyShoreState,shoreFoamDetail:options.has('shoreFoamDetail'),canopyLight:options.has('canopyLight'),northCape:northCape?.counts??null,adaptiveTerrain:world.adaptiveState,forestFloor:world.floorState,buildingShadows:world.buildingShadows?.state??null,hedgerows:{...hedgeStream.state,visible:vegetation.hedgeCount},woodlandStream:forestStream.state,woodlandVolume:vegetation.volumeCount,woodlandGroundedShadows:vegetation.groundedShadowCount,woodlandHeights:forestHeights?.ids??[],rudderAngle:aircraft.rudderAngle(),altitudeAngles:aircraft.altitudeAngles(),controlAngles:aircraft.controlAngles(),inlandSurveys:terrain.inlandGrids.map(g=>g.spec.id),coastalSurveys:terrain.coastalSurveys,coastalRefinements:terrain.coastalRefinements,coastalBenches:world.coastalBenches,shelteredWater:world.shelteredWater,bowleyPond:world.bowleyPond,cavendishWaterCore:world.hasFreshwaterSource(DUNELANDS.id)?DUNELANDS.id:null,localGroundGrade:world.activeGroundGrade,harbourShoreline:cover.harbour?.plan.id??null,montagueFoundation:cover.montague?.plan.id??null,montagueBridge:roads?.bridgePreviewActive??false,spinnakersDeck:buildings?.spinnakersActive??false,northBaywalkCourt:world.baywalkActive,northBaywalkRamp:buildings?.northBaywalkActive??false,northBaywalkRoad:roads?.baywalkRoadActive??false,northBaywalkConcrete:buildings?.northConcreteActive??false,basinShoreline:cover.basin?.plan.id??null,basinFootbridge:!!basinFootbridge,basinFootbridgeVisible:basinFootbridge?.visible??false,basinCanneryVisible:basinCannery?.visible??false,basinWharfVisible:basinWharf?.visible??false,basinWharfToe:cover.wharfToe,quartermasterDocks:quartermasterDocks??null,sourisLighting:sourisLighting?.active.value?sourisLighting.id:null,groundY:world.groundHeight(f.x,f.z),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,roads:!!roads,pavement:roads?.pavementStatus??null,seatedRoads:roads?.seatState??null,sidewalks:sidewalks?.state??null,parking:parking?.state??null,buildings:!!buildings,buildingTiles:buildings?.diagnostics(),mainland:!!mainland,detail:world.detailState(),layerWarnings:layerWarnings.slice()}});
  }
 });
}
run().catch(err=>{console.error(err);failUI(err instanceof Error?err.message:String(err));});
