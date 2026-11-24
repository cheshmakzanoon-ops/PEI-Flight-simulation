import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {DoubleSide,MeshBasicMaterial,Raycaster,Vector3} from 'three';
import {Buildings} from '../src/render/buildings.ts';
import {Terrain} from '../src/sim/terrain.ts';
import {project} from '../src/sim/geo.ts';
import {DOWNTOWN_TILES,downtownWireAllows} from '../src/render/summerside-roof-source.ts';

test('Western Summerside roofs replay both frozen surfaces and keep the original Water Street witness',async()=>{
 const p=(f:string)=>readFileSync(new URL('../public/world/'+f,import.meta.url));
 const hold=JSON.parse(readFileSync(new URL('../data/summerside-roof/held-west-roofs.json',import.meta.url),'utf8'));
 assert.equal(hold.frozenSHA256,'00cf1dc05a12aa0f39df18dc7807104c80661875474783b7df3d1344747e6046');
 assert.equal(hold.rows.length,417);
 const signed=DOWNTOWN_TILES.q032001;
 const raw=Uint8Array.from(p('buildings/tiles.pack').subarray(signed.offset,signed.offset+signed.bytes));
 assert(await downtownWireAllows(signed,raw.buffer));
 const rows=JSON.parse(gunzipSync(raw).toString()).features;
 const [l,s,r,n]=signed.bounds,a=project(l,n),b=project(r,s),tile={...signed,x1:a.x,x2:b.x,z1:a.z,z2:b.z};
 const atlas=JSON.parse(p('buildings/index.json').toString()),h=gunzipSync(p('height.bin.gz'));
 const t=new Terrain(JSON.parse(p('terrain.json').toString()),new Int16Array(h.buffer,h.byteOffset,h.length/2));
 const mat=new MeshBasicMaterial({side:DoubleSide}),gen=Object.assign(Object.create(Buildings.prototype),{t,mat,atlasHash:atlas.sha256});
 const signedFull=gen.generate(rows,tile,false,undefined,false,undefined,true);
 assert.equal(signedFull.userData.measuredDowntownRoofs,3);
 assert.equal(signedFull.userData.measuredWaterRoof,true);
 signedFull.geometry.dispose();
 const ray=new Raycaster(new Vector3(),new Vector3(0,-1,0));
 const quantile=(x:number[])=>[...x].sort((a,b)=>a-b)[Math.floor(.9*(x.length-1))];
 for(const [id,nCore,before,after,oldN,newN] of [[328,190,.55,.27,42,30],[371,59,.95,.064,42,54]] as const){
  const only=rows.map((row:unknown,j:number)=>j===id?row:{footprint:[]});
  const a=gen.generate(only,tile),b=gen.generate(only,tile,false,undefined,false,undefined,true);
  assert.equal(a.geometry.getAttribute('position').count,oldN);
  assert.equal(b.geometry.getAttribute('position').count,newN);
  a.updateMatrixWorld(true);b.updateMatrixWorld(true);
  const measure=(m:typeof a,x:number,z:number)=>{
   ray.ray.origin.set(x,120,z);
   const hit=ray.intersectObject(m).find(o=>m.geometry.getAttribute('topFlag').getX(o.face!.a)===1);
   assert(hit);return hit.point.y;
  };
  const old:number[]=[],fresh:number[]=[];
  for(const [owner,region,,x,z,y] of hold.rows){
   if(owner!==id)continue;
   const prior=Math.abs(measure(a,x,z)-y),newer=Math.abs(measure(b,x,z)-y);
   if(region==='core'){old.push(prior);fresh.push(newer);}
  }
  assert.equal(old.length,nCore);
  assert(quantile(old)>before);assert(quantile(fresh)<after);
  a.geometry.dispose();b.geometry.dispose();
 }
 mat.dispose();
});
