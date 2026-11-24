import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {DoubleSide,MeshBasicMaterial,Raycaster,Vector3} from 'three';
import {Buildings} from '../src/render/buildings.ts';
import {Terrain} from '../src/sim/terrain.ts';
import {project} from '../src/sim/geo.ts';
import {DOWNTOWN_TILES,downtownWireAllows} from '../src/render/summerside-roof-source.ts';

test('Summerside submitted roof planes pass reserved physical shots without replacing another owner',async()=>{
 const p=(path:string)=>readFileSync(new URL('../public/world/'+path,import.meta.url));
 const g=JSON.parse(readFileSync(new URL('../data/summerside-roof/held-roof.json',import.meta.url),'utf8'));
 const tile=DOWNTOWN_TILES.q032001,slot=383;
 assert.deepEqual(g.owner,[tile.id,slot]);
 const atlas=JSON.parse(p('buildings/index.json').toString());
 const raw=Uint8Array.from(p('buildings/tiles.pack').subarray(tile.offset,tile.offset+tile.bytes));
 assert(await downtownWireAllows(tile,raw.buffer));
 const rows=JSON.parse(gunzipSync(raw).toString()).features;
 const a=project(tile.bounds[0],tile.bounds[3]),b=project(tile.bounds[2],tile.bounds[1]);
 const bounds={...tile,x1:a.x,z1:a.z,x2:b.x,z2:b.z};
 const dt=gunzipSync(p('height.bin.gz'));
 const t=new Terrain(JSON.parse(p('terrain.json').toString()),new Int16Array(dt.buffer,dt.byteOffset,dt.length/2));
 const mat=new MeshBasicMaterial({side:DoubleSide});
 const generator=Object.assign(Object.create(Buildings.prototype),{mat,t,atlasHash:atlas.sha256});
 const ownerOnly=rows.map((row:unknown,i:number)=>i===slot?row:{footprint:[]});
 const old=generator.generate(ownerOnly,bounds);
 const next=generator.generate(ownerOnly,bounds,false,undefined,false,undefined,true);
 assert.equal(old.geometry.getAttribute('position').count,42);
 assert.equal(next.geometry.getAttribute('position').count,54);
 assert.equal(next.userData.measuredDowntownRoofs,1);
 for(const m of [old,next])m.updateMatrixWorld(true);
 const ray=new Raycaster(new Vector3(),new Vector3(0,-1,0));
 const at=(mesh:typeof old,x:number,z:number)=>{
  ray.ray.origin.set(x,150,z);
  const r=ray.intersectObject(mesh).find(e=>mesh.geometry.getAttribute('topFlag').getX(e.face!.a)===1);
  assert(r,`Roof missing at ${x},${z}`);return r.point.y;
 };
 const error=g.cores.map(([role,x,z,h]:number[])=>[role,Math.abs(at(old,x,z)-h),Math.abs(at(next,x,z)-h)]);
 const p90=(a:number[])=>[...a].sort((a,b)=>a-b)[Math.floor(.9*(a.length-1))];
 for(const role of [0,1]){
  const q=error.filter(([n]:number[])=>n===role);
  assert(q.length>=60);
  assert(p90(q.map((x:number[])=>x[1]))>.84);
  assert(p90(q.map((x:number[])=>x[2]))<.10);
 }
 assert(g.rim.every(([,x,z,h]:number[])=>Math.abs(at(next,x,z)-h)<.16));
 const other=rows.map((row:unknown,i:number)=>i===slot?{footprint:[]}:row);
 const prior=generator.generate(other,bounds),rest=generator.generate(other,bounds,false,undefined,false,undefined,true);
 for(const [k,attr] of Object.entries(prior.geometry.attributes))assert.deepEqual((attr as {array:unknown}).array,rest.geometry.attributes[k].array,k);
 for(const m of [old,next,prior,rest])m.geometry.dispose();
 mat.dispose();
});
