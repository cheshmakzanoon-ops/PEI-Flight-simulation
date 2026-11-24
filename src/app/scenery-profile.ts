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

export function sceneryOptions(search:string){
 const q=new URLSearchParams(search);
 if(isDetailScenery(search))for(const flag of DETAIL_FLAGS)if(!q.has(flag))q.set(flag,'');
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
 {flag:'beaconsfieldReview',name:'Beaconsfield exterior',scope:'Charlottetown waterfront'},
 {flag:'greenGablesReview',name:'Green Gables House',scope:'Cavendish exterior'},
 {flag:'cavendishWaterReview',name:'Dunelands freshwater',scope:'2020 surveyed core'},
 {flag:'cropRowsReview',name:'Field surface relief',scope:'Three inland sites'},
 {flag:'northRusticoLighthouseStudy',name:'North Rustico lighthouse',scope:'2020 exterior and local ground'},
 {flag:'sourceGrassStudy',name:'Ground vegetation',scope:'Selected grassland in all three counties'},
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

export function sceneryReviewBlock(flag:ScenicReview,options:URLSearchParams):'detail'|'terrain'|undefined{
 if(flag==='provinceFieldsReview')return provinceFieldBlock(options);
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
