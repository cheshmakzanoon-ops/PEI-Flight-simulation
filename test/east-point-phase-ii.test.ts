import assert from 'node:assert/strict';
import test from 'node:test';
import {Scene,type InstancedMesh} from 'three';
import {standardRegionalWind} from '../src/app/scenery-profile.ts';
import {EAST_POINT_PHASE_II} from '../src/render/east-point-phase-ii.generated.ts';
import {WIND_PROFILE,turbineGeometry,type WindLod} from '../src/render/regional-wind-geometry.ts';
import {RegionalWindStream,type WindFarmArt} from '../src/render/regional-wind-stream.ts';
import {createRegionalWind} from '../src/render/regional-wind.ts';
import {SITES} from '../src/sim/places.ts';
import {project} from '../src/sim/geo.ts';

const phase='east-point-ii';
const observer={...project(-62.03698,46.44747),y:235};
const later=()=>new Promise<void>(r=>setTimeout(r,0));

test('Eastern Kings Phase II preserves real type and rotor size at all LODs, not a larger copy of the V90',()=>{
 const f=WIND_PROFILE[phase];
 assert.deepEqual([f.model,f.hub,2*f.radius,f.bladeLength,f.shaftTilt,f.noseX],
  ['Enercon E-138 EP3 E2',108,138.25,67.795,7,6.064]);
 assert.deepEqual(EAST_POINT_PHASE_II.map(r=>r[0]),['E1','E2','E3','E4','E5','E6','E7']);
 const shapes=[];
 for(const lod of [0,1,2] as WindLod[]){
  const {mast,rotor}=turbineGeometry(phase,lod);
  const p=rotor.getAttribute('position'), xyz=mast.getAttribute('position');
  let r=0;
  for(let i=0;i<p.count;i++)r=Math.max(r,Math.hypot(p.getY(i),p.getZ(i)));
  assert(Math.abs(r-69.125)<.00001);
  for(const a of [xyz,p,mast.getAttribute('normal'),rotor.getAttribute('normal')]){
   assert(Array.from(a.array).every(Number.isFinite));
  }
  assert(mast.index&&rotor.index);
  shapes.push([mast.index.count/3,rotor.index.count/3]);
  mast.dispose();rotor.dispose();
 }
 assert.deepEqual(shapes,[[2424,1520],[656,608],[208,256]]);
});

test('Phase II stock control and regional stream preserve Phase I and keep far start cold',async()=>{
 for(const q of ['', 'stockEastPointPhaseII','stockRegionalWindLight&stockEastPointPhaseII'])
  assert(standardRegionalWind(new URLSearchParams(q)),q);
 for(const q of ['stockRegionalWind','scenery=detail&stockEastPointPhaseII','woodlandView&stockEastPointPhaseII'])
  assert(!standardRegionalWind(new URLSearchParams(q)),q);
 const route=SITES.find(s=>s.id==='eastern-kings-skyline');
 assert(route&&route.height===235&&route.heading===327&&route.region==='Kings County');
 const somewhere={...project(-63.2,46.5),y:235};
 const make=():WindFarmArt=>({counts:{registered:7,near:0,cruise:7,distant:0},update(){},dispose(){}});
 for(const enabled of [true,false]){
  let loads=0;
  const s=new RegionalWindStream(async()=>{loads++;return make;},enabled);
  s.update(somewhere,0);await later();assert.equal(loads,0);
  s.update(observer,1);await later();s.update(observer,2);
  assert.equal(loads,1);
  assert.deepEqual(s.diagnostics().farms.map(a=>a.farm),enabled?['east-point-i',phase]:['east-point-i']);
  s.update(somewhere,3);assert.deepEqual(s.diagnostics().farms,[]);s.dispose();
 }
});

test('seven live Three.js rotors use shader time with no Phase II ground leases or old shadow-prep calls',async()=>{
 const ground={cover:{distance:()=>254},terrain:{isLand:()=>true},surface:()=>({land:true}),
  visualGroundHeight:()=>12,visualGroundEpoch:0};
 const sc=new Scene();let leases=0,lights=0;
 const a=createRegionalWind(phase,sc,ground as never,()=>{leases++;},async()=>{lights++;})!;
 assert(a);a.update(observer,1);
 assert.equal(a.counts.registered,7);assert.equal(a.counts.near+a.counts.cruise+a.counts.distant,7);
 assert.equal(a.root.children.length,6);
 const slots=a.root.children as InstancedMesh[];
 const versions=slots.map(m=>m.instanceMatrix.version);
 for(let t=2;t<40;t++)a.update(observer,t);
 await later();assert.deepEqual(slots.map(m=>m.instanceMatrix.version),versions);
 assert.equal(lights,0);assert.equal(leases,0);assert.equal(a.groundLightState(),null);
 ground.visualGroundEpoch++;ground.visualGroundHeight=()=>NaN;a.update(observer,40);
 assert.equal(a.root.visible,false);a.dispose();assert.deepEqual(sc.children,[]);
 ground.visualGroundHeight=()=>12;let probes=0;ground.cover.distance=()=>++probes===63?0:254;
 assert.equal(createRegionalWind(phase,sc,ground as never),undefined);
 assert.deepEqual(sc.children,[]);
});
