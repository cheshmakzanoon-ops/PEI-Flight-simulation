import type {BufferGeometry,PerspectiveCamera,Scene,WebGLRenderer} from 'three';
import type {World} from '../world.ts';
import type {Buildings} from '../buildings.ts';
import type {Vegetation} from '../vegetation.ts';
import type {RiverCohort} from '../../app/indian-river-departure.ts';
import {INDIAN_RIVER_GRADE as G} from '../../sim/indian-river-grade.generated.ts';
import {supportsOpaqueCoverage} from '../opaque-coverage-alpha.ts';
import {olearyLinkPrograms} from '../oleary-railway/program-gate.ts';
import {linkChurchOpaquePrograms} from './church-opaque-programs.ts';
import {prepareChurchArt} from './runtime.ts';
import {loadStandardIndianRiverSource} from './standard-source.ts';
import {mappedHedgeShadowsAvoidGrade} from './st-marys-hedge-guard.ts';
import {prepareStMarysShadowPreflight,type StMarysPreparedShadowPair} from './st-marys-shadow-preflight.ts';

type Context={
 base:string;world:World;buildings:Buildings;vegetation:Vegetation;scene:Scene;camera:PerspectiveCamera;renderer:WebGLRenderer;
 terrainSHA?:string;roadsSHA?:string;preparing:()=>boolean;route:()=>boolean;
};
export type LiveIndianRiverCohort=RiverCohort&{
 beginDraw:()=>undefined|(()=>void);
 updateDetail:(height:number)=>void;
 detail:()=>ReturnType<typeof prepareChurchArt>['detail'];
 shadowInfo:()=>{revision:number;triangles:number;slots:readonly number[]};
};

export async function prepareStandardIndianRiverCohort(o:Context,signal:AbortSignal):Promise<LiveIndianRiverCohort|undefined>{
 const {world,buildings,vegetation,scene,camera,renderer}=o;
 const gl=renderer.getContext();
 let phase:'checking'|'ready'|'live'|'closed'='checking';
 const compatible=()=>!signal.aborted&&o.route()&&!gl.isContextLost()&&renderer.getContext()===gl&&
  renderer.getRenderTarget()===null&&!renderer.xr.isPresenting&&!scene.overrideMaterial&&!renderer.shadowMap.enabled&&
  supportsOpaqueCoverage(gl)&&gl.getParameter(gl.SAMPLES)===4&&camera.layers.mask===1;
 const permit=()=>phase!=='closed'&&compatible()&&(phase!=='checking'||o.preparing());
 if(!permit()||!buildings.standardIndianRiverSourceReady)return;
 const source=await loadStandardIndianRiverSource(o.base,{cover:world.cover,terrain:world.terrain,
  terrainSHA:o.terrainSHA,roadsSHA:o.roadsSHA,accept:permit,signal});
 if(!source)return;
 const {grade,sun}=source;
 let installedOwner=false,adopted=false,shadow:StMarysPreparedShadowPair|undefined;
 let shadowWarm:Awaited<ReturnType<typeof prepareStMarysShadowPreflight>>,art:ReturnType<typeof prepareChurchArt>|undefined;
 let seeing:((()=>boolean))|undefined,geometry:BufferGeometry|undefined;
 const clear=()=>{
  if(phase==='closed')return;
  phase='closed';sun.live.value=0;
  art?.setView(camera.position,world,G.id,false);
  if(installedOwner){buildings.syncIndianRiver();buildings.dropStandardIndianRiver(art);}
  if(geometry)world.retireIndianRiverTerrain(geometry);world.disposeIndianRiverSun(sun);
  try{shadow?.dispose();}
  finally{
   try{shadowWarm?.dispose();}
   finally{try{art?.dispose();}finally{sun.uniforms.churchSunMask.value.dispose();}}
  }
 };
 try{
  if(!permit()||!buildings.standardIndianRiverSourceReady)return;
  const draft=world.stageIndianRiverLens(grade);
  if(!draft)return;
  geometry=draft.mesh.geometry;
  const roster=()=>vegetation.beaconsfieldShadowRoster();
  let checked=-1,safe=false;
  const hedges=()=>{
   const r=roster();
   if(r.revision!==checked){checked=r.revision;safe=mappedHedgeShadowsAvoidGrade(draft.bounds,r.stems,r.shapes,r.original,r.total);}
   return safe;
  };
  art=prepareChurchArt();
  const [paint,opaque,prepared]=await Promise.all([
   world.prepareIndianRiverSun(sun,olearyLinkPrograms(renderer,camera,scene,1,false,4500),signal),
   linkChurchOpaquePrograms(renderer,camera,scene,art.group,signal),
   prepareStMarysShadowPreflight({renderer,camera,scene,source:draft,roster,permit:()=>permit()&&hedges(),signal}),
  ]);
  shadowWarm=prepared;seeing=opaque;
  if(!paint||!seeing||!shadowWarm||!permit()||!world.indianRiverSunReady||!seeing()||!hedges())return;
  installedOwner=await buildings.prepareStandardIndianRiver(art,permit);
  if(!installedOwner||!permit()||!buildings.indianRiverLensDrawReady||!(shadow=shadowWarm.take()))return;
  const paintArt=art,shade=shadow;
  const stage=()=>world.stageIndianRiverLens(grade)?.mesh.geometry===geometry;
  const pass=()=>permit()&&world.indianRiverSunReady&&!!seeing?.()&&paintArt.inRange(camera.position)&&
   buildings.indianRiverLensDrawReady&&hedges();
  const paired=()=>shade.unmountedStill();
  const ready=()=>phase==='ready'&&pass()&&stage()&&shade.refresh()&&paired();
  const couple=()=>{
   if(!pass()||!stage()||!shade.refresh()||!paired()||!world.setIndianRiverLens(true))return false;
   sun.live.value=1;paintArt.setView(camera.position,world,G.id,true);buildings.syncIndianRiver();
   return buildings.indianRiverActive;
  };
  phase='ready';if(!ready())return;
  adopted=true;
  return {
   ready,
   commit(){if(!ready()||!couple())return false;phase='live';return true;},
   maintain(){return phase==='live'&&couple();},
   dispose:clear,
   updateDetail(height){if(phase==='live')paintArt.updateDetail(camera,height);},
   detail:()=>paintArt.detail,
   shadowInfo:()=>({revision:shade.forestRevision,triangles:shade.triangleCount,slots:shade.slots}),
   beginDraw(){
    if(phase!=='live'||!compatible()||!buildings.indianRiverActive||!paired())return;
    const endSun=world.beginIndianRiverSunDraw();if(!endSun)return;
    const {stock,stockGeometry,stockMaterial,suppression,receiver}=shade;
    if(stock.geometry!==stockGeometry||stock.material!==stockMaterial||receiver.parent){endSun();return;}
    const end=()=>{
     if(stock.geometry===suppression.geometry)stock.geometry=stockGeometry;
     if(stock.material===suppression.material)stock.material=stockMaterial;
     try{if(receiver.parent===scene)scene.remove(receiver);}finally{endSun();}
    };
    try{stock.geometry=suppression.geometry;stock.material=suppression.material;scene.add(receiver);return end;}
    catch{end();return;}
   },
  };
 }catch{return;}
 finally{if(!adopted)clear();}
}
