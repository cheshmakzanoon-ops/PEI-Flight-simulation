import test from 'node:test';
import {NEIGHBOUR as R} from '../src/render/souris-east/nearby-recipe.ts';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Mesh,Raycaster,Vector3} from 'three';
import {SOURCE as S} from '../src/render/souris-east/source.ts';
import {GROUND as G} from '../src/render/souris-east/ground.generated.ts';
import {crockettAtlasCandidate,crockettExactRow,crockettExactWire} from '../src/render/souris-east/admit.ts';
import {sourisEastGround} from '../src/render/souris-east/ground.ts';
import {createSourisEastExterior} from '../src/render/souris-east/art.ts';
import type {World} from '../src/render/world.ts';

test('Souris east authoring pins exact existing tile bytes, original row and ordinal',async()=>{
 const bytes=readFileSync(new URL('../public/world/buildings/tiles.pack',import.meta.url));
 assert.equal(bytes.length,S.archiveBytes);
 const raw=Uint8Array.from(bytes.subarray(S.tile.offset,S.tile.offset+S.tile.bytes));
 const rows=JSON.parse(gunzipSync(raw).toString()).features;
 assert(crockettAtlasCandidate(S.atlas,S.tile));
 assert(crockettExactRow(rows));
 assert(await crockettExactWire(raw));
 for(const [key,extra] of [['offset',1],['bytes',1],['count',1]] as const)
  assert(!crockettAtlasCandidate(S.atlas,{...S.tile,[key]:S.tile[key]+extra}));
 assert(!crockettAtlasCandidate(S.atlas,{...S.tile,bounds:S.tile.bounds.map((d,i)=>i===0?d+.000001:d)}));
 assert(!crockettAtlasCandidate('0'.repeat(64),S.tile));
 const bad=structuredClone(rows);bad[S.ordinal].footprint.reverse();
 assert(!crockettExactRow(bad));
 for(const edit of [{height:S.row.height+.01},{minHeight:0},{holes:[S.row.footprint]},{footprint:null}]){
  const changed=structuredClone(rows);Object.assign(changed[S.ordinal],edit);
  assert(!crockettExactRow(changed));
 }
 raw[raw.length-8]^=1;
 assert(!await crockettExactWire(raw));
 assert(!await crockettExactWire(raw.subarray(1)));
});

test('Souris east terrain lease restores stock without the exact near surface or road evidence',async()=>{
 let active=true,morph=0,road:string|undefined;
 let geometry={};
 const at=(x:number,z:number)=>G.controls.find(p=>p[0]===x&&p[1]===z)!;
 const world={
  terrain:{},cover:{sourceSha:G.cover,sourceDecodedSha:G.coverDecoded,distance:(_:unknown,x:number,z:number)=>at(x,z)[4]},
  rollingCanopyOwner:()=>active?{key:G.key,geometry}:undefined,
  surface:(x:number,z:number)=>({height:at(x,z)[3],land:true,runway:false}),
  visualGroundHeight:(x:number,z:number)=>at(x,z)[2]+morph,
 } as unknown as World;
 assert.equal(sourisEastGround(world,'incorrect',()=>road),undefined);
 const prepare=sourisEastGround(world,G.terrain,()=>road)!;
 assert.equal(prepare(),prepare());
 const ready=await prepare();assert(ready);
 assert.equal(ready(),false);
 road=G.road;assert.equal(ready(),true);
 active=false;assert.equal(ready(),false);
 active=true;geometry={};morph=.02;assert.equal(ready(),false);
 geometry={};morph=0;assert.equal(ready(),true);
 road='incorrect';assert.equal(ready(),false);
 const corrupt={...world,cover:{...world.cover,sourceDecodedSha:undefined,bytes:new Uint8Array(8)}} as World;
 assert.equal(await sourisEastGround(corrupt,G.terrain,()=>G.road)!(),undefined);
});

test('Souris east paired roof roles share draws without moving the measured world-space surface',()=>{
 const a=createSourisEastExterior();
 a.group.updateMatrixWorld(true);
 assert.equal(a.group.children.length,5);
 const meshes=a.group.children as Mesh[];
 for(const m of meshes){assert(m.geometry.boundingSphere);assert(m.geometry.getAttribute('normal'));}
 const samples=[[14,2],[15,-2],[17,6],[10,8]].map(([u,v])=>[R.frame.O[0]+R.frame.U[0]*u+R.frame.V[0]*v,R.frame.O[1]+R.frame.U[1]*u+R.frame.V[1]*v]);
 const roof=new Raycaster(new Vector3(),new Vector3(0,-1,0));
 for(const [x,z] of samples){
  roof.ray.origin.set(x,65,z);
  const top=roof.intersectObjects(meshes)[0]?.point.y;
  assert(top!==undefined&&top>16.2&&top<23.35,`Roof no hit at ${x}/${z}: ${top}`);
 }
 let disposed=0;
 for(const m of meshes)m.geometry.addEventListener('dispose',()=>{disposed++;});
 a.dispose();assert.equal(disposed,meshes.length);assert.equal(a.group.parent,null);
});
