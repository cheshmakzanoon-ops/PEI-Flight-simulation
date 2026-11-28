import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {SITES} from '../src/sim/places.ts';
import {project} from '../src/sim/geo.ts';
import {treeRandom,TREE_PITCH} from '../src/sim/tree-layout.ts';
import {standardDispatchWoodlandRequested,standardRegionalCanopyRequested,sceneryOptions} from '../src/app/scenery-profile.ts';
import {DISPATCH_STAND,PRINCE_DISPATCH_STAND,DispatchStand,dispatchStandPlan,dispatchStandPlanSeated,prepareStandReplacement} from '../src/render/dispatch-stand-height.ts';
import {QUEENS_DISPATCH_STAND as q,QUEENS_DISPATCH_QUIET_BOX as quiet,QUEENS_REGIONAL_BOX as peer,
 QUEENS_REGIONAL_ROSTER,queensDispatchAdmits,queensDispatchHeightView,queensDispatchStandProfile,sameQueensRegionalWords} from '../src/render/queens-dispatch-contract.ts';

const launch=SITES.find(s=>s.id===q.route)!;
test('only the exact Queens low route can start an exact seated plan distinct from neighboring passes',()=>{
 assert(Object.isFrozen(q)&&Object.isFrozen(peer)&&Object.isFrozen(quiet));
 assert.equal(dispatchStandPlan(launch),q);
 for(const k of ['lon','lat','heading','height'] as const)assert.equal(dispatchStandPlan({...launch,[k]:launch[k]+1e-9}),undefined);
 for(const id of ['queens-meadow-low','queens-fields','queens-canopy-pass','kings-canopy-pass','kings-woodland-view','prince-woodland-view'])
  assert.equal(dispatchStandPlan({...launch,id}),undefined,id);
 const p=project(q.lon,q.lat);
 assert(dispatchStandPlanSeated(q,p.x,p.z,1530));
 for(const args of [[p.x+.001,p.z,1530],[p.x,p.z-.001,1530],[p.x,p.z,1530.001],[p.x,p.z,0],[p.x,p.z,NaN]] as const)
  assert(!dispatchStandPlanSeated(q,...args));
 assert(!dispatchStandPlanSeated({...q},p.x,p.z,1530));
});

test('Queens is a raw Standard route only, not a new behavior on existing optional woodland/stock variants',()=>{
 for(const s of ['', 'scenery=standard', 'scenery=&diagnostics', 'departure=queens-woodland-view&diagnostics']){
  const opts=new URLSearchParams(s);
  assert(queensDispatchStandProfile(opts)&&standardDispatchWoodlandRequested(opts));assert(standardRegionalCanopyRequested(sceneryOptions(s)));
 }
 for(const s of [
  'scenery=detail','scenery=unknown','scenery=standard&scenery=standard','diagnostics&diagnostics',
  'departure=x&departure=x','stockRegionalCanopy','stockCanopyLight','stockForestFloor','stockDispatchWoodland',
  'woodlandView','woodland3D','woodlandCrownBase','woodlandBark','forestFloor','sceneryObserver',
  'woodland3D&stockWoodlandVolumeCull','regionalCanopyStudy','seatedForestShadows','buildingShadows',
  'mappedLaneCanopyStudy','kingsDryCrownStudy','surveyRelief','inlandRelief','canopyLight','northCapeStandReview','qa','unknown=',
 ])assert(!queensDispatchStandProfile(new URLSearchParams(s)),s);
 // These remain unchanged recognized comparators on the old P/K mechanism.
 for(const s of ['stockRegionalCanopy','stockForestFloor','stockCanopyLight','stockWoodlandVolumeCull'])
  assert(standardDispatchWoodlandRequested(new URLSearchParams(s)),s);
});

test('borrowed verified owner is additionally restricted and both quiet edges are closed',()=>{
 const spy:number[][]=[];
 const source={id:q.owner,sha256:q.sha256,contains:()=>true,height:(...v:number[])=>{spy.push(v);return 22}};
 assert(!queensDispatchHeightView({...source,id:'14-13'}));
 assert(!queensDispatchHeightView({...source,sha256:'0'.repeat(64)}));
 const admitted=queensDispatchHeightView(source);assert(admitted&&Object.isFrozen(admitted));
 const inside=[(peer[0]+peer[2])*.5,(peer[1]+peer[3])*.5] as const;
 const [w,n,e,s]=quiet;
 for(const p of [inside,[w,n],[e,s],[w+1e-9,s-1e-9],[e,n],[e,inside[1]],[inside[0],s],
  [-18279.09250031408,11000],[-12186.061666875947,11000],[-13400,9499.21988442310],[-13400,15360.440664173511],
  [Infinity,11000],[NaN,11000]] as [number,number][]){
  assert(!queensDispatchAdmits(...p));assert(!admitted.contains(...p));assert.equal(admitted.height(...p,.5),0);
 }
 assert.equal(spy.length,0);
 for(const p of [[w-1e-8,inside[1]],[e+1e-8,inside[1]],[inside[0],n-1e-8],[inside[0],s+1e-8]] as const){
  assert(queensDispatchAdmits(...p));assert(admitted.contains(...p));assert.equal(admitted.height(...p,.5),22);
 }
 assert.equal(spy.length,4);
 const veto=queensDispatchHeightView({...source,contains:()=>false})!;
 assert(!veto.contains(e+1,inside[1]));assert.equal(veto.height(e+1,inside[1],.5),0);assert.equal(spy.length,4);
});

test('original H/W-only replacement skips quiet, neighboring and undefined roots, retaining their exact words',()=>{
 const row=(i:number,j:number)=>{
  const x=(i+treeRandom(i,j,11))*TREE_PITCH,z=(j+treeRandom(i,j,84))*TREE_PITCH;
  const h=8.2+treeRandom(i,j,35)*10.8,w=h*(.83+treeRandom(i,j,9)*.35);
  return [x,38.5,z,h,w,2,1.04,.12];
 };
 const steps=[row(-1130,917),row(-1110,917),row(-1109,917),row(-1015,917)];
 assert(!queensDispatchAdmits(steps[0][0],steps[0][2]),'actual quiet seed');
 assert(queensDispatchAdmits(steps[1][0],steps[1][2])&&queensDispatchAdmits(steps[2][0],steps[2][2]),'two unprotected q13 true seeds');
 assert(!queensDispatchAdmits(steps[3][0],steps[3][2]),'neighbor owner');
 const source=queensDispatchHeightView({id:q.owner,sha256:q.sha256,contains:()=>true,
  height:x=>x>steps[1][0]+1?0:20})!;
 const p=project(q.lon,q.lat),stock=Float32Array.from(steps.flat());
 const r=prepareStandReplacement(source,stock,p.x,p.z,1530);
 assert(r&&r.count===1);
 for(let k=0;k<stock.length;k++)if(k!==11&&k!==12)assert.equal(r.alternate[k],stock[k],k.toString());
 assert.equal(r.alternate[11],20);assert.notEqual(r.alternate[12],stock[12]);
});

test('peer custody checks count, order and all 5 verbatim Float32 words including zero sign',()=>{
 const a=new Uint32Array(QUEENS_REGIONAL_ROSTER*5),b=a.slice();
 assert(sameQueensRegionalWords(a.buffer,b.buffer));
 assert(!sameQueensRegionalWords(a.buffer,new ArrayBuffer(a.byteLength-20)));
 assert(!sameQueensRegionalWords(undefined,b.buffer));assert(!sameQueensRegionalWords(a.buffer,undefined));
 b[3]=0x80000000;assert(!sameQueensRegionalWords(a.buffer,b.buffer));
 b[3]=0;b[1]=32;b[6]=45;a[1]=45;a[6]=32;assert(!sameQueensRegionalWords(a.buffer,b.buffer));
});

test('manual Queens ready/use, same task early, bookmarks and old-route claims retain their identities',()=>{
 const qi=SITES.indexOf(launch),ki=SITES.findIndex(s=>s.id===DISPATCH_STAND.route),pi=SITES.findIndex(s=>s.id===PRINCE_DISPATCH_STAND.route);
 const stand=new DispatchStand<string>(qi);const reject=()=>assert.fail('old or out-of-scope code unexpectedly called');
 stand.select(qi,q.route);stand.prepare(qi,reject);assert(!stand.begin(qi,true,reject)); // direct bookmark
 stand.select(pi,PRINCE_DISPATCH_STAND.route);stand.prepare(pi,plan=>{assert.equal(plan,PRINCE_DISPATCH_STAND);return 'prince';});
 stand.select(qi,q.route);assert.equal(stand.state,'waiting');stand.prepare(pi,reject);
 assert(!stand.begin(qi,true,reject));stand.prepare(qi,reject); // no late source
 stand.select(ki,DISPATCH_STAND.route);stand.select(qi,q.route);stand.prepare(qi,plan=>{assert.equal(plan,q);return 'queens';});
 assert(!stand.begin(qi,false,reject)); // the inherited non-Dispatch paths remain stock
 stand.select(ki,DISPATCH_STAND.route);stand.select(qi,q.route);stand.prepare(qi,plan=>{assert.equal(plan,q);return 'queens';});
 assert(stand.begin(qi,true,(token,plan)=>token==='queens'&&plan===q));
 stand.leave(qi);stand.select(qi,q.route);stand.prepare(qi,reject);assert.equal(stand.state,'other');
 stand.select(ki,DISPATCH_STAND.route);stand.prepare(ki,plan=>{assert.equal(plan,DISPATCH_STAND);return 'k';});
 assert(stand.begin(ki,true,(token,plan)=>token==='k'&&plan===DISPATCH_STAND));
});

test('unchanged real UI removes old ready synchronously on switches to and from Queens',()=>{
 const code=readFileSync(new URL('../src/app/ui.ts',import.meta.url),'utf8'),from="  $('site').onchange=",to="  $('start').onclick=";
 assert.equal(code.split(from).length,2);assert.equal(code.split(to).length,2);
 const body=code.slice(code.indexOf(from),code.indexOf(to)).replace("($('site') as HTMLSelectElement)","$('site')");
 const fn=new Script('(function(){'+body+'}).call(ui)');
 for(const [a,b] of [[DISPATCH_STAND,q],[q,DISPATCH_STAND],[PRINCE_DISPATCH_STAND,q],[q,PRINCE_DISPATCH_STAND]] as const){
  const i=SITES.findIndex(s=>s.id===a.route),j=SITES.findIndex(s=>s.id===b.route),rec:string[]=[];
  const stand=new DispatchStand<string>(-1);stand.select(i,a.route);stand.prepare(i,()=> 'old ready');assert.equal(stand.state,'ready');
  const el={value:String(j),onchange:()=>{}};
  const ui={selected:i,setDispatchWoodland:(s:string)=>rec.push(s),showSite:()=>rec.push('site'),
    actions:{chooseDeparture(k:number){assert.deepEqual(rec,['other']);stand.select(k,b.route);}}};
  fn.runInNewContext({ui,$:()=>el});el.onchange();
  assert.equal(ui.selected,j);assert.deepEqual(rec,['other','site']);
  assert(!stand.begin(j,true,()=>assert.fail('new route cannot take the old route result')));
 }
});
