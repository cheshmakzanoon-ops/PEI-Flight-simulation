import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {NORTH_CAPE_V47} from '../src/render/north-cape.generated.ts';
import {NORTH_CAPE_SITES,NORTH_CAPE_RPM,NorthCapeShadow} from '../src/render/north-cape-shadow.ts';
import {NORTH_CAPE_HUB_M,NORTH_CAPE_ROTOR_M,northCapeMast,northCapeRotor} from '../src/render/north-cape-geometry.ts';
import {NorthCapeScenery} from '../src/render/north-cape.ts';

test('North Cape has exactly the 16 distinct attributed federal commercial turbine locations',()=>{
 const source=JSON.parse(readFileSync(new URL('../data/north-cape/locations.json',import.meta.url),'utf8'));
 assert.equal(source.turbines.length,16);
 assert.equal(new Set(NORTH_CAPE_V47.map(s=>s[0])).size,16);
 assert.equal(new Set(NORTH_CAPE_V47.map(s=>s.slice(1).join(','))).size,16);
 assert.deepEqual(NORTH_CAPE_V47,source.turbines.map(s=>[s.sourceTurbineId,s.longitude,s.latitude]));
 assert.equal(NORTH_CAPE_HUB_M,50);
 assert.equal(NORTH_CAPE_ROTOR_M,47);
 assert.equal(NORTH_CAPE_RPM,28.5);
});

test('both geometry levels retain the same swept envelope and rooted mast',()=>{
 for(const [g,far] of [true,false].map(far=>[northCapeRotor(far),far] as const)){
  const p=g.getAttribute('position'),radius=Math.max(...Array.from({length:p.count},(_,i)=>Math.hypot(p.getY(i),p.getZ(i))));
  assert.ok(Math.abs(radius-NORTH_CAPE_ROTOR_M*.5)<.00001);
  const m=northCapeMast(far);m.computeBoundingBox();
  assert.ok(m.boundingBox!.min.y<-1.2);
  assert.ok(m.boundingBox!.max.y>50);
 }
});

test('physical instancing follows submitted terrain heights and culls away from North Cape',()=>{
 const s=NORTH_CAPE_SITES[0],sunCaster=new NorthCapeShadow(),scene=new T.Scene();
 const state={visualGroundEpoch:0,surface:()=>({land:true,height:8}),visualGroundHeight:()=>8,capeShadow:sunCaster};
 const map=new NorthCapeScenery(scene,state);
 const camera=new T.Vector3(s.x,50,s.z);
 map.update(camera,1);
 assert.equal(map.counts.registered,16);
 assert.equal(map.counts.near+map.counts.cruise,16);
 assert.equal(sunCaster.data[0].y,8);
 assert.equal(sunCaster.data[0].w,1);
 const nearestMast=map.root.children[2] as T.InstancedMesh,nearestRotor=map.root.children[3] as T.InstancedMesh;
 const a=new T.Matrix4(),b=new T.Matrix4();
 nearestMast.getMatrixAt(0,a);nearestRotor.getMatrixAt(0,b);
 assert.equal(a.elements[13],8);
 assert.equal(b.elements[13]-a.elements[13],NORTH_CAPE_HUB_M);
 const old=b.clone();
 map.update(camera,1.4);nearestRotor.getMatrixAt(0,b);
 assert.equal(b.elements[13],old.elements[13]);
 assert.notDeepEqual(b.elements,old.elements);
 state.visualGroundEpoch++;state.visualGroundHeight=()=>11;
 map.update(camera,1.4);nearestMast.getMatrixAt(0,a);nearestRotor.getMatrixAt(0,b);
 assert.equal(a.elements[13],11);
 assert.equal(sunCaster.data[0].y,11);
 assert.equal(b.elements[13]-a.elements[13],NORTH_CAPE_HUB_M);
 map.update(new T.Vector3(),10);
 assert.deepEqual([map.root.visible,map.counts.near,map.counts.cruise],[false,0,0]);
});
