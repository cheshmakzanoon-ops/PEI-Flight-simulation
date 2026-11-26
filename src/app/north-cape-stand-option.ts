/** Private historical comparison; never a global or exclusive scenery review. */
export const NORTH_CAPE_STAND_ACTIVATE='northCapeStandReview';
export const NORTH_CAPE_STAND_VETO='stockNorthCapeStandReview';
export const NORTH_CAPE_STAND_ROUTE='northcape-wind-low';
export function northCapeStandOption(query:string){
 const q=new URLSearchParams(query);
 if(!q.has(NORTH_CAPE_STAND_ACTIVATE)&&!q.has(NORTH_CAPE_STAND_VETO))return {requested:false,stockSearch:query};
 const request=q.getAll(NORTH_CAPE_STAND_ACTIVATE);
 const modes=q.getAll('scenery'),departures=q.getAll('departure'),diagnostics=q.getAll('diagnostics');
 const keys=new Set([NORTH_CAPE_STAND_ACTIVATE,'scenery','departure','diagnostics']);
 const requested=!q.has(NORTH_CAPE_STAND_VETO)&&request.length===1&&request[0]===''&&
  (modes.length===0||modes.length===1&&modes[0]==='standard')&&departures.length===1&&departures[0]===NORTH_CAPE_STAND_ROUTE&&
  diagnostics.length<=1&&Array.from(q.keys()).every(k=>keys.has(k));
 // Standard layers see exactly the normal query, including any leftover
 // unrelated conflict, irrespective of our option's success or failure.
 q.delete(NORTH_CAPE_STAND_ACTIVATE);q.delete(NORTH_CAPE_STAND_VETO);
 return {requested,stockSearch:q.toString()};
}
