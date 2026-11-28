/** Ancillary North Cape landmark switch. Ordinary profiles never see its keys. */
const OFFER='northCapeLightPreview',VETO='stockNorthCapeLight';
const allowed=new Set(['departure','scenery','diagnostics',OFFER,VETO]);
export function northCapeLightOption(raw:string){
  const q=new URLSearchParams(raw);
  if(!q.has(OFFER)&&!q.has(VETO))return {route:false,visible:false,standardSearch:raw};
  const offers=q.getAll(OFFER),profiles=q.getAll('scenery');
  const route=offers.length===1&&offers[0]===''&&q.getAll('departure').length<=1&&q.getAll('diagnostics').length<=1
    &&profiles.length<=1&&profiles.every(v=>v===''||v==='standard')&&[...q.keys()].every(k=>allowed.has(k));
  const visible=route&&!q.has(VETO);
  q.delete(OFFER);q.delete(VETO);
  return {route,visible,standardSearch:q.toString()};
}
