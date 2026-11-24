import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {DoubleSide,MeshBasicMaterial,Raycaster,Vector3} from 'three';
import {Buildings} from '../src/render/buildings.ts';
import {Terrain} from '../src/sim/terrain.ts';
import {project} from '../src/sim/geo.ts';
import {DOWNTOWN_TILES,downtownWireAllows} from '../src/render/summerside-roof-source.ts';

test('Northern Summerside roof fits independently reserved points and preserves its signed tile neighbors',async()=>{
 const p=(path:string)=>readFileSync(new URL('../public/world/'+path,import.meta.url));
 const g=JSON.parse(readFileSync(new URL('../data/summerside-roof/held-north-roof.json',import.meta.url),'utf8'));
 const tile=DOWNTOWN_TILES.q03200300,slot=139;
 assert.deepEqual(g.owner,[tile.id,slot]);
 assert.equal(g.frozenSHA256,'e2c2bbe808a5e810473e3993f3059f2e88f9c570379aebe53d5938b5339dec24');
 for(const role of [0,1])assert(g.core.filter(([j]:number[])=>j===role).length>=33);
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
 assert.equal(old.geometry.getAttribute('position').count,48);
 assert.equal(next.geometry.getAttribute('position').count,78);
 assert.equal(next.userData.measuredDowntownRoofs,1);
 for(const m of [old,next])m.updateMatrixWorld(true);
 const ray=new Raycaster(new Vector3(),new Vector3(0,-1,0));
 const at=(mesh:typeof old,x:number,z:number)=>{
  ray.ray.origin.set(x,150,z);
  const r=ray.intersectObject(mesh).find(e=>mesh.geometry.getAttribute('topFlag').getX(e.face!.a)===1);
  assert(r,`Roof missing at ${x},${z}`);return r.point.y;
 };
 const p90=(a:number[])=>[...a].sort((a,b)=>a-b)[Math.floor(.9*(a.length-1))];
 for(const [role,threshold,oldLimit,n] of [['core',.11,1.70,95],['rim',.15,2.12,46],['outerInside',.16,2.23,16]] as const){
  assert.equal(g[role].length,n);
  const error=g[role].map(([,x,z,h]:number[])=>[Math.abs(at(old,x,z)-h),Math.abs(at(next,x,z)-h)]);
  assert(p90(error.map((x:number[])=>x[0]))>oldLimit);
  assert(p90(error.map((x:number[])=>x[1]))<threshold);
 }
 // The new split edge keeps the interpolated line through both stock
 // ground endpoint samples. All visible bases stay at the same elevation.
 const outline=rows[slot].footprint.map(([lon,lat]:number[])=>project(lon,lat));
 const xyz=next.geometry.getAttribute('position'),mask=next.geometry.getAttribute('topFlag');
 const {x:ox,z:oz}=next.position;
 let feet=0;
 for(let k=0;k<xyz.count;k++){
  if(mask.getX(k)>.5||next.geometry.getAttribute('uv').getY(k)!==0)continue;
  const x=xyz.getX(k)+ox,z=xyz.getZ(k)+oz;
  const edges=outline.map((a:{x:number;z:number},i:number)=>{
   const b=outline[(i+1)%outline.length],dx=b.x-a.x,dz=b.z-a.z;
   const q=Math.min(1,Math.max(0,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));
   return {d:Math.hypot(x-a.x-dx*q,z-a.z-dz*q),y:(t.meshElevation(a.x,a.z)-.6)*(1-q)+(t.meshElevation(b.x,b.z)-.6)*q};
  }).sort((a:{d:number},b:{d:number})=>a.d-b.d);
  assert(edges[0].d<.0002&&Math.abs(xyz.getY(k)-edges[0].y)<.0002);
  feet++;
 }
 assert(feet>10);
 const other=rows.map((row:unknown,i:number)=>i===slot?{footprint:[]}:row);
 const prior=generator.generate(other,bounds),rest=generator.generate(other,bounds,false,undefined,false,undefined,true);
 for(const [k,attr] of Object.entries(prior.geometry.attributes))assert.deepEqual((attr as {array:unknown}).array,rest.geometry.attributes[k].array,k);
 for(const m of [old,next,prior,rest])m.geometry.dispose();
 mat.dispose();
});
