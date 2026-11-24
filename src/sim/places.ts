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
 {id:'northcape-wind-low',name:'North Cape · wind farm low pass',region:'Prince County',lon:-64.0036036,lat:47.0544783,heading:139,height:122,note:'Begin over the Gulf and cross the commercial turbine array at 122 metres above the starting surface. The North Cape wind scenery preview renders the towers.'},
 {id:'greenwich-dunes-low',name:'Greenwich Dunes · coastal pass',region:'Kings County',lon:-62.7187079,lat:46.4560696,heading:148,height:177,note:'Start over the Gulf and cross the Greenwich dunes toward Bowley Pond. The survey preview shows the documented open-water core.'}
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
 {id:"prince-sand-dunes",name:"Prince County · dry dune pass",region:"Prince County",lon:-63.9425035487,lat:46.705942742,heading:175,height:58,note:"Fly south over one selected 2020 dune study. Enable Dry dune surface detail in Standard for the close sand treatment."},
 {id:"queens-sand-dunes",name:"Queens County · dry dune pass",region:"Queens County",lon:-63.4589346845,lat:46.5103707013,heading:175,height:58,note:"Fly south over one selected 2020 dune study. Enable Dry dune surface detail in Standard for the close sand treatment."},
 {id:"kings-sand-dunes",name:"Kings County · dry dune pass",region:"Kings County",lon:-62.0594249031,lat:46.4715531596,heading:175,height:58,note:"Fly south over one selected 2020 dune study. Enable Dry dune surface detail in Standard for the close sand treatment."},
 {id:'hog-island-west-pass',name:'Hog Island · west dune pass',region:'Pituamkek Sandhills',lon:-63.8444204973,lat:46.6466321746,heading:175,height:58,note:'Approach from offshore. Enable Hog Island aerial detail to see the September 2022 dry dune imagery.'},
 {id:'hog-island-east-pass',name:'Hog Island · east dune pass',region:'Pituamkek Sandhills',lon:-63.8232250243,lat:46.6356946663,heading:175,height:58,note:'Approach the eastern dry dune area from the Gulf. The aerial study does not alter terrain or water.'}
];
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
