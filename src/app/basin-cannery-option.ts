export const BASIN_CANNERY_ROUTE='basin-head-low';
export const BASIN_CANNERY_OPTION='basinCanneryFinish';
const keys=new Set(['departure','basinChannel','scenery','diagnostics',BASIN_CANNERY_OPTION]);
/** The old profile and legacy UI links never see this token, even when
 * invalid/mixed. Retain the literal spelling and order of the other values. */
export function withoutBasinCanneryToken(search:string){
 if(!new URLSearchParams(search).has(BASIN_CANNERY_OPTION))return search;
 const prefix=search.startsWith('?'),body=prefix?search.slice(1):search;
 const remaining=body.split('&').filter(k=>!new URLSearchParams('&'+k).has(BASIN_CANNERY_OPTION)).join('&');
 return prefix&&remaining?'?'+remaining:remaining;
}
/** Recognize direct consent from the untouched URL, not another option's output. */
export function basinCanneryFinishConsent(raw:string){
 const q=new URLSearchParams(raw),parts=(raw.startsWith('?')?raw.slice(1):raw).split('&');
 const d=q.getAll('departure'),b=q.getAll('basinChannel'),v=q.getAll(BASIN_CANNERY_OPTION),s=q.getAll('scenery');
 return v.length===1&&v[0]==='1'&&parts.includes(BASIN_CANNERY_OPTION+'=1')&&
  d.length===1&&d[0]===BASIN_CANNERY_ROUTE&&b.length===1&&b[0]===''&&
  s.length<=1&&s.every(x=>x===''||x==='standard')&&q.getAll('diagnostics').length<=1&&
  [...q.keys()].every(k=>keys.has(k));
}
