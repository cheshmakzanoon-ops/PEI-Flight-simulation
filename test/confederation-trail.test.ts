import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import {gunzipSync} from 'node:zlib';
import {CONFEDERATION_TRAIL as S} from '../src/render/confederation-trail.generated.ts';
import {
 ConfederationTrail,TRAIL_MAX_RESIDENT,confederationGeometry,confederationSceneryPins,confederationTerrainPins,confederationTrailRequested,
 decodeConfederationTrail,loadConfederationTrail,seatConfederation,
} from '../src/render/confederation-trail.ts';
import {sidewalkGrid} from '../src/render/sidewalks.ts';
import {project} from '../src/sim/geo.ts';
import type {Terrain} from '../src/sim/terrain.ts';
import type {World} from '../src/render/world.ts';

const file=(name:string)=>readFileSync(new URL('../'+name,import.meta.url));
const bytes=file('public/world/'+S.asset),body=gunzipSync(bytes);
const buf=(q:Uint8Array)=>new Uint8Array(q).buffer;
const raw=buf(body),sha=(q:Uint8Array)=>createHash('sha256').update(q).digest('hex');
const tile=decodeConfederationTrail(raw);
const lonlat=[-64.47,45.94,-61.93,47.10] as const;
const terrain={left:project(lonlat[0],0).x,right:project(lonlat[2],0).x,
 top:project(0,lonlat[3]).z,bottom:project(0,lonlat[1]).z} as Terrain;

test('separate route format allows only exact positive kinds, bounded meters and canonical tile joins',()=>{
 assert.equal(sha(bytes),S.wireSha256);assert.equal(sha(body),S.sha256);
 assert.equal(bytes.byteLength,S.compressedBytes);assert.equal(raw.byteLength,S.decodedBytes);
 assert.equal(tile.size,S.tiles);
 const exact=new Map<string,[string,number]>();
 const sources=new Set<number>(),widths=new Set<number>();let runs=0,cuts=0,joins=0;
 for(const [key,t]of tile)for(const p of t.paths){
  assert.ok(p.kind===0||p.kind===1);
  sources.add(p.way);widths.add(p.width);runs++;cuts+=p.cuts.length;
  for(const c of [p.cuts[0],p.cuts.at(-1)!]){
   const k=[p.way,Math.round(c.x*100),Math.round(c.z*100),Math.round(c.wX*100),Math.round(c.wZ*100)].join('/');
   const old=exact.get(k);
   if(old&&old[0]!==key){assert.equal(old[1],c.fade,k);joins++;}
   exact.set(k,[key,c.fade]);
  }
 }
 assert.equal(sources.size,60);assert.deepEqual([...widths],[2]);assert.equal(runs,S.paths);assert.equal(cuts,S.sections);
 assert.ok(joins>180,joins+' cross-cell joins');
 const corrupt=new DataView(raw.slice(0));corrupt.setUint32(12,1,true);
 assert.throws(()=>decodeConfederationTrail(corrupt.buffer));
 assert.throws(()=>decodeConfederationTrail(raw.slice(0,-1)));
});

test('glyph-free ODbL derivative reproduces the encoded sections and retains no account fields',()=>{
 const data=JSON.parse(gunzipSync(file('data/odbl/confederation-trail/trail-source-and-sections.json.gz')).toString());
 assert.equal(data.relation,4740520);assert.equal(data.relationVersion,61);assert.equal(data.sourceMembers.length,109);
 assert.ok(data.sourceMembers.every((w:Record<string,unknown>)=>Object.keys(w).sort().join(',')==='coordinates,id,memberIndex,tags,version'));
 for(const [x,z,paths]of data.exactRuntimeTileSectionsXZcm){
  const view=tile.get(x+','+z)!;
  assert.equal(view.paths.length,paths.length);
  paths.forEach(([kind,tag,width,way,ss]:any[],i:number)=>{
   const p=view.paths[i];assert.deepEqual([p.kind,+p.tagged,p.width*100,p.way],[kind,tag,width,way]);
   assert.deepEqual(p.cuts.map(q=>[q.x*100,q.z*100,q.wX*100,q.wZ*100,q.fade*255].map(Math.round)),ss);
  });
 }
});

test('request is optional and fails closed on mismatched pins, size, hash, HTTP and timeout',async()=>{
 assert.ok(confederationTrailRequested(new URLSearchParams()));
 for(const param of ['stockConfederationTrail','surveyRelief','inlandRelief','scenery=detail','northBaywalkPreview']){
  assert.equal(confederationTrailRequested(new URLSearchParams(param)),false,param);
 }
 assert.ok(confederationTerrainPins(S.pins.terrain,S.pins.cover));
 assert.ok(confederationSceneryPins(S.pins.roads,S.pins.buildings,S.pins.sidewalk,S.pins.parking));
 assert.equal(confederationTerrainPins(undefined,S.pins.cover),false);
 assert.equal(confederationSceneryPins(S.pins.roads,S.pins.buildings,undefined,S.pins.parking),false);
 const asset=async(b:Uint8Array)=>new Response(buf(b));
 const load=(f:typeof fetch,t=400)=>loadConfederationTrail('https://fixture.invalid/world/',f,t);
 assert.equal((await load(async(x,o)=>{assert.ok(String(x).endsWith(S.asset));assert.equal(o?.redirect,'error');return asset(bytes);} ))?.size,S.tiles);
 assert.equal((await load(async()=>asset(body)))?.size,S.tiles);
 const bad=Uint8Array.from(bytes);bad[90]^=1;
 assert.equal(await load(async()=>asset(bad)),undefined);
 assert.equal(await load(async()=>asset(new Uint8Array(S.decodedBytes+1))),undefined);
 assert.equal(await load(async()=>new Response('missing',{status:404})),undefined);
 assert.equal(await load(async()=>new Response('partial',{status:206,headers:{'Content-Range':'bytes 0-7/*'}})),undefined);
 assert.equal(await load(async()=>new Promise(()=>{}),8),undefined);
});

test('every three.js cap remains inside one regular terrain facet and is seated as decoration',()=>{
 const grid=sidewalkGrid(terrain),kw=(x:number,z:number)=>{
  const i=(x-grid.x0)/grid.dx,j=(z-grid.z0)/grid.dz;
  return [i,j,i+j];
 };
 const vertex=(i:number,j:number)=>25+4*Math.sin(i*.51)+3*Math.cos(j*.58)+1.8*Math.sin((i+j)*.71);
 const ground=(x:number,z:number)=>{
  const[u,v]=kw(x,z),i=Math.floor(u),j=Math.floor(v),dx=u-i,dz=v-j;
  const a=vertex(i,j),b=vertex(i+1,j),c=vertex(i,j+1),d=vertex(i+1,j+1);
  return dx+dz<=1?a+(b-a)*dx+(c-a)*dz:d+(c-d)*(1-dx)+(b-d)*(1-dz);
 };
 let n=0,highest=0;
 for(const t of tile.values()){
  const g=confederationGeometry(t,terrain,()=>true);
  seatConfederation(g,t,ground);
  const xyz=g.getAttribute('position');highest=Math.max(highest,xyz.count);n+=xyz.count/3;
  assert.equal(xyz.count%3,0);
  assert.equal(g.getAttribute('trailOptic').itemSize,2);
  for(let q=0;q<xyz.count;q+=3){
   const ids=[q,q+1,q+2],pts=ids.map(i=>kw(t.ox+xyz.getX(i),t.oz+xyz.getZ(i)));
   for(let i=0;i<3;i++){
    const P=pts.map(p=>p[i]),lo=Math.min(...P),hi=Math.max(...P);
    assert.ok(!((Math.floor(lo+3e-6)+1)<hi-3e-6),t.key+' grid axis '+i);
   }
   const x=ids.reduce((a,i)=>a+xyz.getX(i)/3,t.ox),z=ids.reduce((a,i)=>a+xyz.getZ(i)/3,t.oz),
    y=ids.reduce((a,i)=>a+xyz.getY(i)/3,0),lift=y-ground(x,z);
   assert.ok(lift>=.01995&&lift<=.03305,String(lift));
  }
  assert.ok(g.getAttribute('trailOptic').normalized);
  g.dispose();
 }
 assert.equal(n,23656,[n,highest].join('/'));
 assert.equal(highest,570);
});

test('protected runway/water guards leave no vertices when a seat is unavailable',()=>{
 const t=tile.values().next().value!;
 assert.equal(confederationGeometry(t,terrain,()=>false).getAttribute('position').count,0);
 assert.equal(confederationGeometry(t,terrain,()=>true,()=>true).getAttribute('position').count,0);
});

test('dispatch cannot request, active terrain frames build one cell, and changing ground revokes stale draws',async()=>{
 const target=project(-63.3480649803,46.3511121287),scene=new THREE.Scene();
 let verified=0,fetched=0;
 let groundStamp='112/;',groundVersion=0;
 const w={terrain:{...terrain,inlandGrids:[]},sun:new THREE.Vector3(1,1,0).normalize(),
  cover:{distance:()=>220,sample:()=>10},visualGroundHeight:()=>29,
  visualGroundSignature:()=>groundStamp,get visualGroundEpoch(){return groundVersion;}} as unknown as World;
 const trial=new ConfederationTrail(scene,w,'https://fixture.invalid/world/',true,async()=>{
  fetched++;return new Response(buf(bytes));
 });
 trial.permit(async()=>{verified++;return S.pins.coverDecoded;});
 trial.update(target.x,target.z,8,false);
 trial.update(target.x,target.z,900,true);
 assert.equal(verified,0);assert.equal(fetched,0);
 for(let j=0;j<45;j++){
  const before=trial.state.resident;
  trial.update(target.x,target.z,8,true);
  assert.ok(trial.state.resident<=before+1&&trial.state.resident<=TRAIL_MAX_RESIDENT);
  await new Promise(r=>setTimeout(r,2));
  if(trial.state.active&&!trial.state.pending)break;
 }
 assert.ok(trial.state.active&&trial.state.visible>2,JSON.stringify(trial.state));
 assert.equal(verified,1);assert.equal(fetched,1);
 groundStamp='112/g;';groundVersion++;
 trial.update(target.x,target.z,8,true);
 assert.equal(trial.state.visible,0,'stale seat hidden immediately');
 groundStamp='112/;';groundVersion++;
 for(let j=0;j<TRAIL_MAX_RESIDENT;j++)trial.update(target.x,target.z,8,true);
 assert.ok(trial.state.active);
 trial.update(target.x+10000,target.z,8,true);
 assert.equal(trial.state.resident,0);
 trial.update(target.x+10000,target.z,800,true);
 assert.equal(trial.state.visible,0);assert.equal(trial.state.attempts,1);
});
