import {readFileSync as read,openSync,fstatSync,readSync,closeSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {Scene,Texture} from 'three';
import {Buildings} from '../../../../src/render/buildings.ts';
import {Terrain} from '../../../../src/sim/terrain.ts';
import {TOWN_WALL_CORE_AREAS,townTileRegion} from '../../../../src/render/town-wall-optics.ts';

const base='public/world/',bounds='buildings/';
const sha=b=>createHash('sha256').update(b).digest('hex');
const m=JSON.parse(read(base+bounds+'index.json'));
assert.equal(m.sha256,'538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557','signed building archive identity');
const a=m.tiles.find(x=>x.id==='q221232');
const key='e463fe9b6df51d4d8ca540dc3074496fbee609a680a206e7b5ce0f5fbf9ecb8d';
assert.deepEqual([a.offset,a.bytes,a.sha256],[3765681,13660,key]);
const bunch=Buffer.alloc(a.bytes), fd=openSync(base+bounds+'tiles.pack','r');
try{
  assert(fstatSync(fd).size>=a.offset+a.bytes);
  assert.equal(readSync(fd,bunch,0,a.bytes,a.offset),a.bytes);
} finally { closeSync(fd); }
assert.equal(sha(bunch),key);
const {features}=JSON.parse(gunzipSync(bunch,{maxOutputLength:5000000}));
assert.equal(features.length,310);

const h=read(base+'terrain.json');
assert.equal(sha(h),'77c9417c6bd4f4286ea4ca86a4625be30f779f33272dd7a8a4af13e001de7e98');
const hm=JSON.parse(h);
const v=gunzipSync(read(base+hm.file),{maxOutputLength:4096*2720*2});
assert.equal(sha(v),hm.sha256);
const terrain=new Terrain(hm,new Int16Array(v.buffer,v.byteOffset,v.byteLength/2));
const scene=new Scene();scene.environment=new Texture();
const stream=new Buildings(scene,terrain,m.tiles,undefined,m.sha256,undefined,undefined,
 undefined,undefined,false,undefined,undefined,false,undefined,undefined,undefined,undefined,undefined,
 {panorama:scene.environment,gain:{value:1},mode:'core',areas:TOWN_WALL_CORE_AREAS});
const tile=stream.tiles.find(t=>t.id==='q221232');
assert(!townTileRegion(tile.x1,tile.z1,tile.x2,tile.z2,TOWN_WALL_CORE_AREAS));
const mesh=stream.generate(features,tile,false,98);
assert.deepEqual(mesh.position.toArray(),[-65486.935865377614,0,-49563.892638222096]);
const pos=mesh.geometry.getAttribute('position');
assert.equal(pos.count,18048);
assert.equal(mesh.geometry.index,null);
const bytes=Buffer.from(pos.array.buffer,pos.array.byteOffset,pos.array.byteLength);
assert.equal(sha(bytes),'6c78563cebe351ca66690a205e46219125feed43a6973cfd3115dda396b78779');
assert(process.argv[2],'pass an unoccupied output filename');
writeFileSync(process.argv[2],bytes,{flag:'wx'});
