import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {closeSync,openSync,readFileSync,readSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Color,Scene} from 'three';
import {Buildings} from '../src/render/buildings.ts';
import {Terrain} from '../src/sim/terrain.ts';
import {PackedBytes} from '../src/sim/packed-bytes.ts';
import {olearyAccessRoofOrdinal,OLEARY_ACCESS_ROOF_COLOR} from '../src/render/oleary-access-roof-tone.ts';
import {olearyAccessRoofRequested,olearyExteriorRequested,sceneryOptions} from '../src/app/scenery-profile.ts';

const world=(name:string)=>new URL('../public/world/'+name,import.meta.url);
const json=(n:string)=>JSON.parse(readFileSync(world(n),'utf8'));
const sha=(a:Uint8Array)=>createHash('sha256').update(a).digest('hex');
const bytes=(a:ArrayBufferView)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const atlas=json('buildings/index.json'),tile=atlas.tiles.find((t:{id:string})=>t.id==='q20213');
const block=Buffer.alloc(tile.bytes),fd=openSync(world('buildings/tiles.pack'),'r');
try{assert.equal(readSync(fd,block,0,tile.bytes,tile.offset),tile.bytes);}finally{closeSync(fd);}
const rows=JSON.parse(gunzipSync(block).toString('utf8')).features;
const terrainMeta=json('terrain.json'),raw=gunzipSync(readFileSync(world(terrainMeta.file)));
const terrain=new Terrain(terrainMeta,new Int16Array(raw.buffer,raw.byteOffset,raw.byteLength/2));
const Builder=Buildings as unknown as new(...a:any[])=>any;
function context(wire:Uint8Array=block){
 const headers:string[]=[];
 const pack=new PackedBytes('https://fixture.invalid/tiles.pack',atlas.bytes,async(_url,init)=>{
  const range=new Headers(init?.headers).get('Range')??'';
  assert.equal(range,'bytes='+tile.offset+'-'+(tile.offset+tile.bytes-1));
  headers.push(range);
  return new Response(Uint8Array.from(wire),{status:206,headers:{'Content-Range':'bytes '+range.slice(6)+'/'+atlas.bytes}});
 });
 const b=new Builder(new Scene(),terrain,[tile],pack,atlas.sha256);
 b.wanted.add(tile.id);
 return {b,headers,load:async()=>{await b.load(b.tiles[0]);return b.meshes.get(tile.id);}};
}
test('only the signed ordered single-storey roof row can carry the authored tone',()=>{
 assert.equal(sha(block),tile.sha256);
 assert.equal(sha(Buffer.from(JSON.stringify(rows[26]))),'ada7ed24d6d4636f5b0433ba1034ed36ff4b14fb0bfb37d5f7827f68b8ea7f41');
 assert.equal(olearyAccessRoofOrdinal(atlas.sha256,tile,sha(block),rows),26);
 assert.equal(olearyAccessRoofOrdinal(atlas.sha256,tile,undefined,rows),undefined);
 for(const change of [(r:any)=>r[26].footprint.reverse(),(r:any)=>r[26].height+=.1,
   (r:any)=>r[26].holes=[],(r:any)=>[r[26],r[27]]=[r[27],r[26]]]){
  const c=structuredClone(rows);change(c);
  assert.equal(olearyAccessRoofOrdinal(atlas.sha256,tile,sha(block),c),undefined);
 }
});
test('the preview loses on explicit O’Leary actor, Detail, local veto or special replay',()=>{
 const q=(s:string)=>sceneryOptions('departure=oleary-railway-low&olearyAccessRoofReview'+s);
 assert(olearyAccessRoofRequested(q('')));
 for(const s of ['&stockOlearyAccessRoof','&scenery=detail','&olearyExteriorStudy','&olearyWarehouseStudy','&qa=%7B%7D'])
  assert(!olearyAccessRoofRequested(q(s)));
 assert(olearyExteriorRequested(q('&olearyExteriorStudy')));
});
test('live emitter changes only the 30 exact flat roof colors, preserving the resident material',async()=>{
 const a=context(),b=context(),stock=await a.load();b.b.enableOlearyAccessRoof();
 const next=await b.load();assert.equal(b.headers.length,1);
 assert(b.b.olearyAccessRoofActive);assert(!a.b.olearyAccessRoofActive);
 assert.equal(next.material.vertexShader,stock.material.vertexShader);
 assert.equal(next.material.fragmentShader,stock.material.fragmentShader);
 assert.deepEqual(next.geometry.boundingSphere,stock.geometry.boundingSphere);
 assert.equal(stock.geometry.index,null);assert.equal(next.geometry.index,null);
 assert.equal(stock.geometry.groups.length,0);assert.equal(next.geometry.groups.length,0);
 assert.equal(next.geometry.attributes.position.count,32049);
 const c=new Float32Array(new Color(OLEARY_ACCESS_ROOF_COLOR).toArray()), old=stock.geometry.attributes.color.array,newer=next.geometry.attributes.color.array;
 for(const [k,v] of Object.entries(stock.geometry.attributes) as [string,any][]){
  if(k==='color')continue;assert.deepEqual(bytes(next.geometry.attributes[k].array),bytes(v.array),k);
 }
 assert.deepEqual(bytes(old.subarray(0,3*1842)),bytes(newer.subarray(0,3*1842)));
 assert.deepEqual(bytes(old.subarray(3*1872)),bytes(newer.subarray(3*1872)));
 for(let k=1842;k<1872;k++){
  assert.equal(next.geometry.attributes.topFlag.getX(k),1);assert.equal(next.geometry.attributes.facadeStyle.getX(k),0);
  assert.deepEqual(newer.subarray(k*3,k*3+3),c);
  assert.notDeepEqual(old.subarray(k*3,k*3+3),c);
 }
});
test('different valid gzip or an existing exterior seat cannot color the original roof',async()=>{
 const different=Uint8Array.from(block);different[4]^=1;
 const a=context(different);a.b.enableOlearyAccessRoof();const m=await a.load();
 assert(m);assert(!a.b.olearyAccessRoofActive);
 const b=context();b.b.enableOlearyAccessRoof();b.b.olearySeat={};
 const tile=b.b.tiles[0],q=b.b.generate(rows,tile,false,undefined,false,sha(block));
 assert.equal(q.userData.olearyAccessRoofTone,undefined);
});
