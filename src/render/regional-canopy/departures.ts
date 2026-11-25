import type {Site} from '../../sim/places.ts';
/** Simulator-only eastbound passes. Keep their coordinates in every profile for comparison. */
export const REGIONAL_CANOPY_DEPARTURES=[
 {id:'queens-canopy-pass',name:'Queens · woodland pass',region:'Queens County',lon:-63.38452740392676,lat:46.40061023797044,
  heading:90,height:112,note:'Virtual eastbound flight over a small 2020 woodland study. This is not a real airstrip or route.'},
 {id:'kings-canopy-pass',name:'Kings · woodland pass',region:'Kings County',lon:-62.178044535816746,lat:46.40741024142273,
  heading:90,height:112,note:'Virtual eastbound flight over a small 2020 woodland study. This is not a real airstrip or route.'},
] as const satisfies readonly Site[];
