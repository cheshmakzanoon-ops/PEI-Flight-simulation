import {supportsOpaqueCoverage} from './render/opaque-coverage-alpha.ts';
import {supportsOpaqueCanopyCoverage} from './render/canopy-coverage-alpha.ts';
import {verifiedPrinceOverview} from './render/prince-grassland/source.ts';
import {northCapeStandOption} from './app/north-cape-stand-option.ts';
import type {NorthCapeStandReview} from './render/north-cape-stand/review.ts';
import {olearyLinkPrograms} from './render/oleary-railway/program-gate.ts';
import {olearyIndustrialDry} from './render/oleary-railway/industrial-seat.ts';
import {standardWharfLoader,standardWharfRequested} from './render/spinnakers-standard.ts';
import {olearyCloseCamera,olearyGradeCenter,olearySiteAllows} from './render/oleary-railway/authority.ts';
import {princeSkyBudget} from './render/prince-roof-sky-budget.ts';
import {standardPrinceSurveyRoof,standardPrinceRoofContact} from './app/scenery-profile.ts';
import {PASTURE,PanmurePastureFlight} from './render/panmure-pasture/flight.ts';
import {standardPanmurePastureRequested} from './app/scenery-profile.ts';
import {StandardNearshore} from './render/nearshore-standard.ts';
import {StandardMeadow,standardLandAtlasMatches} from './render/meadow-standard.ts';
import {StandardBasinSand} from './render/basin-head-sand.ts';
import {RegionalCanopies} from './render/regional-canopy/controller.ts';
import {REGIONAL_STANDS} from './render/regional-canopy/spec.ts';
import {regionalBase,regionalLayers} from './render/regional-canopy/ground.ts';
import {REGIONAL_CANOPY_DEPARTURES} from './render/regional-canopy/departures.ts';
import {POINT_PRIM_DEPARTURE,pointPrimBase,pointPrimLayers,pointPrimRequested,pointPrimDepartureAvailable} from './render/point-prim/admit.ts';
import {PointPrimFlight} from './render/point-prim/flight.ts';
import {authenticateSummersideFrontage,SUMMERSIDE_FRONTAGE_ROOT,summersideFrontageCompatible} from './render/summerside-open-ground.ts';
import {downtownSceneryCompatible} from './render/summerside-roof-source.ts';
import {aerialPerspectiveRequested,loadAerialModule} from './render/aerial-profile.ts';
import {sourisEastGround} from './render/souris-east/ground.ts';
import {shoreToneRequested} from './render/shore-tone.ts';
import {townWallMode,TOWN_WALL_CORE_AREAS} from './render/town-wall-optics.ts';
import {nearshoreFoamRequested} from './render/nearshore-foam.ts';
import {stDavidsRequested,stDavidsGround,stDavidsStandardRequested,standardStDavidsGround} from './render/st-davids/admit.ts';
import {ST_DAVIDS} from './render/st-davids/source.generated.ts';
import {GEORGETOWN_GROUND_SUN} from './render/st-davids/ground-sun.generated.ts';
import {georgetownSunMatches} from './render/st-davids/ground-sun.ts';
import {railRequested,railGround,railStandardRequested,standardRailGround} from './render/summerside-station/admit.ts';
import {SUMMERSIDE_STATION as RAIL} from './render/summerside-station/source.generated.ts';
import {DUNE_RELIEF} from './sim/dune-relief.generated.ts';
import {GREEN_GABLES_BARN as BARN} from './render/green-gables-barn-spec.ts';
import {CANOPY_FENCE} from './render/canopy-fence.generated.ts';
import {WORLD_COLS,WORLD_ROWS,SURVEY_LOD} from './sim/coastal-terrain.ts';
import {KINGS_DRY_CROWN} from './sim/kings-dry-crown.generated.ts';
import {kingsDryCrownHedges,kingsDryCrownInterior,kingsDryCrownRequested,kingsDryCrownSources} from './sim/kings-dry-crown.ts';
import {HOG_WEST_GRADE} from './sim/hog-west-grade.generated.ts';
import {pinnedHogBuildingIndex} from './sim/hog-west-grade.ts';
import {loadHogPhoto,matchesHogPhoto,hogInfrastructureMatches,loadWestDuneOptics} from './render/hog-photo.ts';
import {CHURCH_SUN_MASK} from './render/indian-river/church-sun.generated.ts';
import {loadChurchGroundSun} from './render/indian-river/church-ground-sun.ts';
import {INDIAN_RIVER_GRADE} from './sim/indian-river-grade.generated.ts';
import {churchLandSource} from './render/indian-river/indian-river-guard.ts';
import {fetchGrassStudy,grassSourceAllows,provinceGrass} from './render/province-grass.ts';
import {GRASS_SOURCE_PINS} from './render/province-grass.generated.ts';
import {DRY_FRAME} from './render/dry-coast/soil.ts';
import {RUSTICO_GRADE} from './sim/rustico-grade.generated.ts';
import {loadGablesFairway,fairwayAtlasMatches,fairwayGeometryMatches} from './render/gables-fairway.ts';
import {gablesGravelAtlasMatches,gablesGravelGeometryMatches} from './render/gables-gravel.ts';
import {greenGablesBarnRequested,greenGablesBarnAtlasMatches,greenGablesBarnGate,greenGablesBarnStandardRequested,greenGablesBarnStandardGate} from './render/green-gables-barn-gate.ts';
import {GABLES_GRADE} from './sim/gables-grade.generated.ts';
import {BEACON_GRADE,BEACON_RECEIVERS} from './sim/beaconsfield-grade.generated.ts';
import {beaconsfieldGradeRequested} from './sim/beaconsfield-grade-admit.ts';
import type {MuseumShadowDelta} from './render/beaconsfield-grade/receiver.ts';
import {gradeAtlasMatches,loadBoundedGrade} from './sim/bounded-grade.ts';
import {CAVENDISH_WATER_CORE as DUNELANDS} from './sim/cavendish-water-core.generated.ts';
import {cavendishAtlasMatches,loadCavendishWaterCore} from './sim/cavendish-water-core.ts';
import {GREEN_GABLES_REVIEW as GABLES} from './render/green-gables-review-spec.ts';
import {FIELD_SITE_PINS} from './render/province-fields.generated.ts';
import {fetchProvinceDirectory,provinceFields,fieldLayersMatch} from './render/province-fields.ts';
import {cropFieldAtlasMatches,loadFieldPilot,loadFieldRelief} from './render/fields-pilot.ts';
import {georgetownSchoolWallNear} from './render/school-wall-finish.ts';
import {regionalCanopyRequested,standardRegionalCanopyRequested,sceneryDeparture,sceneryOptions,sceneryReviewBlock,rusticoHarbourRoofRequested,sourisWestFacingRequested,olearyAccessRoofRequested,olearyCompoundRoofsRequested,georgetownSchoolWallsRequested} from './app/scenery-profile.ts';
import type {NorthCapeScenery} from './render/north-cape.ts';
import {NORTH_CAPE_SITES} from './render/north-cape-shadow.ts';
import {northCapeMode,northCapeAtlas,NorthCapeStream,NORTH_CAPE_COVER_DECODED_SHA} from './render/north-cape-stream.ts';
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
import { AircraftRunwayDepth } from './render/runway-aircraft-depth.ts';
import { addMainland } from './render/mainland.ts';
import {OCEAN_Y,type Terrain} from './sim/terrain.ts';
import { addLighthouseScenery } from './render/lighthouses.ts';
import { addBasilica } from './render/basilica.ts';
import { basilicaSiteSupports, mountBasilicaStudy } from './render/basilica-study-seat.ts';
import {DALVAY,dalvaySiteSupports} from './render/dalvay-exterior-seat.ts';
import {SEACOW,seacowSiteSupports} from './render/seacow-exterior-seat.ts';
import {seacowDefaultFlight,standardSeacowExteriorRequested,foundersWestRequested,FOUNDERS_WEST_ROUTE,indianRiverLensState,indianRiverLensFlight,indianRiverCanCommit,kingsRidgeLensState,kingsRidgeAirState,princeLandscapeState,PRINCE_LANDSCAPE_ROUTE} from './app/scenery-profile.ts';
import {FOUNDERS_WEST} from './render/founders-west/authority.ts';
import {KNIGHT_SEAT,knightGroundSupports} from './render/souris-knight-seat.ts';
import {olearyExteriorRequested,olearyIndustrialStudyRequested,olearyWarehouseRequested,terminalWallPreviewRequested,dalvayWaterRequested,dalvayExteriorRequested,dalvayGlazingRequested,sourisKnightRequested,seacowExteriorRequested,basilicaExteriorRequested,basilicaYardSunRequested} from './app/scenery-profile.ts';
import {regularRoadGround as basilicaGround} from './render/road-contact.ts';
import { addConfederationBridge } from './render/confederation.ts';
import {addQuartermasterDocks,loadQuartermasterDocks} from './render/quartermaster-docks.ts';
import { Vegetation } from './render/vegetation.ts';
import {mappedLaneCanopy,mappedLaneCanopyRequested} from './render/mapped-lane-canopy.ts';
import { Roads } from './render/roads.ts';
import { GravelSurfaceStudy } from './render/gravel-surface-study.ts';
import {loadSidewalks,Sidewalks} from './render/sidewalks.ts';
import {SIDEWALKS} from './render/sidewalks.generated.ts';
import {ConfederationTrail,confederationTrailRequested,confederationTerrainPins,confederationSceneryPins} from './render/confederation-trail.ts';
import {loadParkingSurfaces,ParkingSurfaces} from './render/parking-surfaces.ts';
import {MAPPED_PARKING} from './render/parking-surfaces.generated.ts';
import { Buildings } from './render/buildings.ts';
import { Input } from './app/input.ts';
import { EngineSound } from './app/sound.ts';
import { UI, bootUI, loadMsg, failUI } from './app/ui.ts';
import {windmillOmegaRadS} from './sim/windmilling.ts';
import { spawn, step, setEngineOut, FIXED_STEP } from './sim/flight.ts';
import { KINGS_MAPPED_FARMLAND_DEPARTURE, PRINCE_MAPPED_FARMLAND_DEPARTURE, MONTAGUE_BRIDGE_DEPARTURE, SITES as STOCK_SITES } from './sim/places.ts';
import { clamp, RAD, geographic } from './sim/geo.ts';
import {observerView} from './sim/observer-view.ts';
import {duneSandRequested,standardDuneReliefRequested,shoreFoamDetailRequested,orbyClosureRequested,canopyLightRequested,standardDuneGrassRequested,explicitDuneGrassRequested,standardBasinSandRequested,standardMeadowRequested,standardGravelSurfaceRequested,standardMiscoucheRequested,standardNearshoreRequested,standardOpenCoastRequested,standardOpenRipplesRequested,forestFloorProfile,standardTracadieOrtho,standardCountyOrtho,standardInlandOrtho,coastalMarshRequested} from './app/scenery-profile.ts';
import {verifyDecodedCover} from './sim/cover-proof.ts';
import {MappedFieldPass,QUEENS_MAPPED_PASS,PRINCE_MAPPED_PASS} from './render/kings-field-pass.ts';
import {kingsFieldPassRequested,queensFieldPassRequested,princeFieldPassRequested} from './app/scenery-profile.ts';
import {SourisWetCurtain} from './render/souris-wet-curtain.ts';
import {standardRegionalWind,standardSourisShoreline,runway03PavementRequested,summersideRunwayPavementRequested,aircraftRunwayCastRequested,bordenCoastRequested,capeTryonRockRequested,capeTryonSkySeatRequested} from './app/scenery-profile.ts';
import {RegionalWindStream} from './render/regional-wind-stream.ts';
import {RusticoStandardFlight,RUSTICO_LIGHT_ROUTE,standardRusticoLayers} from './render/north-rustico/flight.ts';
import {standardRusticoLighthouseRequested} from './app/scenery-profile.ts';
import {standardGreenGablesHouseRequested} from './app/scenery-profile.ts';
import {bowleyCoreRequested} from './app/scenery-profile.ts';
import './app/style.css';
bootUI();
async function run(){
 const datedCapeStand=northCapeStandOption(location.search);
 const options=sceneryOptions(datedCapeStand.stockSearch),showBuildingShadows=options.has('buildingShadows');
 // Keep the same Point Prim approach in Standard and in its stock comparison.
 const pointPrimSites=pointPrimDepartureAvailable(options)?[...STOCK_SITES,POINT_PRIM_DEPARTURE]:STOCK_SITES;
 const SITES=[...pointPrimSites,...REGIONAL_CANOPY_DEPARTURES,KINGS_MAPPED_FARMLAND_DEPARTURE,PRINCE_MAPPED_FARMLAND_DEPARTURE];
 const wantsPointPrim=pointPrimRequested(options);

 const standardBreakers=shoreFoamDetailRequested(options);
 const directionalCanopy=canopyLightRequested(options);
 const capeMode=northCapeMode(options),capeExplicit=capeMode==='explicit';
 const explicitCapeModule=capeExplicit?loadAerialModule(()=>import('./render/north-cape.ts')):undefined;
 const standardTracadie=standardTracadieOrtho(options),standardCounties=standardCountyOrtho(options);
 const inlandOrtho=standardInlandOrtho(options);
 const orthoJob=standardTracadie||standardCounties||inlandOrtho||(options.has('orthophotoSeamStudy')&&options.get('scenery')!=='detail')?
   loadAerialModule(()=>import('./render/orthophoto-seams.ts')):undefined;
 const daylightWanted=aerialPerspectiveRequested(options);
 const daylightJob=daylightWanted?loadAerialModule(()=>import('./render/aerial-perspective-lab.ts')):undefined;
 const railAsked=railRequested(options),stDavidsAsked=stDavidsRequested(options);
 const frontageAllowed=summersideFrontageCompatible(options);
 let frontageProbe=false,frontageArmed=false;
 const tryMappedLaneCanopy=mappedLaneCanopyRequested(options),tryNearshoreFoam=nearshoreFoamRequested(options);
 let renderer:THREE.WebGLRenderer;
 try{renderer=new THREE.WebGLRenderer({canvas:document.querySelector<HTMLCanvasElement>('#world')!,antialias:true,alpha:false,logarithmicDepthBuffer:true,powerPreference:'high-performance'});}
 catch{throw Error('WebGL 2 is required. Enable hardware acceleration or open this page in a WebGL 2 browser.');}
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(53,innerWidth/innerHeight,.08,350000),cameraUp=new THREE.Vector3(0,1,0);
 const woodland=loadForestHeights(import.meta.env.BASE_URL),forestStream=new ForestStream(import.meta.env.BASE_URL),hedgeStream=new HedgeStream(import.meta.env.BASE_URL);
 const gl=renderer.getContext();
 const crownAsked=options.has('woodlandCrownBase')&&!sceneryReviewBlock('woodlandCrownBase',options)&&
   options.has('woodland3D')&&gl.getParameter(gl.SAMPLES)>=2;
 const crownDeparture=crownAsked?sceneryDeparture(location.search,SITES.map(s=>s.id)):0;
 const miscoucheStart=options.get('departure')==='miscouche-woodlot-pass'?
  SITES.find(q=>q.id==='miscouche-woodlot-pass'):undefined;
 const regionalStart=REGIONAL_CANOPY_DEPARTURES.find(q=>q.id===options.get('departure'));
 // Seed the existing bounded woodland warm-up at the bookmarked flight
 // rather than Cavendish. Already-submitted crowns remain untouched.
 const directDeparture=SITES.find(q=>q.id===options.get('departure'));
 const woodlandStart=crownDeparture?SITES[crownDeparture]:miscoucheStart??regionalStart??directDeparture;
 const warmPoint=woodlandStart?projectSite(woodlandStart.lon,woodlandStart.lat):undefined;
 const startPoint=projectSite(SITES[0].lon,SITES[0].lat),warmForest=forestStream.warm(warmPoint?.x??startPoint.x,warmPoint?.z??startPoint.z);
 const crownStream=crownAsked?new ForestStream(import.meta.env.BASE_URL,fetch,'crown'):undefined;
 if(crownStream){const p=warmPoint??startPoint;void crownStream.warm(p.x,p.z);}
 let crownX=Infinity,crownZ=Infinity;
 const cruiseCrownPrefetch=(x:number,z:number,agl:number)=>{
  if(!crownStream||agl>210||Math.hypot(x-crownX,z-crownZ)<420)return;
  crownX=x;crownZ=z;crownStream.update(x,z);
 };
 const worldBase=import.meta.env.BASE_URL+'world/';
 const hogJob=options.has('hogIslandPhotoStudy')&&!sceneryReviewBlock('hogIslandPhotoStudy',options)?loadHogPhoto(worldBase):undefined;
 const rollingAsked=options.has('seatedForestShadows')&&options.get('scenery')!=='detail'&&
  !['woodland3D','canopyLight','indianRiverReview','surveyRelief','inlandRelief','buildingShadows',
    'seatedRoads','northCapeWind','northRusticoLighthouseStudy','northRusticoSoil',
    'gablesGradeReview','greenGablesReview','greenGablesBarnReview','beaconsfieldReview','rusticoMassingReview','cavendishDetail','cavendishWaterReview','bowleySurveyPreview',
    'montagueFoundationPreview','basinChannel','northBaywalkPreview','spinnakersPreview','hogIslandPhotoStudy'].some(k=>options.has(k));
 const rollingLibrary=rollingAsked?import('./render/rolling-tree-shadows.ts').catch(()=>undefined):undefined;
 let rollingPreflight='off';
 if(rollingAsked)rollingPreflight='module';

 const grassCoastAsked=explicitDuneGrassRequested(options);
 const standardGrassCoast=standardDuneGrassRequested(options);
 const grassCoastJob=grassCoastAsked||standardGrassCoast?loadAerialModule(()=>import('./render/dune-grass-surface.ts')):undefined;
 const duneAsked=duneSandRequested(options);
 const duneModuleJob=duneAsked?loadAerialModule(()=>import('./render/dune-sand.ts')):undefined;
 const hogGroundAsked=options.has('hogIslandWestGround')&&!sceneryReviewBlock('hogIslandWestGround',options);
 const duneReliefAsked=!options.has('stockDuneRelief')&&options.has('duneReliefStudy')&&!sceneryReviewBlock('duneReliefStudy',options);
 const standardDuneRelief=standardDuneReliefRequested(options)&&String(SIDEWALKS.sha256)===CANOPY_FENCE.pins.sidewalk&&
  String(MAPPED_PARKING.sha256)===CANOPY_FENCE.pins.parking;
 const ridgePreview=kingsRidgeLensState(location.search).active;
 const princePreview=princeLandscapeState(location.search).active;
 const legacyKingsCrown=kingsDryCrownRequested(options);
 const crownGradeWanted=legacyKingsCrown||ridgePreview;
 const checkedGroundIndex=hogGroundAsked||duneReliefAsked?pinnedHogBuildingIndex(worldBase):undefined;
 const crownGradeJob=crownGradeWanted?Promise.all([loadBoundedGrade(KINGS_DRY_CROWN,worldBase),kingsDryCrownHedges(worldBase)]):undefined;
 const hogGroundJob=hogGroundAsked?Promise.all([loadBoundedGrade(HOG_WEST_GRADE,worldBase),checkedGroundIndex,loadWestDuneOptics(worldBase)]):undefined;
 const duneReliefJob=duneReliefAsked?Promise.all(DUNE_RELIEF.map(pin=>loadBoundedGrade(pin,worldBase))):undefined;
 const dockPack=loadQuartermasterDocks(worldBase),mappedSidewalks=loadSidewalks(worldBase),mappedParking=loadParkingSurfaces(worldBase);
 const useBasinBank=!options.has('noBasinBank');
 const localRiverLens=indianRiverLensState(location.search).active;
 const legacyChurch=options.has('indianRiverReview')&&!sceneryReviewBlock('indianRiverReview',options);
 const churchAsked=localRiverLens||legacyChurch;
 const churchSunJob=churchAsked&&CHURCH_SUN_MASK.gradeSha===INDIAN_RIVER_GRADE.sha256?loadChurchGroundSun(CHURCH_SUN_MASK,worldBase):undefined;
 const churchJob=churchAsked?Promise.all([loadBoundedGrade(INDIAN_RIVER_GRADE,worldBase),import('./render/indian-river/runtime.ts'),import('./render/indian-river/st-marys-shadows.ts')]).catch(()=>undefined):undefined;
 const useMontague=options.has('montagueFoundationPreview'),useBaywalk=options.has('spinnakersPreview')&&options.has('northBaywalkPreview');
 const preRoadJob=useMontague||useBaywalk||churchAsked||hogGroundAsked||duneReliefAsked||crownGradeWanted?Roads.prepareMontague():undefined;
 const montagueRoadJob=useMontague?preRoadJob:undefined;
 const spinnakersJob=options.has('spinnakersPreview')?loadSpinnakersDeck(worldBase):undefined;
 const preBuildingJob=useBaywalk?Buildings.prepareBaywalk():churchAsked?Buildings.prepareIndianRiver():
  crownGradeJob?.then(([make,hedges])=>make&&hedges?Buildings.prepareKingsDryCrown(fetch,ridgePreview?3300:1450):undefined);
 const baywalkJob=useBaywalk?Promise.all([loadBaywalkCourt(worldBase),spinnakersJob,preRoadJob,preBuildingJob])
  .then(([court,deck,road,buildings])=>court&&deck&&buildings&&road?.digest===BAYWALK_ROAD_SHA&&road.roads[BAYWALK_ROAD_ORDINAL]?.flags===BAYWALK_ROAD_FLAGS?
   {court,deck,road:road.roads[BAYWALK_ROAD_ORDINAL].points}:undefined):undefined;
 const tryBarn=greenGablesBarnRequested(options);
 const schoolFinishRequested=georgetownSchoolWallsRequested(options);
 const tryGreenGables=options.has('greenGablesReview')&&!sceneryReviewBlock('greenGablesReview',options);
 const provinceAllowed=options.has('provinceFieldsReview')&&!sceneryReviewBlock('provinceFieldsReview',options);
 const provinceJob=provinceAllowed?fetchProvinceDirectory(worldBase):undefined;
 const kingsFields=kingsFieldPassRequested(options)&&renderer.capabilities.maxTextures>=16?
   new MappedFieldPass(worldBase,renderer,scene,camera):undefined;
 const queensFields=queensFieldPassRequested(options)&&renderer.capabilities.maxTextures>=16?
   new MappedFieldPass(worldBase,renderer,scene,camera,QUEENS_MAPPED_PASS):undefined;
 const princeFields=princeFieldPassRequested(options)&&renderer.capabilities.maxTextures>=16?
   new MappedFieldPass(worldBase,renderer,scene,camera,PRINCE_MAPPED_PASS):undefined;
 const routeFields=[kingsFields,queensFields,princeFields].filter(f=>f!==undefined);
 const grassRequested=options.has('sourceGrassStudy')&&!sceneryReviewBlock('sourceGrassStudy',options);
 const grassJob=grassRequested?fetchGrassStudy(worldBase):undefined;
 const fieldsJob=options.has('cropRowsReview')?loadFieldPilot(worldBase):undefined;
 // Province and three-site masks are separate choices. If both are requested
 // reuse the earlier choice's scan, never fetch it twice.
 const reliefJob=provinceAllowed?(fieldsJob?fieldsJob.then(p=>p??loadFieldRelief(worldBase)):loadFieldRelief(worldBase)):undefined;
 const ownersJob=provinceAllowed?import('./render/province-field-owners.ts')
  .then(m=>m.checkedFieldOwners(FIELD_SITE_PINS.owners)).catch(()=>false):undefined;
 const dunelandsCompatible=options.has('cavendishWaterReview')&&!sceneryReviewBlock('cavendishWaterReview',options);
 const dunelandsJob=dunelandsCompatible?loadCavendishWaterCore(DUNELANDS,worldBase):undefined;
 const tryTrail=options.has('gablesTrailReview')&&!options.has('surveyRelief')&&!options.has('inlandRelief');
 const tryGravel=options.has('gablesGravelReview')&&!options.has('surveyRelief')&&!options.has('inlandRelief');
 const fairwayJob=options.has('gablesFairwayReview')&&!options.has('surveyRelief')&&!options.has('inlandRelief')?loadGablesFairway(worldBase):undefined;
 const rusticoRequested=options.has('northRusticoLighthouseStudy')&&!sceneryReviewBlock('northRusticoLighthouseStudy',options);
 const rusticoJob=rusticoRequested?Promise.all([loadBoundedGrade(RUSTICO_GRADE,worldBase),import('./render/north-rustico/mount.ts')]).catch(()=>undefined):undefined;
 const museumAsked=beaconsfieldGradeRequested(options)&&gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)>=16;
 const gradeJob=options.has('gablesGradeReview')&&!options.has('surveyRelief')&&!options.has('inlandRelief')&&!showBuildingShadows?loadBoundedGrade(GABLES_GRADE,worldBase):undefined;
 const bowleyJob=bowleyCoreRequested(options)?loadBowleyPond(worldBase):undefined;
 const bowleyDefaultCore=!!bowleyJob&&!options.has('bowleySurveyPreview');
 const {terrain,terrainSha,img,cover,sky,certifiedSky,bench,southLake,sourisLighting,basinSand,bankGround,bowley}=await loadAtlas(
   loadMsg,options.has('inlandRelief'),options.has('basinSand'),useBasinBank&&options.has('basinChannel'),montagueRoadJob?.then(q=>!!q?.montagueVerified),options.has('basinWharf'),baywalkJob,bowleyJob,tryMappedLaneCanopy||railAsked||stDavidsAsked||!!fieldsJob||provinceAllowed||tryGreenGables||tryBarn||!!dunelandsJob||!!gradeJob||museumAsked||!!rusticoJob||!!churchJob||!!grassJob||!!hogJob||!!hogGroundJob||tryGravel||tryTrail||!!fairwayJob||rollingAsked||duneReliefAsked||grassCoastAsked||crownGradeWanted||tryNearshoreFoam,daylightJob?async(url,decode)=>(await daylightJob)?.loadVerifiedAerialSky(url,decode):undefined);
 // Append only after the pinned road, cover and terrain have admitted the
 // same local foundation. The original province-wide route ordinals stay fixed.
 if(cover.montague)SITES.push(MONTAGUE_BRIDGE_DEPARTURE);
 const daylightModule=await daylightJob;
 const daylight=certifiedSky?daylightModule?.verifiedAerialOptics(certifiedSky):undefined;
 if(daylight)daylight.gain.value=0; // Require both independently loaded horizon meshes.
 const useTrail=tryTrail&&gablesGravelAtlasMatches(terrainSha,cover.sourceSha,cover.sourceDecodedSha);
 const fairway=fairwayJob&&fairwayAtlasMatches(terrainSha,cover.sourceSha,cover.sourceDecodedSha)?await fairwayJob:undefined;
 const useGravel=tryGravel&&gablesGravelAtlasMatches(terrainSha,cover.sourceSha,cover.sourceDecodedSha);
 const useGrade=gradeJob&&gradeAtlasMatches(GABLES_GRADE,terrainSha,cover.sourceSha,cover.sourceDecodedSha)?await gradeJob:undefined;
 const grade=useGrade?.(terrain,(x,z)=>terrain.atlasElevation(x,z));
 const rusticoPair=rusticoJob&&gradeAtlasMatches(RUSTICO_GRADE,terrainSha,cover.sourceSha,cover.sourceDecodedSha)?await rusticoJob:undefined;
 const rusticoCohort=(()=>{
   try{
    const ground=rusticoPair?.[0]?.(terrain,(x,z)=>terrain.atlasElevation(x,z));
    if(!ground||!rusticoPair?.[1].prototypeRusticoFit(ground,terrain,cover))return;
    return {ground,art:rusticoPair[1].createRusticoExterior(ground)};
   }catch{return undefined;}
 })();
 const rusticoGround=rusticoCohort?.ground;
 const rusticoSoil=rusticoGround&&!options.has('legacyRusticoSoil')?rusticoGround:undefined;
 const context=renderer.getContext(),canTuft=!!rusticoSoil&&!options.has('noRusticoTufts')&&context.getParameter(context.SAMPLES)>=2;
 const dunelands=dunelandsJob&&cavendishAtlasMatches(DUNELANDS,terrainSha,cover.sourceSha,cover.sourceDecodedSha)?await dunelandsJob:undefined;
 const forestHeights=await woodland;await warmForest;
 const proposedFields=await fieldsJob;
 const fieldAtlas=cropFieldAtlasMatches(terrainSha,cover.sourceSha,cover.sourceDecodedSha);
 const cropFields=fieldAtlas?proposedFields:undefined;
 if(!cropFields)proposedFields?.discard();
 const [provinceReader,relief,owners]=await Promise.all([provinceJob,reliefJob,ownersJob]);
 const fieldStudy=provinceReader&&relief&&fieldAtlas&&owners?provinceFields(provinceReader,relief):undefined;
 if(!fieldStudy&&relief&&relief!==proposedFields)relief.discard();
 const grassReader=grassJob&&grassSourceAllows(terrainSha,cover.sourceSha,cover.sourceDecodedSha)?await grassJob:undefined;
 const grass=grassReader?provinceGrass(grassReader,options.has('sourceGrassNap')&&!options.has('cropRowsReview')&&!fieldStudy):undefined;
 const churchInputs=churchJob?await Promise.all([churchJob,preRoadJob,preBuildingJob,churchSunJob]):undefined;
 const churchCohort=(()=>{
  if(!churchInputs)return;
  const [gradeArt,road,owner,groundSun]=churchInputs;
  if(!gradeArt||!groundSun||!owner?.indianRiver||!churchLandSource(terrainSha,cover.sourceSha,cover.sourceDecodedSha,road?.digest))return;
  try{
   const ground=gradeArt[0]?.(terrain,(x,z)=>terrain.atlasElevation(x,z));
   if(ground)return {ground,art:gradeArt[1].prepareChurchArt(),shadowAdapter:gradeArt[2].StMarysShadows,groundSun};
  }catch{/** Never hide the stock owner when the optional scene cannot load. */}
 })();
 const hogGround=await (async()=>{
  if(!hogGroundJob)return;
  const [[make,verified,optics],road]=await Promise.all([hogGroundJob,preRoadJob]);
  if(make&&verified&&optics&&road?.digest===HOG_WEST_GRADE.roadSha256&&
     gradeAtlasMatches(HOG_WEST_GRADE,terrainSha,cover.sourceSha,cover.sourceDecodedSha))try{
   return {grade:make(terrain,(x,z)=>terrain.atlasElevation(x,z)),optics};
  }catch{/** Optional dry relief may never block the standard atlas. */}
  optics?.dispose();
 })();
 const duneLibrary=await duneModuleJob;
 const duneSand=duneLibrary?.duneSandAtlas(terrainSha,cover.sourceSha)?new duneLibrary.DuneSand(worldBase):undefined;
 const dunesGround=await (async()=>{
  if(!duneReliefJob)return [];
  const [makers,pinned,roads]=await Promise.all([duneReliefJob,checkedGroundIndex,preRoadJob]);
  if(!pinned||roads?.digest!==HOG_WEST_GRADE.roadSha256)return [];
  return makers.map((make,i)=>{
   const stamp=DUNE_RELIEF[i];
   if(!make||!gradeAtlasMatches(stamp,terrainSha,cover.sourceSha,cover.sourceDecodedSha))return;
   try{return make(terrain,(x,z)=>terrain.atlasElevation(x,z));}catch{return undefined;}
  });
 })();
 const grassCoastModule=await grassCoastJob;
 const grassCoastPin=grassCoastAsked?grassCoastModule?.duneGrassBase(terrainSha,cover.sourceSha,cover.sourceDecodedSha):
  grassCoastModule?.duneGrassBaseMetadata(terrainSha,cover.sourceSha,terrain,[cover.width,cover.height]);
 const grassCoast=grassCoastModule&&grassCoastPin?new grassCoastModule.DuneGrassSurface(worldBase,terrain,fetch,
  standardGrassCoast?new Set(['18-19',...(standardDuneRelief?DUNE_RELIEF.map(s=>s.tileX+'-'+s.tileZ):[])]):undefined):undefined;
 const crownGround=await (async()=>{
  if(!crownGradeJob)return;
  const [[make,hedges],buildings,roads,sidewalks,parking]=await Promise.all([crownGradeJob,
   preBuildingJob,preRoadJob,mappedSidewalks,mappedParking]);
  if(!make||!kingsDryCrownSources(terrain,cover,terrainSha,roads?.digest,sidewalks?SIDEWALKS.sha256:undefined,
   parking?MAPPED_PARKING.sha256:undefined,!!buildings?.kingsCrown,hedges))return;
  try{const grade=make(terrain,(x,z)=>terrain.atlasElevation(x,z));if(kingsDryCrownInterior(terrain,cover,grade))return grade;}
  catch{/** Stock near terrain remains authoritative. */}
 })();
 const groundCohorts=[grade,rusticoGround,hogGround?.grade,...dunesGround,legacyKingsCrown?crownGround:undefined].filter(g=>g!==undefined);
 const hog=hogJob&&matchesHogPhoto(terrainSha,cover.sourceSha,cover.sourceDecodedSha)?await hogJob:undefined;
 const orthoModule=await orthoJob;
 const inlandWindows=inlandOrtho&&orthoModule&&standardLandAtlasMatches(terrain,terrainSha,cover)?orthoModule.inlandSourceWindows(cover):[];
 const standardOrtho=standardTracadie||standardCounties||inlandWindows.length>0;
 const orthoScope=standardOrtho?{tracadie:standardTracadie,counties:standardCounties,inland:inlandWindows}:'study';
 const ortho=orthoModule&&(standardOrtho||orthoModule.seamOptions(options))&&
   [-64.47,45.94,-61.93,47.10].every((v,i)=>terrain.spec.bounds[i]===v)?
   new orthoModule.OrthophotoSeams(renderer,img,orthoScope):undefined;
 const basinSandStandard=standardBasinSandRequested(options)&&terrainSha===CANOPY_FENCE.pins.terrain&&
  cover.sourceSha===CANOPY_FENCE.pins.cover&&cover.width===4096&&cover.height===2720&&
  terrain.spec.width===cover.width&&terrain.spec.height===cover.height&&terrain.spec.bounds.length===4&&
  [-64.47,45.94,-61.93,47.1].every((v,i)=>v===terrain.spec.bounds[i])&&globalThis.crypto?.subtle?
  new StandardBasinSand(worldBase):undefined;
 const standardMeadow=standardMeadowRequested(options)&&standardLandAtlasMatches(terrain,terrainSha,cover)?new StandardMeadow(cover):undefined;
 const nearshoreStandard=standardNearshoreRequested(options)&&standardLandAtlasMatches(terrain,terrainSha,cover)?new StandardNearshore(cover):undefined;
 const CapeArt=explicitCapeModule?(await explicitCapeModule)?.NorthCapeScenery:undefined;
 const pastureEligible=standardPanmurePastureRequested(options)&&standardLandAtlasMatches(terrain,terrainSha,cover)&&renderer.capabilities.maxTextures>=12;
 const openRipples=standardOpenRipplesRequested(options)&&standardLandAtlasMatches(terrain,terrainSha,cover);
 const marshModule=coastalMarshRequested(options)&&standardLandAtlasMatches(terrain,terrainSha,cover)&&
  renderer.capabilities.maxTextures>=16?await loadAerialModule(()=>import('./render/marsh-stream.ts')):undefined;
 const marsh=marshModule?new marshModule.MarshStream(import.meta.env.BASE_URL,cover):undefined;
 const floorProfile=forestFloorProfile(options);
 const floor=floorProfile==='standard'&&(!standardLandAtlasMatches(terrain,terrainSha,cover)||
  renderer.capabilities.maxTextures<16)?false:floorProfile;
 const aircraft=createAircraft();
 const aircraftDepth=aircraftRunwayCastRequested(options)&&standardLandAtlasMatches(terrain,terrainSha,cover)&&
  gl.getParameter(gl.SAMPLES)===4&&renderer.capabilities.maxTextures>=16?
  new AircraftRunwayDepth(renderer,aircraft.root,aircraft.runwayCasters):undefined;
 const world=new World(scene,terrain,img,renderer,cover,sky,bench,southLake,sourisLighting,
   showBuildingShadows,floor,useBasinBank,basinSand??basinSandStandard?.uniforms,bankGround,options.has('montagueReachOptics'),options.has('legacyShoreArcs'),cover.wharfToe&&!options.has('noBasinWharf'),standardBreakers,!!CapeArt,bowley,options.has('meadowTexture'),options.has('cropRowsReview')&&!fieldStudy?cropFields:undefined,fieldStudy,dunelands?[dunelands]:[],groundCohorts.length?groundCohorts:undefined,useGravel,fairway,useTrail,rusticoSoil,grass,churchCohort?.groundSun,hog,hogGround?.optics,duneSand,grassCoast,daylight,orbyClosureRequested(options),ortho,shoreToneRequested(options),tryNearshoreFoam,standardMeadow?.tiles,!!nearshoreStandard,standardOpenCoastRequested(options),pastureEligible,openRipples,marsh,capeTryonRockRequested(options)?terrainSha:undefined,options.has('capeTryonWaterReview')?terrainSha:undefined,runway03PavementRequested(options),bowleyDefaultCore,
   standardLandAtlasMatches(terrain,terrainSha,cover)?terrainSha:undefined,summersideRunwayPavementRequested(options),aircraftDepth,bordenCoastRequested(options),capeTryonSkySeatRequested(options)?terrainSha:undefined);
 const dalvayAllowed=dalvayWaterRequested(options)&&standardLandAtlasMatches(terrain,terrainSha,cover)&&renderer.capabilities.maxTextures>=16;
 let dalvayGlazingActive=false;
 let dalvayRequested=false,dalvayVisual:import('./render/dalvay-lake-optics.ts').DalvayLakeOptics|undefined;
 let dalvayOpticsAdmission:'idle'|'cover'|'module'|'asset'|'ready'|'unavailable'='idle';
 const sourisShoreline=standardSourisShoreline(options)&&standardLandAtlasMatches(terrain,terrainSha,cover)?
   new SourisWetCurtain(scene,()=>verifyDecodedCover(cover)):undefined;
 const marshMSAA=gl.getParameter(gl.SAMPLES)>=2;
 const foliageModule=marsh&&marshMSAA?await loadAerialModule(()=>import('./render/marsh-foliage/live.ts')):undefined;
 const foliage=foliageModule&&marsh?new foliageModule.LiveMarshFoliage(scene,world,marsh,marshMSAA,supportsOpaqueCoverage(gl)):undefined;
 if(standardMeadow)world.meadowStrength.value=0;
 const pastureBinding=pastureEligible?world.panmurePastureBinding():undefined;
 const panmurePasture=pastureBinding?new PanmurePastureFlight(()=>verifyDecodedCover(cover),async()=>
  (await import('./render/panmure-pasture/material.ts')).preparePasture(pastureBinding.material,pastureBinding.compose)):undefined;
 let pastureOwner:(()=>ArrayBuffer|undefined)|undefined;
 const pointPrim=wantsPointPrim&&pointPrimBase(terrain,cover,terrainSha)?new PointPrimFlight(world,worldBase):undefined;
 const rustico=rusticoCohort?.art(scene,world);
 const stdRustico=standardRusticoLighthouseRequested(options)&&globalThis.crypto?.subtle?new RusticoStandardFlight(world,worldBase,terrainSha):undefined;
 let tuftsModule:typeof import('./render/dry-coast/tussocks.ts')|undefined;
 let tuftsJob:Promise<void>|undefined,tuftBuild=false;
 let rusticoTufts:ReturnType<typeof import('./render/dry-coast/tussocks.ts').makeDryTussocks>;
 const rollingModule=rollingLibrary?await rollingLibrary:undefined;
 const vegetation=new Vegetation(scene,terrain,cover,forestHeights,forestStream,hedgeStream,
   (x,z)=>world.visualGroundHeight(x,z),bankGround?(x,z)=>world.basinPlantedGround(x,z):undefined,directionalCanopy?world.sun:undefined,bowley||dunelands?(x,z)=>world.freshwaterContains(x,z):undefined,
   rollingModule?new rollingModule.ShadowSlotRoster():undefined,directionalCanopy&&!options.has('canopyLight'),supportsOpaqueCanopyCoverage(gl));
 world.registerBordenLateOwners(vegetation.stockBordenCanopyOwners(),aircraft.shutterDisc);
 world.registerBordenAircraft(aircraft.root);
 let datedStandReview:NorthCapeStandReview|undefined;
 if(datedCapeStand.requested&&directionalCanopy&&capeMode==='ordinary')
  void import('./render/north-cape-stand/review.ts').then(({NorthCapeStandReview})=>{
   datedStandReview=new NorthCapeStandReview(renderer,scene,camera,world,vegetation,import.meta.env.BASE_URL,terrainSha);
   window.addEventListener('pagehide',()=>datedStandReview?.dispose(),{once:true});
  }).catch(()=>{});
 const regionalCanopy=(regionalCanopyRequested(options)||standardRegionalCanopyRequested(options))&&gl.getParameter(gl.SAMPLES)>=2&&regionalBase(terrain,cover,terrainSha)?
  new RegionalCanopies(world,scene,vegetation,forestStream,worldBase,REGIONAL_STANDS):undefined;
 if(crownStream)vegetation.trackCrownHeights();
 const chooseMiscoucheStandard=standardMiscoucheRequested(options);
 const miscoucheRequest=(chooseMiscoucheStandard||options.has('miscoucheCanopyStudy')&&!sceneryReviewBlock('miscoucheCanopyStudy',options))&&gl.getParameter(gl.SAMPLES)>=2&&
  terrainSha==='661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d'&&
  cover.sourceSha==='46a4f4736a885576fa0529cd0f91bacdbfd47e3bfd719130ba3446c52c245863'&&
  cover.width===4096&&cover.height===2720&&terrain.spec.width===4096&&terrain.spec.height===2720&&
  [-64.47,45.94,-61.93,47.10].every((v,i)=>terrain.spec.bounds[i]===v);
 let miscoucheDef:typeof import('./render/miscouche-fill.ts')|undefined,miscoucheJob=false,miscoucheRejected=false;
 let miscoucheProof:'cold'|'waiting'|'verified'|'stock'='cold',miscoucheInfrastructure=!chooseMiscoucheStandard;
 if(chooseMiscoucheStandard&&miscoucheRequest)void Promise.all([mappedSidewalks,mappedParking]).then(([walk,parking])=>{
  miscoucheInfrastructure=!!walk&&!!parking&&String(SIDEWALKS.sha256)===CANOPY_FENCE.pins.sidewalk&&
   String(MAPPED_PARKING.sha256)===CANOPY_FENCE.pins.parking;
 }).catch(()=>{});
 let miscoucheArt:ReturnType<typeof import('./render/miscouche-fill.ts')['createMiscoucheFill']>;
 const MISCOUCHE_OWNER=[-53778.10046418605,5740.396270232558] as const;
 const MISCOUCHE_EFI='0590eb96ff84ec82282e722c90cbfb83d4dabb3222f4acb3b471ccd4077f222b';
 if(churchCohort&&!localRiverLens)vegetation.attachStMarysShadows(scene,churchCohort.shadowAdapter,INDIAN_RIVER_GRADE.id);
 const northCape=CapeArt?new CapeArt(scene,world):undefined;
 const regionalWind=standardRegionalWind(options)&&northCapeAtlas({...terrain.spec,sha:terrainSha},cover)?
  new RegionalWindStream(async()=>{
   if(await verifyDecodedCover(cover)!==NORTH_CAPE_COVER_DECODED_SHA)return;
   const {createRegionalWind}=await import('./render/regional-wind.ts');
   const caps=renderer.capabilities;
   const mount=!options.has('stockRegionalWindLight')&&caps.maxTextures>=16&&caps.maxFragmentUniforms>=224?
    async (id:import('./render/regional-wind-stream.ts').WindFarmId,caster:import('./render/regional-wind.ts').RegionalWind)=>{
     const rotorScope=!options.has('stockRegionalWindRotorLight')&&caps.isWebGL2&&!caps.reversedDepthBuffer&&caps.maxTextureSize>=2048;
     const base=(await import('./render/regional-wind-light.ts')).staticWindLight(id,{world,base:worldBase,maxTextures:caps.maxTextures,maxUniforms:caps.maxFragmentUniforms,rotorScope},caster);
     if(!base||!rotorScope)return base;
     try{return (await import('./render/regional-wind-rotor.ts')).withRotorReceiver(id,renderer,world,caster,base);}catch{return base;}
    }:undefined;
   return id=>createRegionalWind(id,scene,world,(owner,roots)=>vegetation.setRegionalWindRoots(owner,roots),mount);
  },!options.has('stockEastPointPhaseII')):undefined;
 const capeCenter=NORTH_CAPE_SITES[7];
 const capeSpan=Math.max(...NORTH_CAPE_SITES.map(s=>Math.hypot(s.x-capeCenter.x,s.z-capeCenter.z)));
 const streamedCape=capeMode==='ordinary'&&northCapeAtlas({...terrain.spec,sha:terrainSha},cover)?
  new NorthCapeStream<NorthCapeScenery,THREE.Vector3>(capeCenter.x,capeCenter.z,capeSpan,async()=>{
   // Full decoded land data are checked once only when nearing the region.
   const coverSha=await verifyDecodedCover(cover);
   if(coverSha!==NORTH_CAPE_COVER_DECODED_SHA)return;
   if(!NORTH_CAPE_SITES.every(({x,z})=>cover.distance(terrain,x,z)>32&&terrain.isLand(x,z)))return;
   const {NorthCapeScenery}=await import('./render/north-cape.ts');
   return ()=>new NorthCapeScenery(scene,world);
  }):undefined;
 world.registerBordenBridge(addConfederationBridge(scene));
 let basilicaExterior:'authored'|'stock'='stock';
 if(basilicaExteriorRequested(options)&&basilicaSiteSupports(terrain,terrainSha,cover)&&
    await verifyDecodedCover(cover)===CANOPY_FENCE.pins.coverDecoded){
  // Import the art only in its admitted profile. One complete group is attached after successful assembly;
  // a missing art chunk, bad survey seat or failed construction leaves the historical landmark intact.
  if(await mountBasilicaStudy(scene,terrain,basilicaGround(terrain),
    ()=>import('./render/basilica-exterior.ts')))basilicaExterior='authored';
 }
 if(basilicaExterior==='stock')addBasilica(scene,terrain);
 addLighthouseScenery(scene,terrain);
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
 const barkLoader=options.has('woodlandBark')&&!sceneryReviewBlock('woodlandBark',options)&&glCanopy.getParameter(glCanopy.SAMPLES)>=2?
  ()=>import('./render/woodland-bark.ts').then(m=>m.loadWoodlandBark(import.meta.env.BASE_URL)):undefined;
 if(options.has('woodland3D')&&glCanopy.getParameter(glCanopy.SAMPLES)>=2){
  void import('./render/woodland-volume.ts').then(({WoodlandVolume})=>
     vegetation.attachVolume(new WoodlandVolume(scene,45000,crownStream?(x,z,h,slot)=>vegetation.crownBaseLift(crownStream,x,z,h,slot):undefined,barkLoader,!options.has('stockWoodlandVolumeCull'),supportsOpaqueCanopyCoverage(glCanopy)),world,scene)).catch(()=>{});
 }
 let quartermasterDocks:ReturnType<typeof addQuartermasterDocks>;
 void dockPack.then(p=>quartermasterDocks=addQuartermasterDocks(scene,cover,world.sun,p));
 let mainland:Terrain|undefined;
 const sceneSurface=(x:number,z:number)=>{const s=world.surface(x,z);if(!s.land&&!world.freshwaterContains(x,z)&&mainland?.isLand(x,z)){s.height=mainland.elevation(x,z)+.18;s.land=true;}return s;};
 scene.add(aircraft.root);const audio=new EngineSound();
 let activeSite=0,f=spawn(SITES[0],sceneSurface),acc=0,view=0,time=0,last=performance.now(),snap=true;
 const names=options.has('sceneryObserver')?['Chase','Cockpit','Wide chase','Scenery']:['Chase','Cockpit','Wide chase'];let ui:UI;
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
 const reposition=(i:number)=>{pointPrim?.clear();regionalCanopy?.clear();stdRustico?.clear();activeSite=clamp(i,0,SITES.length-1);f=spawn(SITES[activeSite],sceneSurface);acc=0;snap=true;};
 const start=(i:number)=>{reposition(i);ui.departure(i);};
 ui=new UI(terrain,input,{start,resume:()=>ui.set('flight'),view:cameraCycle,sound:()=>void audio.toggle().then(v=>ui.setSound(v)).catch(()=>{}),pause,restart:()=>start(activeSite),
  engineState:()=>({out:f.engineOut,airborne:f.status==='flying'}),
  practiceFailure:(out:boolean)=>setEngineOut(f,out)},SITES);
 const resize=()=>{renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();snap=true;};resize();window.addEventListener('resize',resize);
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&ui.mode==='flight')ui.set('paused');acc=0;last=performance.now();input.clear();});
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();renderer.setAnimationLoop(null);failUI('Your browser lost the graphics context. Reload to restart the atlas; other GPU-heavy tabs can use the same memory.');});
 const layerWarnings:string[]=[];const warn=(layer:string,e:unknown)=>{layerWarnings.push(layer);ui.setWarnings(layerWarnings);console.warn(layer+' layer unavailable',e);};
 let roads:Roads|undefined,buildings:Buildings|undefined,sidewalks:Sidewalks|undefined,parking:ParkingSurfaces|undefined;
 let basilicaSun:import('./render/basilica-local-sun.ts').BasilicaLocalSun|undefined;
 if(basilicaExterior==='authored'&&basilicaYardSunRequested(options)){
  const g=scene.getObjectByName('St. Dunstan’s Basilica') as THREE.Group|undefined;
  if(g?.isGroup&&g.userData.basilicaAppearance==='qualitative exterior')try{
   const {BasilicaLocalSun}=await import('./render/basilica-local-sun.ts');
   basilicaSun=new BasilicaLocalSun(renderer,scene,world,g,()=>roads,()=>sidewalks);
  }catch{ /* Optional sunlight cannot replace the selected architecture on failure. */ }
 }
 type NearDune={stamp:(typeof DUNE_RELIEF)[number]; box:readonly [number,number,number,number];
  asked:boolean;grade?:ReturnType<NonNullable<Awaited<ReturnType<typeof loadBoundedGrade>>>>};
 const nearDunes:NearDune[]=standardDuneRelief?DUNE_RELIEF.filter(s=>s.terrainSha256===terrainSha&&
  s.coverCompressedSha256===cover.sourceSha).map(stamp=>{
   const w=(terrain.right-terrain.left)/WORLD_COLS,d=(terrain.bottom-terrain.top)/WORLD_ROWS;
   const x=terrain.left+w*(stamp.tileX+stamp.firstX/SURVEY_LOD),z=terrain.top+d*(stamp.tileZ+stamp.firstZ/SURVEY_LOD);
   return {stamp,box:[x,z,x+w*stamp.cellsX/SURVEY_LOD,z+d*stamp.cellsZ/SURVEY_LOD],asked:false};
  }):[];
 let nearDuneIndex:ReturnType<typeof pinnedHogBuildingIndex>|undefined;
 function updateNearDunes(x:number,z:number,y:number){
  if(roads?.sourceGeometrySha256!==HOG_WEST_GRADE.roadSha256||!sidewalks||!parking)return;
  for(const row of nearDunes){
   const [a,b,c,d]=row.box,offset=Math.hypot(Math.max(0,a-x,x-c),Math.max(0,b-z,z-d));
   if(offset>1650)continue;
   const agl=y-Math.max(world.visualGroundHeight(x,z),world.groundHeight(x,z));
   if(agl>480||(agl<18&&offset<90))continue;
   if(row.grade){
    if(world.mountStandardDuneGrade(row.grade))row.grade=undefined;
   }else if(!row.asked){
    row.asked=true;
    const stamp=row.stamp;
    void Promise.all([nearDuneIndex??=pinnedHogBuildingIndex(worldBase),verifyDecodedCover(cover),loadBoundedGrade(stamp,worldBase)])
     .then(([index,decoded,make])=>{
      if(index&&make&&gradeAtlasMatches(stamp,terrainSha,cover.sourceSha,decoded))
       row.grade=make(terrain,(x,z)=>terrain.atlasElevation(x,z));
     }).catch(()=>{});
   }
  }
 }
 void addMainland(scene,daylight).then(t=>{mainland=t;if(daylight?.armed)daylight.gain.value=1;}).catch(e=>warn('Mainland',e));
 const explicitGravel=options.has('gravelSurfaceStudy')&&!sceneryReviewBlock('gravelSurfaceStudy',options);
 const standardGravel=standardGravelSurfaceRequested(options)&&standardLandAtlasMatches(terrain,terrainSha,cover);
 const gravelSurface=explicitGravel?new GravelSurfaceStudy(import.meta.env.BASE_URL):
  standardGravel?new GravelSurfaceStudy(import.meta.env.BASE_URL,fetch,{
   verifyScene:async()=>await verifyDecodedCover(cover)===CANOPY_FENCE.pins.coverDecoded
  }):undefined;
 const confederationTrail=confederationTrailRequested(options)&&confederationTerrainPins(terrainSha,cover.sourceSha)?
  new ConfederationTrail(scene,world,worldBase,gl.getContextAttributes()?.antialias===true,undefined,supportsOpaqueCoverage(gl)):undefined;
 const gravelDrySeat=(x:number,y:number,z:number)=>world.surface(x,z).land&&y>=world.visualGroundHeight(x,z)-.012;
 const startRoads=(prepared?:Awaited<typeof montagueRoadJob>)=>Roads.create(scene,terrain,world.buildingShadows,
  terrain.inlandGrids.length?()=>world.nearInlandGrids():undefined,options.has('seatedRoads')?world:undefined,
  cover.montague||cover.baywalk?world:undefined,prepared,world.capeShadow,gravelSurface?.look,supportsOpaqueCoverage(gl));
 const roadReady=(preRoadJob?preRoadJob.then(startRoads):startRoads()).then(v=>{roads=v;world.registerBordenRoads(v.bordenStockRoads());return v;}).catch(e=>{warn('Road',e);});
 if(tryMappedLaneCanopy)void roadReady.then(r=>{
  const lane=mappedLaneCanopy(terrain,cover,terrainSha,r?.sourceGeometrySha256);
  if(lane)vegetation.installOpenRoadLane(lane);
 });
 const gablesStandard=standardGreenGablesHouseRequested(options)&&standardLandAtlasMatches(terrain,terrainSha,cover)&&
  terrainSha===GABLES.terrain&&cover.sourceSha===GABLES.cover;
 let gablesProof:'cold'|'checking'|'ready'|'held'='cold',gablesRoute=false;
 const houseSeat=()=>{
  const y=world.visualGroundHeight(...GABLES.centroidXZ);
  return y>=11.26&&y<=13.44;
 };
 const ordinaryHouseSeat=()=>{
  if(!gablesRoute)return false;
  if(gablesProof==='cold'){
   gablesProof='checking';
   void verifyDecodedCover(cover).then(h=>{gablesProof=h===GABLES.coverDecoded?'ready':'held';})
    .catch(()=>{gablesProof='held';});
  }
  return gablesProof==='ready'&&houseSeat();
 };
 const greenGablesGate=tryGreenGables&&terrainSha===GABLES.terrain&&cover.sourceSha===GABLES.cover&&
  cover.sourceDecodedSha===GABLES.coverDecoded?houseSeat:gablesStandard?ordinaryHouseSeat:undefined;
 const barnStandard=greenGablesBarnStandardRequested(options)?greenGablesBarnStandardGate(world,terrainSha,cover):undefined;
 const barnGate=tryBarn&&greenGablesBarnAtlasMatches(terrainSha,cover.sourceSha,cover.sourceDecodedSha)?greenGablesBarnGate(world):barnStandard;
 const rusticoEnvelopeAllowed=!showBuildingShadows&&!options.has('inlandRelief')&&!options.has('surveyRelief')&&
  !options.has('legacyRusticoMassing')&&(!!rusticoCohort||options.has('rusticoMassingReview'));
 const railSeat=railAsked&&world.buildingShadows&&renderer.capabilities.maxTextureSize>=1536&&
  SIDEWALKS.sha256===RAIL.sidewalk&&MAPPED_PARKING.sha256===RAIL.parking?railGround(world,terrainSha,()=>roads?.sourceGeometrySha256):undefined;
 const defaultRailSeat=railStandardRequested(options)&&SIDEWALKS.sha256===RAIL.sidewalk&&MAPPED_PARKING.sha256===RAIL.parking?
  standardRailGround(world,terrainSha,()=>roads?.sourceGeometrySha256):undefined;
 const railReview=railSeat&&world.buildingShadows?{ground:railSeat,shadows:world.buildingShadows}:
  defaultRailSeat?{ground:defaultRailSeat,standard:true as const}:undefined;
 const stDavidsSeat=stDavidsAsked&&world.buildingShadows&&renderer.capabilities.maxTextureSize>=1536&&
  SIDEWALKS.sha256===ST_DAVIDS.sidewalk&&MAPPED_PARKING.sha256===ST_DAVIDS.parking?stDavidsGround(world,terrainSha,()=>roads?.sourceGeometrySha256):undefined;
 const standardStDavidsSeat=stDavidsStandardRequested(options)&&SIDEWALKS.sha256===ST_DAVIDS.sidewalk&&MAPPED_PARKING.sha256===ST_DAVIDS.parking?
  standardStDavidsGround(world,terrainSha,()=>roads?.sourceGeometrySha256):undefined;
 const stDavidsReview=stDavidsSeat&&world.buildingShadows?{ground:stDavidsSeat,shadows:world.buildingShadows}:
  standardStDavidsSeat?{ground:standardStDavidsSeat,standard:true as const}:undefined;
 const paintGeorgetownSun=stDavidsReview?.standard&&!options.has('stockStDavidsGroundSun')&&
  georgetownSunMatches(terrainSha,world.sun.toArray());
 let georgetownGroundSun:Awaited<ReturnType<typeof loadChurchGroundSun>>,georgetownSunPending:typeof georgetownGroundSun;
 let georgetownSunFetched=false;
 const wallMode=townWallMode(options);
 const townWallOptics=wallMode?{panorama:sky,gain:{value:1},mode:wallMode,areas:wallMode==='core'?TOWN_WALL_CORE_AREAS:undefined}:undefined;
 // The unqualified alternate light/ground paths keep the ordinary tile.
 const sourisEastShadows=showBuildingShadows&&renderer.capabilities.maxTextureSize>=1536?world.buildingShadows:undefined;
 const sourisEastRequest=(showBuildingShadows&&!sourisEastShadows)||options.get('scenery')==='detail'||options.has('surveyRelief')||options.has('inlandRelief')?undefined:
  sourisEastGround(world,terrainSha,()=>roads?.sourceGeometrySha256);
 const buildingReady=Buildings.create(scene,terrain,sourisLighting,world.buildingShadows,spinnakers,preBuildingJob,options.has('beaconsfieldReview')&&!sceneryReviewBlock('beaconsfieldReview',options),greenGablesGate,barnGate,rusticoEnvelopeAllowed,churchCohort?.art,railReview,stDavidsReview,townWallOptics).then(v=>{
  if(localRiverLens)v.enableStrictIndianLens();
  if(ridgePreview)v.enableStrictRidgeOwner();
  if(rusticoHarbourRoofRequested(options))v.enableRusticoHarbourRoof();
  if(olearyAccessRoofRequested(options))v.enableOlearyAccessRoof();
  if(olearyCompoundRoofsRequested(options)&&supportsOpaqueCoverage(gl)&&gl.getParameter(gl.SAMPLES)===4)
   v.enableOlearyCompoundRoofs();
  if(schoolFinishRequested)v.enableGeorgetownSchoolWalls(olearyLinkPrograms(renderer,camera,scene,1,false,7400));
  if(foundersWestRequested(options)){
   const [x,z]=FOUNDERS_WEST.xz;
   const eligible=()=>SITES[activeSite].id===FOUNDERS_WEST_ROUTE&&
    (ui.mode==='flight'||ui.mode==='paused'||((ui.mode==='map'||ui.mode==='help'||ui.mode==='credits')&&(ui.previous==='flight'||ui.previous==='paused')))&&
    f.y<270&&Math.hypot(f.x-x,f.z-z)<1700;
   v.enableFoundersWest({render:renderer,camera,eligible,
    local:()=>Math.hypot(camera.position.x-x,camera.position.z-z)<550&&camera.position.y<270,
    preflight:olearyLinkPrograms(renderer,camera,scene,1,false,7400)});
  }
  if(sourisWestFacingRequested(options))v.enableSourisWestFacing(olearyLinkPrograms(renderer,camera,scene,1,false,2400));
  if(standardPrinceSurveyRoof(options))v.enablePrinceSurveyRoof(standardPrinceRoofContact(options)&&princeSkyBudget(renderer.capabilities.maxFragmentUniforms));
  if(panmurePasture)pastureOwner=v.observeSourceChunk(PASTURE.owner,PASTURE.offset,PASTURE.size);
  const station=olearyExteriorRequested(options),industrial=olearyIndustrialStudyRequested(options)&&olearyIndustrialDry(terrain,cover);
  const warehouse=station&&industrial&&olearyWarehouseRequested(options);
  if((station||industrial)&&olearySiteAllows(terrain,terrainSha,cover)){
   v.enableOlearyExterior({center:olearyGradeCenter(terrain),link:olearyLinkPrograms(renderer,camera,scene,5,industrial),verifiedCover:async()=>await verifyDecodedCover(cover)===CANOPY_FENCE.pins.coverDecoded,
    ground:()=>{const p=camera.position;return olearyCloseCamera(p.x,p.y,p.z)?world.olearyRenderGround():undefined;}},
    industrial?{station,industrialLink:olearyLinkPrograms(renderer,camera,scene,2,true),
     warehouse:warehouse?{row:undefined,link:olearyLinkPrograms(renderer,camera,scene,4,true)}:undefined}:undefined);
  }
  if(dalvayExteriorRequested(options)&&dalvaySiteSupports(terrain,terrainSha,cover)){
   const [x,z]=DALVAY.xz;
   v.enableDalvayExterior({verifiedCover:async()=>await verifyDecodedCover(cover)===CANOPY_FENCE.pins.coverDecoded,
    resident:()=>Math.hypot(camera.position.x-x,camera.position.z-z)<3200&&camera.position.y<435&&world.dalvayGroundReady()},
    dalvayGlazingRequested(options)&&daylight&&certifiedSky?.texture===sky?
     {verified:certifiedSky,panorama:sky,scene,viewer:camera,engine:renderer,report:active=>{dalvayGlazingActive=active;}}:undefined);
  }
  const explicitSeacow=seacowExteriorRequested(options);
  if((explicitSeacow||standardSeacowExteriorRequested(options))&&seacowSiteSupports(terrain,terrainSha,cover)){
   const [x,z]=SEACOW.xz;
   v.enableSeacowExterior({floor:basilicaGround(terrain),verifiedCover:async()=>await verifyDecodedCover(cover)===CANOPY_FENCE.pins.coverDecoded,
    prepare:explicitSeacow?undefined:()=>seacowDefaultFlight(SITES[activeSite].id,ui.mode,ui.previous)&&
     Math.hypot(f.x-x,f.z-z)<2700&&f.y<390,
    resident:()=>world.seacowGroundReady()&&Math.hypot(camera.position.x-x,camera.position.z-z)<2700&&camera.position.y<390});
  }
  if(sourisKnightRequested(options)&&knightGroundSupports(terrain,terrainSha,cover)){
   const [x,z]=KNIGHT_SEAT.xz;
   v.enableKnightExterior({floor:basilicaGround(terrain),verifiedCover:async()=>await verifyDecodedCover(cover)===CANOPY_FENCE.pins.coverDecoded,
    resident:()=>world.knightGroundReady()&&Math.hypot(camera.position.x-x,camera.position.z-z)<2400&&camera.position.y<365});
  }
  if(pointPrim)v.enablePointPrim();
  if(barnStandard)v.enableNearBarn();
  if(gablesStandard)v.enableNearHouse();
  if(sourisEastRequest)v.enableSourisEast(sourisEastRequest,sourisEastShadows);
  if(downtownSceneryCompatible(options)){
   v.enableSummersideRoofCohort();
   if(terminalWallPreviewRequested(options))v.enableTerminalWallPreview(renderer,camera,import.meta.env.DEV||options.has('diagnostics'));
  }
  const nearWharf=standardWharfRequested(options)?standardWharfLoader(worldBase,cover,terrain,terrainSha):undefined;
  if(nearWharf)v.enableStandardWharf(nearWharf);
  return buildings=v;
 }).catch(e=>{warn('Building',e);});
 if(confederationTrail)void Promise.all([roadReady,buildingReady,mappedSidewalks,mappedParking]).then(([r,b,s,p])=>{
  confederationTrail.permit(s&&p&&confederationSceneryPins(r?.sourceGeometrySha256,b?.sourceAtlasSha256,SIDEWALKS.sha256,MAPPED_PARKING.sha256)?
   ()=>verifyDecodedCover(cover):undefined);
 }).catch(()=>confederationTrail.permit(undefined));
 if(marsh)void Promise.all([roadReady,buildingReady,mappedSidewalks,mappedParking]).then(([r,b,s,p])=>{
  const pin=CANOPY_FENCE.pins;
  marsh.permit(!!s&&!!p&&r?.sourceGeometrySha256===pin.road&&b?.sourceAtlasSha256===pin.buildings&&
   SIDEWALKS.sha256===pin.sidewalk&&MAPPED_PARKING.sha256===pin.parking);
 }).catch(()=>marsh.permit(false));
 if(panmurePasture)void Promise.all([roadReady,buildingReady,mappedSidewalks,mappedParking]).then(([r,b,s,p])=>{
  const pin=CANOPY_FENCE.pins;panmurePasture.permit(!!s&&!!p&&r?.sourceGeometrySha256===pin.road&&b?.sourceAtlasSha256===pin.buildings&&
   String(SIDEWALKS.sha256)===pin.sidewalk&&String(MAPPED_PARKING.sha256)===pin.parking);
 }).catch(()=>panmurePasture.permit(false));
 if(regionalCanopy)void Promise.all([roadReady,buildingReady,mappedSidewalks,mappedParking]).then(([r,b,s,p])=>{
  regionalCanopy.qualifyLayers(!!s&&!!p&&regionalLayers(r?.sourceGeometrySha256,b?.sourceAtlasSha256,SIDEWALKS.sha256,MAPPED_PARKING.sha256));
 }).catch(()=>regionalCanopy.qualifyLayers(false));
 if(stdRustico)void Promise.all([roadReady,buildingReady,mappedSidewalks,mappedParking]).then(([r,b,s,p])=>{
  stdRustico.qualifyLayers(!!s&&!!p&&standardRusticoLayers(r?.sourceGeometrySha256,b?.sourceAtlasSha256,SIDEWALKS.sha256,MAPPED_PARKING.sha256));
 }).catch(()=>stdRustico.qualifyLayers(false));
 if(pointPrim)void Promise.all([roadReady,buildingReady,mappedSidewalks,mappedParking]).then(([r,b,s,p])=>{
  pointPrim.qualifyLayers(!!s&&!!p&&pointPrimLayers(r?.sourceGeometrySha256,b?.sourceAtlasSha256,SIDEWALKS.sha256,MAPPED_PARKING.sha256));
 }).catch(()=>pointPrim.qualifyLayers(false));
 if(hog)void Promise.all([roadReady,buildingReady]).then(([r,b])=>{
  if(hogInfrastructureMatches(r?.sourceGeometrySha256,b?.sourceAtlasSha256))hog.opacity.value=1;
 });
 if(basinSandStandard)void Promise.all([roadReady,buildingReady,mappedSidewalks,mappedParking]).then(([r,b,s,p])=>{
  const pin=CANOPY_FENCE.pins;
  if(s&&p&&r?.sourceGeometrySha256===pin.road&&b?.sourceAtlasSha256===pin.buildings&&
     String(SIDEWALKS.sha256)===pin.sidewalk&&String(MAPPED_PARKING.sha256)===pin.parking)
   basinSandStandard.permit(async()=>await verifyDecodedCover(cover)===pin.coverDecoded);
 }).catch(()=>{});
 if(grassCoast&&grassCoastModule)void Promise.all([roadReady,buildingReady,mappedSidewalks,mappedParking]).then(([r,b,s,p])=>{
  if(s&&p&&grassCoastModule.duneGrassInfrastructure(r?.sourceGeometrySha256,b?.sourceAtlasSha256,SIDEWALKS.sha256,MAPPED_PARKING.sha256))
   grassCoast.permit(standardGrassCoast?async()=>grassCoastModule.duneGrassBase(terrainSha,cover.sourceSha,await verifyDecodedCover(cover)):undefined);
 });
 if(duneSand&&duneLibrary)void Promise.all([roadReady,buildingReady,mappedSidewalks,mappedParking]).then(([r,b,s,p])=>{
  if(s&&p&&duneLibrary.duneSandOverlays(r?.sourceGeometrySha256,b?.sourceAtlasSha256,SIDEWALKS.sha256,MAPPED_PARKING.sha256))
   duneSand.certifyNear(async()=>duneLibrary.duneSandSources(terrainSha,cover.sourceSha,await verifyDecodedCover(cover)));
 });
 if(rollingModule){
   rollingPreflight='base layers';
   void Promise.all([roadReady,buildingReady,mappedSidewalks,mappedParking]).then(async([r,b,s,p])=>{
    const pin=rollingModule.canopyFenceMatches({
     terrain:terrainSha,cover:cover.sourceSha,coverDecoded:cover.sourceDecodedSha,
     road:r?.sourceGeometrySha256,buildings:b?.sourceAtlasSha256,sidewalk:SIDEWALKS.sha256,parking:MAPPED_PARKING.sha256
    });
    if(!s||!p||churchCohort||!pin){rollingPreflight='base sources not verified';return;}
    rollingPreflight='loading optional fence';
    const fence=await rollingModule.loadCanopyFence(worldBase,fetch,7500);
    if(!fence){rollingPreflight='optional fence unavailable';return;}
    vegetation.attachRollingShadows(scene,world,fence,rollingModule.RollingTreeShadows);
    rollingPreflight=vegetation.rollingShadowState?'mounted':'stock shader mismatch';
   }).catch(()=>{rollingPreflight='optional receiver unavailable';});
 }else if(rollingAsked)rollingPreflight='optional code unavailable';
 if(fairway)void Promise.all([roadReady,buildingReady]).then(([r,b])=>{
  if(fairwayGeometryMatches(r?.sourceGeometrySha256,b?.sourceAtlasSha256))fairway.strength.value=1;
 });
 if(useTrail)void Promise.all([roadReady,buildingReady]).then(([r,b])=>{
  if(gablesGravelGeometryMatches(r?.sourceGeometrySha256,b?.sourceAtlasSha256))world.trailStrength.value=1;
 });
 if(useGravel)void Promise.all([roadReady,buildingReady]).then(([r,b])=>{
  if(gablesGravelGeometryMatches(r?.sourceGeometrySha256,b?.sourceAtlasSha256))world.gravelStrength.value=1;
 });
 if(grass)void Promise.all([roadReady,buildingReady,mappedSidewalks,mappedParking]).then(([r,b,s,p])=>{
   if(!!s&&!!p&&String(SIDEWALKS.sha256)===GRASS_SOURCE_PINS.sides&&String(MAPPED_PARKING.sha256)===GRASS_SOURCE_PINS.parking&&
     r?.sourceGeometrySha256===GRASS_SOURCE_PINS.road&&b?.sourceAtlasSha256===GRASS_SOURCE_PINS.buildings)grass.start();
   else grass.dispose();
 }).catch(()=>grass.dispose());
 if(fieldStudy)void Promise.all([roadReady,buildingReady,mappedSidewalks,mappedParking,verifyDecodedCover(cover)]).then(([r,b,s,p,decoded])=>{
  fieldStudy.admitted=fieldLayersMatch(r?.sourceGeometrySha256,b?.sourceAtlasSha256,s?SIDEWALKS.sha256:undefined,p?MAPPED_PARKING.sha256:undefined,decoded);
 }).catch(()=>{fieldStudy.admitted=false;});
 let mappedFieldPinned:Promise<boolean>|undefined;
 const mappedFieldProof=()=>mappedFieldPinned??=Promise.all([roadReady,buildingReady,mappedSidewalks,mappedParking,verifyDecodedCover(cover)])
   .then(([r,b,s,p,decoded])=>cropFieldAtlasMatches(terrainSha,cover.sourceSha,decoded)&&
    fieldLayersMatch(r?.sourceGeometrySha256,b?.sourceAtlasSha256,s?SIDEWALKS.sha256:undefined,
     p?MAPPED_PARKING.sha256:undefined,decoded)).catch(()=>false);
 // Preserve the former opt-in art if roads, pedestrian source, building row, grade or canopy contract is unavailable.
 // Only the final near call starts an extra download, after the signed art is already resident.
 let museumInputs=false,museumTried=false,museumShadow:MuseumShadowDelta|undefined;
 let museumGrade:ReturnType<NonNullable<Awaited<ReturnType<typeof loadBoundedGrade>>>>|undefined;
 if(museumAsked)void Promise.all([roadReady,buildingReady,mappedSidewalks,mappedParking,verifyDecodedCover(cover)]).then(([rd,bl,sw,pk,ok])=>{
  const pins=BEACON_RECEIVERS.fences;
  museumInputs=!!sw&&!!pk&&ok===BEACON_GRADE.coverDecodedSha256&&gradeAtlasMatches(BEACON_GRADE,terrainSha,cover.sourceSha,ok)&&
   rd?.sourceGeometrySha256===pins.roads&&bl?.sourceAtlasSha256===pins.allBuildings&&SIDEWALKS.sha256===pins.sidewalk&&MAPPED_PARKING.sha256===pins.parking;
 }).catch(()=>{});
 const museumRange=(x:number,y:number,z:number)=>Math.hypot(x-5104.224,z-29805)<680&&y<265;
 const updateMuseumGround=(permitted:boolean)=>{
  const author=permitted&&museumInputs&&buildings?.beaconsfieldPreviewActive&&museumRange(camera.position.x,camera.position.y,camera.position.z);
  if(author&&!museumTried){
   museumTried=true;
   void Promise.all([loadBoundedGrade(BEACON_GRADE,worldBase),import('./render/beaconsfield-grade/receiver.ts')]).then(([make,library])=>{
    if(make){museumGrade=make(terrain,(x,z)=>terrain.atlasElevation(x,z));museumShadow=new library.MuseumShadowDelta(scene,renderer.capabilities.maxTextures);}
   }).catch(()=>{});
  }
  if(!museumShadow||!museumGrade)return;
  const roster=vegetation.beaconsfieldShadowRoster();
  try{
   const local=author?world.stageBeaconsfieldNear(museumGrade,museumShadow.positiveGround):undefined,match=museumShadow.update(roster,local);
   if(!world.setBeaconsfieldGround(match)&&match)museumShadow.clear(roster);
  }catch{museumShadow.clear(roster,true);world.setBeaconsfieldGround(false);}
 };
 if(cover.sourceSha===SIDEWALKS.pinCoverSha256){
  void Promise.all([mappedSidewalks,roadReady,buildingReady]).then(([paths,street,structures])=>{
   if(paths&&street&&structures&&street.sourceGeometrySha256===SIDEWALKS.pinRoadGeometrySha256&&
      structures.sourceAtlasSha256===SIDEWALKS.pinBuildingAtlasSha256)sidewalks=new Sidewalks(scene,world,paths,supportsOpaqueCoverage(gl));
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
      structures.sourceAtlasSha256===MAPPED_PARKING.pinBuildingAtlasSha256)parking=new ParkingSurfaces(scene,world,areas,supportsOpaqueCoverage(gl));
  });
 }
 let princeSource:Awaited<ReturnType<typeof verifiedPrinceOverview>>,princeSourceFinished=false,princeRequest:AbortController|undefined;
 const preparePrinceSource=()=>{
  if(princeSourceFinished||princeRequest)return;
  const request=princeRequest=new AbortController();
  void Promise.all([roadReady,buildingReady,mappedSidewalks,mappedParking]).then(async([r,b,walk,park])=>{
   if(request.signal.aborted||!r?.sourceGeometrySha256||!b?.sourceAtlasSha256||!terrainSha||!cover.sourceSha||!walk||!park||
    SIDEWALKS.sha256!==CANOPY_FENCE.pins.sidewalk||MAPPED_PARKING.sha256!==CANOPY_FENCE.pins.parking||
    await verifyDecodedCover(cover)!==CANOPY_FENCE.pins.coverDecoded)return;
   const source=await verifiedPrinceOverview(import.meta.env.BASE_URL,{terrain:terrainSha,cover:cover.sourceSha,
    road:r.sourceGeometrySha256,buildings:b.sourceAtlasSha256},fetch,request.signal);
   if(princeRequest===request&&!request.signal.aborted)princeSource=source;
  }).catch(()=>{}).finally(()=>{
   if(princeRequest===request){princeSourceFinished=!request.signal.aborted;princeRequest=undefined;}
  });
 };
 const tgt=new THREE.Vector3(),eye=new THREE.Vector3(),forward=new THREE.Vector3(),up=new THREE.Vector3(),right=new THREE.Vector3(),rot=new THREE.Quaternion(),aim=new THREE.Vector3(),groundY=new THREE.Vector3();
 const liveCasters=(x:number,z:number,d:number,out:THREE.Mesh[])=>buildings?.drawableCasters(x,z,d,out);
 const diagnostic=import.meta.env.DEV||new URLSearchParams(location.search).has('diagnostics');
 const drawingBuffer=new THREE.Vector2();
 const rE=new THREE.Euler(0,0,0,'YXZ');let oldMode=ui.mode;
 let ridgeDeparture:typeof f|undefined,princeDeparture:typeof f|undefined;
 renderer.setAnimationLoop((now:number)=>{
  const delta=Math.min(.10,Math.max(0,(now-last)*.001));last=now;time+=delta;
  const u=input.poll(pause);
  if(ui.mode==='dispatch'&&ui.selected!==activeSite)reposition(ui.selected);
  const dispatch=ui.mode==='dispatch',playing=ui.mode==='flight';
  const retainPointPrim=!dispatch&&!((ui.mode==='map'||ui.mode==='help'||ui.mode==='credits')&&ui.previous==='dispatch');

  world.trackBordenFrame(f.x,f.z);
  world.prepareAdaptiveTerrain(f.x,f.z,f.y,performance.now());
  // Commit verified near geometry before the fixed-step contact sampler.
  if(princePreview){
   const route=SITES[activeSite].id===PRINCE_LANDSCAPE_ROUTE,begin=route&&playing;
   if(route&&ui.mode==='dispatch')preparePrinceSource();
   if(!route&&princeRequest){princeRequest.abort();princeRequest=undefined;}
   const retain=route&&(playing||ui.mode==='paused'||ui.mode==='crash'||
    (ui.mode==='map'||ui.mode==='help'||ui.mode==='credits')&&(ui.previous==='flight'||ui.previous==='paused'||ui.previous==='crash'));
   if(!route||(!retain&&ui.mode!=='dispatch'))world.clearPrinceLandscape();
   world.checkPrinceLandscape();
   if(route&&ui.mode==='dispatch'&&princeSource){
    if(world.princeLandscapeActive)world.clearPrinceLandscape();
    world.preparePrinceLandscape(princeSource);
   }
   if(begin&&f!==princeDeparture){
    princeDeparture=f;
    if(world.princeLandscapeReady&&f.status==='flying'&&f.y-world.groundHeight(f.x,f.z)>=30)world.armPrinceLandscape();
   }
   ui.setPrinceLandscapeState(!route?'different':retain?(world.princeLandscapeActive?'playing':'stock'):
     world.princeLandscapeReady?'ready':princeSourceFinished&&!princeSource?'unavailable':'pending');
  }
  if(ridgePreview){
   const here=SITES[activeSite].id;
   const rightFlight=kingsRidgeAirState(here,ui.mode,ui.previous);
   const [a,b,c,d]=KINGS_DRY_CROWN.boundsXZ;
   const distance=Math.hypot(Math.max(0,a-f.x,f.x-c),Math.max(0,b-f.z,f.z-d));
   world.maintainKingsRidge();
   const ready=!!crownGround&&buildings?.kingsRidgeOwnerLive===true;
   if(!rightFlight.retain||!ready||distance>3900)world.clearKingsRidge();
   if(rightFlight.initiate&&ridgeDeparture!==f){
    // One decision per genuine departure. A late or incompatible pack stays
    // stock for the whole flight rather than rising under the aircraft.
    ridgeDeparture=f;world.clearKingsRidge();
    if(crownGround&&ready&&distance<2700&&f.status==='flying'&&f.y-world.groundHeight(f.x,f.z)>=45)
     world.installKingsRidge(crownGround);
   }
   ui.setKingsRidgeState(rightFlight.retain?(world.kingsRidgeContactActive?'playing':'stock'):
    here==='kings-coastal-ridge'?(ready?'ready':crownGround?'pending':'unavailable'):'different');
  }
  if(nearDunes.length&&f.status==='flying')updateNearDunes(f.x,f.z,f.y);
  if(museumAsked){vegetation.update(f.x,f.z,f.y);updateMuseumGround(!dispatch||options.has('qa'));}
  const riverFlight=localRiverLens?indianRiverLensFlight(SITES[activeSite].id,ui.mode,ui.previous):undefined;
  const retainChurch=!!churchCohort&&(!riverFlight||riverFlight.retain);
  const hasRiverGrade=!!riverFlight&&world.groundGradeInstalled(INDIAN_RIVER_GRADE.id);
  const canStageChurch=retainChurch&&(!riverFlight||indianRiverCanCommit(riverFlight.initiate,riverFlight.retain,hasRiverGrade,
   f.status,hasRiverGrade||!riverFlight.initiate?0:f.y-world.groundHeight(f.x,f.z)));
  if(churchCohort&&retainChurch){
   // Finalize the live roster and exact near-grade/shadow/owner transaction
   // before the fixed step. Keep the same roster for this rendered frame.
   vegetation.update(f.x,f.z,f.y);
   const ready=localRiverLens?buildings?.indianRiverLensDrawReady:buildings?.indianRiverPrepared;
   const proposal=canStageChurch&&ready&&churchCohort.art.inRange(camera.position)?
    (localRiverLens?world.stageIndianRiverLens(churchCohort.ground):world.stageStMarysNear(churchCohort.ground)):undefined;
   const matched=localRiverLens?vegetation.checkStMarysLensShadows(scene,churchCohort.shadowAdapter,INDIAN_RIVER_GRADE.id,proposal):
    vegetation.updateStMarysShadows(proposal);
   const committed=localRiverLens?world.setIndianRiverLens(matched):world.setStMarysGround(matched);
   if(!committed&&matched)vegetation.updateStMarysShadows();
   churchCohort.groundSun.live.value=committed?1:0;
   churchCohort.art.setView(camera.position,world,INDIAN_RIVER_GRADE.id,committed);
   buildings?.syncIndianRiver();
   if(localRiverLens&&(!committed||!buildings?.indianRiverActive)){
    world.setIndianRiverLens(false);vegetation.detachStMarysShadows();churchCohort.groundSun.live.value=0;
    churchCohort.art.setView(camera.position,world,INDIAN_RIVER_GRADE.id,false);buildings?.syncIndianRiver();
   }
  }else if(localRiverLens&&churchCohort){
   vegetation.detachStMarysShadows();world.dropIndianRiverLens();churchCohort.groundSun.live.value=0;
   churchCohort.art.setView(camera.position,world,INDIAN_RIVER_GRADE.id,false);buildings?.syncIndianRiver();
  }
  pointPrim?.before(buildings,f,camera.position,playing&&f.status==='flying',retainPointPrim);
  const rusticoRoute=SITES[activeSite].id===RUSTICO_LIGHT_ROUTE;
  // Retain a mounted seat on the contact-to-stop frame as well as pause.
  // Crash mode can never initiate a new scenery/ground transaction.
  const retainRustico=retainPointPrim;
  stdRustico?.before(rusticoRoute,retainRustico,playing&&f.status==='flying',dispatch,f,camera.position);
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
  }else if(view===3&&options.has('sceneryObserver')){
   const v=observerView(f,camera.aspect);
   eye.set(...v.eye);tgt.set(...v.target);up.copy(cameraUp);
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
  for(const fields of routeFields){
   const selected=SITES[activeSite]?.id===fields.route.id&&ui.mode!=='crash'&&
    !(ui.mode!=='flight'&&ui.mode!=='paused'&&ui.mode!=='dispatch'&&ui.previous==='crash');
   if(selected){
    const p=retainPointPrim?camera.position:groundY;
    fields.update(retainPointPrim,playing&&f.status==='flying',mappedFieldProof,p,
     p.y-terrain.atlasElevation(p.x,p.z),()=>world.mappedFieldGround(fields.materials,fields.route.tile));
   }else fields.leave();
  }
  sourisShoreline?.update(camera.position);world.sourisWaterTie.value=sourisShoreline?.isActive()?1:0;foliage?.update(camera.position,time,ui.mode!=='crash');rustico?.update(camera.position);
  if(rusticoSoil){
   const active=!!rustico?.state.visible&&world.groundGradeInstalled(RUSTICO_GRADE.id);
   world.rusticoSoilStrength.value=Number(active);
   const near=active&&canTuft&&camera.position.y<26&&Math.hypot(camera.position.x-DRY_FRAME.origin[0],camera.position.z-DRY_FRAME.origin[1])<65;
   if(near&&!tuftsJob)tuftsJob=import('./render/dry-coast/tussocks.ts').then(m=>{tuftsModule=m;}).catch(()=>{});
   if(near&&tuftsModule&&!tuftBuild){
    tuftBuild=true;
    try{rusticoTufts=tuftsModule.makeDryTussocks(world,rusticoSoil);if(rusticoTufts)scene.add(rusticoTufts.mesh);}catch{/** Optional near silhouettes may remain absent. */}
   }
   if(rusticoTufts)rusticoTufts.mesh.visible=near;
  }
  northCape?.update(camera.position,time);
  streamedCape?.update(camera.position,time);
  regionalWind?.update(camera.position,time);
  if(basinFootbridge){
   const dx=camera.position.x-basinFootbridge.position.x,dz=camera.position.z-basinFootbridge.position.z;
   // A 10 m boardwalk needs no near-detail draw at the distant headlands.
   basinFootbridge.visible=dx*dx+dz*dz<3000**2;
  }
  if(basinWharf)basinWharf.visible=Math.hypot(camera.position.x-basinWharf.position.x,camera.position.z-basinWharf.position.z)<3100;
  if(basinCannery)basinCannery.visible=Math.hypot(camera.position.x-basinCannery.position.x,camera.position.z-basinCannery.position.z)<4600;
  const eyeAGL=camera.position.y-world.groundHeight(camera.position.x,camera.position.z);
  panmurePasture?.update(camera.position,time,playing&&f.status==='flying',!cinematic,()=>pastureBinding?.ready()?pastureOwner?.():undefined);
  if(nearshoreStandard)world.nearshoreLocalGain.value=nearshoreStandard.update(camera.position,time,playing&&f.status==='flying',!cinematic);
  // The shader's exact edge is 180 m of eye distance. A broad absolute
  // guard never fades an uphill fragment early when hovering over a hollow.
  if(standardMeadow)world.meadowStrength.value=standardMeadow.update(time,!cinematic&&camera.position.y<330,
   ()=>eyeAGL<190&&world.meadowNear(camera.position.x,camera.position.z));
  roads?.update(f.x,f.z,eyeAGL);
  gravelSurface?.update(camera.position,eyeAGL,playing,roads,gravelDrySeat,diagnostic);
  const barnAgl=barnStandard&&(f.x-BARN.gameXZ[0])**2+(f.z-BARN.gameXZ[1])**2<2700**2?
   f.y-world.visualGroundHeight(f.x,f.z):undefined;
  const schoolAgl=schoolFinishRequested&&georgetownSchoolWallNear(f.x,f.z)?f.y-world.groundHeight(f.x,f.z):undefined;
  gablesRoute=gablesStandard&&SITES[activeSite].id==='cavendish-dunelands-low'&&retainPointPrim&&
   camera.position.y<330&&Math.hypot(f.x-GABLES.centroidXZ[0],f.z-GABLES.centroidXZ[1])<1950;
  buildings?.update(f.x,f.z,barnAgl,f.y,schoolAgl);
  pointPrim?.after(f,camera.position,retainPointPrim);
  stdRustico?.after(rusticoRoute,retainRustico,camera.position);
  if(paintGeorgetownSun){
   const hasChurch=!!buildings?.stDavidsActive;
   if(georgetownGroundSun)georgetownGroundSun.live.value=hasChurch?1:0;
   else if(hasChurch&&georgetownSunPending){
    const mask=georgetownSunPending;georgetownSunPending=undefined;
    if(world.mountGeorgetownGroundSun(mask)){
     georgetownGroundSun=mask;mask.live.value=1;
    }else mask.uniforms.churchSunMask.value.dispose();
   }else if(hasChurch&&!georgetownSunFetched){
    georgetownSunFetched=true;
    void loadChurchGroundSun(GEORGETOWN_GROUND_SUN,worldBase).then(mask=>georgetownSunPending=mask).catch(()=>{});
   }
  }
  if(frontageAllowed&&!frontageProbe&&buildings?.summersideWaterRoofActive&&roads?.sourceGeometrySha256&&
     Math.hypot(f.x-SUMMERSIDE_FRONTAGE_ROOT[0],f.z-SUMMERSIDE_FRONTAGE_ROOT[1])<3100){
   frontageProbe=true;
   void authenticateSummersideFrontage(terrain,cover,terrainSha,roads.sourceGeometrySha256).then(verified=>{
    if(verified)frontageArmed=vegetation.installOpenRoadLane(verified);
   });
  }
  confederationTrail?.update(camera.position.x,camera.position.z,eyeAGL,ui.mode==='flight'||ui.mode==='paused');
  sidewalks?.update(camera.position.x,camera.position.z,eyeAGL);parking?.update(camera.position.x,camera.position.z,eyeAGL);if(!retainChurch&&!museumAsked)vegetation.update(f.x,f.z,f.y);cruiseCrownPrefetch(f.x,f.z,eyeAGL);vegetation.updateVolume(camera.position.x,camera.position.z,eyeAGL);
  if(museumShadow?.live&&(!buildings?.beaconsfieldPreviewActive||!world.groundGradeInstalled(BEACON_GRADE.id))){museumShadow.clear(vegetation.beaconsfieldShadowRoster());world.setBeaconsfieldGround(false);}
  if(rollingModule)vegetation.updateRollingShadows(camera.position.x,camera.position.z,eyeAGL);
  if(miscoucheRequest){
   const d2=(camera.position.x-MISCOUCHE_OWNER[0])**2+(camera.position.z-MISCOUCHE_OWNER[1])**2;
   const nearby=Number.isFinite(camera.position.y)&&camera.position.y<(chooseMiscoucheStandard?342:970)&&d2<1100**2;
   const standReady=nearby&&miscoucheInfrastructure&&forestStream.hasHeightPlan('7-12',MISCOUCHE_EFI)&&
    roads?.sourceGeometrySha256==='72528a1b26b68ee345e5047f30f2c9b49a3c18edeaccaf3e759ead296d3276c1'&&
    buildings?.sourceAtlasSha256==='538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557';
   const canStart=!chooseMiscoucheStandard||playing&&f.status==='flying';
   if(standReady&&canStart&&miscoucheProof==='cold'){
    miscoucheProof='waiting';
    void verifyDecodedCover(cover).then(pin=>{
     miscoucheProof=pin===CANOPY_FENCE.pins.coverDecoded?'verified':'stock';
    }).catch(()=>{miscoucheProof='stock';});
   }
   if(standReady&&canStart&&miscoucheProof==='verified'&&!miscoucheJob){
    miscoucheJob=true;
    void import('./render/miscouche-fill.ts').then(module=>{miscoucheDef=module;}).catch(()=>{});
   }
   if(standReady&&canStart&&miscoucheDef&&!miscoucheArt&&!miscoucheRejected){
    try{
     miscoucheArt=miscoucheDef.createMiscoucheFill(scene,vegetation.crownFillMaterial(),(x,z)=>
      cover.distance(terrain,x,z)>=125&&world.surface(x,z).land?world.visualGroundHeight(x,z):undefined,chooseMiscoucheStandard);
    }catch{/** The isolated optional art may remain absent. */}
    if(!miscoucheArt)miscoucheRejected=true;
   }
   if(!nearby&&miscoucheArt){miscoucheArt.dispose();miscoucheArt=undefined;}
   miscoucheArt?.update(camera.position,!!standReady&&(!chooseMiscoucheStandard||!cinematic)&&d2<740**2&&vegetation.miscoucheFillRoster(),world.visualGroundEpoch,performance.now());
  }
  if(regionalCanopy){
   const lowScope=regionalCanopy.interested(f,camera.position);
   regionalCanopy.update(f,camera.position,lowScope?f.y-world.groundHeight(f.x,f.z):Infinity,
    eyeAGL,playing&&f.status==='flying',!cinematic,now);
  }
  duneSand?.update(camera.position.x,camera.position.z,eyeAGL);
  grassCoast?.update(camera.position.x,camera.position.y,camera.position.z);
  basinSandStandard?.update(camera.position.x,camera.position.y,camera.position.z);
  // If camera/LOD/owner changes away after the step, the craft is outside
  // the patch already. Clear the remaining draw lease before rendering.
  if(churchCohort&&(!churchCohort.art.inRange(camera.position)||
    !(localRiverLens?buildings?.indianRiverLensDrawReady&&buildings.indianRiverActive:buildings?.indianRiverPrepared)||
    !world.groundGradeInstalled(INDIAN_RIVER_GRADE.id))){
   if(localRiverLens){world.setIndianRiverLens(false);vegetation.detachStMarysShadows();}
   else {world.setStMarysGround(false);vegetation.updateStMarysShadows();}
   churchCohort.groundSun.live.value=0;
   churchCohort.art.setView(camera.position,world,INDIAN_RIVER_GRADE.id,false);buildings?.syncIndianRiver();
  }

  ui.update(f,world.groundHeight(f.x,f.z)-.12);audio.update(f.throttle,f.speed,playing&&!f.engineOut);
  if(world.buildingShadows){
   world.buildingShadows.render(camera.position,world.groundHeight(camera.position.x,camera.position.z),
    buildings?liveCasters:undefined);
  }
  churchCohort?.art.updateDetail(camera,renderer.getDrawingBufferSize(drawingBuffer).y);
  basilicaSun?.update(camera.position,delta);
  if(dalvayAllowed){
   const p=camera.position,near=Math.hypot(p.x-9914.042434018622,p.z-9677.795112696944)<3400&&p.y<1350;
   const eligible=near&&!scene.overrideMaterial&&!renderer.getRenderTarget()&&!renderer.getContext().isContextLost()&&!renderer.xr.isPresenting;
   if(eligible&&!dalvayRequested&&world.dalvayWaterReceivers()){
    dalvayRequested=true;dalvayOpticsAdmission='cover';
    void (async()=>{if(await verifyDecodedCover(cover)!==CANOPY_FENCE.pins.coverDecoded){dalvayOpticsAdmission='unavailable';return;}
     dalvayOpticsAdmission='module';const m=await import('./render/dalvay-lake-optics.ts');
     dalvayOpticsAdmission='asset';const body=await m.loadDalvayOptics(worldBase);
     if(!body){dalvayOpticsAdmission='unavailable';return;}
     dalvayVisual=new m.DalvayLakeOptics(body);dalvayOpticsAdmission='ready';
    })().catch(()=>{dalvayOpticsAdmission='unavailable';});
   }
   if(eligible||dalvayVisual?.active)dalvayVisual?.update(()=>eligible?world.dalvayWaterReceivers():undefined);
  }
  buildings?.syncTerminalWall();
  if(world.kingsRidgeContactActive&&buildings?.kingsRidgeOwnerLive!==true)world.clearKingsRidge();
  if(aircraftDepth)world.prepareAircraftRunwayCast(aircraft.root.position,camera,
   SITES[activeSite].id==='cysu'&&(ui.mode==='flight'||ui.mode==='paused'||((ui.previous==='flight'||ui.previous==='paused')&&
    (ui.mode==='map'||ui.mode==='help'||ui.mode==='credits'))));
  const endRidge=world.beginKingsRidgeDraw(camera);
  const endPrince=world.beginPrinceLandscapeDraw(),endCapeSky=world.capeTryonSkySeat?.begin(camera);
  let endRim:undefined|(()=>void),endBorden:undefined|(()=>void);
  try{if(datedStandReview){
   let end:undefined|(()=>void);
   try{end=datedStandReview.beforeFrame({site:SITES[activeSite].id,mode:ui.mode,view,now});}
   catch{datedStandReview.dispose();}
   try{endRim=world.beginRegularNorthRimDraw(camera);endBorden=world.beginBordenShoreArc(camera);renderer.render(scene,camera);}
   finally{endBorden?.();endBorden=undefined;endRim?.();endRim=undefined;end?.();}
  }else{endRim=world.beginRegularNorthRimDraw(camera);endBorden=world.beginBordenShoreArc(camera);renderer.render(scene,camera);}
  }finally{endBorden?.();endRim?.();endCapeSky?.();endPrince?.();endRidge?.();}
  if(world.tryonRockState==='pending'&&roads&&buildings&&mainland&&world.detailState().loading===0)
   void world.prepareTryonRock(camera);
  if(world.capeWetState==='pending')void world.prepareCapeWet(camera);
  if(diagnostic){
   if(datedStandReview&&new URLSearchParams(location.search).has('diagnostics'))
    Object.assign(window,{islandAirNorthCapeStandReview:datedStandReview.status});
   if(kingsFields)Object.assign(window,{islandAirKingsFields:{state:kingsFields.state,gain:kingsFields.gain}});
   if(queensFields)Object.assign(window,{islandAirQueensFields:{state:queensFields.state,gain:queensFields.gain}});
   if(princeFields)Object.assign(window,{islandAirPrinceFields:{state:princeFields.state,gain:princeFields.gain}});
   Object.assign(window,{islandAirDiagnostics:{regularNorthRim:world.regularNorthRimState,foundersWestWall:buildings?.foundersWestActive??false,georgetownSchoolWallStage:buildings?.georgetownSchoolWallStage,georgetownSchoolWalls:buildings?.georgetownSchoolWallsActive??false,olearyWarehouse150:buildings?.olearyWarehouseActive?'authored':'stock',olearyIndustrial192:buildings?.olearyIndustrialActive?'authored':'stock',olearyExterior:buildings?.olearyExteriorActive?'authored':'stock',dalvayExterior:buildings?.dalvayExteriorActive?'authored':'stock',dalvayGlazing:buildings?.dalvayExteriorActive&&dalvayGlazingActive?'reflected':'stock',dalvayWaterOptics:dalvayVisual?.state??null,dalvayWaterAdmission:dalvayOpticsAdmission,sourisKnightExterior:buildings?.knightExteriorActive?'authored':'stock',seacowExterior:buildings?.seacowExteriorActive?'authored':'stock',basilicaSun:basilicaSun?.state??null,basilicaExterior,regionalWind:regionalWind?.diagnostics()??null,sourisShoreline:sourisShoreline?.state??null,panmurePasture:panmurePasture?.state??null,standardMeadow:standardMeadow?.state??null,regionalCanopy:regionalCanopy?.state??null,pointPrim:pointPrim?.state??null,hogPhoto:world.hogPhoto?.opacity.value===1,hogWestAerial:world.westDuneOptics?.gain.value===1,duneSand:duneSand?.note()??null,grassCoast:grassCoast?.diagnostics()??null,basinSandStandard:basinSandStandard?.state??null,indianRiver:buildings?.indianRiverActive??false,indianRiverLocalLens:localRiverLens,kingsRidgePreview:ridgePreview,kingsRidgeAuthority:!!crownGround&&buildings?.kingsRidgeOwnerLive===true,kingsRidgeContact:world.kingsRidgeContactActive,princeLandscape:world.princeLandscapeActive,princeLandscapeReady:world.princeLandscapeReady,indianRiverSun:churchCohort?.groundSun.live.value===1,indianRiverDetail:churchCohort?.art.detail??null,indianRiverPrepared:buildings?.indianRiverPrepared??false,indianRiverShadowReceivers:vegetation.stMarysShadowReceivers,indianRiverShadowTriangles:vegetation.stMarysShadowTriangles,provinceGrass:grass?.stream.state??null,provinceFields:fieldStudy?.stream.state??null,cropRowsReview:!!world.fieldPilot,beaconsfieldReview:buildings?.beaconsfieldPreviewActive??false,beaconsfieldGrade:!!museumShadow?.live,beaconsfieldGradeShadows:museumShadow?.count??0,beaconsfieldGradeShadowTriangles:museumShadow?.triangles??0,greenGablesReview:buildings?.greenGablesPreviewActive??false,greenGablesBarnReview:buildings?.greenGablesBarnPreviewActive??false,summersideStation:buildings?.summersideStationActive??false,stDavids:buildings?.stDavidsActive??false,stDavidsGroundSun:georgetownGroundSun?.live.value===1,site:SITES[activeSite].id,mode:ui.mode,camera:names[view],x:f.x,z:f.z,altitude:f.y,heading:f.heading,bank:f.bank,speed:f.speed,throttle:f.throttle,engineOut:f.engineOut,
    summersideTerminalWallPreview:buildings?.terminalWallActive??false,summersideTerminalWallDrawn:buildings?.terminalWallDrawn??false,
    legacyShore:world.legacyShoreState,openCoast:world.openCoastState,panmureCoast:world.panmureCoastState,tryonCoast:world.tryonCoastState,tryonRockPreview:world.tryonRockActive,tryonRockState:world.tryonRockState,capeWetState:world.capeWetState,...(world.capeTryonSkySeat?{capeTryonSkySeat:world.capeTryonSkySeat.state}:{}),shoreFoamDetail:standardBreakers,openRipples,princeRoofContact:buildings?.princeRoofContactActive??false,princeSurveyRoof:buildings?.princeSurveyRoofActive??false,townWallStudy:buildings?.townWallReview??false,townWallProfile:buildings?.townWallProfile??null,nearshoreStandard:nearshoreStandard?.state??null,nearshoreFoamStudy:world.nearshoreFoamArmed&&world.nearshoreFoamMode.value>=1.5&&world.nearshoreLocalGain.value>0,canopyLight:directionalCanopy,northCape:(northCape??streamedCape?.art)?.counts??null,adaptiveTerrain:world.adaptiveState,forestFloor:world.floorState,buildingShadows:world.buildingShadows?.state??null,hedgerows:{...hedgeStream.state,visible:vegetation.hedgeCount},woodlandStream:forestStream.state,miscoucheFill:miscoucheArt?.mesh.visible?miscoucheArt.total:0,miscoucheFillGain:miscoucheArt?.gain??0,woodlandVolume:vegetation.volumeCount,woodlandCull:vegetation.woodlandCull,woodlandBark:barkLoader?vegetation.woodlandBark:null,woodlandCrown:crownStream?{...crownStream.state,rosterEligible:vegetation.crownBaseCount}:null,woodlandGroundedShadows:vegetation.groundedShadowCount,rollingForestShadows:vegetation.rollingShadowState,rollingForestPreflight:rollingPreflight,woodlandHeights:forestHeights?.ids??[],mappedLaneCanopy:tryMappedLaneCanopy?vegetation.openRoadLaneState:null,summersideOpenGround:frontageArmed?vegetation.openRoadLaneState:null,aerialPerspective:daylight?.armed&&daylight.gain.value>0,orthophotoSeams:ortho?.diagnostics(),marsh:marsh?.diagnostics(),marshFoliage:foliage?.diagnostics(),rudderAngle:aircraft.rudderAngle(),altitudeAngles:aircraft.altitudeAngles(),controlAngles:aircraft.controlAngles(),inlandSurveys:terrain.inlandGrids.map(g=>g.spec.id),coastalSurveys:terrain.coastalSurveys,coastalRefinements:terrain.coastalRefinements,coastalBenches:world.coastalBenches,shelteredWater:world.shelteredWater,bowleyPond:world.bowleyPond,cavendishWaterCore:world.hasFreshwaterSource(DUNELANDS.id)?DUNELANDS.id:null,localGroundGrade:world.activeGroundGrade,localGroundGrades:world.activeGroundGrades,kingsDryCrownBlend:world.kingsDryCrownBlend,northRusticoLighthouse:rustico?.state??stdRustico?.state??null,rusticoMassingReview:buildings?.rusticoMassingPreviewActive??false,rusticoHarbourRoof:buildings?.rusticoHarbourRoofActive??false,sourisWestFacing:buildings?.sourisWestFacingActive??false,olearyAccessRoof:buildings?.olearyAccessRoofActive??false,rusticoDrySoil:world.rusticoSoilStrength.value>0,rusticoDryTussocks:rusticoTufts?.mesh.visible?rusticoTufts.roots.length:0,gablesGravelReview:world.gravelStrength.value>0,gablesTrailReview:world.trailStrength.value>0,gablesFairwayReview:!!fairway?.strength.value,harbourShoreline:cover.harbour?.plan.id??null,montagueFoundation:cover.montague?.plan.id??null,montagueBridge:roads?.bridgePreviewActive??false,spinnakersDeck:buildings?.spinnakersActive??false,northBaywalkCourt:world.baywalkActive,northBaywalkRamp:buildings?.northBaywalkActive??false,northBaywalkRoad:roads?.baywalkRoadActive??false,northBaywalkConcrete:buildings?.northConcreteActive??false,basinShoreline:cover.basin?.plan.id??null,basinFootbridge:!!basinFootbridge,basinFootbridgeVisible:basinFootbridge?.visible??false,basinCanneryVisible:basinCannery?.visible??false,basinWharfVisible:basinWharf?.visible??false,basinWharfToe:cover.wharfToe,quartermasterDocks:quartermasterDocks??null,sourisLighting:sourisLighting?.active.value?sourisLighting.id:null,groundY:world.groundHeight(f.x,f.z),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,roads:!!roads,pavement:roads?.pavementStatus??null,runway03Pavement:world.runway03PavementLive.value===1,summersideRunwayPavement:world.summersideRunwayPavementLive.value===1,aircraftRunwayCast:aircraftDepth?.state??null,seatedRoads:roads?.seatState??null,sidewalks:sidewalks?.state??null,parking:parking?.state??null,gravelSurface:gravelSurface?.state??null,confederationTrail:confederationTrail?.state??null,buildings:!!buildings,buildingTiles:buildings?.diagnostics(),sourisEastExterior:buildings?.sourisEastActive??false,summersideMeasuredRoofs:buildings?.summersideRoofCount??0,mainland:!!mainland,detail:world.detailState(),layerWarnings:layerWarnings.slice()}});
  }
 });
}
run().catch(err=>{console.error(err);failUI(err instanceof Error?err.message:String(err));});
