import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {Terrain} from '../src/sim/terrain.ts';
import type {World} from '../src/render/world.ts';
import {decodeParkingSurfaces,loadParkingSurfaces,ParkingSurfaces} from '../src/render/parking-surfaces.ts';
import {MAPPED_PARKING} from '../src/render/parking-surfaces.generated.ts';

const url=new URL('../public/world/'+MAPPED_PARKING.asset,import.meta.url);
const packed=readFileSync(url),raw=gunzipSync(packed);
const asBuffer=(x:Uint8Array)=>new Uint8Array(x).buffer;

test('parking pack supports only the expected bounded, uniquely tiled material masks',()=>{
 const tiles=decodeParkingSurfaces(asBuffer(raw));
 assert.equal(tiles.length,MAPPED_PARKING.tiles);
 const lots=tiles.flatMap(t=>t.lots);
 assert.equal(lots.length,MAPPED_PARKING.pieces);
 assert.equal(new Set(tiles.map(t=>t.id)).size,tiles.length);
 assert.deepEqual([...new Set(lots.map(p=>p[0]))].sort(),[0,3,4,5,6]);
 for(const n of [0,2,12,17,21,raw.length-1])assert.throws(()=>decodeParkingSurfaces(asBuffer(raw.subarray(0,n))));
 const bad=Buffer.from(raw);bad[18]=17;
 assert.throws(()=>decodeParkingSurfaces(asBuffer(bad)),/Invalid mapped parking material/);
 const extra=new Uint8Array(raw.length+1);extra.set(raw);
 assert.throws(()=>decodeParkingSurfaces(extra.buffer),/Unexpected parking buffer length/);
});

test('no optional parking surfaces install on a failed, corrupt, or aborted transfer',async()=>{
 const fetch=async()=>new Response(asBuffer(packed));
 const autoDecoded=async()=>new Response(asBuffer(raw));
 assert.equal((await loadParkingSurfaces('/',fetch))?.length,MAPPED_PARKING.tiles);
 assert.equal((await loadParkingSurfaces('/',autoDecoded))?.length,MAPPED_PARKING.tiles);
 assert.equal(await loadParkingSurfaces('/',async()=>new Response(null,{status:404})),undefined);
 const bad=Buffer.from(raw);bad[bad.length-1]^=1;
 assert.equal(await loadParkingSurfaces('/',async()=>new Response(asBuffer(bad))),undefined);
 let stopped=false;const hang:typeof fetch=async(_url,opts)=>new Promise((_res,reject)=>
  opts?.signal?.addEventListener('abort',()=>{stopped=true;reject(Error('aborted'));}));
 assert.equal(await loadParkingSurfaces('/',hang,7),undefined);
 assert.equal(stopped,true);
});

test('a lot mesh hides on irregular active terrain and seats again when the regular grid returns',()=>{
 const scene=new THREE.Scene(),terrain=new Terrain({width:2,height:2,bounds:[-64.47,45.94,-61.93,47.1]},new Int16Array(4));
 const chosen=decodeParkingSurfaces(asBuffer(raw)).find(t=>t.lots.length>2)!;
 const [left,top,right,bottom]=chosen.box,x=(left+right)/2,z=(top+bottom)/2;
 let epoch=1,ground=4.75,stamp='112/;';
 const fake={terrain,get visualGroundEpoch(){return epoch;},visualGroundSignature:()=>stamp,
   cover:{distance:()=>13.},visualGroundHeight:()=>ground,sun:new THREE.Vector3(-.6,.74,-.31)} as unknown as World;
 const p=new ParkingSurfaces(scene,fake,[chosen]);
 p.update(x,z,15);
 const group=scene.getObjectByName('Mapped PEI parking surfaces')!;
 const m=group.children[0] as THREE.Mesh;
 assert.ok(m&&m.visible);
 const start=m.geometry.getAttribute('position').getY(0);
 stamp='112/*;';epoch++;
 p.update(x,z,15);
 assert.equal(m.visible,false);
 stamp='56/;';epoch++;ground+=1.25;
 p.update(x,z,15);
 assert.equal(m.visible,true);
 assert.ok(Math.abs(m.geometry.getAttribute('position').getY(0)-start-1.25)<1e-6);
 p.update(x,z,970);assert.equal(group.visible,false);
});
