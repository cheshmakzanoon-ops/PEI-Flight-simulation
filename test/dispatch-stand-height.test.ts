import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DISPATCH_STAND,DispatchStand,exactStandSeed,prepareStandReplacement,type SignedHeightView} from '../src/render/dispatch-stand-height.ts';
import {standardCountyOrtho,standardDispatchWoodlandRequested} from '../src/app/scenery-profile.ts';
import {treeRandom} from '../src/sim/tree-layout.ts';
import {ForestStream} from '../src/sim/forest-stream.ts';
import {project} from '../src/sim/geo.ts';

const q=DISPATCH_STAND;
const p=(s:string)=>new URLSearchParams(s);
test('ordinary Standard may prepare, but its own veto is inert to other Standard comparators',()=>{
 for(const x of ['', 'diagnostics&departure=other','scenery=standard&stockRusticoLighthouse'])
  assert(standardDispatchWoodlandRequested(p(x)));
 for(const x of ['stockDispatchWoodland', 'qa', 'scenery=detail','scenery=standard&scenery=standard','woodland3D',
  'canopyLight','sourisKnightExterior','quartermasterQuayStudy','forestFloor','unknown'])
  assert(!standardDispatchWoodlandRequested(p(x)),x);
 assert.equal(standardCountyOrtho(p('departure=souris-waterfront-pass&diagnostics&stockDispatchWoodland')),
  standardCountyOrtho(p('departure=souris-waterfront-pass&diagnostics')));
});
test('only a changed manual selection may prepare, even when a bookmark is selected initially',()=>{
 const s=new DispatchStand<string>(1);let calls=0;
 s.select(1,q.route);s.prepare(1,()=>{calls++;return 'stale';});
 assert.equal(calls,0);assert(!s.begin(1,true,()=>true));
 s.select(2,'other');s.select(1,q.route);assert.equal(s.state,'waiting');
 s.prepare(1,()=>undefined);assert.equal(s.state,'waiting');
 s.prepare(1,()=> 'signed');assert.equal(s.state,'ready');
 assert(s.begin(1,true,claim=>claim==='signed'));assert.equal(s.state,'active');
 assert(!s.begin(1,false,()=>true));
});
test('same-task Begin, unknown/missing source, and post-click data keep existing behavior',()=>{
 for(const stage of ['none','fresh','rejected'] as const){
  const s=new DispatchStand<object>(0);
  if(stage!=='none'){s.select(1,q.route);s.prepare(1,()=>stage==='fresh'?undefined:false);}
  assert(!s.begin(1,stage!=='none',()=>true));
  s.select(1,q.route);s.prepare(1,()=>{throw Error('late source');});
  assert.equal(s.state,'other');
 }
});
test('wrong route or map/crash cannot inherit a ready cohort, and stale selection cannot stage',()=>{
 const s=new DispatchStand<number>(0);
 s.select(1,q.route);s.prepare(1,()=>3);s.select(2,'other');
 s.prepare(1,()=>{throw Error('wrong selection');});
 assert(!s.begin(2,true,()=>true));
 s.select(1,q.route);s.prepare(1,()=>4);
 assert(!s.begin(1,false,()=>{throw Error('map or crash');}));
 s.select(0,'other');s.select(1,q.route);s.prepare(1,()=>5);
 assert(!s.begin(1,true,()=>false));assert.equal(s.state,'other');
});
function root(i:number,j:number){
 const x=(i+treeRandom(i,j,11))*12,z=(j+treeRandom(i,j,84))*12;
 const y=72.3;
 return {x,z,i,j,a:[x,y,z,12.1,13.2,2,.71,treeRandom(i,j,62)]};
}
test('original double jitter is recovered despite exact rounding to next F32 grid cell',()=>{
 const r=root(6043,650);
 assert.equal(Math.fround(r.x),72528);assert.equal(Math.floor(Math.fround(r.x)/12),6044);
 assert.deepEqual(exactStandSeed(Math.fround(r.x),Math.fround(r.z)),{x:r.x,z:r.z,i:r.i,j:r.j});
 assert.equal(exactStandSeed(Math.fround(r.x+.12),Math.fround(r.z)),undefined);
});
test('only measured H/W are replaced, scale calculated from F64 height, all untouched tuples bit exact',()=>{
 const a=root(6060,651),b=root(6061,651),c=root(6043,650);
 const input=new Float32Array([...a.a,...b.a,...c.a]),orig=input.slice();
 let queries=0;
 const f64=19.456789125642;
 const view:SignedHeightView={
  id:q.owner,sha256:q.sha256,contains:(x,z)=>x>Math.floor(a.x/12)*12&&z>0,
  height(x,z,v){queries++;if(x!==a.x)return 0;assert.equal(z,a.z);assert.equal(v,treeRandom(a.i,a.j,35));return f64;}
 };
 const out=prepareStandReplacement(view,input,b.x,a.z,1530);
 assert(out);assert.equal(out.count,1);assert.equal(queries,2);
 assert.equal(out.alternate[3],Math.fround(f64));
 assert.equal(out.alternate[4],Math.fround(f64*(.83+treeRandom(a.i,a.j,9)*.35)));
 assert.deepEqual(input,orig);
 for(let i=0;i<orig.length;i++)if(i!==3&&i!==4)assert.equal(out.alternate[i],orig[i],String(i));
 assert.equal(prepareStandReplacement(view,out.alternate,b.x,a.z,1530),undefined);
 const bad=input.slice();bad[0]+=.25;
 assert.equal(prepareStandReplacement(view,bad,b.x,a.z,1530),false);
 assert.equal(prepareStandReplacement({...view,height:()=>NaN},input,b.x,a.z,1530),false);
});
const file=(f:string)=>readFileSync(new URL('../public/world/woodland/stream-v1/'+f,import.meta.url));
const mock=(mutate:(key:string,r:string,data:Uint8Array)=>Uint8Array=(_k,_r,a)=>a)=>{
 const index=file('index.json');
 assert.equal(createHash('sha256').update(index).digest('hex'),'5878c49f6a6c2cb896606c07be2d2943586edad10f45871116d36ef88d716efe');
 const files=new Map<string,Buffer>();let count=0;
 const fetcher=(async(url: string|URL, options?:RequestInit)=>{
  count++;
  const key=new URL(String(url)).pathname.split('/').at(-1)!;
  if(key==='index.json')return new Response(new Uint8Array(index));
  let a=files.get(key);if(!a){a=file(key);files.set(key,a);}
  const r=new Headers(options?.headers).get('range')??'';
  const m=/^bytes=(\d+)-(\d+)$/.exec(r);assert(m);
  return new Response(mutate(key,r,new Uint8Array(a.subarray(Number(m[1]),Number(m[2])+1))),{
   status:206,headers:{'content-range':`bytes ${m[1]}-${m[2]}/${a.length}`}
  });
 }) as typeof fetch;
 return {fetcher,requests:()=>count};
};
const target=project(-62.1975,46.443); // interior of exact signed q28-12
test('installed signed range and decoded source produce exact stock dimensions and reject no-data/foreign owners',async()=>{
 const m=mock(),f=new ForestStream('https://fixture.invalid/',m.fetcher);
 await f.warm(target.x,target.z,3000);
 assert.equal(f.state.active,q.owner);
 const previous=m.requests();
 const view=f.captureHeightPlan(q.owner,q.sha256);
 assert(view);
 assert.equal(f.captureHeightPlan(q.owner,'0'.repeat(64)),undefined);
 assert.equal(f.heightPlanUnavailable(q.owner,'0'.repeat(64)),true);
 assert.equal(view.height(target.x-11000,target.z,.4),0);
 let supported=0;
 for(let sz=-750;sz<=750;sz+=225)for(let sx=-750;sx<=750;sx+=225){
  const x=target.x+sx,z=target.z+sz,h=view.height(x,z,.63);
  assert(view.contains(x,z));
  assert.equal(h,f.height(x,z,0,.63));
  if(h)supported++;
 }
 assert(supported>=24);
 assert.equal(m.requests(),previous);
});
test('a single damaged original range refuses signed tooling without changing its existing fallback',async()=>{
 const m=mock((key,r,a)=>{if(key==='heights-03.pack'&&r==='bytes=478492-530951')a[123]^=1;return a;});
 const f=new ForestStream('https://fixture.invalid/',m.fetcher);
 await f.warm(target.x,target.z,3000);
 assert.equal(f.state.active,q.owner);
 assert.equal(f.captureHeightPlan(q.owner,q.sha256),undefined);
 assert.equal(f.heightPlanUnavailable(q.owner,q.sha256),true);
 assert.equal(f.height(target.x,target.z,-17,.1),-17);
});
