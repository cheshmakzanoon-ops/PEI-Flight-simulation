export const EAST_RIM_ROUTE='east-light';
export const EAST_RIM_OPTION='eastPointRimPreview';
const allowed=new Set(['departure','diagnostics','scenery',EAST_RIM_OPTION]);

export function eastRimStockSearch(search:string){
 if(!new URLSearchParams(search).has(EAST_RIM_OPTION))return search;
 const lead=search.startsWith('?'),raw=lead?search.slice(1):search;
 const retained=raw.split('&').filter(x=>!new URLSearchParams('&'+x).has(EAST_RIM_OPTION)).join('&');
 return lead&&retained?'?'+retained:retained;
}

/** Decide consent against the original query, never a normalized peer option. */
export function eastRimConsent(search:string){
 const q=new URLSearchParams(search),routes=q.getAll('departure'),offers=q.getAll(EAST_RIM_OPTION),profiles=q.getAll('scenery');
 const raw=search.startsWith('?')?search.slice(1):search;
 return routes.length===1&&routes[0]===EAST_RIM_ROUTE&&offers.length===1&&offers[0]==='1'&&
  raw.split('&').includes(EAST_RIM_OPTION+'=1')&&profiles.length<=1&&profiles.every(v=>v===''||v==='standard')&&
  q.getAll('diagnostics').length<=1&&[...q.keys()].every(k=>allowed.has(k));
}
