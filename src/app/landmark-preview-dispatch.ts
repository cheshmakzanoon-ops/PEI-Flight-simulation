import {EAST_RIM_OPTION,EAST_RIM_ROUTE,eastRimConsent} from './east-roof-rim-option.ts';
import {RAIL_SHINGLE_OPTION,RAIL_SHINGLE_ROUTE,railShingleConsent} from './rail-shingle-option.ts';

const CARDS=[
 {route:EAST_RIM_ROUTE,flag:EAST_RIM_OPTION,accept:eastRimConsent,title:'East Point roof forms',
  description:'See two roofs rebuilt from dated elevation data. Nearby scenery and flight controls stay the same.'},
 {route:RAIL_SHINGLE_ROUTE,flag:RAIL_SHINGLE_OPTION,accept:railShingleConsent,title:'Summerside station roof finish',
  description:'See a finish that makes the station roof folds easier to read. The roof shape and flight controls stay the same.'},
] as const;
type Status='available'|'selected'|'blocked';
export type LandmarkPreviewCard=Readonly<{title:string;description:string;status:Status;url?:string}>;

function pieces(q:string){return q.replace(/^\?/,'').split('&').filter(Boolean);}
const isKey=(piece:string,key:string)=>new URLSearchParams('&'+piece).has(key);
/** Convenience controls only. Admission is still owned by each renderer's
 * original raw consent test, without adding new combinations or defaults. */
export function landmarkPreviewCard(originalHref:string,selectedRoute:string):LandmarkPreviewCard|undefined{
 const card=CARDS.find(row=>row.route===selectedRoute);if(!card)return;
 const u=new URL(originalHref),raw=u.search,params=new URLSearchParams(raw);
 const describe=(status:Status,url?:string):LandmarkPreviewCard=>({title:card.title,description:card.description,status,url});
 const selected=card.accept(raw),parts=pieces(raw);
 if(selected){
  u.search=parts.filter(p=>!isKey(p,card.flag)).join('&');
  return describe('selected',u.href);
 }
 // Do not normalize conflicting previews, repeated departure, or invented
 // chronology into an authorization that the address itself didn't grant.
 if(params.has(card.flag)||params.getAll('departure').length>1)return describe('blocked');
 const next=parts.filter(p=>!isKey(p,'departure'));
 next.push('departure='+encodeURIComponent(selectedRoute),card.flag+'=1');
 const candidate='?'+next.join('&');
 if(!card.accept(candidate))return describe('blocked');
 u.search=candidate;
 return describe('available',u.href);
}
