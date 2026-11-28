export const HANGAR9_ROUTE='cysu';
export const HANGAR9_OPTION='hangar9ApronPreview';
const allowed=new Set(['departure','scenery','diagnostics',HANGAR9_OPTION]);
export function hangar9StockSearch(input:string) {
 if(!new URLSearchParams(input).has(HANGAR9_OPTION))return input;
 const body=input.replace(/^\?/,'');
 const kept=body.split('&').filter(bit=>!new URLSearchParams('&'+bit).has(HANGAR9_OPTION)).join('&');
 return kept&&input.startsWith('?')?'?'+kept:kept;
}
export function hangar9Consent(input:string){
 const body=input.replace(/^\?/,'');
 const q=new URLSearchParams(body),route=q.getAll('departure'),flags=q.getAll(HANGAR9_OPTION),profiles=q.getAll('scenery');
 return route.length===1&&route[0]===HANGAR9_ROUTE&&flags.length===1&&flags[0]==='1'&&body.split('&').includes(HANGAR9_OPTION+'=1')&&
  profiles.length<=1&&profiles.every(x=>x===''||x==='standard')&&q.getAll('diagnostics').length<=1&&[...q.keys()].every(k=>allowed.has(k));
}
