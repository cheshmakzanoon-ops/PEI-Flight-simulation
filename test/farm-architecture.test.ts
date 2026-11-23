import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import * as THREE from 'three';
import { project } from '../src/sim/geo.ts';
import { Terrain } from '../src/sim/terrain.ts';
import { Buildings } from '../src/render/buildings.ts';
import { FARM_ATLAS_SHA,FARM_PROFILE_COUNT,FARM_PROFILE_SOURCE_SHA,FARM_PROFILES } from '../src/render/farm-shells.generated.ts';
import { emitFarmShell,farmFootprintKey,farmRoofAtlas,farmRoofHeight,readFarmShell } from '../src/render/farm-shells.ts';

type Pt={x:number;z:number};
type Feature={footprint:[number,number][];height:number;minHeight:number;holes?:[number,number][][]};
type Tile={id:string;offset:number;bytes:number;bounds:[number,number,number,number]};
const p=new URL('../public/world/',import.meta.url);
const bytes=readFileSync(new URL('buildings/tiles.pack',p));
const atlas=JSON.parse(readFileSync(new URL('buildings/index.json',p),'utf8')) as
 {sha256:string;tiles:Tile[];count:number};
const rows=FARM_PROFILES as Readonly<Record<string,readonly (readonly number[])[]>>;
const features=(q:Tile): Feature[]=>JSON.parse(gunzipSync(bytes.subarray(q.offset,q.offset+q.bytes)).toString()).features;
const area=(a:Pt,b:Pt,c:Pt)=>((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))*.5;
const distance=(a:Pt,b:Pt,p:Pt)=>{
 const x=b.x-a.x,z=b.z-a.z;
 const u=Math.max(0,Math.min(1,((p.x-a.x)*x+(p.z-a.z)*z)/(x*x+z*z)));
 return Math.hypot(p.x-a.x-u*x,p.z-a.z-u*z);
};
function inside(r:readonly Pt[],p:Pt){
 let covered=false, min=Infinity;
 for(let i=0;i<r.length;i++){
  const a=r[i],b=r[(i+1)%r.length];
  if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)covered=!covered;
  min=Math.min(min,distance(a,b,p));
 }
 return covered||min<.0002;
}
// Check sub-segments on both sides of every real edge intersection rather
// than merely requiring vertices inside a potentially concave outline.
function containedEdge(r:readonly Pt[],a:Pt,b:Pt){
 const x=b.x-a.x,z=b.z-a.z,events=[0,1];
 if(x*x+z*z<1e-14)return inside(r,a);
 for(let i=0;i<r.length;i++){
  const p=r[i],q=r[(i+1)%r.length],u=q.x-p.x,v=q.z-p.z;
  const w=p.x-a.x,t=p.z-a.z,d=x*v-z*u;
  if(Math.abs(d)<1e-10)continue;
  const k=(w*v-t*u)/d,j=(w*z-t*x)/d;
  if(k>1e-9&&k<1-1e-9&&j>=-1e-8&&j<=1+1e-8)events.push(k);
 }
 events.sort((l,m)=>l-m);
 return events.slice(1).every((t,i)=>{
  const k=(t+events[i])*.5;
  return inside(r,{x:a.x+k*x,z:a.z+k*z});
 });
}
test('the derived data agrees with the pinned source and withheld-evidence summary',()=>{
 const root=new URL('../data/farm-architecture/',import.meta.url);
 const raw=gunzipSync(readFileSync(new URL('native-window-evidence.json.gz',root))).toString().trimEnd();
 const results=JSON.parse(raw) as {tile:string;i:number;sha:string;n:number;nHold:number;p90:number;oldP90:number}[];
 const stat=JSON.parse(readFileSync(new URL('fit-report.json',root),'utf8'));
 const source=JSON.parse(readFileSync(new URL('clui-farmsteads-receipt.json',root),'utf8'));
 assert.equal(stat.atlasSha256,FARM_ATLAS_SHA);
 assert.equal(stat.profileSourceSha256,FARM_PROFILE_SOURCE_SHA);
 assert.equal(createHash('sha256').update(raw).digest('hex'),FARM_PROFILE_SOURCE_SHA);
 assert.equal(source.count,3107);
 assert.equal(source.pages.reduce((sum:number,r:{count:number})=>sum+r.count,0),source.count);
 assert.equal(results.length,929);
 assert.equal(results.reduce((s,r)=>s+r.nHold,0),58700);
 assert.equal(results.reduce((s,r)=>s+r.n,0),287875);
 for(const r of results){
  assert.match(r.sha,/^[0-9a-f]{64}$/);
  assert.ok(rows[r.tile].some(a=>a[0]===r.i)&&r.nHold<r.n&&r.p90<=.49);
 }
 assert.ok(stat.heldoutP90BuildingMedianM[1]<.12&&stat.heldoutP90UpperP90M[1]<.20);
});

test('the province farm roof key is pinned and changes only the exact supported, ordered atlas rows',()=>{
 assert.equal(createHash('sha256').update(bytes).digest('hex'),FARM_ATLAS_SHA);
 assert.equal(farmRoofAtlas(atlas.sha256),true);
 for(const unsupported of [undefined,'','0'.repeat(64)])assert.equal(farmRoofAtlas(unsupported),false);
 let count=0;const forms=[0,0,0,0];
 for(const tile of atlas.tiles){
  const list=rows[tile.id]??[];
  const records=features(tile);
  for(let i=0;i<records.length;i++){
   const f=records[i],r=list.find(k=>k[0]===i);
   assert.equal(!!readFarmShell(tile.id,i,f.footprint),!!r);
   if(!r)continue;
   count++;forms[r[2]]++;
   assert.equal(f.holes?.length??0,0);
   assert.equal(r[1],farmFootprintKey(f.footprint));
   assert.equal(r.length, r[2]<2?11:r[2]===2?13:17);
   assert.ok(Math.abs(Math.hypot(r[5],r[6])/1e6-1)<1e-6);
   const altered=f.footprint.map(([x,z],j):[number,number]=>[x+Number(j===1)*.000001,z]);
   assert.equal(readFarmShell(tile.id,i,altered),undefined);
  }
 }
 assert.equal(count,FARM_PROFILE_COUNT);
 assert.equal(count,929);
 assert.deepEqual(forms,[6,14,866,43]);
});
test('farm roofs and all their trim are inside the source plan, with a full roof cap and no invented peak',()=>{
 let n=0,portal=0,maxTriangles=0;
 for(const tile of atlas.tiles){
  const rr=rows[tile.id];if(!rr)continue;
  const fs=features(tile);
  for(const row of rr){
   const f=fs[row[0]],shell=readFarmShell(tile.id,row[0],f.footprint)!;
   const ring=f.footprint.map(a=>project(...a)),c={x:ring.reduce((s,q)=>s+q.x,0)/ring.length,z:ring.reduce((s,q)=>s+q.z,0)/ring.length};
   const calced=ring.reduce((s,a,i)=>s+area(c,a,ring[(i+1)%ring.length]),0);
   const V:{p:Pt;y:number;kind:number}[]=[];
   emitFarmShell(ring,c,60,37,shell,(x,z)=>59.95+(x-c.x)*.003+(z-c.z)*.004,
    (p,y,_tint,u,v,kind)=>{assert.ok(Number.isFinite(y+u+v));V.push({p,y,kind});});
   let capArea=0;
   for(let i=0;i<V.length;i+=3){
    const [A,B,C]=V.slice(i,i+3);
    assert.equal(A.kind,B.kind);assert.equal(B.kind,C.kind);
    const label=tile.id+':'+row[0]+' form '+A.kind;
    for(const v of [A,B,C]){
     assert.ok(inside(ring,v.p),label+' outside measured plan');
     if(v.kind===1||v.kind===4)assert.ok(Math.abs(v.y-60-farmRoofHeight((v.p.x-c.x)*shell.normal.x+(v.p.z-c.z)*shell.normal.z,shell.profile))<1e-6,label);
    }
    assert.ok(containedEdge(ring,A.p,B.p)&&containedEdge(ring,B.p,C.p)&&containedEdge(ring,C.p,A.p),label+' edge crosses measured plan');
    const center={x:(A.p.x+B.p.x+C.p.x)/3,z:(A.p.z+B.p.z+C.p.z)/3};
    assert.ok(inside(ring,center),label+' interior crosses plan');
    if(A.kind===1||A.kind===4)capArea+=Math.abs(area(A.p,B.p,C.p));
    if(A.kind===-1)portal++;
   }
   assert.ok(Math.abs(capArea-Math.abs(calced))<.00009,tile.id+':'+row[0]+' gap or overlap in cap');
   n++;
   assert.ok(V.length/3<=225,'per-shell bounded geometry budget');
   maxTriangles=Math.max(maxTriangles,V.length/3);
  }
 }
 assert.equal(n,929);assert.ok(portal>1000);assert.ok(maxTriangles>34);
});
test('the actual streamed mesh batch keeps every non-farm attribute buffer exactly unchanged',()=>{
 const spec=JSON.parse(readFileSync(new URL('terrain.json',p),'utf8'));
 const raw=gunzipSync(readFileSync(new URL('height.bin.gz',p)));
 const samples=new Int16Array(raw.length/2);
 for(let i=0;i<samples.length;i++)samples[i]=raw.readInt16LE(i*2);
 const terrain=new Terrain(spec,samples);
 const object=Object.create(Buildings.prototype);
 const mat=new THREE.MeshBasicMaterial();
 Object.assign(object,{t:terrain,atlasHash:FARM_ATLAS_SHA,fitted:true,mat});
 let changed=0,vertices=0,triangles=0,worstTileDelta=0,maxFarmTile=0,oldTris=0;
 for(const tile of atlas.tiles){
  const targets=rows[tile.id];if(!targets)continue;
  const f=features(tile),skip=new Set(targets.map(r=>r[0]));
  const [w,s,e,n]=tile.bounds;
  const bounds={...tile,x1:project(w,n).x,x2:project(e,s).x,z1:project(w,n).z,z2:project(w,s).z};
  const absent=f.map((record,j)=>skip.has(j)?{...record,footprint:[]}:record);
  object.farms=false;const legacy=object.generate(absent,bounds) as THREE.Mesh;
  const prior=object.generate(f,bounds) as THREE.Mesh;
  object.farms=true;const newMesh=object.generate(f,bounds) as THREE.Mesh;
  assert.deepEqual(legacy.position.toArray(),newMesh.position.toArray());
  const facade=newMesh.geometry.getAttribute('facadeStyle'),keep:number[]=[];
  for(let i=0;i<facade.count;i++){if(facade.getX(i)<7)keep.push(i);}
  const added=(facade.count-keep.length)/3;
  assert.ok(added>=targets.length*20,tile.id+' changed which assigned farms activate');
  const tileDelta=(facade.count-prior.geometry.getAttribute('position').count)/3;
  triangles+=tileDelta;oldTris+=prior.geometry.getAttribute('position').count/3;worstTileDelta=Math.max(worstTileDelta,tileDelta);
  maxFarmTile=Math.max(maxFarmTile,targets.length);changed+=targets.length;vertices+=keep.length;
  for(const name of ['position','normal','color','uv','topFlag','facadeStyle']){
   const orig=legacy.geometry.getAttribute(name),next=newMesh.geometry.getAttribute(name);
   assert.equal(orig.count,keep.length,name+' has a different non-farm vertex count');
   for(let k=0;k<orig.array.length;k++){
    const j=Math.floor(k/orig.itemSize),m=k%orig.itemSize;
    if(!Object.is(orig.array[k],next.array[keep[j]*orig.itemSize+m]))
     throw new Error(tile.id+' changed a non-farm '+name+' scalar at '+k);
   }
  }
  for(const mesh of [legacy,prior,newMesh])mesh.geometry.dispose();
 }
 assert.equal(changed,929);assert.ok(vertices>2e6);
 assert.ok(triangles<70000);assert.ok(worstTileDelta<2300);
 console.log('Farm atlas', {changed,vertices,triangles,worstTileDelta,maxFarmTile,oldTris});
 mat.dispose();
});
