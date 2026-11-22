import { project } from './geo.ts';
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
 {id:'cavendish-low',name:'Cavendish shore · low pass',region:'Queens County',lon:-63.422,lat:46.500,heading:105,height:130,note:'See the coast and dunes from a lower 130-metre starting altitude.'}
];
/** Published threshold locations and widths from OurAirports, https://ourairports.com/data/ (public domain; 2026-11-22 snapshot). */
export const RUNWAYS = [
 {id:'CYYG03',airport:'CYYG',ends:['03','21'],from:[-63.127498626708984,46.279701232910156],to:[-63.12310028076172,46.29859924316406],width:45.72},
 {id:'CYYG10',airport:'CYYG',ends:['10','28'],from:[-63.12900161743164,46.29389953613281],to:[-63.109500885009766,46.29650115966797],width:45.72},
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
