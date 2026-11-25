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

export const isDetailScenery=(search:string)=>new URLSearchParams(search).get('scenery')==='detail';

/** A Standard-scene shortcut for separately verified coastal optics.
 * Preserve explicit incompatible styles rather than silently replacing them. */
export const COASTAL_OPTICS_FLAGS=['shoreToneStudy','shoreFoamDetail','orbyCoastClosure'] as const;
const COASTAL_OPTICS_CONFLICTS=['legacyShoreArcs','orthophotoSeamStudy','buildingShadows','surveyRelief','inlandRelief',
 'kingsDryCrownStudy','duneReliefStudy'] as const;
export const WOODLAND_SCENERY_FLAGS=['woodland3D','woodlandCrownBase','woodlandBark','forestFloor','sceneryObserver'] as const;

export function sceneryOptions(search:string){
 const q=new URLSearchParams(search);
 if(q.has('stockDuneSand'))q.delete('duneSandDetail');
 if(q.has('stockDuneRelief'))q.delete('duneReliefStudy');
 if(isDetailScenery(search))for(const flag of DETAIL_FLAGS)if(!q.has(flag))q.set(flag,'');
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
 return Math.max(0,i);
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
const STANDARD_COMPARISON_KEYS=new Set(['departure','scenery','diagnostics','qa',
 'stockCanopyLight','stockRegionalCanopy','stockOpenRipples','stockForestFloor','stockTracadieOrtho','stockCountyOrtho','stockInlandOrtho','stockConfederationTrail','stockCoastalMarsh','stockPrinceSurveyRoof','stockPrinceRoofContact','stockSourisShoreline','stockRegionalWind','stockRegionalWindLight','stockRegionalWindRotorLight','stockWoodlandVolumeCull','basilicaExteriorStudy','stockBasilicaExterior']);
const standardComparisonQuery=(q:URLSearchParams)=>[...q.keys()].every(k=>STANDARD_COMPARISON_KEYS.has(k));

/** Original local architectural study, never a terrain or general Detail replacement.
 * The stock comparison and all older independent Standard switches retain their own effects. */
export function basilicaExteriorRequested(q:URLSearchParams){
 return q.has('basilicaExteriorStudy')&&!q.has('stockBasilicaExterior')&&
  q.getAll('scenery').every(mode=>mode===''||mode==='standard')&&standardComparisonQuery(q);
}

/** Exact known false shoreline stroke over verified open water. No visual ownership in alternate scenery modes. */
export function standardSourisShoreline(q:URLSearchParams){
 const mode=q.get('scenery');
 return (!mode||mode==='standard')&&!q.has('stockSourisShoreline')&&standardComparisonQuery(q);
}

/** Three registered commercial arrays in Standard only. The historical North Cape views remain separate. */
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
