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
 if(isDetailScenery(search))for(const flag of DETAIL_FLAGS)if(!q.has(flag))q.set(flag,'');
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
 {flag:'woodlandView',name:'Woodland scenery view',scope:'Forest ground, close bark, conifers and a down-looking camera'},
 {flag:'woodlandBark',name:'Close bark grain',scope:'Close woodland material study'},
 {flag:'woodlandCrownBase',name:'Near conifer crown shape',scope:'Stand-informed close woodland'},
 {flag:'sourceGrassStudy',name:'Ground vegetation',scope:'Selected grassland in all three counties'},
 {flag:'gravelSurfaceStudy',name:'Mapped gravel surfaces',scope:'Close mineral detail on explicitly mapped gravel roads in all three counties'},
 {flag:'sourceGrassNap',name:'Close grass detail',scope:'Includes Ground vegetation near the ground'},
 {flag:'hogIslandPhotoStudy',name:'Hog Island aerial detail',scope:'Dated survey of two dry dune areas'},
 {flag:'duneReliefStudy',name:'Measured dune relief',scope:'Prince and Kings dry terrain'},
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

export function sceneryReviewBlock(flag:ScenicReview|'duneSandDetail',options:URLSearchParams):'detail'|'terrain'|undefined{
 if(flag==='coastalOptics'){
  if(options.get('scenery')==='detail')return 'detail';
  return COASTAL_OPTICS_CONFLICTS.some(k=>options.has(k))?'terrain':undefined;
 }
 if(flag==='nearshoreFoamStudy'||flag==='townWallStudy')return options.get('scenery')==='detail'?'detail':undefined;
 if(flag==='provinceFieldsReview')return provinceFieldBlock(options);
 if(flag==='gravelSurfaceStudy')return options.get('scenery')==='detail'?'detail':undefined;
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
