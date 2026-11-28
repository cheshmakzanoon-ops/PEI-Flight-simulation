import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
import {SITES} from '../src/sim/places.ts';
import {project} from '../src/sim/geo.ts';
import {ForestStream} from '../src/sim/forest-stream.ts';
import {DISPATCH_STAND,PRINCE_DISPATCH_STAND,DispatchStand,dispatchStandPlan,dispatchStandPlanSeated,type DispatchStandPlan} from '../src/render/dispatch-stand-height.ts';

const p=PRINCE_DISPATCH_STAND,k=DISPATCH_STAND,at=(q:DispatchStandPlan)=>SITES.find(s=>s.id===q.route)!;
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
test('exact two declared routes; Prince signed shape aperture is outside the original Miscouche companion',()=>{
 assert(Object.isFrozen(p)&&Object.isFrozen(k));
 assert.equal(dispatchStandPlan(at(p)),p);assert.equal(dispatchStandPlan(at(k)),k);
 for(const key of ['lon','lat','heading','height'] as const)assert.equal(dispatchStandPlan({...at(p),[key]:at(p)[key]+1e-6}),undefined,key);
 for(const id of ['prince-woodland-view','miscouche-woodlot-pass','queens-meadow-low','prince-fields','prince-mapped-farmland-pass'])
  assert.equal(dispatchStandPlan(SITES.find(s=>s.id===id)),undefined,id);
 const s=project(p.lon,p.lat);
 assert(dispatchStandPlanSeated(p,s.x,s.z,1530));
 assert(!dispatchStandPlanSeated(p,s.x+.0001,s.z,1530));
 assert(!dispatchStandPlanSeated(p,s.x,s.z,1530.0001));
 assert(!dispatchStandPlanSeated({...p},s.x,s.z,1530));
 assert(!dispatchStandPlanSeated(p,-53778.10046418605,5740.396270232558,1530));
});

test('route, ordinal and ready result are a single Begin token; no old bookmark, stale route or same-menu resurrection',()=>{
 const kId=SITES.indexOf(at(k)),pId=SITES.indexOf(at(p)),deny=()=>assert.fail('unexpected preparation or take');
 const d=new DispatchStand<string>(pId);
 d.select(pId,p.route);d.prepare(pId,deny);assert(!d.begin(pId,true,deny));
 d.select(kId,k.route);d.prepare(kId,q=>{assert.equal(q,k);return 'k';});
 d.select(pId,p.route);assert.equal(d.state,'waiting');d.prepare(kId,deny);
 assert(!d.begin(pId,true,deny)); // clicked before Prince response; old Kings not carried
 d.prepare(pId,deny);d.select(pId,p.route);d.prepare(pId,deny);
 d.select(kId,k.route);d.select(pId,p.route);
 d.prepare(pId,plan=>{assert.equal(plan,p);return 'p';});
 assert(!d.begin(pId,false,deny)); // map/crash/toolbar path
 d.select(kId,k.route);d.select(pId,p.route);
 d.prepare(pId,()=>false);assert.equal(d.state,'stock');d.prepare(pId,deny);assert(!d.begin(pId,true,deny));
 d.select(kId,k.route);d.select(pId,p.route);d.prepare(pId,plan=>plan===p?'p':false);
 assert(d.begin(pId,true,(result,plan)=>result==='p'&&plan===p));
 d.leave(pId);assert.equal(d.state,'other');d.select(pId,p.route);d.prepare(pId,deny);
 d.select(kId,k.route);d.prepare(kId,plan=>plan===k?'k':false);
 assert(d.begin(kId,true,(result,plan)=>result==='k'&&plan===k));
});
test('actual UI hides old ready state synchronously on both cross-county selections before an immediate Begin',()=>{
 const source=readFileSync(new URL('../src/app/ui.ts',import.meta.url),'utf8'),begin="  $('site').onchange=",end="  $('start').onclick=";
 assert.equal(source.split(begin).length,2);assert.equal(source.split(end).length,2);
 const handler=source.slice(source.indexOf(begin),source.indexOf(end)).replace("($('site') as HTMLSelectElement)","$('site')");
 const run=new Script('(function(){'+handler+'}).call(ui);');
 for(const [old,next] of [[k,p],[p,k]] as const){
  const oldI=SITES.indexOf(at(old)),nextI=SITES.indexOf(at(next)),events:string[]=[];
  const d=new DispatchStand<string>(-1);
  d.select(oldI,old.route);d.prepare(oldI,()=> 'old ready');assert.equal(d.state,'ready');
  const e={value:String(nextI),onchange:()=>{}};
  const ui={selected:oldI,setDispatchWoodland:(s:string)=>events.push(s),showSite:()=>events.push('update site'),
   actions:{chooseDeparture(i:number){assert.equal(i,nextI);assert.deepEqual(events,['other']);d.select(i,next.route);}}};
  run.runInNewContext({ui,$:(id:string)=>{assert.equal(id,'site');return e;}});e.onchange();
  assert.equal(ui.selected,nextI);assert.deepEqual(events,['other','update site']);
  assert.equal(d.state,'waiting');assert(!d.begin(nextI,true,()=>assert.fail('old ready must not be taken')));
 }
 // A mode change must clear the badge before Dispatch becomes visible, not
 // first on a future RAF. Scope this source guard to the actual UI method.
 const start=' set(mode:Mode){',stop='this.input.clear();';
 const a=source.indexOf(start),z=source.indexOf(stop,a);assert(a>=0&&z>a);
 const runMode=new Script('(function(mode){'+source.slice(a+start.length,z)+'}).call(ui,next);');
 for(const [previous,next,events] of [
  ['paused','dispatch',['badge:paused','transition:paused>dispatch:dispatch']],
  ['dispatch','help',['transition:dispatch>help:help']],
  ['dispatch','flight',['transition:dispatch>flight:flight']],
  ['dispatch','dispatch',[]]
 ] as const){
  const seen:string[]=[];
  const ui={mode:previous,setDispatchWoodland(mark:string){assert.equal(mark,'other');seen.push('badge:'+this.mode);},
   actions:{modeChanged(from:string,to:string){seen.push('transition:'+from+'>'+to+':'+ui.mode);}}};
  runMode.runInNewContext({ui,next});assert.equal(ui.mode,next);assert.deepEqual(seen,events);
 }
});

const prefix=new URL('../public/world/woodland/stream-v1/',import.meta.url);
function stockTransport(mode:'range'|'full'|'corrupt'){
 const known=new Map<string,Buffer>();const get=(n:string)=>{let b=known.get(n);if(!b){b=readFileSync(new URL(n,prefix));known.set(n,b);}return b;};
 const index=get('index.json');assert.equal(sha(index),'5878c49f6a6c2cb896606c07be2d2943586edad10f45871116d36ef88d716efe');
 let exactRange=0,readCount=0;
 const fetcher=(async(url:string,opts?:RequestInit)=>{
  readCount++;const file=new URL(url).pathname.split('/').at(-1)!;const b=get(file);
  if(file==='index.json')return new Response(new Uint8Array(b));
  const r=new Headers(opts?.headers).get('range')!,m=/^bytes=(\d+)-(\d+)$/.exec(r);assert(m);
  let a=new Uint8Array(b.subarray(+m[1],+m[2]+1));
  if(file==='heights-03.pack'&&r==='bytes=47309-78870'){
   exactRange++;
   assert.equal(sha(a),'c541961bf48163c9adc944e38d0201000d43840ac4277d9b15f3ae73af8f0485');
   if(mode==='full')return new Response(new Uint8Array(b));
   if(mode==='corrupt')a[110]^=1;
  }
  return new Response(a,{status:206,headers:{'content-range':`bytes ${m[1]}-${m[2]}/${b.length}`}});
 }) as typeof fetch;
 return {fetcher,seen:()=>exactRange,reads:()=>readCount};
}
for(const kind of ['range','full','corrupt'] as const)test(`Prince stock loader ${kind}: only already verified source may prepare`,async()=>{
 const t=stockTransport(kind),f=new ForestStream('https://fixture.invalid/',t.fetcher),root=project(p.lon,p.lat);
 await f.warm(root.x,root.z,4000);assert.equal(f.state.active,p.owner);assert(t.seen()>0);
 const before=t.reads(),view=f.captureHeightPlan(p.owner,p.sha256);
 if(kind==='corrupt'){assert.equal(view,undefined);assert(f.heightPlanUnavailable(p.owner,p.sha256));return;}
 assert(view);assert(!f.heightPlanUnavailable(p.owner,p.sha256));
 let have=0;
 for(let z=-600;z<=600;z+=100)for(let x=-600;x<=600;x+=100){
  const a=root.x+x,b=root.z+z;if(!view.contains(a,b))continue;
  const H=view.height(a,b,.43);assert.equal(H,f.height(a,b,0,.43));if(H>0)have++;
 }
 assert(have>18);assert.equal(view.height(root.x-11000,root.z,.4),0);assert.equal(f.captureHeightPlan(p.owner,k.sha256),undefined);
 assert.equal(t.reads(),before,'the Dispatch claim reads no additional pack');
});
