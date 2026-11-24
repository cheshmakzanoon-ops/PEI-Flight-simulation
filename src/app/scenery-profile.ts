/**
 * A dispatch shortcut for already independent, validated previews. Standard
 * keeps its settings and URL behavior. This is not a new scenery source.
 */
export const DETAIL_FLAGS=[
 'shoreFoamDetail','legacyShoreArcs','canopyLight','forestFloor','woodland3D',
 'spinnakersPreview','northBaywalkPreview','baywalkConcrete',
 'basinChannel','basinWharf','montagueFoundationPreview','montagueReachOptics','northCapeWind','bowleySurveyPreview',
] as const;

export const isDetailScenery=(search:string)=>new URLSearchParams(search).get('scenery')==='detail';

export function sceneryOptions(search:string){
 const q=new URLSearchParams(search);
 if(isDetailScenery(search))for(const flag of DETAIL_FLAGS)if(!q.has(flag))q.set(flag,'');
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
 {flag:'cropRowsReview',name:'Field surface relief',scope:'Three selected inland areas'},
 {flag:'provinceFieldsReview',name:'Expanded farmland',scope:'Selected fields in all three counties'},
] as const;
export type ScenicReview=(typeof SCENERY_REVIEWS)[number]['flag'];

/** The measured atlas replaces stock-ground shading only. These render
 * layers can substitute another terrain mesh or take its shadow material. */
const PROVINCE_FIELD_CONFLICTS=['surveyRelief','inlandRelief','northCapeWind','buildingShadows'] as const;
export function provinceFieldBlock(options:URLSearchParams):'detail'|'terrain'|undefined{
 if(options.get('scenery')==='detail')return 'detail';
 return PROVINCE_FIELD_CONFLICTS.some(flag=>options.has(flag))?'terrain':undefined;
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
