import { geographic, project } from './geo.ts';
import {CYYG_10_MAP_LINE,CYYG_10_SIZE} from './cyyg-runway-reference.ts';
export type Site = {id:string;name:string;region:string;lon:number;lat:number;heading:number;height:number;note:string;runway?:string};
export const SITES: Site[] = [
 {id:'cavendish',name:'Cavendish coast',region:'Queens County',lon:-63.423,lat:46.487,heading:101,height:440,note:'Follow sandstone headlands and the beach east toward North Rustico.'},
 {id:'charlottetown',name:'Charlottetown Harbour',region:'Queens County',lon:-63.155,lat:46.199,heading:34,height:520,note:'Approach the provincial capital from the mouth of its harbour.'},
 {id:'summerside',name:'Summerside',region:'Prince County',lon:-63.804,lat:46.376,heading:312,height:360,note:'Cross Bedeque Bay toward the waterfront and Summerside Airport.'},
 {id:'eastpoint',name:'East Point',region:'Kings County',lon:-62.012,lat:46.457,heading:71,height:390,note:'Fly the eastern tip where the Northumberland Strait meets the Gulf.'},
 {id:'northcape',name:'North Cape',region:'Prince County',lon:-64.026,lat:47.009,heading:338,height:380,note:'Trace the exposed shoreline toward the island’s northern tip.'},
 {id:'montague',name:'Montague River',region:'Kings County',lon:-62.614,lat:46.159,heading:260,height:360,note:'Follow the river inland from the Three Rivers estuary.'},
 {id:'bridge',name:'Confederation Bridge',region:'Prince County',lon:-63.7125,lat:46.243,heading:226,height:265,note:'Depart over Borden-Carleton and follow the 12.9-kilometre crossing toward New Brunswick.'},
 {id:'cyyg',name:'Charlottetown · runway 03',region:'Queens County',lon:-63.1274986,lat:46.2797012,heading:9.3,height:0,runway:'CYYG03',note:'Start on the runway. Advance throttle, then pull up around 65 knots.'},
 {id:'cysu',name:'Summerside · runway 05',region:'Prince County',lon:-63.8428,lat:46.4314,heading:36,height:0,runway:'CYSU05',note:'Depart runway 05 and head northeast over Prince County.'},
 {id:'harbour-low',name:'Charlottetown waterfront · low pass',region:'Queens County',lon:-63.1338,lat:46.2190,heading:34,height:115,note:'Cross the harbour approach at 115 metres above the starting surface; keep clear of land and buildings.'},
 {id:'cavendish-low',name:'Cavendish shore · low pass',region:'Queens County',lon:-63.422,lat:46.500,heading:105,height:130,note:'See the coast and dunes from a lower 130-metre starting altitude.'},
 {id:'east-light',name:'East Point · lighthouse pass',region:'Kings County',lon:-61.9679,lat:46.4507,heading:292,height:58,note:'Approach the red-roofed fog house and white octagonal light from offshore.'},
 {id:'west-light',name:'West Point · lighthouse pass',region:'Prince County',lon:-64.3910,lat:46.6194,heading:61,height:58,note:'Follow the striped light onto the Cedar Dunes shoreline at the western entrance to the strait.'},
 {id:'basin-head-low',name:'Basin Head · low pass',region:'Kings County',lon:-62.10574,lat:46.37296,heading:338,height:96,note:'Follow the inlet towards the beach, footbridge and historic Cannery from offshore.'},
 {id:'spinnakers-low',name:'Summerside waterfront · low pass',region:'Prince County',lon:-63.7813,lat:46.3849,heading:314,height:82,note:'Cross the harbour towards Spinnakers’ Landing and the Summerside waterfront.'},
 {id:'prince-open-shore-pass',name:'Prince County · open shore pass',region:'Prince County',lon:-63.97795820465,lat:46.92729003459,heading:245,height:72,note:'Begin offshore at 72 metres and fly toward the exposed Prince County shoreline. A virtual flight, not a navigation route.'},
 {id:'northcape-wind-low',name:'North Cape · wind farm low pass',region:'Prince County',lon:-64.0036036,lat:47.0544783,heading:139,height:122,note:'Begin over the Gulf and cross the commercial turbine array at 122 metres above the starting surface. Standard scenery renders the commercial towers as you approach.'},
 {id:'greenwich-dunes-low',name:'Greenwich Dunes · coastal pass',region:'Kings County',lon:-62.7187079,lat:46.4560696,heading:148,height:177,note:'Start over the Gulf and cross the Greenwich dunes toward Bowley Pond. The survey preview shows the documented open-water core.'}
 ,{id:'kings-coastal-ridge',name:'Kings County · coastal ridge pass',region:'Kings County',lon:-62.78234,lat:46.4420,heading:174,height:126,note:'Virtual offshore start at 126 metres. Fly inland above the dated coastal ridge. Enable the Kings dry crown study to compare the LiDAR terrain.'}
,
 {id:'prince-fields',name:'Prince County · fields low pass',region:'Prince County',lon:-63.87084083,lat:46.45180499,heading:330.611,height:62,note:'A low inland pass for comparison with the optional field surface study.'},
 {id:'queens-fields',name:'Queens County · fields low pass',region:'Queens County',lon:-63.50800256,lat:46.36244236,heading:47.031,height:62,note:'A low inland pass for comparison with the optional field surface study.'},
 {id:'kings-fields',name:'Kings County · fields low pass',region:'Kings County',lon:-62.36975541,lat:46.34643049,heading:140.268,height:62,note:'A low inland pass for comparison with the optional field surface study.'},
 {id:'cavendish-dunelands-low',name:'Cavendish Dunelands · coastal pass',region:'Queens County',lon:-63.38962,lat:46.5015,heading:162,height:130,note:'Cross the dunes from offshore and follow the lowlands toward Green Gables. Optional water and exterior studies cover selected sites.'},
 {id:'north-rustico-harbour-low',name:'North Rustico Harbour · coastal pass',region:'Queens County',lon:-63.2848204321,lat:46.4563682649,heading:255,height:72,note:'Start offshore and cross into the harbour at 72 metres above the starting surface. The optional lighthouse study shows the historic light and keeper’s dwelling.'},
 {id:'prince-grassland',name:'Prince County · grassland pass',region:'Prince County',lon:-63.91099256406,lat:46.64893385636,heading:83,height:78,note:'Begin at 78 metres above the starting surface and fly across selected inland fields. Enable Ground vegetation in Dispatch to see the optional grass treatment.'},
 {id:'queens-grassland',name:'Queens County · grassland pass',region:'Queens County',lon:-63.21394671296,lat:46.16121449621,heading:37,height:78,note:'Begin at 78 metres above the starting surface and fly across selected inland fields. Enable Ground vegetation in Dispatch to see the optional grass treatment.'},
 {id:'kings-grassland',name:'Kings County · grassland pass',region:'Kings County',lon:-62.62491056413,lat:46.21593818962,heading:150,height:78,note:'Begin at 78 metres above the starting surface and fly across selected inland fields. Enable Ground vegetation in Dispatch to see the optional grass treatment.'},
 {id:'indian-river-country-pass',name:'Indian River · country pass',region:'Prince County',lon:-63.6787969268,lat:46.4754997191,heading:75,height:80,note:'Fly over farm country from the west. Enable St. Mary’s exterior to see the surveyed roof and spire.'},
 {id:"prince-coastal-grass",name:"Prince County · coastal grass pass",region:"Prince County",lon:-63.8776772273,lat:46.6619507095,heading:174,height:55,note:"Fly toward a selected coastal grassland area."},
 {id:"queens-coastal-grass",name:"Queens County · coastal grass pass",region:"Queens County",lon:-62.9969096919,lat:46.41721578,heading:174,height:55,note:"Fly toward a selected coastal grassland area."},
 {id:"kings-coastal-grass",name:"Kings County · coastal grass pass",region:"Kings County",lon:-62.1615418735,lat:46.3697621224,heading:174,height:55,note:"Fly toward a selected coastal grassland area."},
 {id:'prince-meadow-low',name:'Prince County · inland meadow pass',region:'Prince County',lon:-63.87977038384,lat:46.4621004046,heading:90,height:55,note:'Begin 55 metres above the starting surface and cross mapped grassland near Miscouche.'},
 {id:'queens-meadow-low',name:'Queens County · inland meadow pass',region:'Queens County',lon:-63.35949592323,lat:46.25395821978,heading:90,height:55,note:'Start at 55 metres and cross a mapped open-ground pocket west of Charlottetown.'},
 {id:'kings-meadow-low',name:'Kings County · inland meadow pass',region:'Kings County',lon:-62.25213570748,lat:46.41897991908,heading:90,height:55,note:'Begin at 55 metres and fly east over the mapped grassland north of Souris.'},
 {id:"prince-sand-dunes",name:"Prince County · dry dune pass",region:"Prince County",lon:-63.9425035487,lat:46.705942742,heading:175,height:58,note:"Fly south over one selected 2020 dune study. Enable Dry dune surface detail in Standard for the close sand treatment."},
 {id:"queens-sand-dunes",name:"Queens County · dry dune pass",region:"Queens County",lon:-63.4589346845,lat:46.5103707013,heading:175,height:58,note:"Fly south over one selected 2020 dune study. Enable Dry dune surface detail in Standard for the close sand treatment."},
 {id:"kings-sand-dunes",name:"Kings County · dry dune pass",region:"Kings County",lon:-62.0594249031,lat:46.4715531596,heading:175,height:58,note:"Fly south over one selected 2020 dune study. Enable Dry dune surface detail in Standard for the close sand treatment."},
 {id:'hog-island-west-pass',name:'Hog Island · west dune pass',region:'Pituamkek Sandhills',lon:-63.8444204973,lat:46.6466321746,heading:175,height:58,note:'Approach from offshore. Enable Hog Island aerial detail to see the September 2022 dry dune imagery.'},
 {id:'hog-island-east-pass',name:'Hog Island · east dune pass',region:'Pituamkek Sandhills',lon:-63.8232250243,lat:46.6356946663,heading:175,height:58,note:'Approach the eastern dry dune area from the Gulf. The aerial study does not alter terrain or water.'},
 {"lon":-64.23357075932525,"lat":46.674377830069496,"id":"prince-woodland-view","name":"Prince County \u00b7 woodland view pass","heading":270,"height":29,"region":"Prince County","note":"Virtual low woodland pass. Enable Woodland scenery view in Standard and cycle to Scenery with V to look down."},
 {"lon":-63.37650018484735,"lat":46.400959210988596,"id":"queens-woodland-view","name":"Queens County \u00b7 woodland view pass","heading":120,"height":29,"region":"Queens County","note":"Virtual low woodland pass. Enable Woodland scenery view in Standard and cycle to Scenery with V to look down."},
 {"lon":-62.16750720087922,"lat":46.41638738574205,"id":"kings-woodland-view","name":"Kings County \u00b7 woodland view pass","heading":195,"height":26,"region":"Kings County","note":"Virtual low woodland pass. Enable Woodland scenery view in Standard and cycle to Scenery with V to look down."},
 {id:'souris-waterfront-pass',name:'Souris · waterfront pass',region:'Kings County',lon:-62.2537,lat:46.3491,heading:352.2,height:98,note:'Start offshore and head north along the waterfront toward the centre of Souris.'},
 {id:'georgetown-low',name:'Georgetown harbour · low pass',region:'Kings County',lon:-62.52719008293827,lat:46.17861545831718,heading:309,height:61,note:'Start over Georgetown Harbour and cross toward the village and St. David’s United Church. A virtual flight, not a navigation route.'},
 {id:'miscouche-woodlot-pass',name:'Miscouche · woodland pass',region:'Prince County',lon:-63.907896877253485,lat:46.446923871189824,heading:90,height:96,note:'Virtual eastbound view over the measured public woodlot, west of Summerside.'},
 {id:'panmure-head-coast',name:'Panmure Head · coastal pass',region:'Kings County',lon:-62.4570153429,lat:46.1454518341,heading:260,height:78,note:'Start over open water east of Panmure Head and fly toward the headland. Virtual sightseeing, not an aviation route.'},
 {id:'cape-tryon-coast',name:'Cape Tryon · cliff pass',region:'Queens County',lon:-63.5018495003,lat:46.5390361933,heading:210,height:82,note:'Fly from over the Gulf toward the Cape Tryon headland. Virtual terrain sightseeing, not a navigation route.'},
 {id:'hunter-river-trail',name:'Hunter River · Confederation Trail pass',region:'Queens County',lon:-63.35065736,lat:46.3523806,heading:125.3,height:95,note:'Virtual sightseeing only. Begin at 95 metres above the starting terrain and look for the mapped trail below. Not an aviation or cycling route.'},
 {id:'tracadie-marsh',name:'Tracadie Bay · marsh pass',region:'Queens County',lon:-62.970714,lat:46.414663,heading:271,height:35,note:'Virtual sightseeing only. Begin above the Tracadie Bay marsh. Not an aviation or landscape survey route.'},
 {id:'seacow-head-coast',name:'Seacow Head · coastal pass',region:'Prince County',lon:-63.7979256832,lat:46.3058977815,heading:320,height:78,note:'Virtual sightseeing only. Start over water southeast of Seacow Head and fly toward the lighthouse.'},
 {id:'dalvay-lake-coastal-pass',name:'Dalvay Lake · coastal pass',region:'Queens County',lon:-63.07337348670973,lat:46.42729933695014,heading:182.1,height:110,note:'Start over the Gulf and fly south toward Dalvay-by-the-Sea and Dalvay Lake. Virtual sightseeing only.'},
 {id:'oleary-railway-low',name:'O’Leary · railway station pass',region:'Prince County',
  lon:-64.21528650212998,lat:46.715825492132865,heading:221,height:65,
  note:'Start northeast of O’Leary and look for the former railway station on Main Street. Virtual sightseeing only, not a navigation route.'},
];
// The lower route is discoverable only with the authenticated Montague
// foundation. Keep it out of the stock dispatch list and leave the older
// high-altitude estuary departure unchanged.
export const MONTAGUE_BRIDGE_DEPARTURE:Site={
 id:'montague-bridge-low',name:'Montague · river bridge pass',region:'Kings County',
 lon:-62.64066788367977,lat:46.16629032720332,heading:245,height:64,
 note:'Start over the river northeast of the Main Street bridge. Virtual sightseeing only, not an aviation or marine route.',
};

// Keep normal stock and conditionally appended route ordinals stable.
// Main lists this additional pass after the existing regional routes.
export const KINGS_MAPPED_FARMLAND_DEPARTURE:Site={
 id:'kings-mapped-farmland-pass',name:'Kings County · mapped farmland pass',region:'Kings County',
 lon:-62.63729889216559,lat:46.39645292554363,heading:197.3,height:62,
 note:'Begin at 62 metres above the starting surface. Enable Expanded farmland in Standard Dispatch for close furrow detail over a mapped inland field. Virtual sightseeing only.',
};
function cyyg10SimulatorEnds(){
 const p=project(...CYYG_10_MAP_LINE.west),q=project(...CYYG_10_MAP_LINE.east);
 const dx=q.x-p.x,dz=q.z-p.z,k=CYYG_10_SIZE.length/(2*Math.hypot(dx,dz));
 const x=(p.x+q.x)/2,z=(p.z+q.z)/2;
 const a=geographic(x-dx*k,z-dz*k),b=geographic(x+dx*k,z+dz*k);
 return {from:[a.lon,a.lat],to:[b.lon,b.lat]};
}
/** 03/21 and 05/23: OurAirports public-domain snapshot. 10/28 is separately
 * registered to the post-extension map line and the declared pavement length. */
export const RUNWAYS = [
 {id:'CYYG03',airport:'CYYG',ends:['03','21'],from:[-63.127498626708984,46.279701232910156],to:[-63.12310028076172,46.29859924316406],width:45.72},
 {id:'CYYG10',airport:'CYYG',ends:['10','28'],...cyyg10SimulatorEnds(),width:CYYG_10_SIZE.width},
 {id:'CYSU05',airport:'CYSU',ends:['05','23'],from:[-63.8428,46.4314],to:[-63.8242,46.4492],width:60.96}
].map(r=>{
 const p=project(r.from[0],r.from[1]),q=project(r.to[0],r.to[1]);
 const dx=q.x-p.x,dz=q.z-p.z,length=Math.hypot(dx,dz);
 return {...r,p,q,dx:dx/length,dz:dz/length,length,heading:Math.atan2(dx,-dz)};
});
export function runwayAt(x:number,z:number){
 return RUNWAYS.find(r=>{const dx=x-r.p.x,dz=z-r.p.z,along=dx*r.dx+dz*r.dz;
 return along>=0&&along<=r.length&&Math.abs(dx*r.dz-dz*r.dx)<=r.width*.5;});
}
