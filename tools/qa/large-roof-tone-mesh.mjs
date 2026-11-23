import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const [, , stock, candidate, reportPath, dataPath]=process.argv;
if(!dataPath)throw Error('Usage: node render-tone-gate.mjs STOCK CANDIDATE REPORT DATA');
const load=(path0,p)=>import(pathToFileURL(path.resolve(path0,p)));
const file=(r)=>path.resolve(stock,'public/world',r);
const json=p=>JSON.parse(readFileSync(p));
const hash=p=>createHash('sha256').update(p).digest('hex');
const TH=await load(stock,'node_modules/three/build/three.module.js');
const {Buildings:Old}=await load(stock,'src/render/buildings.ts');
const {Buildings:Next}=await load(candidate,'src/render/buildings.ts');
const {readRoofTone}=await load(candidate,'src/render/roof-tone.ts');
const {Terrain}=await load(stock,'src/sim/terrain.ts');
const {project}=await load(stock,'src/sim/geo.ts');
const {supportedRoofAtlas}=await load(stock,'src/sim/fitted-roofs.ts');
const atlas=json(file('buildings/index.json')),pack=readFileSync(file('buildings/tiles.pack'));
assert.equal(hash(pack),atlas.sha256);
const ground=gunzipSync(readFileSync(file('height.bin.gz')));
const terrain=new Terrain(json(file('terrain.json')),new Int16Array(ground.buffer,ground.byteOffset,ground.byteLength/2));
const material=new TH.MeshBasicMaterial({side:TH.DoubleSide});
function renderer(Buildings){
 return Object.assign(Object.create(Buildings.prototype),{t:terrain,mat:material,sourisMat:material,sourisMcleanMat:material,waterStreetMat:material,
  victoriaMat:material,montagueMat:material,atlasHash:atlas.sha256,farms:true,homes:true,fitted:supportedRoofAtlas(atlas.sha256)});
}
const old=renderer(Old),update=renderer(Next);
const tiles=new Map(atlas.tiles.map(q=>{
 const a=project(q.bounds[0],q.bounds[3]),b=project(q.bounds[2],q.bounds[1]);
 return [q.id,{...q,x1:a.x,x2:b.x,z1:a.z,z2:b.z}];
}));
const cache=new Map();
function loadShapes(t){
 if(!cache.has(t.id)){
  const b=pack.subarray(t.offset,t.offset+t.bytes);assert.equal(hash(b),t.sha256);
  const f=JSON.parse(gunzipSync(b)).features;assert.equal(f.length,t.count);cache.set(t.id,f);
 }
 return cache.get(t.id);
}
const blank={footprint:[]};
const user=json(dataPath),noOp=[],art=[],sets=new Map();
const attrs=(g)=>g.geometry.attributes;
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const diff=(a,b)=>!bytes(a).equals(bytes(b));
let intended=0,unchanged=0,scopeBytes=0;
for(const {owner,row,rgb,centerLonLat,areaM2,nativeSha,sampledPixels} of user.proofCases){
 const t=tiles.get(owner),f=loadShapes(t)[row],expected=readRoofTone(atlas.sha256,owner,row,f.footprint);
 if(!expected)continue;
 assert.deepEqual(expected,rgb.map(x=>x/1020));
 assert.equal(readRoofTone(atlas.sha256+'broken',owner,row,f.footprint),undefined);
 assert.equal(readRoofTone(atlas.sha256,owner,row,[...f.footprint.slice(1),f.footprint[0]]),undefined);
 const src=Array(row+1).fill(blank);src[row]=f;
 const b=old.generate(src,t),a=update.generate(src,t);
 const A=attrs(a),B=attrs(b);
 for(const k of Object.keys(B))if(k!=='color')assert.ok(!diff(A[k].array,B[k].array),owner+'/'+row+' '+k);
 assert.equal(A.color.array.length,B.color.array.length);
 let count=0,previous=null,netEffect=0;
 for(let p=0;p<A.topFlag.count;p++){
  const r=Array.from(B.color.array.subarray(p*3,p*3+3)),q=Array.from(A.color.array.subarray(p*3,p*3+3));
  const md=Math.max(...r.map((v,i)=>Math.abs(v-q[i])));
  if(md>0){
   assert.equal(A.topFlag.getX(p),1,owner+'/'+row+' wall mutation');
   assert.ok(q.every((v,i)=>v===Math.fround(expected[i])));
   previous=r;count++;netEffect=Math.max(netEffect,md);
  }
 }
 if(!sets.has(owner))sets.set(owner,new Set());sets.get(owner).add(row);
 if(count){
  intended+=count;art.push({owner,row,areaM2,centerLonLat,sampledPixels,nativeSha,previous,current:expected,roofVertices:count,netEffect});
 }else noOp.push({owner,row,reason:'protected authored mesh or exact unchanged color'});
 a.geometry.dispose();b.geometry.dispose();
}
for(const [tile,target]of sets){
 const t=tiles.get(tile),src=loadShapes(t).map((s,i)=>target.has(i)?blank:s),a=update.generate(src,t),b=old.generate(src,t);
 for(const k of Object.keys(attrs(a))){
  assert.ok(!diff(attrs(a)[k].array,attrs(b)[k].array),tile+' unrelated '+k);
  scopeBytes+=attrs(a)[k].array.byteLength;
 }
 unchanged+=attrs(a).position.count;a.geometry.dispose();b.geometry.dispose();
}
const summary={accepted:art.length,unchangedSpecials:noOp,intendedVertexColors:intended,unrelatedVertices:unchanged,unrelatedBytes:scopeBytes,
 maxToneChange:Math.max(...art.map(q=>q.netEffect)),homes:art};
writeFileSync(reportPath,JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({...summary,homes:undefined},null,2));material.dispose();
