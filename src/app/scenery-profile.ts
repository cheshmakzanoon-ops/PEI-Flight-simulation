import {NORTH_CAPE_STAND_ACTIVATE,NORTH_CAPE_STAND_VETO} from './north-cape-stand-option.ts';
/**
 * A dispatch shortcut for already independent, validated previews. Standard
 * keeps its settings and URL behavior. This is not a new scenery source.
 */
export const DETAIL_FLAGS=[
 'shoreFoamDetail','legacyShoreArcs','canopyLight','forestFloor','woodland3D',
 'spinnakersPreview','northBaywalkPreview','baywalkConcrete',
 'basinChannel','basinWharf','montagueFoundationPreview','montagueReachOptics','northCapeWind','bowleySurveyPreview',
] as const;

/** Named regional pack using already released independent scenery. */
export const CAVENDISH_PACKAGE_FLAGS=['greenGablesReview','greenGablesBarnReview','cavendishWaterReview',
 'gablesGradeReview','gablesFairwayReview','gablesTrailReview'] as const;
export const CAVENDISH_PACKAGE_FLAG='cavendishDetail';
export function cavePackageBlocked(q:URLSearchParams){
 return ['surveyRelief','inlandRelief','buildingShadows'].some(x=>q.has(x));
}
export function switchCavendishPackageURL(source:string,on:boolean,departureId:string){
 const url=new URL(source);
 if(on)url.searchParams.set(CAVENDISH_PACKAGE_FLAG,'');
 else url.searchParams.delete(CAVENDISH_PACKAGE_FLAG);
 url.searchParams.set('departure',departureId);
 return url.href;
}
export function cavendishPackageState(search:string){
 const q=new URLSearchParams(search);
 const selected=q.has(CAVENDISH_PACKAGE_FLAG),blocked=cavePackageBlocked(q);
 return {selected,blocked,active:selected&&!blocked};
}

export const CAPE_TRYON_ROCK_FLAG='capeTryonRockReview';
export const CAPE_TRYON_ROCK_STOCK='stockCapeTryonRock';
export const CAPE_TRYON_DEPARTURE='cape-tryon-coast';
/** Standard admits the existing local sandstone material only in its
 * unchanged, compatible shoreline family. The older opt-in is still valid. */
export function capeTryonRockRequested(q:URLSearchParams){
 const profiles=q.getAll('scenery');
 if(profiles.length>1||profiles.some(v=>v!==''&&v!=='standard')||
    q.has(CAPE_TRYON_ROCK_STOCK)||!standardOpenCoastRequested(q))return false;
 return q.has(CAPE_TRYON_ROCK_FLAG)||(!q.has('qa')&&standardComparisonQuery(q));
}
/** Opt-in while moving admission and co-owner controls are qualified. */
export function capeTryonSkySeatRequested(q:URLSearchParams){
 const comparison=new URLSearchParams(q);comparison.delete('qa');
 const profiles=q.getAll('scenery');
 return q.getAll('capeTryonSkySeatReview').length===1&&profiles.length<=1&&
  profiles.every(v=>!v||v==='standard')&&standardComparisonQuery(comparison)&&
  standardOpenCoastRequested(q)&&!q.has('capeTryonWaterReview');
}
export function capeTryonRockState(search:string){
 const q=sceneryOptions(search),selected=capeTryonRockRequested(q);
 const test=new URLSearchParams(q);test.delete(CAPE_TRYON_ROCK_STOCK);test.set(CAPE_TRYON_ROCK_FLAG,'');
 return {selected,blocked:!capeTryonRockRequested(test)};
}
export function switchCapeTryonRockURL(source:string,on:boolean,departureId:string){
 const url=new URL(source);
 if(!on){
  url.searchParams.delete(CAPE_TRYON_ROCK_FLAG);url.searchParams.set(CAPE_TRYON_ROCK_STOCK,'');
 }else if(departureId===CAPE_TRYON_DEPARTURE&&!capeTryonRockState(url.search).blocked){
  url.searchParams.delete(CAPE_TRYON_ROCK_STOCK);url.searchParams.set(CAPE_TRYON_ROCK_FLAG,'');
 }
 url.searchParams.set('departure',departureId);
 return url.href;
}

export const isDetailScenery=(search:string)=>new URLSearchParams(search).get('scenery')==='detail';

/** A Standard-scene shortcut for separately verified coastal optics.
 * Preserve explicit incompatible styles rather than silently replacing them. */
export const COASTAL_OPTICS_FLAGS=['shoreToneStudy','shoreFoamDetail','orbyCoastClosure'] as const;
const COASTAL_OPTICS_CONFLICTS=['legacyShoreArcs','orthophotoSeamStudy','buildingShadows','surveyRelief','inlandRelief',
 'kingsDryCrownStudy','duneReliefStudy'] as const;
export const WOODLAND_SCENERY_FLAGS=['woodland3D','woodlandCrownBase','woodlandBark','forestFloor','sceneryObserver'] as const;

export const PRINCE_LANDSCAPE_ROUTE='prince-grassland';
export const PRINCE_LANDSCAPE_LENS='princeLandscapePreview';
export const KINGS_RIDGE_LENS='kingsRidgeGroundPreview';
export const KINGS_RIDGE_ROUTE='kings-coastal-ridge';
export const INDIAN_RIVER_LENS='indianRiverGradeLens';
export const STOCK_INDIAN_RIVER='stockIndianRiver';
export const INDIAN_RIVER_ROUTE='indian-river-country-pass';
/** Existing dated water core. Default geography doesn't require a route
 * bookmark; incompatible ground studies retain their pre-existing owner. */
export function bowleyCoreRequested(options:URLSearchParams){
 if(options.has('stockBowleyPond'))return false;
 if(options.has('bowleySurveyPreview'))return true;
 return options.get('scenery')!=='detail'&&
  !['surveyRelief','inlandRelief','seatedForestShadows','buildingShadows'].some(k=>options.has(k));
}
export function sceneryOptions(search:string){
 const q=new URLSearchParams(search);
 // The local dated view is ancillary, including when Dispatch shows another site.
 q.delete(NORTH_CAPE_STAND_ACTIVATE);q.delete(NORTH_CAPE_STAND_VETO);q.delete(INDIAN_RIVER_LENS);q.delete(KINGS_RIDGE_LENS);q.delete(PRINCE_LANDSCAPE_LENS);
 if(q.has('stockDuneSand'))q.delete('duneSandDetail');
 if(q.has('stockDuneRelief'))q.delete('duneReliefStudy');
 if(isDetailScenery(search))for(const flag of DETAIL_FLAGS)if(!q.has(flag))q.set(flag,'');
 if(q.has('stockBowleyPond'))q.delete('bowleySurveyPreview');
 if(q.has('stockNorthCapeWind'))q.delete('northCapeWind');
 if(q.has('stockCanopyLight'))q.delete('canopyLight');
 if(q.has('stockDuneGrass'))q.delete('duneGrassSurface');
 if(q.has('stockBasinSand'))q.delete('basinSand');
 if(q.has('stockMeadow'))q.delete('meadowTexture');
 if(q.has('stockGravelSurface'))q.delete('gravelSurfaceStudy');
 if(q.has('stockMiscouche'))q.delete('miscoucheCanopyStudy');
 if(q.has('stockNearshoreFoam'))q.delete('nearshoreFoamStudy');
 if(q.has('coastalOptics')&&!sceneryReviewBlock('coastalOptics',q))
  for(const k of COASTAL_OPTICS_FLAGS)if(!q.has(k))q.set(k,'');
 if(q.has('woodlandView')&&!sceneryReviewBlock('woodlandView',q))for(const key of WOODLAND_SCENERY_FLAGS)if(!q.has(key))q.set(key,'');
 if(q.has('woodlandBark')&&!sceneryReviewBlock('woodlandBark',q))q.set('woodland3D','');
 if(q.has('woodlandCrownBase')&&!sceneryReviewBlock('woodlandCrownBase',q))q.set('woodland3D','');
 if(q.has('sourceGrassNap')&&!sceneryReviewBlock('sourceGrassNap',q))q.set('sourceGrassStudy','');
 if(q.has(CAVENDISH_PACKAGE_FLAG)&&!cavePackageBlocked(q))for(const flag of CAVENDISH_PACKAGE_FLAGS)if(!q.has(flag))q.set(flag,'');
 return q;
}

export function switchSceneryURL(source:string,detail:boolean,departureId:string){
 const url=new URL(source);
 if(detail)url.searchParams.set('scenery','detail');
 else url.searchParams.delete('scenery');
 url.searchParams.set('departure',departureId);
 return url.href;
}

export function sceneryDeparture(search:string,siteIds:readonly string[]){
 const wanted=new URLSearchParams(search).get('departure');
 const i=wanted===null?-1:siteIds.indexOf(wanted);
 // Outside the admitted local bridge preview, keep a saved lower-pass
 // link in the same valley rather than sending it across the island.
 return Math.max(0,i<0&&wanted==='montague-bridge-low'?siteIds.indexOf('montague'):i);
}

/** Standalone art reviews. They are intentionally not in the bundled detail profile. */
export const SCENERY_REVIEWS=[
 {flag:'coastalOptics',name:'Coastal optics',scope:'Breaking surf and scoped shore repairs in Standard'},
 {flag:'nearshoreFoamStudy',name:'Nearshore surf',scope:'Two exposed reaches in Prince and Kings counties'},
 {flag:'townWallStudy',name:'Expanded town façades',scope:'Wider close-range coverage in Charlottetown, Summerside and Souris'},

 {flag:'beaconsfieldReview',name:'Beaconsfield exterior',scope:'Charlottetown waterfront'},
 {flag:'greenGablesReview',name:'Green Gables House',scope:'Cavendish exterior'},
 {flag:'cavendishWaterReview',name:'Dunelands freshwater',scope:'2020 surveyed core'},
 {flag:'cropRowsReview',name:'Field surface relief',scope:'Three inland sites'},
 {flag:'northRusticoLighthouseStudy',name:'North Rustico lighthouse',scope:'2020 exterior and local ground'},
 {flag:'indianRiverReview',name:'St. Mary’s exterior',scope:'Indian River, Prince County'},
 {flag:'miscoucheCanopyStudy',name:'Miscouche canopy',scope:'Local measured woodland density near Summerside'},
 {flag:'regionalCanopyStudy',name:'Regional woodland canopy',scope:'Two small 2020 woodland studies in Queens and Kings counties'},
 {flag:'woodlandView',name:'Woodland scenery view',scope:'Forest ground, close bark, conifers and a down-looking camera'},
 {flag:'woodlandBark',name:'Close bark grain',scope:'Close woodland material study'},
 {flag:'woodlandCrownBase',name:'Near conifer crown shape',scope:'Stand-informed close woodland'},
 {flag:'sourceGrassStudy',name:'Ground vegetation',scope:'Selected grassland in all three counties'},
 {flag:'gravelSurfaceStudy',name:'Mapped gravel surfaces',scope:'Close mineral detail on explicitly mapped gravel roads in all three counties'},
 {flag:'sourceGrassNap',name:'Close grass detail',scope:'Includes Ground vegetation near the ground'},
 {flag:'hogIslandPhotoStudy',name:'Hog Island aerial detail',scope:'Dated survey of two dry dune areas'},
 {flag:'duneGrassSurface',name:'Coastal grass surface',scope:'Source-qualified dune grassland in all three counties'},
 {flag:'hogIslandWestGround',name:'Hog Island dune ground',scope:'Western measured relief and dated aerial colour'},
 {flag:'provinceFieldsReview',name:'Expanded farmland',scope:'All three counties'},
] as const;
export type ScenicReview=(typeof SCENERY_REVIEWS)[number]['flag'];

/** The measured atlas replaces stock-ground shading only. These render
 * layers can substitute another terrain mesh or take its shadow material. */
const PROVINCE_FIELD_CONFLICTS=['surveyRelief','inlandRelief','northCapeWind','buildingShadows'] as const;
export function provinceFieldBlock(options:URLSearchParams):'detail'|'terrain'|undefined{
 if(options.get('scenery')==='detail')return 'detail';
 return PROVINCE_FIELD_CONFLICTS.some(flag=>options.has(flag))?'terrain':undefined;
}

/** Route-only admission must not set the island-wide legacy review flag. */
export function kingsFieldPassRequested(q:URLSearchParams){
 return !q.has('stockKingsFieldPass')&&!q.has('qa')&&standardComparisonQuery(q)&&
  q.getAll('scenery').every(v=>!v||v==='standard');
}

export function queensFieldPassRequested(q:URLSearchParams){
 return !q.has('stockQueensFieldPass')&&!q.has('qa')&&standardComparisonQuery(q)&&
  q.getAll('scenery').every(v=>!v||v==='standard');
}

export function princeFieldPassRequested(q:URLSearchParams){
 return !q.has('stockPrinceFieldPass')&&!q.has('qa')&&standardComparisonQuery(q)&&
  q.getAll('scenery').every(v=>!v||v==='standard');
}

export function kingsDunesFieldPassRequested(q:URLSearchParams){
 const modes=q.getAll('scenery');
 return !q.has('stockKingsDunesFieldPass')&&!q.has('qa')&&standardComparisonQuery(q)&&
  q.getAll('departure').length<=1&&modes.length<=1&&modes.every(v=>!v||v==='standard');
}

/** Close Prince low-pass optics. The old three route flags and broad
 * review still stand on their original contracts and schedule. */
export function standardPrinceLowFieldRequested(q:URLSearchParams){
 const modes=q.getAll('scenery');
 return !q.has('stockPrinceLowFieldPass')&&!q.has('qa')&&standardComparisonQuery(q)&&
  q.getAll('departure').length<=1&&modes.length<=1&&modes.every(v=>!v||v==='standard');
}

/** Regional canopy fill keeps the standard billboards and unaltered ground. */
export function regionalCanopyRequested(q:URLSearchParams){
 return q.has('regionalCanopyStudy')&&!q.has('stockRegionalCanopy')&&!sceneryReviewBlock('regionalCanopyStudy',q);
}

export function standardRegionalCanopyRequested(q:URLSearchParams){
 if(q.has('stockRegionalCanopy')||q.has('regionalCanopyStudy')||sceneryReviewBlock('regionalCanopyStudy',q))return false;
 return !SCENERY_REVIEWS.some(row=>q.has(row.flag))&&
  !['pointPrimStudy','seatedRoads','duneReliefStudy','duneSandDetail','duneGrassSurface',
    'orthophotoSeamStudy','shoreToneStudy','greenGablesBarnReview','gablesGradeReview',
    'cavendishDetail','northCapeWind'].some(k=>q.has(k));
}

export function sceneryReviewBlock(flag:ScenicReview|'duneSandDetail'|'duneReliefStudy',options:URLSearchParams):'detail'|'terrain'|undefined{
 if(flag==='coastalOptics'){
  if(options.get('scenery')==='detail')return 'detail';
  return COASTAL_OPTICS_CONFLICTS.some(k=>options.has(k))?'terrain':undefined;
 }
 if(flag==='nearshoreFoamStudy'||flag==='townWallStudy')return options.get('scenery')==='detail'?'detail':undefined;
 if(flag==='provinceFieldsReview')return provinceFieldBlock(options);
 if(flag==='gravelSurfaceStudy')return options.get('scenery')==='detail'?'detail':undefined;
 if(flag==='regionalCanopyStudy'){
  const mode=options.get('scenery');
  if(mode&&mode!=='standard')return mode==='detail'?'detail':'terrain';
  return ['surveyRelief','inlandRelief','woodland3D','woodlandView','woodlandBark','woodlandCrownBase','canopyLight','forestFloor',
   'buildingShadows','seatedForestShadows','mappedLaneCanopyStudy','kingsDryCrownStudy'].some(k=>options.has(k))?'terrain':undefined;
 }
 if(flag==='miscoucheCanopyStudy'){
  const mode=options.get('scenery');
  if(mode&&mode!=='standard')return mode==='detail'?'detail':'terrain';
  return ['surveyRelief','inlandRelief','woodland3D','woodlandView','woodlandBark','canopyLight','forestFloor',
   'buildingShadows','seatedForestShadows'].some(k=>options.has(k))?'terrain':undefined;
 }
 if(flag==='woodlandCrownBase'||flag==='woodlandBark'||flag==='woodlandView'){
  if(options.get('scenery')==='detail')return 'detail';
  return ['surveyRelief','inlandRelief','indianRiverReview','buildingShadows','seatedForestShadows',
   'duneReliefStudy','duneGrassSurface','duneSandDetail'].some(k=>options.has(k))?'terrain':undefined;
 }
 if(flag==='duneReliefStudy'){
  if(options.get('scenery')==='detail')return 'detail';
  return ['surveyRelief','inlandRelief','buildingShadows','indianRiverReview','sourceGrassStudy','sourceGrassNap',
   'northCapeWind','woodland3D','canopyLight','forestFloor'].some(k=>options.has(k))?'terrain':undefined;
 }
 if(flag==='duneGrassSurface'){
  if(options.get('scenery')==='detail')return 'detail';
  return ['surveyRelief','inlandRelief','buildingShadows', 'duneReliefStudy','northCapeWind','sourceGrassStudy','sourceGrassNap',
   'meadowTexture','provinceFieldsReview','cropRowsReview','woodland3D','canopyLight','forestFloor',
   'hogIslandPhotoStudy','hogIslandWestGround','northRusticoLighthouseStudy','northRusticoSoil','cavendishDetail',
   'cavendishWaterReview','bowleySurveyPreview','basinChannel','indianRiverReview','northBaywalkPreview','montagueFoundationPreview'].some(k=>options.has(k))?'terrain':undefined;
 }
 if(flag==='duneSandDetail'){
  if(options.get('scenery')==='detail')return 'detail';
  return ['surveyRelief','inlandRelief','buildingShadows','northCapeWind','sourceGrassStudy','sourceGrassNap',
   'meadowTexture','provinceFieldsReview','cropRowsReview','woodland3D','canopyLight',
   'hogIslandPhotoStudy','hogIslandWestGround','northRusticoLighthouseStudy','northRusticoSoil','cavendishDetail',
   'cavendishWaterReview','bowleySurveyPreview','basinChannel','indianRiverReview','northBaywalkPreview','montagueFoundationPreview'].some(k=>options.has(k))?'terrain':undefined;
 }
 if(flag==='hogIslandWestGround'){
  if(options.get('scenery')==='detail')return 'detail';
  return ['surveyRelief','inlandRelief','buildingShadows','seatedForestShadows'].some(k=>options.has(k))?'terrain':undefined;
 }
 if(flag==='sourceGrassNap'){
  const base=sceneryReviewBlock('sourceGrassStudy',options);
  return base??(options.has('provinceFieldsReview')?'terrain':undefined);
 }
 if(flag==='hogIslandPhotoStudy'){
  if(options.get('scenery')==='detail')return 'detail';
  return options.has('surveyRelief')||options.has('inlandRelief')?'terrain':undefined;
 }
 if(flag==='indianRiverReview'){
  if(options.get('scenery')==='detail')return 'detail';
  if(['surveyRelief','inlandRelief','buildingShadows','woodland3D','canopyLight','northBaywalkPreview'].some(k=>options.has(k)))return 'terrain';
  return;
 }
 if(flag==='sourceGrassStudy'){
  if(options.get('scenery')==='detail')return 'detail';
  if(['surveyRelief','inlandRelief','buildingShadows','cropRowsReview','meadowTexture','northCapeWind'].some(f=>options.has(f)))return 'terrain';
  return;
 }
 if(flag==='cropRowsReview')return;
 if(options.has('buildingShadows'))return 'terrain';
 if(flag==='beaconsfieldReview')return;
 if(options.has('surveyRelief'))return 'terrain';
 if((flag==='cavendishWaterReview'||flag==='northRusticoLighthouseStudy')&&options.has('inlandRelief'))return 'terrain';
}

/** Legacy explicit URLs retain the old supported combinations. */
export function duneSandRequested(q:URLSearchParams){
 if(q.has('stockDuneSand')||sceneryReviewBlock('duneSandDetail',q))return false;
 return q.has('duneSandDetail')||!['duneGrassSurface','duneReliefStudy','seatedForestShadows',
  'forestFloor','coastalOptics','shoreToneStudy','orthophotoSeamStudy','woodlandView'].some(k=>q.has(k));
}
/** Automatic relief is narrower than the legacy explicit scenery study. */
export function standardDuneReliefRequested(q:URLSearchParams){
 return !q.has('stockDuneRelief')&&!q.has('duneReliefStudy')&&!sceneryReviewBlock('duneReliefStudy',q)&&
  !['seatedRoads','seatedForestShadows','coastalOptics','orthophotoSeamStudy','shoreToneStudy','duneGrassSurface',
    'woodlandView','legacyShoreArcs','northBaywalkPreview','spinnakersPreview','montagueFoundationPreview',
    'basinChannel','northRusticoLighthouseStudy','cavendishDetail','hogIslandWestGround','hogIslandPhotoStudy'].some(k=>q.has(k));
}
/** Default breakers are optical only. Stable authored nearshore/legacy
 * comparisons retain their earlier water branch without an explicit request. */
export function shoreFoamDetailRequested(q:URLSearchParams){
 if(q.has('stockShoreFoam'))return false;
 if(q.has('shoreFoamDetail'))return true;
 return q.get('scenery')!=='detail'&&!['legacyShoreArcs','nearshoreFoamStudy','orthophotoSeamStudy',
  'buildingShadows','surveyRelief','inlandRelief','basinChannel','basinWharf','montagueReachOptics',
  'montagueFoundationPreview','northBaywalkPreview','northBaywalkConcrete','spinnakersPreview','baywalkConcrete'].some(k=>q.has(k));
}
/** Known Orby mask closure is local. Independent shore/terrain comparisons
 * keep their earlier choice unless the explicit legacy-compatible flag is set. */
export function orbyClosureRequested(q:URLSearchParams){
 if(q.has('stockOrbyCoast')||q.has('legacyShoreArcs')||q.get('scenery')==='detail')return false;
 if(q.has('orbyCoastClosure'))return true;
 return !['orthophotoSeamStudy','nearshoreFoamStudy','surveyRelief','inlandRelief','buildingShadows'].some(k=>q.has(k));
}
/** Only the dry, previously reviewed regional material is ordinary here.
 * Keep separate lagoon, wharf, coast and shoreline comparisons untouched. */
export function standardBasinSandRequested(q:URLSearchParams){
 if(q.has('stockBasinSand')||q.has('basinSand'))return false;
 const mode=q.get('scenery');if(mode&&mode!=='standard')return false;
 return !SCENERY_REVIEWS.some(r=>q.has(r.flag))&&
  !['basinChannel','basinWharf','noBasinBank','legacyShoreArcs','shoreToneStudy','pointPrimStudy',
  'regionalCanopyStudy','orthophotoSeamStudy','surveyRelief','inlandRelief','seatedForestShadows',
  'duneReliefStudy','duneSandDetail','duneGrassSurface','kingsDryCrownStudy','buildingShadows','woodland3D',
  'forestFloor','northCapeWind','canopyLight'].some(k=>q.has(k));
}
export function explicitDuneGrassRequested(q:URLSearchParams){
 return !q.has('stockDuneGrass')&&q.has('duneGrassSurface')&&!sceneryReviewBlock('duneGrassSurface',q);
}
/** Ordinary optical treatment. Do not inject the explicit review flag:
 * it has different dirt/relief interactions on historic comparison URLs. */
export function standardDuneGrassRequested(q:URLSearchParams){
 if(q.has('stockDuneGrass')||q.has('duneGrassSurface')||sceneryReviewBlock('duneGrassSurface',q))return false;
 const mode=q.get('scenery');if(mode&&mode!=='standard')return false;
 return !SCENERY_REVIEWS.some(r=>q.has(r.flag))&&
  !['duneReliefStudy','pointPrimStudy','regionalCanopyStudy','orthophotoSeamStudy','nearshoreFoamStudy','legacyShoreArcs','seatedForestShadows','canopyLight','shoreToneStudy','kingsDryCrownStudy'].some(k=>q.has(k));
}
// Comparison switches exempt only their owning feature. The flag itself
// cannot move another Standard layer onto its historical reference path.
const STANDARD_COMPARISON_KEYS=new Set(['departure','scenery','diagnostics','qa','quartermasterQuayStudy',
 'stockSpinnakersDeck','stockStationExterior','stockCanopyLight','stockRegionalCanopy','stockOpenRipples','stockForestFloor','stockTracadieOrtho','stockCountyOrtho','stockInlandOrtho','stockConfederationTrail','stockCoastalMarsh','stockPrinceSurveyRoof','stockPrinceRoofContact','stockSourisShoreline','stockRegionalWind','stockEastPointPhaseII','stockRegionalWindLight','stockRegionalWindRotorLight','stockWoodlandVolumeCull','basilicaExteriorStudy','stockBasilicaExterior','basilicaYardSun','stockBasilicaSun','seacowExteriorStudy','stockSeacowExterior','sourisKnightExterior','stockSourisKnight','dalvayWaterOptics','stockDalvayWaterOptics','dalvayExteriorStudy','stockDalvayExterior','dalvayGlazingStudy','stockDalvayGlazing','olearyExteriorStudy','stockOlearyExterior','stockOlearyIndustrial','stockOlearyStation','olearyWarehouseStudy','stockOlearyWarehouse','summersideTerminalWallPreview','stockSummersideTerminalWalls','stockRusticoHarbourRoof','stockRusticoLighthouse','stockRusticoNeighbourRoof','stockGreenGablesHouse','stockFoundersWestWall','olearyAccessRoofReview','stockOlearyAccessRoof','sourisWestWallReview','stockSourisWestFacing','stockGeorgetownSchoolWalls','capeTryonRockReview','stockCapeTryonRock','capeTryonWaterReview','capeTryonSkySeatReview','runway03PavementReview','stockRunway03Pavement','stockSummersideRunwayPavement','stockAircraftRunwayCast','stockBordenCoast','stockIndianRiver','stockCavendishWater','stockKingsRidge','stockKingsFieldPass','stockQueensFieldPass','stockPrinceFieldPass','stockKingsDunesFieldPass','stockPrinceLowFieldPass','stockDispatchWoodland','stockQuartermasterSeawardRoof']);
/** New admission for a manually selected route; preserve legacy, Detail,
 * separate scene comparisons and all unknown/mixed configurations. */
export function standardDispatchWoodlandRequested(q:URLSearchParams){
 const profiles=q.getAll('scenery');
 return q.getAll('departure').length<=1&&profiles.length<=1&&profiles.every(v=>v===''||v==='standard')&&standardComparisonQuery(q)&&
  !q.has('qa')&&!q.has('stockDispatchWoodland')&&!q.has('quartermasterQuayStudy')&&
  !['dalvayExteriorStudy','dalvayWaterOptics','dalvayGlazingStudy','seacowExteriorStudy','sourisKnightExterior',
    'basilicaExteriorStudy','basilicaYardSun','olearyExteriorStudy','olearyWarehouseStudy','capeTryonSkySeatReview',
    'capeTryonRockReview','capeTryonWaterReview','sourisWestWallReview','summersideTerminalWallPreview',
    'olearyAccessRoofReview','runway03PavementReview'].some(k=>q.has(k));
}
/** Standard changes only the existing CYYG 03/21 asphalt; old exact replays stay stock. */
export function runway03PavementRequested(q:URLSearchParams){
 return q.getAll('scenery').every(v=>!v||v==='standard')&&standardComparisonQuery(q)&&!q.has('qa')&&
  !q.has('stockRunway03Pavement');
}
/** This switch owns only the close Summerside finish, not runway geometry. */
export function summersideRunwayPavementRequested(q:URLSearchParams){
 const profiles=q.getAll('scenery');
 return profiles.length<=1&&profiles.every(v=>v===''||v==='standard')&&
  standardComparisonQuery(q)&&!q.has('qa')&&!q.has('runway03PavementReview')&&!q.has('stockSummersideRunwayPavement');
}
export function aircraftRunwayCastRequested(q:URLSearchParams){
 const profiles=q.getAll('scenery');
 return profiles.length<=1&&profiles.every(v=>v===''||v==='standard')&&standardComparisonQuery(q)&&
  !q.has('qa')&&!q.has('runway03PavementReview')&&!q.has('stockAircraftRunwayCast');
}
export function bordenCoastRequested(q:URLSearchParams){
 const profiles=q.getAll('scenery');
 return profiles.length<=1&&profiles.every(v=>v===''||v==='standard')&&standardComparisonQuery(q)&&
  !q.has('qa')&&!q.has('legacyShoreArcs')&&!q.has('stockBordenCoast');
}
const standardComparisonQuery=(q:URLSearchParams)=>[...q.keys()].every(k=>STANDARD_COMPARISON_KEYS.has(k));
export const CAVENDISH_STANDARD_WATER_ROUTE='cavendish-dunelands-low';
/** Ordinary Cavendish owns this dated packet only for its selected flight.
 * The explicit Cavendish/detail/terrain study URLs remain unchanged. */
export function standardCavendishWaterRequested(q:URLSearchParams){
 const mode=q.getAll('scenery');
 return mode.length<=1&&mode.every(v=>!v||v==='standard')&&q.getAll('departure').length<=1&&
  standardComparisonQuery(q)&&!['qa','stockCavendishWater','cavendishWaterReview','cavendishDetail'].some(k=>q.has(k));
}

/** The original house and the independently admitted Barn have distinct spans. */
export function standardGreenGablesHouseRequested(q:URLSearchParams){
 const local=new URLSearchParams(q);local.delete('stockGreenGablesBarn');
 return !q.has('stockGreenGablesHouse')&&!q.has('qa')&&q.getAll('scenery').length<=1&&
  q.getAll('scenery').every(v=>v===''||v==='standard')&&standardComparisonQuery(local);
}

/** Distinguish a route lens from the bundled legacy profile. The internal
 * token never enters the global Standard scenery options. */
export function standardIndianRiverRequested(search:string){
 const q=new URLSearchParams(search),modes=q.getAll('scenery');
 return !q.has(STOCK_INDIAN_RIVER)&&!q.has('qa')&&modes.length<=1&&modes.every(v=>v===''||v==='standard')&&
  q.getAll('departure').length<=1&&standardComparisonQuery(q);
}
export function switchStandardIndianRiverURL(source:string,useStock:boolean,route:string){
 const url=new URL(source);
 if(route!==INDIAN_RIVER_ROUTE)return url.href;
 if(useStock){url.searchParams.delete(INDIAN_RIVER_LENS);url.searchParams.set(STOCK_INDIAN_RIVER,'');}
 else url.searchParams.delete(STOCK_INDIAN_RIVER);
 url.searchParams.set('departure',route);return url.href;
}
export function indianRiverLensState(search:string){
 const q=new URLSearchParams(search),selected=q.has(INDIAN_RIVER_LENS),detail=isDetailScenery(search);
 const modes=q.getAll('scenery'),departures=q.getAll('departure');
 const once=q.getAll(INDIAN_RIVER_LENS).length<=1;
 q.delete(INDIAN_RIVER_LENS);
 const compatible=!detail&&once&&modes.length<=1&&modes.every(m=>m===''||m==='standard')&&
  departures.length<=1&&!q.has('qa')&&standardComparisonQuery(q);
 return {selected,detail,compatible,active:selected&&compatible&&departures[0]===INDIAN_RIVER_ROUTE};
}
export function switchIndianRiverLens(source:string,enable:boolean,route:string){
 const url=new URL(source),q=indianRiverLensState(url.search);
 if(enable&&(!q.compatible||route!==INDIAN_RIVER_ROUTE))return url.href;
 if(enable)url.searchParams.set(INDIAN_RIVER_LENS,'');else url.searchParams.delete(INDIAN_RIVER_LENS);
 url.searchParams.set('departure',route);return url.href;
}
export function indianRiverLensFlight(route:string,mode:string,previous:string){
 if(route!==INDIAN_RIVER_ROUTE)return {initiate:false,retain:false};
 const playing=mode==='flight';
 const retain=playing||mode==='paused'||mode==='crash'||
  (mode==='map'||mode==='help'||mode==='credits')&&(previous==='flight'||previous==='paused'||previous==='crash');
 return {initiate:playing,retain};
}
/** Do not install raised terrain under a landed aircraft, even if the
 * departure is armed or the downloaded cohort becomes ready late. */
export function indianRiverCanCommit(initiate:boolean,retain:boolean,installed:boolean,flightStatus:string,clearance:number){
 return retain&&(installed||initiate&&flightStatus==='flying'&&Number.isFinite(clearance)&&clearance>=24);
}
/** A route in Dispatch owns the actual demand; this only accepts ordinary Standard options. */
export function standardKingsRidgeRequested(search:string){
 const q=new URLSearchParams(search),profile=q.getAll('scenery');
 return profile.length<=1&&profile.every(v=>v===''||v==='standard')&&q.getAll('departure').length<=1&&
  !q.has('qa')&&!q.has('stockKingsRidge')&&standardComparisonQuery(q);
}
export function switchStandardKingsRidgeURL(source:string,useStock:boolean,route:string){
 const url=new URL(source);
 if(route!==KINGS_RIDGE_ROUTE)return url.href;
 if(useStock){url.searchParams.delete(KINGS_RIDGE_LENS);url.searchParams.set('stockKingsRidge','');}
 else url.searchParams.delete('stockKingsRidge');
 url.searchParams.set('departure',route);
 return url.href;
}
export function kingsRidgeLensState(search:string){
 const q=new URLSearchParams(search),selected=q.has(KINGS_RIDGE_LENS),detail=isDetailScenery(search);
 const modes=q.getAll('scenery'),departures=q.getAll('departure'),single=q.getAll(KINGS_RIDGE_LENS).length<=1;
 q.delete(KINGS_RIDGE_LENS);
 const compatible=!detail&&single&&modes.length<=1&&modes.every(m=>m===''||m==='standard')&&
  departures.length<=1&&!q.has('qa')&&standardComparisonQuery(q);
 return {selected,detail,compatible,active:selected&&compatible&&departures[0]===KINGS_RIDGE_ROUTE};
}
export function switchKingsRidgeLens(source:string,enable:boolean,route:string){
 const url=new URL(source),q=kingsRidgeLensState(url.search);
 if(enable&&(!q.compatible||route!==KINGS_RIDGE_ROUTE))return url.href;
 if(enable)url.searchParams.set(KINGS_RIDGE_LENS,'');else url.searchParams.delete(KINGS_RIDGE_LENS);
 url.searchParams.set('departure',route);return url.href;
}
export function kingsRidgeAirState(route:string,mode:string,previous:string){
 if(route!==KINGS_RIDGE_ROUTE)return {initiate:false,retain:false};
 const initiate=mode==='flight';
 return {initiate,retain:initiate||mode==='paused'||mode==='crash'||
  (mode==='map'||mode==='help'||mode==='credits')&&(previous==='flight'||previous==='paused'||previous==='crash')};
}
export function princeLandscapeState(search:string){
 const q=new URLSearchParams(search),selected=q.has(PRINCE_LANDSCAPE_LENS),detail=isDetailScenery(search),
  modes=q.getAll('scenery'),departures=q.getAll('departure'),single=q.getAll(PRINCE_LANDSCAPE_LENS).length<=1;
 q.delete(PRINCE_LANDSCAPE_LENS);
 const compatible=!detail&&single&&modes.length<=1&&modes.every(m=>m===''||m==='standard')&&
  departures.length<=1&&!q.has('qa')&&standardComparisonQuery(q);
 return {selected,detail,compatible,active:selected&&compatible&&departures[0]===PRINCE_LANDSCAPE_ROUTE};
}
export function switchPrinceLandscape(source:string,enable:boolean,route:string){
 const url=new URL(source),q=princeLandscapeState(url.search);
 if(enable&&(!q.compatible||route!==PRINCE_LANDSCAPE_ROUTE))return url.href;
 if(enable)url.searchParams.set(PRINCE_LANDSCAPE_LENS,'');else url.searchParams.delete(PRINCE_LANDSCAPE_LENS);
 url.searchParams.set('departure',route);return url.href;
}
export const BASIN_HEAD_DEPARTURE='basin-head-low';
/** The established coupled inlet preview remains an explicit reload. Do
 * not inject its profile into default options or animate water at selection. */
export function basinHeadDispatchState(search:string){
 const q=new URLSearchParams(search),detail=isDetailScenery(search),selected=q.has('basinChannel');
 const legacy=new URLSearchParams(q);legacy.delete('basinChannel');
 const compatible=!detail&&q.getAll('scenery').length<=1&&q.getAll('scenery').every(v=>v===''||v==='standard')&&
   !q.has('qa')&&standardComparisonQuery(legacy);
 return {selected,detail,compatible};
}
export function switchBasinHeadDispatchURL(source:string,enable:boolean,departureId:string){
 const url=new URL(source),state=basinHeadDispatchState(url.search);
 if(state.detail||enable&&(departureId!==BASIN_HEAD_DEPARTURE||!state.compatible))return url.href;
 if(enable)url.searchParams.set('basinChannel','');
 else url.searchParams.delete('basinChannel');
 url.searchParams.set('departure',departureId);
 return url.href;
}

/** One local terrain + exterior lease; do not set the bundled review flag. */
export function standardRusticoLighthouseRequested(q:URLSearchParams){
 return !q.has('stockRusticoLighthouse')&&!q.has('qa')&&q.getAll('scenery').length<=1&&
  q.getAll('scenery').every(v=>v===''||v==='standard')&&standardComparisonQuery(q);
}


/** /268 is a separate verified draw variant; it does not request the explicit
 * Rustico massing bundle or enable/disable the lighthouse or /377 finish. */
export function standardRusticoNeighbourRequested(q:URLSearchParams){
 const profiles=q.getAll('scenery');
 return !q.has('stockRusticoNeighbourRoof')&&!q.has('qa')&&q.getAll('departure').length<=1&&
  profiles.length<=1&&profiles.every(v=>!v||v==='standard')&&standardComparisonQuery(q);
}

/** Compare just the dated q377 broad roof tone in Standard. Explicit Rustico
 * choices are local exceptions, not new compatibility rules for other layers. */
export function rusticoHarbourRoofRequested(q:URLSearchParams){
 return !q.has('stockRusticoHarbourRoof')&&q.getAll('scenery').every(v=>v===''||v==='standard')&&
  [...q.keys()].every(k=>STANDARD_COMPARISON_KEYS.has(k)||k==='northRusticoLighthouseStudy'||
   k==='rusticoMassingReview'||k==='legacyRusticoMassing');
}

/** Use the matched facing only on the validated Standard compatible graph. */
export function sourisWestFacingRequested(q:URLSearchParams){
 return !q.has('stockSourisWestFacing')&&!q.has('qa')&&q.getAll('scenery').every(v=>v===''||v==='standard')&&standardComparisonQuery(q);
}

export function georgetownSchoolWallsRequested(q:URLSearchParams){
 return !q.has('stockGeorgetownSchoolWalls')&&!q.has('qa')&&q.getAll('scenery').every(v=>v===''||v==='standard')&&standardComparisonQuery(q);
}

/** Use the documented membrane tone on Standard unless an older O’Leary actor owns the draw. */
export function olearyAccessRoofRequested(q:URLSearchParams){
 return !['stockOlearyAccessRoof','olearyExteriorStudy','olearyWarehouseStudy','qa'].some(k=>q.has(k))&&
  q.getAll('scenery').every(v=>v===''||v==='standard')&&standardComparisonQuery(q);
}

/** Keep the whole original O'Leary mesh whenever a signed railway study
 * is requested, even if a requested study's terrain cannot authenticate. */
export function olearyCompoundRoofsRequested(q:URLSearchParams){
 return !['olearyExteriorStudy','stockOlearyExterior','olearyWarehouseStudy','stockOlearyWarehouse','qa'].some(k=>q.has(k))&&
  q.getAll('scenery').every(v=>v===''||v==='standard')&&standardComparisonQuery(q);
}

/** Compare only the authored q68 wall tones on an unchanged Standard draw. */
export function terminalWallPreviewRequested(q:URLSearchParams){
 return q.has('summersideTerminalWallPreview')&&!q.has('stockSummersideTerminalWalls')&&
  q.getAll('scenery').every(v=>v===''||v==='standard')&&standardComparisonQuery(q);
}

/** Original local architectural study, never a terrain or general Detail replacement.
 * The stock comparison and all older independent Standard switches retain their own effects. */
export function basilicaExteriorRequested(q:URLSearchParams){
 return q.has('basilicaExteriorStudy')&&!q.has('stockBasilicaExterior')&&
  q.getAll('scenery').every(mode=>mode===''||mode==='standard')&&standardComparisonQuery(q);
}

/** The tiny Prince County O’Leary exterior owns neither trail nor terrain. */
export function olearyExteriorRequested(q:URLSearchParams){
 return q.has('olearyExteriorStudy')&&!q.has('stockOlearyExterior')&&
  q.getAll('scenery').every(v=>v===''||v==='standard')&&standardComparisonQuery(q);
}

export const OLEARY_STANDARD_INDUSTRIAL_ROUTE='oleary-railway-low';
export function olearyIndustrialStandardRequested(q:URLSearchParams){
 const profiles=q.getAll('scenery');
 return profiles.length<=1&&profiles.every(v=>!v||v==='standard')&&q.getAll('departure').length<=1&&
  !q.has('stockOlearyIndustrial')&&olearyAccessRoofRequested(q)&&olearyCompoundRoofsRequested(q);
}

/** One independent station comparison, leaving the surveyed shed and roof co-owners on their ordinary graph. */
export function olearyStationStandardRequested(q:URLSearchParams){
 return !q.has('stockOlearyStation')&&olearyIndustrialStandardRequested(q);
}
/** Detached close-view study only. Existing Standard and q431 URLs use the
 * original path, and no diagnostic query field can set either model's geometry. */
export function olearyIndustrialStudyRequested(q:URLSearchParams){
 if(!q.has('diagnostics')||!q.getAll('scenery').every(v=>v===''||v==='standard')||!standardComparisonQuery(q))return false;
 const values=q.getAll('qa'),raw=values[0];
 if(values.length!==1||!raw||raw.length>2048)return false;
 try{
  const v=JSON.parse(raw);
  return !!v&&typeof v==='object'&&!Array.isArray(v)&&Object.hasOwn(v,'olearyIndustrial192')&&v.olearyIndustrial192===true;
 }catch{return false;}
}

/**
 * The stepped warehouse is opt-in and shares the admitted O’Leary cohort.
 * Comparing its stock shape must not turn off the station or tower/shed lane.
 */
export function olearyWarehouseRequested(q:URLSearchParams){
 return q.has('olearyWarehouseStudy')&&!q.has('stockOlearyWarehouse')&&olearyExteriorRequested(q)&&
  olearyIndustrialStudyRequested(q);
}

export const DALVAY_STANDARD_ROUTE='dalvay-lake-coastal-pass';
/** Plain local flight may use the already shipped V2. Historical lens
 * combinations, including independent water-only shots, are unchanged. */
export function standardDalvayExteriorRequested(q:URLSearchParams){
 const modes=q.getAll('scenery');
 return modes.length<=1&&modes.every(v=>v===''||v==='standard')&&q.getAll('departure').length<=1&&
  standardComparisonQuery(q)&&!['qa','stockDalvayExterior','dalvayExteriorStudy','dalvayGlazingStudy','dalvayWaterOptics'].some(k=>q.has(k));
}
export function dalvayDefaultFlight(route:string,mode:string,previous:string){
 return route===DALVAY_STANDARD_ROUTE&&(mode==='flight'||mode==='paused'||
  ((mode==='map'||mode==='help'||mode==='credits')&&(previous==='flight'||previous==='paused')));
}

/** Optional, documentary Queens County manor exterior; never a new lake or terrain owner. */
export function dalvayExteriorRequested(q:URLSearchParams){
 return q.has('dalvayExteriorStudy')&&!q.has('stockDalvayExterior')&&
  q.getAll('scenery').every(v=>v===''||v==='standard')&&standardComparisonQuery(q);
}

/** Nested artistic finish only; neither lake optics nor ordinary manor art changes. */
export function dalvayGlazingRequested(q:URLSearchParams){
 return q.has('dalvayGlazingStudy')&&!q.has('stockDalvayGlazing')&&dalvayExteriorRequested(q);
}

export const FOUNDERS_WEST_ROUTE='harbour-low';
export function foundersWestRequested(q:URLSearchParams){
 const modes=q.getAll('scenery');
 return !q.has('stockFoundersWestWall')&&!q.has('qa')&&modes.length<=1&&
  modes.every(v=>v===''||v==='standard')&&standardComparisonQuery(q);
}
export const SEACOW_ROUTE='seacow-head-coast';
/** Only the actual selected pass may show this by default. Keep the old explicit study. */
export function standardSeacowExteriorRequested(q:URLSearchParams){
 const modes=q.getAll('scenery');
 return !q.has('stockSeacowExterior')&&!q.has('qa')&&modes.length<=1&&
  modes.every(v=>v===''||v==='standard')&&standardComparisonQuery(q);
}
export function seacowDefaultFlight(route:string,mode:string,previous:string){
 if(route!==SEACOW_ROUTE)return false;
 if(mode==='flight'||mode==='paused')return true;
 return (mode==='map'||mode==='help'||mode==='credits')&&(previous==='flight'||previous==='paused');
}
/** The existing explicit study remains available outside the Standard route. */
export function seacowExteriorRequested(q:URLSearchParams){
 return q.has('seacowExteriorStudy')&&!q.has('stockSeacowExterior')&&
  q.getAll('scenery').every(v=>v===''||v==='standard')&&standardComparisonQuery(q);
}

/** Route-owned Standard lake optics; leave all explicit Dalvay studies independent. */
export function standardDalvayWaterRequested(q:URLSearchParams){
 const modes=q.getAll('scenery');
 return modes.length<=1&&modes.every(v=>v===''||v==='standard')&&q.getAll('departure').length<=1&&
  standardComparisonQuery(q)&&!['qa','stockDalvayWaterOptics','dalvayWaterOptics',
   'dalvayExteriorStudy','dalvayGlazingStudy'].some(k=>q.has(k));
}
export function dalvayWaterRequested(q:URLSearchParams){
 return q.has('dalvayWaterOptics')&&!q.has('stockDalvayWaterOptics')&&
  q.getAll('scenery').every(mode=>mode===''||mode==='standard')&&standardComparisonQuery(q);
}

export function standardSourisKnightRequested(q:URLSearchParams){
 const modes=q.getAll('scenery');
 return !q.has('stockSourisKnight')&&!q.has('sourisKnightExterior')&&!q.has('qa')&&
  modes.length<=1&&modes.every(v=>!v||v==='standard')&&q.getAll('departure').length<=1&&standardComparisonQuery(q);
}
export function sourisKnightRequested(q:URLSearchParams){
 return q.has('sourisKnightExterior')&&!q.has('stockSourisKnight')&&
  q.getAll('scenery').every(v=>v===''||v==='standard')&&standardComparisonQuery(q);
}

export function basilicaYardSunRequested(q:URLSearchParams){
 return q.has('basilicaYardSun')&&!q.has('stockBasilicaSun')&&basilicaExteriorRequested(q);
}

/** Exact known false shoreline stroke over verified open water. No visual ownership in alternate scenery modes. */
export function standardSourisShoreline(q:URLSearchParams){
 const mode=q.get('scenery');
 return (!mode||mode==='standard')&&!q.has('stockSourisShoreline')&&standardComparisonQuery(q);
}

/** Regional turbine scenery in Standard only. The historical North Cape views remain separate. */
export function standardRegionalWind(q:URLSearchParams){
 const mode=q.get('scenery');
 // A North Cape stock comparison is independent here, but remains historically
 // unknown to previous Standard layers; do not change their old behavior.
 const known=[...q.keys()].every(k=>k==='stockNorthCapeWind'||STANDARD_COMPARISON_KEYS.has(k));
 return (!mode||mode==='standard')&&!q.has('stockRegionalWind')&&known;
}

/** Relative massing of one identified streamed building; no activation in historical views. */
export function standardPrinceSurveyRoof(q:URLSearchParams){
 const mode=q.get('scenery');
 return (!mode||mode==='standard')&&!q.has('stockPrinceSurveyRoof')&&standardComparisonQuery(q);
}

/** Exact measured roof, with its own independent source-neutral lighting study. */
export const standardPrinceRoofContact=(q:URLSearchParams)=>standardPrinceSurveyRoof(q)&&!q.has('stockPrinceRoofContact');

/** Optional local native-source optical and vegetation layer in Standard. */
export function coastalMarshRequested(q:URLSearchParams){
 const mode=q.get('scenery');
 return (!mode||mode==='standard')&&!q.has('stockCoastalMarsh')&&standardComparisonQuery(q);
}

/** Each Standard source cohort has an independent opt-out. Neither stock
 * switch disables the other or changes the optics of the historical study. */
export function standardTracadieOrtho(q:URLSearchParams){
 const mode=q.get('scenery');
 if(mode&&mode!=='standard')return false;
 if(q.has('stockTracadieOrtho'))return false;
 return standardComparisonQuery(q);
}
export function standardCountyOrtho(q:URLSearchParams){
 const mode=q.get('scenery');
 return (!mode||mode==='standard')&&!q.has('stockCountyOrtho')&&standardComparisonQuery(q);
}
// Opting out of this two-window inland study must not disable the four
// previously accepted imagery joins or any other Standard comparison.
export function standardInlandOrtho(q:URLSearchParams){
 const mode=q.get('scenery');
 return (!mode||mode==='standard')&&!q.has('stockInlandOrtho')&&standardComparisonQuery(q);
}

/** Ordinary close forest only. An explicit floor request retains the
 * historical preview, including in the bundled Detail profile. */
export function forestFloorProfile(q:URLSearchParams):false|true|'standard'{
 if(q.has('stockForestFloor'))return false;
 if(q.has('forestFloor'))return true;
 const mode=q.get('scenery');
 if(mode&&mode!=='standard')return false;
 return standardComparisonQuery(q)?'standard':false;
}
/** Appearance-only default. Preserve separately locked woodland, relief,
 * architecture and shadow comparisons unless directional light is explicit. */
export function canopyLightRequested(q:URLSearchParams){
 if(q.has('stockCanopyLight'))return false;
 if(q.has('canopyLight'))return true; // old explicit path and Detail unchanged
 const mode=q.get('scenery');
 if(mode&&mode!=='standard')return false;
 if(SCENERY_REVIEWS.some(study=>q.has(study.flag)))return false;
 return !['woodland3D','woodlandView','woodlandBark','woodlandCrownBase','forestFloor',
  'buildingShadows','seatedForestShadows','surveyRelief','inlandRelief','orthophotoSeamStudy',
  'pointPrimStudy','miscoucheCanopyStudy','regionalCanopyStudy','indianRiverReview',
  'sourceGrassNap','northCapeWind','hogIslandWestGround','duneReliefStudy','duneSandDetail',
  'duneGrassSurface','kingsDryCrownStudy','mappedLaneCanopyStudy','greenGablesBarnReview',
  'cavendishDetail','gablesGradeReview','northRusticoSoil'].some(k=>q.has(k));
}
export function reviewedScenery(search:string){
 const query=new URLSearchParams(search);
 return SCENERY_REVIEWS.filter(row=>query.has(row.flag)).map(row=>row.flag);
}

export function applyReviewSceneryURL(source:string,selected:ReadonlySet<ScenicReview>,departureId:string){
 const url=new URL(source);
 for(const {flag} of SCENERY_REVIEWS){
  if(selected.has(flag)){
   if(!url.searchParams.has(flag))url.searchParams.set(flag,'');
  }else url.searchParams.delete(flag);
 }
 url.searchParams.set('departure',departureId);
 return url.href;
}

/** Standard's close open-ground material is independent of inherited reviews. */
export function standardMeadowRequested(q:URLSearchParams){
 if(q.has('stockMeadow')||q.has('meadowTexture'))return false;
 const mode=q.get('scenery');if(mode&&mode!=='standard')return false;
 return !SCENERY_REVIEWS.some(r=>q.has(r.flag))&&
 !['surveyRelief','inlandRelief','buildingShadows','pointPrimStudy','basinChannel','basinSand','regionalCanopyStudy',
   'bowleySurveyPreview','montagueFoundationPreview','duneReliefStudy','duneSandDetail','duneGrassSurface',
   'kingsDryCrownStudy','orthophotoSeamStudy','shoreToneStudy','canopyLight','cavendishDetail',
   'gablesGradeReview','greenGablesBarnReview','northCapeWind','woodland3D','forestFloor'].some(k=>q.has(k));
}

/** Only the dated standard atlas enables mapped gravel without the study flag. */
export function standardGravelSurfaceRequested(q:URLSearchParams){
 if(q.has('stockGravelSurface')||q.has('gravelSurfaceStudy'))return false;
 const layer=q.get('scenery');if(layer&&layer!=='standard')return false;
 return !SCENERY_REVIEWS.some(r=>q.has(r.flag))&&
 !['surveyRelief','inlandRelief','buildingShadows','seatedRoads','seatedForestShadows',
   'basinChannel','pointPrimStudy','kingsDryCrownStudy','regionalCanopyStudy','sourceGrassNap',
   'duneReliefStudy','duneSandDetail','duneGrassSurface','orthophotoSeamStudy',
   'cavendishDetail','gablesGradeReview','greenGablesBarnReview','canopyLight','shoreToneStudy',
   'northCapeWind','woodland3D','forestFloor'].some(k=>q.has(k));
}

/** Release the narrowly source-fenced Miscouche woodland in ordinary low flight. */
export function standardMiscoucheRequested(q:URLSearchParams){
 if(q.has('stockMiscouche')||q.has('miscoucheCanopyStudy')||sceneryReviewBlock('miscoucheCanopyStudy',q))return false;
 return !SCENERY_REVIEWS.some(row=>q.has(row.flag))&&
  !['regionalCanopyStudy','pointPrimStudy','kingsDryCrownStudy','seatedRoads','duneReliefStudy',
    'duneSandDetail','duneGrassSurface','orthophotoSeamStudy','shoreToneStudy','greenGablesBarnReview',
    'gablesGradeReview','cavendishDetail','woodlandCrownBase','northCapeWind'].some(k=>q.has(k));
}

/** The two vetted open coasts only. Preserve alternative shoreline cohorts. */
export function standardNearshoreRequested(q:URLSearchParams){
 if(q.has('stockNearshoreFoam')||q.has('nearshoreFoamStudy'))return false;
 const layer=q.get('scenery');if(layer&&layer!=='standard')return false;
 return !SCENERY_REVIEWS.some(row=>q.has(row.flag))&&
  !['legacyShoreArcs','surveyRelief','inlandRelief','buildingShadows','orthophotoSeamStudy',
    'shoreToneStudy','basinChannel','basinWharf','pointPrimStudy','regionalCanopyStudy',
    'cavendishDetail','greenGablesBarnReview','gablesGradeReview',
    'duneReliefStudy','duneSandDetail','duneGrassSurface','kingsDryCrownStudy','northCapeWind'].some(k=>q.has(k));
}

/** The two lower-deviation shore cells are standalone mask repairs.
 * Explicit shoreline studies retain their own earlier geometry. */
export function standardOpenCoastRequested(q:URLSearchParams){
 if(q.has('stockOpenCoast')||q.has('legacyShoreArcs'))return false;
 const layer=q.get('scenery');if(layer&&layer!=='standard')return false;
 return !SCENERY_REVIEWS.some(r=>q.has(r.flag))&&
  !['surveyRelief','inlandRelief','buildingShadows','basinChannel','basinWharf',
    'orthophotoSeamStudy','shoreToneStudy','regionalCanopyStudy',
    'cavendishDetail','duneReliefStudy','northCapeWind'].some(k=>q.has(k));
}

/** Fail closed on named, alternate, and unknown scenery comparisons. The
 * supported keys are dispatch/telemetry only; none select a different surface. */
function ordinarySceneryKeysOnly(q:URLSearchParams){
 const mode=q.get('scenery');if(mode&&mode!=='standard')return false;
 return standardComparisonQuery(q);
}
export function standardPanmurePastureRequested(q:URLSearchParams){
 return ordinarySceneryKeysOnly(q);
}


/** De-tile Standard's open water only. Explicit scenery comparisons and
 * unknown options remain on the existing shader for exact comparisons. */
export function standardOpenRipplesRequested(q:URLSearchParams){
 return !q.has('stockOpenRipples')&&ordinarySceneryKeysOnly(q);
}
