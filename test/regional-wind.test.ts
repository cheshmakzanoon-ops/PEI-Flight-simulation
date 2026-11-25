import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {readFileSync} from 'node:fs';
import {standardRegionalWind,standardSourisShoreline,standardTracadieOrtho,canopyLightRequested} from '../src/app/scenery-profile.ts';
import {northCapeMode} from '../src/render/north-cape-stream.ts';
import {project} from '../src/sim/geo.ts';
import {WIND_RANGES,WIND_ENVELOPES,RegionalWindStream,type WindFarmId,type WindFarmArt} from '../src/render/regional-wind-stream.ts';
import {WIND_STATIONS} from '../src/render/regional-wind.generated.ts';
import {WIND_PROFILE,turbineGeometry,type WindLod} from '../src/render/regional-wind-geometry.ts';
import {createRegionalWind,regionalRotorAngle} from '../src/render/regional-wind.ts';

const keys=WIND_ENVELOPES.map(f=>f.id);
const pos=(lon:number,lat:number)=>({...project(lon,lat),y:95});
const west=pos(-64.3855708,46.686477),east=pos(-62.0460799,46.4558586),far=pos(-63.12,46.23);
const wait=()=>new Promise<void>(resolve=>setTimeout(resolve,0));

test('74 published positive-capacity rows at three complete farms; idle historical and later unrelated stations excluded',()=>{
 const receipt=JSON.parse(readFileSync(new URL('../data/regional-wind/locations.json',import.meta.url),'utf8'));
 assert.equal(receipt.sourceWorkbookSHA256,'e3f7b51dc062b94fd442e41727bc787030534992ce36c70d012fb0662acdd558');
 assert.equal(receipt.turbines.length,74);
 const active=new Set<string>();for(const k of keys){
  assert.equal(WIND_STATIONS[k].length,receipt.groups[k].count);
  for(const [id,lon,lat] of WIND_STATIONS[k]){
   assert(!active.has(id));active.add(id);
   const r=receipt.turbines.find((r:{id:string})=>r.id===id);
   assert.deepEqual([r.farm,r.longitude,r.latitude,r.rotorDiameterM,r.federalHubM],[k,lon,lat,WIND_PROFILE[k].radius*2,WIND_PROFILE[k].hub]);
  }
 }
 assert(!active.has('HCS9'));assert.deepEqual(receipt.explicitlyExcluded.map((r:{id:string})=>r.id),['HCS9']);
});
test('comparison switches keep historical regional studies and dependants independent',()=>{
 const q=(s:string)=>new URLSearchParams(s);
 for(const v of ['','scenery=standard','stockNorthCapeWind','stockSourisShoreline','departure=east&diagnostics'])assert(standardRegionalWind(q(v)),v);
 for(const v of ['stockRegionalWind','scenery=detail','scenery=other','northCapeWind','unknown','woodlandView'])assert(!standardRegionalWind(q(v)),v);
 for(const f of [standardSourisShoreline,standardTracadieOrtho,canopyLightRequested])assert.equal(f(q('')),f(q('stockRegionalWind')));
 assert.equal(northCapeMode(q('stockRegionalWind')),'ordinary');assert.equal(northCapeMode(q('northCapeWind&stockRegionalWind')),'explicit');assert.equal(northCapeMode(q('stockNorthCapeWind')),'stock');
});
test('module only requested near a registered world box; late resolving data cannot mount away or after disposal',async()=>{
 let resolve!: (fn:(id:WindFarmId)=>WindFarmArt)=>void,calls=0,mount=0,drop=0;
 const fresh=()=>({counts:{registered:1,near:1,cruise:0,distant:0},update(){},dispose(){drop++;}});
 const s=new RegionalWindStream(()=>{calls++;return new Promise(r=>resolve=r);});
 s.update(far,1);await wait();assert.equal(calls,0);s.update(west,2);await wait();assert.equal(calls,1);
 s.update(far,3);resolve(()=>{mount++;return fresh();});await wait();s.update(far,4);assert.equal(mount,0);
 s.update(west,4.5);assert.equal(mount,1);s.update(far,5);assert.equal(drop,1);s.update(west,5.5);assert.equal(mount,2);
 s.update(east,6);assert.equal(mount,3);s.update({...east,x:NaN},7);assert.equal(drop,3);
 s.dispose();s.update(west,10);assert.equal(calls,1);
 let r!: (v:(()=>WindFarmArt))=>void;const unmounted=new RegionalWindStream(()=>new Promise(ok=>r=ok));
 unmounted.update(west,0);await wait();unmounted.dispose();r(()=>{throw new Error('stale factory executed');});await wait();unmounted.update(west,2);assert.equal(unmounted.diagnostics().farms.length,0);
});
test('failed module and one invalid farm stay cached without poisoning another group',async()=>{
 let times=0;const fail=new RegionalWindStream(async()=>{times++;throw Error('unavailable');});
 fail.update(west,0);await wait();fail.update(west,1);fail.update(east,2);assert.equal(times,1);assert.equal(fail.diagnostics().phase,'unavailable');
 let bad=0,good=0;const s=new RegionalWindStream(async()=>id=>id==='west-cape'?(bad++,undefined):(good++,{counts:{registered:1,near:1,cruise:0,distant:0},update(){},dispose(){}}));
 s.update(west,0);await wait();s.update(west,1);s.update(far,2);s.update(west,3);s.update(east,4);assert.equal(bad,1);assert.equal(good,1);
});
test('every analytical blade sweep and all three detail levels retain the installed metric radius and outward-facing surfaces',()=>{
 const totals:Record<string,number[]>={};
 for(const id of keys){totals[id]=[];for(const level of [0,1,2] as WindLod[]){
  const {mast,rotor}=turbineGeometry(id,level), p=rotor.getAttribute('position'),n=mast.getAttribute('normal'),m=mast.getAttribute('position'),f=WIND_PROFILE[id];
  let r=0,out=0,seen=0;for(let k=0;k<p.count;k++){r=Math.max(r,Math.hypot(p.getY(k),p.getZ(k)));assert(Number.isFinite(p.getX(k)));}
  for(let k=0;k<m.count;k++){const x=m.getX(k),y=m.getY(k),z=m.getZ(k);if(y>2&&y<f.hub-4&&Math.hypot(n.getX(k),n.getZ(k))>.5){seen++;if(n.getX(k)*x+n.getZ(k)*z>0)out++;}}
  assert(Math.abs(r-f.radius)<.00001,id+' '+level+' '+r);if(seen)assert(out/seen>.90,id+' mast normals');
  assert(rotor.index&&mast.index);totals[id].push((rotor.index.count+mast.index.count)/3);mast.dispose();rotor.dispose();
 }}
 for(const id of keys){const [a,b,c]=totals[id];assert(a>b&&b>c);assert(a<3900&&c<420);}
 assert.notDeepEqual(totals['west-cape'],totals.hermanville);
});
test('mounted real THREE geometries batch all stations, update rotor phase by uniform only, and flush when any true ground becomes invalid',()=>{
 const ground={cover:{distance:()=>254},terrain:{isLand:()=>true},surface:()=>({land:true,height:12}),visualGroundHeight:()=>12,visualGroundEpoch:0};const scene=new T.Scene();
 const a=createRegionalWind('east-point-i',scene,ground as never)!;assert(a);a.update(east,0); const counts={...a.counts};
 assert.equal(counts.registered,10);assert.equal(counts.near+counts.cruise+counts.distant,10);assert(a.root.visible);
 const all=a.root.children as T.InstancedMesh[];const versions=all.map(m=>m.instanceMatrix.version);
 for(const {id} of a.sites)assert(id.startsWith('EKW'));
 a.update(east,2);assert.deepEqual(all.map(m=>m.instanceMatrix.version),versions);
 assert(Math.abs((regionalRotorAngle(2,0,16.1)-regionalRotorAngle(1,0,16.1)) -(-Math.PI*2*16.1/60))<1e-11);
 assert.equal(regionalRotorAngle(604,3,12.3),regionalRotorAngle(4,3,12.3));
 ground.visualGroundEpoch++;ground.visualGroundHeight=()=>NaN;a.update(east,3);assert(!a.root.visible);assert.equal(a.counts.registered,0);
 a.dispose();assert.equal(scene.children.length,0);
 ground.visualGroundHeight=()=>12;ground.cover.distance=()=>0;assert.equal(createRegionalWind('west-cape',scene,ground as never),undefined);
 assert(WIND_RANGES.visible<WIND_RANGES.prefetch&&WIND_RANGES.prefetch<WIND_RANGES.unload);
});
test('exact forest-root leases attach only to active local steel, default/failure/travel release, never neighbouring crowns',()=>{
 const ground={visualGroundEpoch:0,visualGroundHeight:()=>12,surface:()=>({land:true}),terrain:{isLand:()=>true},cover:{distance:()=>254}};
 const seen:{farm:string;ids:string[]}[]=[];
 const lease=(farm:WindFarmId,rows:readonly {id:string;x:number;z:number}[])=>{
  seen.push({farm,ids:rows.map(r=>r.id)});for(const r of rows){
   const s=WIND_STATIONS[farm].find(st=>st[0]===r.id)!;const p=project(s[1],s[2]);
   assert(Math.hypot(p.x-r.x,p.z-r.z)<WIND_PROFILE[farm].towerBase);
   assert.equal(Math.fround(r.x),r.x);assert.equal(Math.fround(r.z),r.z);
  }
 };
 const art=createRegionalWind('west-cape',new T.Scene(),ground as never,lease)!;
 assert.deepEqual(seen,[]);art.update(west,0);
 assert.deepEqual(seen,[{farm:'west-cape',ids:['WCW8','WCW9','WCW46','WCW49']}]);
 art.update(west,2);assert.equal(seen.length,1);art.update(far,3);assert.deepEqual(seen.at(-1)?.ids,[]);
 art.update(west,4);ground.visualGroundEpoch++;ground.visualGroundHeight=()=>NaN;art.update(west,4.2);assert.deepEqual(seen.at(-1)?.ids,[]);
 ground.visualGroundHeight=()=>12;ground.visualGroundEpoch++;art.update(west,4.5);art.dispose();assert.deepEqual(seen.at(-1)?.ids,[]);
 const herm=createRegionalWind('hermanville',new T.Scene(),ground as never,lease)!;herm.update(pos(-62.32,46.45),0);
 assert.deepEqual(seen.at(-1),{farm:'hermanville',ids:['HCS1']});herm.dispose();
 const was=seen.length,e=createRegionalWind('east-point-i',new T.Scene(),ground as never,lease)!;e.update(east,0);e.dispose();assert.equal(seen.length,was);
});
test('all optical coverage reaches zero before a bounding-center cull including hysteresis and any moving tips',()=>{
 for(const id of keys){const f=WIND_PROFILE[id],span=Math.max(f.hub*.58+1.05,f.hub*.42+f.radius+f.noseX+5);
  assert(WIND_RANGES.fadeStart>2*WIND_RANGES.cruise&&WIND_RANGES.fadeEnd-WIND_RANGES.fadeStart>1800);
  assert(WIND_RANGES.visible-WIND_RANGES.fadeEnd>span+8);
 }
});
