import { equivalentAirspeed } from '../sim/aerodynamics.ts';
import { SITES, type Site } from '../sim/places.ts';
import { geographic, DEG } from '../sim/geo.ts';
import type { Flight } from '../sim/flight.ts';
import type { Terrain } from '../sim/terrain.ts';
import type { Input } from './input.ts';
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id)! as T;
const logo='<svg viewBox="0 0 56 38" aria-hidden="true"><path fill="currentColor" d="M1 13 54 4 36 34l-9-13-13 2 8-8z"/><path fill="#153734" d="m30 19 17-10-13 15z"/></svg>';
export type Mode='dispatch'|'flight'|'paused'|'map'|'help'|'crash'|'credits';
export function bootUI(){
 $('ui').innerHTML=`<div class="loading" role="status"><span class="brandmark">${logo}</span><div><span class="eyebrow">PEI FLIGHT SIM / SYSTEMS</span><h1>Preparing the island</h1><p id="load-msg">Opening the flight atlas…</p></div></div>`;
}
export const loadMsg=(s:string)=>{const a=document.getElementById('load-msg');if(a)a.textContent=s;};
export function failUI(message:string){
 $('ui').innerHTML='<section class="fault"><span class="eyebrow">PEI FLIGHT SIM / SYSTEMS</span><h1>Flight deck unavailable</h1><p id="fault-msg"></p><button id="retry" class="gold">Reload flight deck</button></section>';
 $('fault-msg').textContent=message;$('retry').onclick=()=>location.reload();
}
export class UI {
 mode:Mode='dispatch';selected=0;previous:Mode='dispatch';private terrain:Terrain; private input:Input;
 private chartImage:HTMLImageElement;private frame=0;private siteNow=0;private camera='Chase';private silent=true;private message='';
 constructor(t:Terrain,input:Input,private actions:{start:(i:number)=>void;resume:()=>void;view:()=>void;sound:()=>void;pause:()=>void;restart:()=>void;engineState:()=>{out:boolean;airborne:boolean};practiceFailure:(out:boolean)=>void;}) {
  this.terrain=t;this.input=input;
  const opts=SITES.map((s,i)=>`<option value="${i}">${s.name}</option>`).join('');
  $('ui').innerHTML=`<header class="bar"><div class="brand"><span class="brandmark">${logo}</span><div><strong>PEI FLIGHT SIM</strong><small>ATLANTIC FLIGHT ATLAS</small></div></div><div class="topnav"><button id="nav-map" title="Flight atlas (M)">Atlas <kbd>M</kbd></button><button id="nav-help" title="Controls (H)">Controls <kbd>H</kbd></button><button id="nav-sound" aria-label="Enable engine sound">Sound off</button><button id="nav-pause" hidden>Pause</button></div></header>
  <div class="scrim" id="scrim"></div>
  <section id="dispatch" class="dispatch panel" aria-labelledby="dispatch-title"><span class="eyebrow"><i></i> CANADA &nbsp; / &nbsp; ATLANTIC</span><h1 id="dispatch-title">Prince Edward<br><em>Island</em></h1><p class="standfirst">Free flight across the province, from red sandstone shores to patchwork farmland.</p>
  <div class="rule"></div><label class="eyebrow" for="site">DEPARTURE POINT</label><select id="site">${opts}</select><p id="site-note" class="sitenote"></p><div class="brief-meta"><span>Aircraft <b>Survey 01</b></span><span>Conditions <b>Late summer</b></span></div><button class="gold" id="start">Begin flight <span aria-hidden="true">→</span></button></section>
  <div class="location" id="location"><span class="eyebrow"><i></i> ON LOCATION</span><strong id="loc-name"></strong><small id="loc-county"></small></div>
  <section id="telemetry" aria-label="Flight instruments"><div class="flight-strip"><span><small>AIRSPEED</small><b id="kt">0</b><em>KT</em></span><span><small>ALTITUDE</small><b id="ft">0</b><em>FT MSL</em></span><span><small>HEADING</small><b id="hdg">000</b><em>°T</em></span><span><small>THROTTLE</small><b id="pwr">0</b><em>%</em></span></div><div id="annun"></div></section>
  <div id="inflight" class="flightbtns"><button id="view">Chase <kbd>V</kbd></button><span id="controller"></span></div>
  <div id="modal" class="modal panel" role="dialog" aria-modal="true" aria-label="Flight panel"></div>
  <div id="touch"><div class="pad" id="stick" aria-label="Drag for pitch and roll"><i></i><small>STICK</small></div><div class="touchbuttons"><button id="upPower" aria-label="Increase throttle">PWR +</button><button id="dnPower" aria-label="Reduce throttle">PWR −</button></div></div>
  <footer><span id="layer-alert" hidden role="status"></span><button id="credits">Map credits</button><span>Contains modified Copernicus Sentinel data 2025 · NRCan · Statistics Canada</span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></footer>`;
  this.chartImage=new Image();this.chartImage.src=import.meta.env.BASE_URL+'world/color.webp';
  $('site').onchange=()=>{this.selected=Number(($('site') as HTMLSelectElement).value);this.showSite();};
  $('start').onclick=()=>this.actions.start(this.selected);$('view').onclick=()=>this.actions.view();
  $('nav-map').onclick=()=>this.toggle('map');$('nav-help').onclick=()=>this.toggle('help');$('credits').onclick=()=>this.toggle('credits');
  $('nav-pause').onclick=()=>this.actions.pause();$('nav-sound').onclick=()=>this.actions.sound();
  const stick=$('stick'),knob=stick.querySelector('i')!;const stickMove=(e:PointerEvent)=>{
   const r=stick.getBoundingClientRect(),x=Math.max(-1,Math.min(1,(e.clientX-r.left-r.width/2)/(r.width*.42))),y=Math.max(-1,Math.min(1,(e.clientY-r.top-r.height/2)/(r.height*.42)));
   this.input.touch.roll=x;this.input.touch.pitch=y;knob.style.transform='translate('+x*25+'px,'+y*25+'px)';};
  stick.onpointerdown=e=>{stick.setPointerCapture(e.pointerId);stickMove(e);};stick.onpointermove=e=>{if(stick.hasPointerCapture(e.pointerId))stickMove(e);};
  stick.onlostpointercapture=()=>{this.input.touch.roll=0;this.input.touch.pitch=0;knob.style.transform='none';};
  for(const [id,delta] of [['upPower',1],['dnPower',-1]] as const){const b=$(id);b.onpointerdown=e=>{b.setPointerCapture(e.pointerId);this.input.touch.power=delta;};b.onlostpointercapture=()=>this.input.touch.power=0;}
  this.showSite();this.set('dispatch');
 }
 showSite(){const s=SITES[this.selected];$('site-note').textContent=s.note;$('loc-name').textContent=s.name;$('loc-county').textContent=s.region;($('site') as HTMLSelectElement).value=''+this.selected;}
 departure(i:number){this.siteNow=this.selected=i;this.showSite();this.set('flight');}
 setCamera(v:string){this.camera=v;$('telemetry').classList.toggle('cockpit-telemetry',v==='Cockpit');$('view').innerHTML=v+' <kbd>V</kbd>';}
 setWarnings(xs:string[]){const e=$('layer-alert');e.textContent=xs.length?'Scenery unavailable: '+xs.join(', '):'';e.hidden=!xs.length;}
 setSound(on:boolean){this.silent=!on;$('nav-sound').textContent=on?'Sound on':'Sound off';$('nav-sound').setAttribute('aria-label',on?'Mute engine sound':'Enable engine sound');}
 stop(reason:string){this.message=reason;this.set('crash');}
 toggle(next:'map'|'help'|'credits'){
  if(this.mode===next){this.close();return;}
  if(this.mode==='flight'||this.mode==='dispatch'||this.mode==='paused'||this.mode==='crash')this.previous=this.mode;
  this.set(next);
 }
 close(){this.set(this.previous==='dispatch'?'dispatch':this.previous==='crash'?'crash':this.previous==='paused'?'paused':'flight');}
 set(mode:Mode){
  this.mode=mode;this.input.clear();$('ui').dataset.mode=mode;const flight=mode==='flight',dispatch=mode==='dispatch';
  for(const [name,visible] of Object.entries({dispatch,location:dispatch,telemetry:flight,inflight:flight,touch:flight,'nav-pause':flight,scrim:!flight,modal:!dispatch&&!flight}))$(name).hidden=!visible;
  const modal=$('modal');if(dispatch||flight){modal.innerHTML='';return;}
  const closer='<button class="close" id="close" aria-label="Close panel">×</button>';
  if(mode==='help')modal.innerHTML=closer+`<span class="eyebrow">PILOT HANDBOOK / 01</span><h2>Flight controls</h2><div class="binds"><div><b>Pitch & bank</b><span>Arrow keys or WASD</span></div><div><b>Rudder</b><span>Q / E</span></div><div><b>Throttle</b><span>Hold + / − or [ / ]</span></div><div><b>Wheel brakes</b><span>Hold B</span></div><div><b>View / pause / atlas</b><span>V / P / M</span></div></div><p>Pull back (↓ or S) to climb. Bank to turn; release to level. On a runway, hold + for full power, then pull back near 65 kt.</p><h3>Standard gamepad</h3><p>Left stick: pitch and bank. Right stick X: rudder. Triggers change power. South button brakes; Start pauses. Press a button on your controller to connect.</p><h3>Engine-out practice</h3><p>While airborne, open Pause to simulate a power loss. You can restore power from the same panel. New departures always start normally.</p>`;
  if(mode==='map'){
   modal.innerHTML=closer+`<span class="eyebrow">NAVIGATION / PEI</span><h2>Flight atlas</h2><canvas id="chart" width="760" height="378"></canvas><label class="eyebrow" for="map-site">REPOSITION AIRCRAFT</label><select id="map-site">${SITES.map((s,i)=>`<option value="${i}">${s.name}</option>`).join('')}</select><button id="fly-here" class="gold">Fly from here <span>↗</span></button>`;
   ($('map-site') as HTMLSelectElement).value=''+this.siteNow;$('fly-here').onclick=()=>this.actions.start(Number(($('map-site') as HTMLSelectElement).value));
  }
  if(mode==='credits')modal.innerHTML=closer+`<span class="eyebrow">CHART NOTES / SOURCES</span><h2>About this atlas</h2><p>Contains modified Copernicus Sentinel data 2025. Natural-colour imagery is a multi-date satellite mosaic. Terrain: Natural Resources Canada, CanElevation. Province shoreline: Statistics Canada, 2021 Census, with a localized Quartermaster Marina correction.</p><p>Contains information licensed under the <a href="https://open.canada.ca/en/open-government-licence-canada" target="_blank" rel="noreferrer">Open Government Licence – Canada</a>. National Road Network: Statistics Canada. Building outlines and roof heights: Natural Resources Canada, PEI 2020 LiDAR survey. Building façades and roof forms are inferred, not photographed. St. Dunstan’s Basilica, the Confederation Bridge and the East and West Point light stations are original approximate exterior models. Nearby New Brunswick and Nova Scotia terrain provides non-playable shoreline context. Other runway thresholds: OurAirports, public domain. CYYG 10/28 centreline, Quartermaster Marina shoreline and floating docks, selected residential building types, mapped sidewalks and Water Street building parts: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>, <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">ODbL 1.0</a>. The <a href="https://github.com/cheshmakzanoon-ops/PEI-Flight-simulation/tree/main/data/odbl/residential" target="_blank" rel="noreferrer">adapted residential source data</a> and <a href="https://github.com/cheshmakzanoon-ops/PEI-Flight-simulation/tree/main/data/odbl/sidewalks" target="_blank" rel="noreferrer">mapped sidewalk data</a> and <a href="https://github.com/cheshmakzanoon-ops/PEI-Flight-simulation/tree/main/data/odbl/water-street" target="_blank" rel="noreferrer">Water Street reference geometry</a> are available under the same licence. The optional <a href="https://github.com/cheshmakzanoon-ops/PEI-Flight-simulation/tree/main/data/odbl/adaptive-relief" target="_blank" rel="noreferrer">inland relief selection data</a> include a separately licensed eligibility mask; measured 16 m elevations are from NRCan. <a href="https://dataspace.copernicus.eu/terms-and-conditions" target="_blank" rel="noreferrer">Copernicus terms</a>.</p><p>Metre-scale coordinates do not imply metre-resolution scenery. The terrain and coastline mask are sampled at roughly 47 m; the near satellite imagery is about 10 m per pixel. Sky environment: Greg Zaal and Jarod Guest, <a href="https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky" target="_blank" rel="noreferrer">Poly Haven</a> (CC0); it represents lighting, not current PEI weather. © ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium. <a href="https://doi.org/10.5281/zenodo.7254221" target="_blank" rel="noreferrer">WorldCover 2021 v200</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. Forest classes are measured; individual trees and field detail are inferred. Selected stand heights use PEI Enhanced Forest Inventory 2020. Contains information licensed under the <a href="https://www.princeedwardisland.ca/en/information/finance/open-government-licence-prince-edward-island" target="_blank" rel="noreferrer">Open Government Licence – Prince Edward Island</a>. Not for real navigation.</p>`;
  if(mode==='paused'||mode==='crash'){
   modal.innerHTML=`<span class="eyebrow">PEI FLIGHT SIM / FREE FLIGHT</span><h2>${mode==='crash'?this.message:'Flight paused'}</h2><p>${mode==='crash'?'Choose a departure or restart your last flight.':'Your aircraft is held in place.'}</p><button class="gold" id="again">${mode==='crash'?'Restart flight':'Resume flight'} <span>↗</span></button><button class="outline" id="site-list">Choose departure</button>`;
   if(mode==='paused'){
    modal.insertAdjacentHTML('beforeend','<h3>Engine-out practice</h3><p id="practice-status" role="status"></p><button class="outline" id="practice-engine"></button>');
    const button=$<HTMLButtonElement>('practice-engine');
    const paint=()=>{
     const s=this.actions.engineState();
     $('practice-status').textContent=s.out?'Engine out. The windmilling prop adds drag. Restoring power uses your current throttle.':s.airborne?'Engine running. This optional scenario cuts thrust when you resume.':'This scenario is available once airborne.';
     button.textContent=s.out?'Restore engine power':'Simulate engine failure';
     button.disabled=!s.airborne&&!s.out;
    };
    paint();button.onclick=()=>{this.actions.practiceFailure(!this.actions.engineState().out);paint();};
   }
   $('again').onclick=()=>mode==='crash'?this.actions.restart():this.actions.resume();
   $('site-list').onclick=()=>{this.set('dispatch');this.showSite();};
  }
  const x=document.getElementById('close');if(x)x.onclick=()=>this.close();
 }
 update(f:Flight,ground:number){
  this.frame++;if(this.frame%5!==0&&this.mode!=='map')return;
  $('kt').textContent=''+Math.round(equivalentAirspeed(f.speed,f.y)*1.94384);$('ft').textContent=Math.round(f.y*3.28084).toLocaleString('en-US');
  $('hdg').textContent=('00'+(Math.round(f.heading*DEG)%360)).slice(-3);$('pwr').textContent=''+Math.round(f.throttle*100);
  const alert=f.stalled?'STALL • LOWER NOSE':f.status!=='flying'?f.status==='landed'?'TOUCHDOWN':'GROUND ROLL':f.y-ground<30?'LOW ALTITUDE':'';
  $('annun').textContent=(f.engineOut?'ENGINE OUT'+(alert?' · ':''):'')+alert;
  $('controller').textContent=this.input.gamepad?'● GAMEPAD':'';
  if(this.mode==='map'){const c=$<HTMLCanvasElement>('chart'),g=c.getContext('2d')!;
   g.fillStyle='#17383b';g.fillRect(0,0,c.width,c.height);
   if(this.chartImage.complete&&this.chartImage.naturalWidth>0){g.globalAlpha=.85;g.drawImage(this.chartImage,0,0,c.width,c.height);g.globalAlpha=1;}
   const [W,S,E,N]=this.terrain.spec.bounds,coord=(lon:number,lat:number)=>[(lon-W)/(E-W)*c.width,(N-lat)/(N-S)*c.height];
   for(const site of SITES.filter(s=>!s.runway)){const [x,y]=coord(site.lon,site.lat);g.strokeStyle='#f1c074';g.beginPath();g.arc(x,y,4,0,Math.PI*2);g.stroke();}
   const ll=geographic(f.x,f.z),[x,y]=coord(ll.lon,ll.lat);g.save();g.translate(x,y);g.rotate(f.heading);g.beginPath();g.moveTo(0,-10);g.lineTo(6,6);g.lineTo(0,3);g.lineTo(-6,6);g.closePath();g.fillStyle='#fff';g.fill();g.restore();
  }
 }
}
