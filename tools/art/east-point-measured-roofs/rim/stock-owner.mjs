/** Offline read-only replay of the already shipped original q1333 generator. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {registerHooks} from 'node:module';
import {pathToFileURL} from 'node:url';

const root=resolve(process.env.PEI_CHECKOUT??'.');
if(process.env.THREE_JS){
 const url=pathToFileURL(resolve(process.env.THREE_JS)).href;
 const pkg=resolve(process.env.THREE_JS,'../..');
 registerHooks({resolve(s,ctx,next){
  if(s==='three')return {url,shortCircuit:true};
  if(s.startsWith('three/addons/'))s='three/examples/jsm/'+s.slice(13);
  if(s.startsWith('three/'))return {url:pathToFileURL(pkg+'/'+s.slice(6)).href,shortCircuit:true};
  return next(s,ctx);
 }});
}
const {Scene,Texture,REVISION}=await import('three');
assert.equal(REVISION,'187');
const source=n=>import(pathToFileURL(root+'/'+n));
const read=n=>readFileSync(resolve(root,n));
const world=n=>read('public/world/'+n);
const sha=b=>createHash('sha256').update(b).digest('hex');
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
// Never fetch or import any browser path.
globalThis.fetch=()=>{throw Error('This offline witness must not fetch.');};

const {Buildings}=await source('src/render/buildings.ts');
const {Terrain}=await source('src/sim/terrain.ts');
const {project}=await source('src/sim/geo.ts');
const {loadCoastalSurveys}=await source('src/sim/coastal-terrain.ts');
const m=JSON.parse(world('terrain.json')),t=gzip(world(m.file));
function gzip(x){return gunzipSync(x);}
assert.equal(sha(t),m.sha256);
assert.equal(sha(t),'661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d');
const coast=await loadCoastalSurveys('',async url=>new Response(world(String(url)),{status:200}),3000);
assert.deepEqual(coast.map(v=>v.spec.id),['east-point','west-point']);
const terrain=new Terrain(m,new Int16Array(t.buffer,t.byteOffset,t.byteLength/2),coast);
assert.deepEqual(terrain.coastalRefinements,['east-cliff-v1']);
const i=JSON.parse(world('buildings/index.json')),pack=world('buildings/'+i.file),tile=i.tiles.find(s=>s.id==='q1333');
assert.equal(sha(pack),i.sha256);
assert.equal(i.sha256,'538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557');
assert.deepEqual([tile.offset,tile.bytes],[3260377,9073]);
const wire=pack.subarray(tile.offset,tile.offset+tile.bytes);
assert.equal(sha(wire),tile.sha256);
assert.equal(tile.sha256,'bcc9434d46fb77c23f15b94c02f0a7758f3dcfcf61cfa96f6336055347f83279');
const rows=JSON.parse(gzip(wire)).features;
const sky=new Texture();
const east={panorama:sky,gain:{value:0},eastSingleScope:true,
 areas:[{id:'east-point-ordinary-shells',p:project(-61.9718333333,46.4525277778),r:278}]};
const emit=(withFit)=>{
 const args=Array(21).fill(undefined);
 [args[0],args[1],args[2],args[3],args[4],args[20]]=[new Scene(),terrain,[tile],{},i.sha256,withFit?east:undefined];
 const v=new Buildings(...args);
 return v.generate(rows,v.tiles[0]);
};
const stock=emit(false),mfit=emit(true),a=stock.geometry.attributes,fa=mfit.geometry.attributes;
assert.equal(stock.geometry.index,null);assert.equal(mfit.geometry.index,null);
assert.deepEqual(stock.position.toArray(),[89807.85854948164,0,4457.559458530726]);
assert.deepEqual(stock.position.toArray(),mfit.position.toArray());
assert.deepEqual(stock.geometry.groups,[]);assert.deepEqual(mfit.geometry.groups,[]);
assert.equal(a.position.count,11988);assert.equal(a.position.itemSize,3);
assert.equal(a.uv.itemSize,2);assert.equal(a.color.itemSize,3);assert.equal(a.topFlag.itemSize,1);
assert.equal(fa.townWallFit.itemSize,3);assert.equal(fa.townWallFit.normalized,false);
assert(fa.townWallFit.array instanceof Int16Array);
assert.equal(sha(bytes(a.position.array)),'a5e6aaf4801b402f24490ed99e1288ae442c86d033108caa5838e190e281ba2b');
assert.equal(sha(bytes(a.topFlag.array)),'2377a078ba4134ee374350179c76e526d35ca314f4e332c5e9bf0175bbf16aa4');
assert.equal(sha(bytes(fa.townWallFit.array)),'2f21446d2d58c325862075c9842671789e43b2e5d65f6734682d6cd4b0cfe2ba');
for(const [name,p] of Object.entries(a)) assert.deepEqual(bytes(p.array),bytes(fa[name].array),name);
assert.equal(mfit.userData.eastWallPrivate.stock,mfit.material);
assert.equal(mfit.userData.eastWallPrivate.material.uniforms.townWallSky.value,sky);
const roles=[[48,'wall',2970,3018],[48,'roof',3018,3036],[49,'wall',3036,3072],[49,'roof',3072,3084]];
for(const [id,role,lo,hi] of roles){
 const ring=new Set(rows[id].footprint.map(([lon,lat])=>{
  const p=project(lon,lat);return [Math.fround(p.x-stock.position.x),Math.fround(p.z-stock.position.z)].join(',');
 }));
 for(let it=lo;it<hi;it++){
  assert(ring.has([a.position.getX(it),a.position.getZ(it)].join(',')));
  assert.equal(a.topFlag.getX(it),role==='roof'?1:0);
  assert.equal(Math.abs(fa.townWallFit.getX(it))>15,role==='wall');
 }
 const allMatching=[];
 for(let v=0;v<a.position.count;v+=3){
  if([v,v+1,v+2].every(j=>ring.has([a.position.getX(j),a.position.getZ(j)].join(','))&&
   a.topFlag.getX(j)===(role==='roof'?1:0)))allMatching.push(v);
 }
 assert.deepEqual(allMatching,Array.from({length:(hi-lo)/3},(_,j)=>lo+3*j));
}
const shapes={position:a.position,uv:a.uv,color:a.color,topFlag:a.topFlag,townWallFit:fa.townWallFit,normal:a.normal,facadeStyle:a.facadeStyle};
const proof={
 owner:tile.id,atlas:i.sha256,index:sha(world('buildings/index.json')),wire:tile.sha256,
 normalizingCenter:stock.position.toArray(),vertices:a.position.count,nonIndexed:true,
 full:Object.fromEntries(Object.entries(shapes).map(([n,v])=>[n,sha(bytes(v.array))])),
 roles:roles.map(([ordinal,role,lo,hi])=>({ordinal,role,span:[lo,hi],
  SHA:Object.fromEntries(Object.entries(shapes).map(([n,v])=>[n,sha(bytes(v.array.subarray(lo*v.itemSize,hi*v.itemSize)))]))})),
};
export {shapes,proof};
