export const RAIL_SHINGLE_ROUTE='spinnakers-low';
export const RAIL_SHINGLE_OPTION='railShinglePreview';
const allowed=new Set(['departure','scenery','diagnostics',RAIL_SHINGLE_OPTION]);

/** Own only this option; unknown, repeated and legacy values remain literal. */
export function railShingleStockSearch(raw:string){
 if(!new URLSearchParams(raw).has(RAIL_SHINGLE_OPTION))return raw;
 const prefix=raw.startsWith('?'),body=prefix?raw.slice(1):raw;
 const kept=body.split('&').filter(k=>!new URLSearchParams('&'+k).has(RAIL_SHINGLE_OPTION)).join('&');
 return prefix&&kept?'?'+kept:kept;
}

/** Consent always comes from the original URL, not other preview normalization. */
export function railShingleConsent(raw:string){
 const q=new URLSearchParams(raw),d=q.getAll('departure'),f=q.getAll(RAIL_SHINGLE_OPTION),p=q.getAll('scenery');
 const body=raw.startsWith('?')?raw.slice(1):raw;
 return d.length===1&&d[0]===RAIL_SHINGLE_ROUTE&&f.length===1&&f[0]==='1'&&
  body.split('&').includes(RAIL_SHINGLE_OPTION+'=1')&&p.length<=1&&p.every(v=>v===''||v==='standard')&&
  q.getAll('diagnostics').length<=1&&[...q.keys()].every(k=>allowed.has(k));
}
