import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Vector3} from 'three';
import {sceneryOptions,standardRusticoLighthouseRequested,rusticoHarbourRoofRequested,runway03PavementRequested,standardOpenCoastRequested} from '../src/app/scenery-profile.ts';
import {RusticoStandardFlight,standardRusticoLayers} from '../src/render/north-rustico/flight.ts';

const near=new Vector3(-7050,67,4980), low=near.clone().setY(10);
function rig(){
 const calls:string[]=[];
 let installed=false,visible=false,allowArt=true,allowSeat=true;
 const world={
  scene:{},
  standardRusticoGroundActive:()=>installed,
  stageStandardRusticoNear:()=>{calls.push('stage');return allowSeat;},
  setStandardRusticoGround:(yes:boolean)=>{installed=yes;calls.push(yes?'seat-on':'seat-off');return yes;},
  dropStandardRusticoGround:()=>{if(installed){calls.push('seat-off');installed=false;}},
 };
 const art={
  get state(){return {visible,seat:visible?'verified':'unverified'};},
  hide(){if(visible)calls.push('art-off');visible=false;},
  update(){visible=allowArt&&installed;if(visible)calls.push('art-on');},
 };
 const subject=new RusticoStandardFlight(world as never,'local','test');
 subject.qualifyLayers(true);
 const fake=subject as unknown as {phase:string;assets:{ground:{affectsBounds:()=>boolean};assembly:()=>typeof art}};
 fake.phase='ready';
 fake.assets={ground:{affectsBounds:()=>true},assembly:()=>art};
 const observe=()=>[installed,visible,subject.state.visible];
 return {subject,calls,observe,failArt:()=>{allowArt=false;},failSeat:()=>{allowSeat=false;}};
}
test('admission is isolated from the explicit legacy review and only vetoes the new default',()=>{
 const base='?departure=north-rustico-harbour-low&diagnostics';
 const own='&stockRusticoLighthouse';
 assert.equal(standardRusticoLighthouseRequested(sceneryOptions(base)),true);
 for(const tail of [own,'&scenery=detail','&qa','&scenery=standard&scenery=standard',
  '&northRusticoLighthouseStudy','&buildingShadows','&unknownOtherLayer']){
  assert.equal(standardRusticoLighthouseRequested(sceneryOptions(base+tail)),false,tail);
 }
 const explicit=sceneryOptions(base+own+'&northRusticoLighthouseStudy');
 assert.equal(explicit.has('northRusticoLighthouseStudy'),true);
 assert.equal(standardRusticoLighthouseRequested(explicit),false);
 for(const fn of [rusticoHarbourRoofRequested,runway03PavementRequested,standardOpenCoastRequested])
  assert.equal(fn(sceneryOptions(base)),fn(sceneryOptions(base+own)),fn.name);
});
test('measured seat and original scene art enter together, survive contact stop, and clear for reposition',()=>{
 const r=rig();
 r.subject.before(true,true,true,false,near,near);
 assert.deepEqual(r.observe(),[true,true,true]);
 assert.deepEqual(r.calls,['stage','seat-on','art-on']);
 // A frame has changed from flight to contact/stop after consuming this seat.
 r.subject.after(true,true,low);
 r.subject.before(true,true,false,false,low,low);
 assert.deepEqual(r.observe(),[true,true,true]);
 assert.equal(r.calls.filter(k=>k==='seat-off').length,0);
 r.subject.clear(); // called before spawning the next route
 assert.deepEqual(r.observe(),[false,false,false]);
 assert.deepEqual(r.calls.slice(-2),['art-off','seat-off']);
});
test('unmounted pause/stop, low intersecting aircraft and no route cannot install',()=>{
 const r=rig();
 r.subject.before(true,true,false,false,near,near);
 r.subject.before(true,true,true,false,low,low);
 r.subject.before(false,true,true,false,near,near);
 r.subject.before(true,false,false,true,near,near);
 assert.deepEqual(r.observe(),[false,false,false]);
 assert.deepEqual(r.calls,[]);
});
test('failed preflight or invisible art restores the stock seat before physics',()=>{
 const r=rig();
 r.failSeat();
 r.subject.before(true,true,true,false,near,near);
 assert.deepEqual(r.observe(),[false,false,false]);
 assert.deepEqual(r.calls,['stage']);
 const q=rig();
 q.failArt();
 q.subject.before(true,true,true,false,near,near);
 assert.deepEqual(q.observe(),[false,false,false]);
 assert.deepEqual(q.calls,['stage','seat-on','seat-off']);
});


test('pending or drifted road, building and pedestrian sources do not start local authentication',()=>{
 const w={dropStandardRusticoGround:()=>{}};
 const pending=new RusticoStandardFlight(w as never,'local','test');
 pending.before(true,false,false,true,near,near);
 assert.equal(pending.state.phase,'idle');
 pending.qualifyLayers(false);
 pending.before(true,false,false,true,near,near);
 assert.equal(pending.state.phase,'held');
 assert.equal(pending.state.requests,0);
 assert.equal(standardRusticoLayers(undefined,undefined,undefined,undefined),false);
});

test('late ready assets miss the close-pass window until a new departure',()=>{
 const r=rig();
 r.subject.before(true,false,false,true,near,near);
 const past=near.clone().setX(near.x-221);
 r.subject.before(true,true,true,false,past,past);
 assert.equal(r.subject.state.deferredByProgress,true);
 assert.deepEqual(r.observe(),[false,false,false]);
 r.subject.clear();
 r.subject.before(true,true,true,false,near,near);
 assert.equal(r.subject.state.deferredByProgress,false);
 assert.deepEqual(r.observe(),[true,true,true]);
});
