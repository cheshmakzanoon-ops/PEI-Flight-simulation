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
