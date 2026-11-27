import { departureBriefing } from './departure-briefing.ts';
import {PRINCE_LANDSCAPE_ROUTE,princeLandscapeState,switchPrinceLandscape,KINGS_RIDGE_ROUTE,kingsRidgeLensState,standardKingsRidgeRequested,switchStandardKingsRidgeURL,switchKingsRidgeLens,INDIAN_RIVER_ROUTE,STOCK_INDIAN_RIVER,indianRiverLensState,standardIndianRiverRequested,switchStandardIndianRiverURL,switchIndianRiverLens,BASIN_HEAD_DEPARTURE,basinHeadDispatchState,switchBasinHeadDispatchURL,SCENERY_REVIEWS,CAVENDISH_PACKAGE_FLAGS,cavendishPackageState,switchCavendishPackageURL,CAPE_TRYON_DEPARTURE,capeTryonRockState,switchCapeTryonRockURL,applyReviewSceneryURL,isDetailScenery,sceneryReviewBlock,reviewedScenery,sceneryDeparture,sceneryOptions,switchSceneryURL,type ScenicReview} from './scenery-profile.ts';
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
 private ridgeState='';
 private industrialState='';
 private riverState='';
 private lakeState='';
 constructor(t:Terrain,input:Input,private actions:{start:(i:number)=>void;resume:()=>void;view:()=>void;sound:()=>void;pause:()=>void;restart:()=>void;engineState:()=>{out:boolean;airborne:boolean};practiceFailure:(out:boolean)=>void;},private readonly sites:readonly Site[]=SITES) {
  this.terrain=t;this.input=input;
  this.selected=sceneryDeparture(location.search,this.sites.map(x=>x.id));
  const detail=isDetailScenery(location.search);
  const cavePack=cavendishPackageState(location.search),capeRock=capeTryonRockState(location.search);
  const basin=basinHeadDispatchState(location.search),river=indianRiverLensState(location.search);
  const standardRiver=standardIndianRiverRequested(location.search),stockRiver=new URLSearchParams(location.search).has(STOCK_INDIAN_RIVER);
  const ridge=kingsRidgeLensState(location.search),prince=princeLandscapeState(location.search);
  const normalRidge=standardKingsRidgeRequested(location.search),stockRidge=new URLSearchParams(location.search).has('stockKingsRidge');
  const ridgeTitle=ridge.selected?'Close ridge preview':normalRidge?'Use original ground':stockRidge?'Use measured ground':'Open ridge preview';
  const selectedReviews=new Set(reviewedScenery(location.search));
  const reviewsWithScope=sceneryOptions(location.search);
  let reviewCount=0;
  const reviewOptions=SCENERY_REVIEWS.map(item=>{
   const blocked=sceneryReviewBlock(item.flag,reviewsWithScope),saved=selectedReviews.has(item.flag);
   const insidePack=cavePack.active&&CAVENDISH_PACKAGE_FLAGS.some(key=>key===item.flag);
   if(saved&&!blocked)reviewCount++;
   const status=insidePack?'Included in Cavendish detail':blocked==='detail'?'Switch to Standard to use this study.':
    blocked==='terrain'?(item.flag==='coastalOptics'?
     'Unavailable with the selected imagery, terrain or shoreline options.':'Unavailable with the current terrain or shadow options.'):item.scope;
   const scope=(blocked&&saved?'Saved · ':'')+status;
   return `<label class="review-choice"><input type="checkbox" name="scenery-review" value="${item.flag}"${saved||insidePack?' checked':''}${insidePack||(blocked&&!saved)?' disabled':''}><span><b>${item.name}</b><small>${scope}</small></span></label>`;
  }).join('');
  const opts=this.sites.map((s,i)=>`<option value="${i}">${s.name}</option>`).join('');
  $('ui').innerHTML=`<header class="bar"><div class="brand"><span class="brandmark">${logo}</span><div><strong>PEI FLIGHT SIM</strong><small>ATLANTIC FLIGHT ATLAS</small></div></div><div class="topnav"><button id="nav-map" title="Flight atlas (M)">Atlas <kbd>M</kbd></button><button id="nav-help" title="Controls (H)">Controls <kbd>H</kbd></button><button id="nav-sound" aria-label="Enable engine sound">Sound off</button><button id="nav-pause" hidden>Pause</button></div></header>
  <div class="scrim" id="scrim"></div>
  <section id="dispatch" class="dispatch panel" aria-labelledby="dispatch-title"><span class="eyebrow"><i></i> CANADA &nbsp; / &nbsp; ATLANTIC</span><h1 id="dispatch-title">Prince Edward<br><em>Island</em></h1><p class="standfirst">Free flight across the province, from red sandstone shores to patchwork farmland.</p>
  <div class="rule"></div><label class="eyebrow" for="site">DEPARTURE POINT</label><select id="site">${opts}</select><p id="site-note" class="sitenote"></p><p id="oleary-survey" class="sitenote" role="status" hidden></p><p id="oleary-station" class="sitenote" role="status" hidden></p><p id="dalvay-water" class="sitenote" role="status" hidden></p><p id="cavendish-freshwater" class="sitenote" role="status" hidden></p><p id="prince-low-field" class="sitenote" role="status" hidden></p><p id="knight-exterior" class="sitenote" role="status" hidden></p>
  <div class="scenery-option"><div><span class="eyebrow">SCENERY</span><p id="scenery-note">${detail?'Detailed preview · more local detail':'Standard atlas'}</p></div>
  <button type="button" id="switch-scenery" class="scenery-switch" aria-describedby="scenery-note" title="Reload the atlas without changing the selected departure">${detail?'Use standard':'Use detailed preview'}</button></div>
  <section class="regional-detail" id="cavendish-package" hidden><div><span class="eyebrow">CAVENDISH DETAIL</span><small id="cavendish-package-info">${cavePack.blocked?'Unavailable with the current terrain or shadow options.':cavePack.active?'House, Barn, lake, slope, turf and trail selected.':'House, Barn, lake, slope, turf and trail'}</small></div><button type="button" id="cavendish-package-switch" aria-label="${cavePack.selected?'Turn off Cavendish detail':'Enable Cavendish detail'}" aria-describedby="cavendish-package-info" ${cavePack.blocked&&!cavePack.selected?'disabled':''}>${cavePack.selected?'Turn off':'Enable'}</button></section>
  <section class="regional-detail" id="cape-rock" hidden><div><span class="eyebrow">CAPE TRYON SANDSTONE</span><small id="cape-rock-info">${capeRock.blocked?'Available in Standard without alternate shoreline studies.':capeRock.selected?'Sandstone in Standard. Cliff geometry is unchanged.':'Original red sandstone finish on the Gulf-facing cliffs.'}</small></div><button type="button" id="cape-rock-switch" aria-label="${capeRock.selected?'Turn off Cape Tryon sandstone':'Enable Cape Tryon sandstone'}" aria-describedby="cape-rock-info" ${capeRock.blocked&&!capeRock.selected?'disabled':''}>${capeRock.selected?'Turn off':'Enable'}</button></section>
  <section class="regional-detail" id="basin-inlet" hidden>
    <div><span class="eyebrow">BASIN HEAD INLET</span><small id="basin-inlet-info">${basin.selected?
      'Inlet, Cannery and footbridge preview selected.':!basin.compatible?
      'Unavailable with the current scenery settings.':'See the surveyed banks, historic Cannery and footbridge in a separate preview.'}</small></div>
    <button type="button" id="basin-inlet-switch" aria-describedby="basin-inlet-info"
      ${!basin.compatible&&!basin.selected?'disabled':''}>${basin.selected?'Close inlet preview':'Open inlet preview'}</button>
  </section>
  <section class="regional-detail" id="indian-river-lens" hidden>
    <div><span class="eyebrow">ST. MARY’S, INDIAN RIVER</span><small id="indian-river-lens-info">${river.active?
      'Preview selected. Surveyed terrain changes local ground contact.':!river.compatible?
      'Unavailable with the current scenery settings.':stockRiver?'Original ground selected for this comparison.':'See the survey-informed exterior and 2020 ground. This changes local ground contact.'}</small></div>
    <button type="button" id="indian-river-lens-switch" aria-describedby="indian-river-lens-info"
      ${!river.compatible&&!river.selected?'disabled':''}>${river.selected?'Close ground preview':standardRiver?'Use original ground':stockRiver?'Use measured ground':'Open ground preview'}</button>
  </section>
  <section class="regional-detail" id="kings-ridge-lens" hidden>
    <div><span class="eyebrow">KINGS COASTAL RIDGE</span><small id="kings-ridge-lens-info">${ridge.active?
      'Preview selected. The measured ridge changes local ground contact.':!ridge.compatible?
      'Unavailable with the current scenery settings.':stockRidge?'Original ground selected for this comparison.':
      'The 2020 measured ridge changes local ground contact when the survey is ready.'}</small></div>
    <button type="button" id="kings-ridge-lens-switch" aria-describedby="kings-ridge-lens-info"
      ${!ridge.compatible&&!ridge.selected?'disabled':''}>${ridgeTitle}</button>
  </section>
  <section class="regional-detail" id="prince-landscape-lens" hidden>
    <div><span class="eyebrow">PRINCE GRASSLAND</span><small id="prince-landscape-info">${prince.active?
     'Checking the measured land. A flight started before it is ready keeps Standard ground.':!prince.compatible?
     'Unavailable with the current scenery settings.':'See the surveyed field contours. This changes local ground contact.'}</small></div>
    <button type="button" id="prince-landscape-switch" aria-describedby="prince-landscape-info"
     ${!prince.compatible&&!prince.selected?'disabled':''}>${prince.selected?'Close landscape preview':'Open landscape preview'}</button>
  </section>
  <details class="scenery-reviews"><summary>Optional scenery studies <span id="scenery-review-count">${reviewCount?reviewCount+' selected':''}</span></summary><div class="scenery-review-list">${reviewOptions}
  <p class="review-note">Apply reloads the map and keeps your departure.</p><button type="button" id="apply-scenery-reviews" disabled>Apply studies</button></div></details><div class="brief-meta"><span>Aircraft <b>Survey 01</b></span><span>Conditions <b>Late summer</b></span></div><button class="gold" id="start">Begin flight <span aria-hidden="true">→</span></button></section>
  <div class="location" id="location"><span class="eyebrow"><i></i> ON LOCATION</span><strong id="loc-name"></strong><small id="loc-county"></small></div>
  <section id="telemetry" aria-label="Flight instruments"><div class="flight-strip"><span><small>AIRSPEED</small><b id="kt">0</b><em>KT</em></span><span><small>ALTITUDE</small><b id="ft">0</b><em>FT MSL</em></span><span><small>HEADING</small><b id="hdg">000</b><em>°T</em></span><span><small>THROTTLE</small><b id="pwr">0</b><em>%</em></span></div><div id="annun"></div></section>
  <div id="inflight" class="flightbtns"><button id="view">Chase <kbd>V</kbd></button><span id="controller"></span><small id="ridge-flight-status" role="status" hidden></small></div>
  <div id="modal" class="modal panel" role="dialog" aria-modal="true" aria-label="Flight panel"></div>
  <div id="touch"><div class="pad" id="stick" aria-label="Drag for pitch and roll"><i></i><small>STICK</small></div><div class="touchbuttons"><button id="upPower" aria-label="Increase throttle">PWR +</button><button id="dnPower" aria-label="Reduce throttle">PWR −</button></div></div>
  <footer><span id="layer-alert" hidden role="status"></span><button id="credits">Map credits</button><span>Contains modified Copernicus Sentinel data 2025 · NRCan · Statistics Canada</span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></footer>`;
  this.chartImage=new Image();this.chartImage.src=import.meta.env.BASE_URL+'world/color.webp';
  $('site').onchange=()=>{this.selected=Number(($('site') as HTMLSelectElement).value);this.showSite();};
  $('start').onclick=()=>this.actions.start(this.selected);$('view').onclick=()=>this.actions.view();
  $('basin-inlet-switch').onclick=()=>{
   location.assign(switchBasinHeadDispatchURL(location.href,!basin.selected,this.sites[this.selected].id));
  };
  $('indian-river-lens-switch').onclick=()=>{
   const route=this.sites[this.selected].id;
   const after=river.selected?switchIndianRiverLens(location.href,false,route):location.href;
   location.assign(river.selected||standardRiver||stockRiver?
    switchStandardIndianRiverURL(after,!stockRiver||river.selected,route):switchIndianRiverLens(after,true,route));
  };
  $('kings-ridge-lens-switch').onclick=()=>{
   const route=this.sites[this.selected].id;
   const after=ridge.selected?switchKingsRidgeLens(location.href,false,route):location.href;
   location.assign(ridge.selected||normalRidge||stockRidge?
    switchStandardKingsRidgeURL(after,!stockRidge||ridge.selected,route):switchKingsRidgeLens(after,true,route));
  };
  $('prince-landscape-switch').onclick=()=>{
   location.assign(switchPrinceLandscape(location.href,!prince.selected,this.sites[this.selected].id));
  };
  $('cavendish-package-switch').onclick=()=>location.assign(switchCavendishPackageURL(location.href,!cavePack.selected,this.sites[this.selected].id));
  $('cape-rock-switch').onclick=()=>location.assign(switchCapeTryonRockURL(location.href,!capeRock.selected,this.sites[this.selected].id));
  $('switch-scenery').onclick=()=>location.assign(switchSceneryURL(location.href,!detail,this.sites[this.selected].id));
  const choices=[...document.querySelectorAll<HTMLInputElement>('input[name="scenery-review"]')];
  const apply=$<HTMLButtonElement>('apply-scenery-reviews');
  const currentReviews=()=>new Set(choices.filter(i=>i.checked&&(!i.disabled||selectedReviews.has(i.value as ScenicReview))).map(i=>i.value as ScenicReview));
  for(const field of choices)field.onchange=()=>{
   const candidate=currentReviews();
   apply.disabled=SCENERY_REVIEWS.every(v=>candidate.has(v.flag)===selectedReviews.has(v.flag));
  };
  apply.onclick=()=>location.assign(applyReviewSceneryURL(location.href,currentReviews(),this.sites[this.selected].id));
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
 showSite(){const s=this.sites[this.selected];if(s.id!=='dalvay-lake-coastal-pass')this.setDalvayWater('other');if(s.id!=='prince-fields')this.setPrinceLowField('other');$('site-note').textContent=departureBriefing(s,location.search);$('loc-name').textContent=s.name;$('loc-county').textContent=s.region;($('site') as HTMLSelectElement).value=''+this.selected;$('cavendish-package').hidden=s.id!=='cavendish-dunelands-low'&&!cavendishPackageState(location.search).selected;$('cape-rock').hidden=s.id!==CAPE_TRYON_DEPARTURE;
  const basin=basinHeadDispatchState(location.search);
  $('basin-inlet').hidden=basin.detail||(s.id!==BASIN_HEAD_DEPARTURE&&!basin.selected);
  const river=indianRiverLensState(location.search);
  $('indian-river-lens').hidden=(!river.selected&&river.detail)||(s.id!==INDIAN_RIVER_ROUTE&&!river.selected);
  const ridge=kingsRidgeLensState(location.search);
  $('kings-ridge-lens').hidden=(!ridge.selected&&ridge.detail)||(s.id!==KINGS_RIDGE_ROUTE&&!ridge.selected);
  const prince=princeLandscapeState(location.search);
  $('prince-landscape-lens').hidden=(!prince.selected&&prince.detail)||(s.id!==PRINCE_LANDSCAPE_ROUTE&&!prince.selected);
 }
 departure(i:number){this.siteNow=this.selected=i;this.showSite();this.set('flight');}
 setCamera(v:string){this.camera=v;$('telemetry').classList.toggle('cockpit-telemetry',v==='Cockpit');$('view').innerHTML=v+' <kbd>V</kbd>';}
 private princeState='';
 setPrinceLandscapeState(s:'pending'|'ready'|'unavailable'|'playing'|'stock'|'different'){
  if(s===this.princeState)return;this.princeState=s;
  $('prince-landscape-info').textContent=s==='ready'?'Measured terrain is ready. It changes local ground contact.':
   s==='pending'?'Checking measured land. A flight started before it is ready keeps the original ground.':
   s==='unavailable'?'The original ground will be used because the preview data could not be verified.':
   s==='different'?'This preview only opens on the Prince County grassland pass.':'The measured field changes local ground contact.';
  const tip=$('ridge-flight-status');tip.hidden=s!=='stock';tip.textContent=s==='stock'?'Using Standard field ground on this flight.':'';
 }
 setDalvayWater(state:'waiting'|'ready'|'stock'|'other'){
  if(this.lakeState===state)return;this.lakeState=state;
  const note=$('dalvay-water');note.hidden=state==='other';
  note.textContent=state==='ready'?'Dalvay Lake reflections ready.':state==='waiting'?
   'Checking the lake reflections. You can begin now with the original lake appearance.':
   state==='stock'?'This flight will use the original lake appearance.':'';
 }
 private cavendishWaterState='';
 setCavendishWater(state:'waiting'|'ready'|'stock'|'other'){
  if(this.cavendishWaterState===state)return;this.cavendishWaterState=state;
  const note=$('cavendish-freshwater');
  note.hidden=state==='other';
  note.textContent=state==='ready'?'Dated freshwater ready. It changes local water contact.':
   state==='waiting'?'Checking the dated freshwater core. Begin now to keep the original terrain.':
   state==='stock'?'Freshwater was not verified. This flight will use the original terrain.':'';
 }
 private princeLowFieldState='';
 setPrinceLowField(state:'waiting'|'ready'|'stock'|'other'){
  if(this.princeLowFieldState===state)return;this.princeLowFieldState=state;
  const note=$('prince-low-field');note.hidden=state==='other';
  note.textContent=state==='ready'?'Mapped field detail ready. Terrain and flight contact are unchanged.':state==='waiting'?
   'Checking mapped field detail. You can begin now with the original ground appearance.':
   state==='stock'?'This flight will use the original ground appearance.':'';
 }
 private knightState='';
 setKnightExterior(state:'waiting'|'ready'|'stock'|'other'){
  if(this.knightState===state)return;this.knightState=state;
  const note=$('knight-exterior');note.hidden=state==='other';
  note.textContent=state==='ready'?'Knight Point lighthouse ready. Turn east to see it.':state==='waiting'?
   'Checking the lighthouse. Begin now for the original tower this flight.':
   state==='stock'?'This flight will use the original tower.':'';
 }
 setIndianRiverStandard(state:'waiting'|'ready'|'stock'){
  if(this.riverState===state)return;this.riverState=state;
  $('indian-river-lens-info').textContent=state==='ready'?'Surveyed church and ground ready. This changes local ground contact.':
   state==='waiting'?'Checking the surveyed church and ground. Begin now to keep the original terrain for this flight.':
   'The survey could not be verified. Begin flight will use the original terrain.';
 }
 setOlearyIndustrial(state:'inactive'|'checking'|'ready'){
  if(this.industrialState===state)return;this.industrialState=state;
  const note=$('oleary-survey');
  note.hidden=state==='inactive';
  note.textContent=state==='ready'?'Surveyed railway-side building ready.':state==='checking'?
   'Checking the surveyed railway-side building. You can begin now with the original building.':'';
 }
 private olearyStationState='';
 setOlearyStation(state:'inactive'|'checking'|'ready'|'stock'){
  if(this.olearyStationState===state)return;this.olearyStationState=state;
  const note=$('oleary-station');note.hidden=state==='inactive';
  note.textContent=state==='ready'?'O’Leary Railway Station exterior ready.':state==='checking'?
   'Checking the railway station exterior. Begin now to keep the original station.':
   state==='stock'?'This flight will use the original station.':'';
 }
 setKingsRidgeState(state:'pending'|'ready'|'unavailable'|'playing'|'stock'|'different'){
  if(this.ridgeState===state)return;this.ridgeState=state;
  const status=$('kings-ridge-lens-info'),flight=$('ridge-flight-status');
  status.textContent=state==='ready'?'Measured terrain is ready. It changes local ground contact.':
   state==='pending'?'Checking the measured terrain. If you fly before it is ready, this flight keeps Standard ground.':
   state==='unavailable'?'Measured terrain could not be verified. Begin flight will use Standard ground.':
   state==='different'?'The separate preview is only available on Kings County · coastal ridge pass.':
   'The measured ridge changes local ground contact.';
  flight.hidden=state!=='stock';flight.textContent=state==='stock'?'Using original ridge ground on this flight.':'';
 }
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
   modal.innerHTML=closer+`<span class="eyebrow">NAVIGATION / PEI</span><h2>Flight atlas</h2><canvas id="chart" width="760" height="378"></canvas><label class="eyebrow" for="map-site">REPOSITION AIRCRAFT</label><select id="map-site">${this.sites.map((s,i)=>`<option value="${i}">${s.name}</option>`).join('')}</select><button id="fly-here" class="gold">Fly from here <span>↗</span></button>`;
   ($('map-site') as HTMLSelectElement).value=''+this.siteNow;$('fly-here').onclick=()=>this.actions.start(Number(($('map-site') as HTMLSelectElement).value));
  }
  if(mode==='credits')modal.innerHTML=closer+`<span class="eyebrow">CHART NOTES / SOURCES</span><h2>About this atlas</h2><p>Mapped farmland uses Agriculture and Agri-Food Canada’s <a href="https://open.canada.ca/data/en/dataset/b3dba669-6611-4cb1-b4be-6c317b9908ad" target="_blank" rel="noopener noreferrer">2023 field boundaries</a> and <a href="https://open.canada.ca/data/en/dataset/89073037-d2fc-4a6d-9ce9-f0b1bcb48745" target="_blank" rel="noopener noreferrer">2025 Annual Crop Inventory</a> under the Open Government Licence – Canada. The generic <a href="https://polyhaven.com/a/farm_furrows" target="_blank" rel="noopener noreferrer">Farm Furrows scan</a> is Poly Haven CC0 material, not a photograph of these fields.</p><p>Contains modified Copernicus Sentinel data 2025. Natural-colour imagery is a multi-date satellite mosaic. Terrain: Natural Resources Canada, CanElevation. Province shoreline: Statistics Canada, 2021 Census, with a localized Quartermaster Marina correction.</p><p>Contains information licensed under the <a href="https://open.canada.ca/en/open-government-licence-canada" target="_blank" rel="noreferrer">Open Government Licence – Canada</a>. National Road Network: Statistics Canada. Building outlines and roof heights: Natural Resources Canada, PEI 2020 LiDAR survey. Building façades and roof forms are inferred, not photographed. St. Dunstan’s Basilica, the Confederation Bridge and the East and West Point light stations are original approximate exterior models. Nearby New Brunswick and Nova Scotia terrain provides non-playable shoreline context. Other runway thresholds: OurAirports, public domain. CYYG 10/28 centreline, Quartermaster Marina shoreline and floating docks, selected residential building types, mapped sidewalks, Water Street and Victoria Row building parts, Montague bridgehead registration, mapped parking surface outlines, and Spinnakers’ Landing pier and buildings: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>, <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">ODbL 1.0</a>. The <a href="https://github.com/cheshmakzanoon-ops/PEI-Flight-simulation/tree/main/data/odbl/residential" target="_blank" rel="noreferrer">adapted residential source data</a> and <a href="https://github.com/cheshmakzanoon-ops/PEI-Flight-simulation/tree/main/data/odbl/sidewalks" target="_blank" rel="noreferrer">mapped sidewalk data</a> and <a href="https://github.com/cheshmakzanoon-ops/PEI-Flight-simulation/tree/main/data/odbl/water-street" target="_blank" rel="noreferrer">Water Street reference geometry</a>, <a href="https://github.com/cheshmakzanoon-ops/PEI-Flight-simulation/tree/main/data/odbl/victoria-row" target="_blank" rel="noreferrer">Victoria Row reference geometry</a>, the <a href="https://github.com/cheshmakzanoon-ops/PEI-Flight-simulation/tree/main/data/odbl/montague-bridgehead" target="_blank" rel="noreferrer">Montague Town Hall registration subset</a>, the <a href="https://github.com/cheshmakzanoon-ops/PEI-Flight-simulation/tree/main/data/odbl/montague-macdonald" target="_blank" rel="noreferrer">Montague 571 Main Street registration subset</a>, and <a href="https://github.com/cheshmakzanoon-ops/PEI-Flight-simulation/tree/main/data/odbl/parking-surfaces" target="_blank" rel="noreferrer">parking surface data</a>, together with the <a href="https://github.com/cheshmakzanoon-ops/PEI-Flight-simulation/tree/main/data/odbl/spinnakers" target="_blank" rel="noreferrer">Spinnakers’ Landing plan</a>, are available under the same licence. The optional <a href="https://github.com/cheshmakzanoon-ops/PEI-Flight-simulation/tree/main/data/odbl/adaptive-relief" target="_blank" rel="noreferrer">inland relief selection data</a> include a separately licensed eligibility mask; measured 16 m elevations are from NRCan. <a href="https://dataspace.copernicus.eu/terms-and-conditions" target="_blank" rel="noreferrer">Copernicus terms</a>.</p><p>The optional Basin Head scenes use the <a href="https://github.com/cheshmakzanoon-ops/PEI-Flight-simulation/tree/main/data/odbl/basin-head-channel" target="_blank" rel="noreferrer">Basin Head inlet and wharf plan sources</a> (© OpenStreetMap contributors, ODbL) and NRCan’s 2020 CanElevation survey under the Open Government Licence – Canada.</p><p>The main Confederation Trail ground layer uses <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>, <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">ODbL 1.0</a>. The <a href="https://github.com/cheshmakzanoon-ops/PEI-Flight-simulation/tree/main/data/odbl/confederation-trail" target="_blank" rel="noreferrer">adapted route database</a> includes the retained mapped strips and exclusions. It is not a continuous route or access guide.</p><p>Close paved surfaces use <a href="https://polyhaven.com/a/asphalt_track" target="_blank" rel="noreferrer">Asphalt Track</a> and <a href="https://polyhaven.com/a/asphalt_07" target="_blank" rel="noreferrer">Asphalt 07</a> (Poly Haven, CC0); they are not local pavement surveys. Metre-scale coordinates do not imply metre-resolution scenery. The terrain and coastline mask are sampled at roughly 47 m; the near satellite imagery is about 10 m per pixel. Sky environment: Greg Zaal and Jarod Guest, <a href="https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky" target="_blank" rel="noreferrer">Poly Haven</a> (CC0); it represents lighting, not current PEI weather. © ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium. <a href="https://doi.org/10.5281/zenodo.7254221" target="_blank" rel="noreferrer">WorldCover 2021 v200</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. Forest classes are measured; individual trees and field detail are inferred. Selected stand heights use PEI Enhanced Forest Inventory 2020. Contains information licensed under the <a href="https://www.princeedwardisland.ca/en/information/finance/open-government-licence-prince-edward-island" target="_blank" rel="noreferrer">Open Government Licence – Prince Edward Island</a>. Not for real navigation.</p>`;
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
   for(const site of this.sites.filter(s=>!s.runway)){const [x,y]=coord(site.lon,site.lat);g.strokeStyle='#f1c074';g.beginPath();g.arc(x,y,4,0,Math.PI*2);g.stroke();}
   const ll=geographic(f.x,f.z),[x,y]=coord(ll.lon,ll.lat);g.save();g.translate(x,y);g.rotate(f.heading);g.beginPath();g.moveTo(0,-10);g.lineTo(6,6);g.lineTo(0,3);g.lineTo(-6,6);g.closePath();g.fillStyle='#fff';g.fill();g.restore();
  }
 }
}
