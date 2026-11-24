import assert from 'node:assert/strict';
import test from 'node:test';
import {gunzipSync} from 'node:zlib';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {CANOPY_FENCE as S} from '../src/render/canopy-fence.generated.ts';
import {CanopyFence,canopyFenceMatches,loadCanopyFence} from '../src/render/canopy-fence.ts';
import {TREE_PITCH,TREE_TILE_SIDE} from '../src/sim/tree-layout.ts';
import {SHADOW_CAPTURE_RADIUS,ShadowSlotRoster} from '../src/render/tree-shadow-roster.ts';
import {RollingTreeShadows,stockCanopyFootprint} from '../src/render/rolling-tree-shadows.ts';

const wire=readFileSync(new URL('../public/world/'+S.path,import.meta.url)),decoded=gunzipSync(wire);
const response=(v:Uint8Array)=>new Response(new Uint8Array(v));
const ab=(v:Uint8Array)=>new Uint8Array(v).buffer;
const fixture=new CanopyFence(ab(decoded));
test('guard bytes validate exactly and wrong optional content takes stock path',async()=>{
 const bad=Uint8Array.from(wire);bad[bad.length-3]^=4;
 const rawBad=Uint8Array.from(decoded);rawBad[rawBad.length-10]^=1;
 assert(await loadCanopyFence('mock/',async()=>response(wire)));
 assert(await loadCanopyFence('mock/',async()=>response(decoded)));
 assert.equal(await loadCanopyFence('mock/',async()=>response(bad)),undefined);
 assert.equal(await loadCanopyFence('mock/',async()=>response(rawBad)),undefined);
 assert.equal(await loadCanopyFence('mock/',async()=>response(new Uint8Array(S.rawBytes+1))),undefined);
 assert.equal(await loadCanopyFence('mock/',async()=>new Response(null,{status:404})),undefined);
 assert.equal(canopyFenceMatches(S.pins),true);
 assert.equal(canopyFenceMatches({...S.pins,coverDecoded:''}),false);
 assert.equal(canopyFenceMatches({}),false);
 assert.equal(fixture.allows([Infinity,-3,0,9]),false);
 assert.equal(fixture.allows([-300000,-5,-299998,5]),false);
});
test('baker hash geometry fence vetoes named old NRN inset even at rough partial overlap',()=>{
 const k=[79165,9542,79173,9551] as const;
 assert(!fixture.allows(k));
 // Geometric negative flags are conservative, not permission to repaint parcels.
 assert(fixture.allows([-13429,11184,-13413,11199]));
});
test('bounded original-slot recorder proves candidate halo, rejects unknown origin',()=>{
 const r=new ShadowSlotRoster(),runs=new Int32Array(32),T=TREE_TILE_SIDE*TREE_PITCH;
 r.start(-120,-7,7);
 for(const [i,x,z] of [[54,-115,-5],[812,-192.1,-7],[824,-190.8,-7],[991,356,45]]){
  const first=r.size;r.append(i,Math.hypot(x+120,z+7)**2);
  r.sealBlock(Math.floor(x/T),Math.floor(z/T),first);
 }
 assert.equal(r.size,3);assert.equal(r.nearby(-120,-7,75,runs),6);
 assert.equal(r.nearby(-120+SHADOW_CAPTURE_RADIUS,-7,75,runs),-1);
 assert.deepEqual(Array.from(r.slots.slice(0,r.size)),[54,812,824]);
});
test('canonical shape and shader gates keep typed original generation in bounds',()=>{
 const points=stockCanopyFootprint({x:-79655.762,z:-19303.843,y:1,height:14.468,width:18.304,variant:2});
 assert(points.every(q=>Math.fround(q.x)===q.x&&Math.fround(q.z)===q.z));
 assert.deepEqual(points.map(q=>[q.u,q.v]),[[0,0],[1,0],[1,1],[0,1]]);
 const g=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial());
 assert.equal(RollingTreeShadows.mount(new THREE.Scene(),{} as never,fixture,g,45000),undefined);
});

test('lookup never conflates just-adjacent or double-occupied quantized cells',()=>{
 const r=new ShadowSlotRoster();r.start(-120,-7,10);
 r.append(54,.45,-121.2,-7.1);
 r.append(812,4,-119.1,-6.3);
 assert.equal(r.slotAt(-121.2,-7.1),54);
 assert.equal(r.slotAt(-119.1,-6.3),812);
 assert.equal(r.slotAt(-130,-7.1),54); // lookup only cell; exact identity is separately required
 r.append(755,12,-121.03,-6.3);
 assert.equal(r.slotAt(-121.2,-7.1),-2);
 assert.equal(r.slotAt(-3000,-7.1),-1);
 r.start(-120,-7,11);
 assert.equal(r.slotAt(-119.1,-6.3),-1);
});
test('canopy transaction rebind is atomic and rejects a same-cell impostor or changed terrain',()=>{
 const a=[-132.2,10.25,-12.4,13,13.125,1],b=[-151.3,10.5,-9.5,12,11,0];
 const vals=new Float32Array([...a,...b]),raw=new Float32Array(24),shape=new Float32Array(32);
 let valid=true;
 const layer=Object.assign(Object.create(RollingTreeShadows.prototype),{
   world:{rollingCanopyStill:()=>valid},mask:new THREE.InstancedBufferAttribute(new Float32Array(8),1),
   rebound:new Uint16Array(350),dirtyMin:8,dirtyMax:-1,reboundCount:0,rebindRejected:0,
 });
 layer.mask.setX(2,1);layer.mask.setX(5,1);
 const stamp={revision:4,tiles:[{key:'control',geometry:new THREE.BufferGeometry()}],
  bank:{ids:vals,slots:Uint16Array.of(2,5),count:2}};
 const read=()=>Array.from(layer.mask.array);
 const roster=new ShadowSlotRoster();roster.start(-136,-10,5);
 const slots=[5,7];
 for(const [i,slot] of slots.entries()){
  raw.set(vals.subarray(i*6,i*6+3),slot*3);shape.set(vals.subarray(i*6+3,i*6+6),slot*4);
  roster.append(slot,20,raw[slot*3],raw[slot*3+2]);
 }
 const retained=Array.from(stamp.bank.slots),power=read();
 raw[7*3]+=.01; // valid grid cell, wrong actual stem
 assert.equal(layer.keep(stamp,roster,raw,shape),false);
 assert.equal(stamp.revision,4);
 assert.deepEqual(Array.from(stamp.bank.slots),retained);assert.deepEqual(read(),power);
 raw[7*3]=vals[6];valid=false;
 assert.equal(layer.keep(stamp,roster,raw,shape),false);assert.deepEqual(read(),power);
 valid=true;assert.equal(layer.keep(stamp,roster,raw,shape),true);
 assert.equal(stamp.revision,5);assert.deepEqual(Array.from(stamp.bank.slots),[5,7]);
 assert.deepEqual(read(),[0,0,0,0,0,1,0,1]);
 assert.equal(layer.reboundCount,1);stamp.tiles[0].geometry.dispose();
});
