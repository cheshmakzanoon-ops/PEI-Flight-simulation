import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {closeSync,openSync,readFileSync,readSync} from 'node:fs';
import test from 'node:test';
import {gunzipSync} from 'node:zlib';
import {Color,Scene,Texture,type BufferAttribute,type BufferGeometry,type Mesh,type ShaderMaterial} from 'three';
import * as profile from '../src/app/scenery-profile.ts';
import {Buildings} from '../src/render/buildings.ts';
import {RUSTICO_HARBOUR_ROOF_ROW,RUSTICO_HARBOUR_ROOF_TONE,rusticoHarbourRoofAllows,rusticoHarbourRoofAtlasAllows} from '../src/render/rustico-harbour-roof.ts';
import {PackedBytes} from '../src/sim/packed-bytes.ts';
import {Terrain} from '../src/sim/terrain.ts';

const path=(name:string)=>new URL('../public/world/'+name,import.meta.url);
const json=(name:string)=>JSON.parse(readFileSync(path(name),'utf8'));
const sha=(data:Uint8Array)=>createHash('sha256').update(data).digest('hex');
const atlas=json('buildings/index.json'),tile=atlas.tiles.find((t:{id:string})=>t.id==='q03330');
const meta=json('terrain.json'), heights=gunzipSync(readFileSync(path(meta.file)));
const terrain=new Terrain(meta,new Int16Array(heights.buffer,heights.byteOffset,heights.byteLength/2));
const body=new Uint8Array(tile.bytes);
const fd=openSync(path('buildings/'+atlas.file),'r');
try {assert.equal(readSync(fd,body,0,tile.bytes,tile.offset),tile.bytes);}finally{closeSync(fd);}
const wire=sha(body),rows=JSON.parse(gunzipSync(body).toString('utf8')).features;
const q=(search:string)=>profile.sceneryOptions(search);
type Entry={footprint:[number,number][];height:number;minHeight?:number;holes?:[number,number][][]};
type Draw=Mesh<BufferGeometry,ShaderMaterial>;
type TestBuildings=Pick<Buildings,'enableRusticoHarbourRoof'|'rusticoHarbourRoofActive'|'rusticoMassingPreviewActive'|'diagnostics'> & {
 wanted:Set<string>;tiles:typeof atlas.tiles;meshes:Map<string,Draw>;
 load:(tile:typeof atlas.tiles[number])=>Promise<void>;
 generate:(rows:Entry[],tile:typeof atlas.tiles[number],wharf:boolean,ord:number,barn:boolean,chunk:string)=>Draw;
};
const TestBuildings=Buildings as unknown as new(...args:unknown[])=>TestBuildings;
function owner(neighbour=false,readyPack?:PackedBytes,manifest=tile,atlasHash=atlas.sha256){
 const scene=new Scene();scene.environment=new Texture();
 const b=new TestBuildings(scene,terrain,[manifest],readyPack,atlasHash,undefined,undefined,undefined,undefined,false,undefined,undefined,neighbour);
 return {b,scene};
}
const exactRoof=(neighbor:boolean)=>neighbor?[25245,25257]:[25128,25140];
const bytes=(a:ArrayBufferView)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const resource=(data=body,m=tile)=>{
 const requests:(string|null)[]=[];
 const range='bytes='+m.offset+'-'+(m.offset+m.bytes-1);
 const pack=new PackedBytes('https://fixture.invalid/world/buildings/'+atlas.file,atlas.bytes,async (_input,options)=>{
  requests.push(new Headers(options?.headers).get('Range'));
  assert.equal(requests.at(-1),range);
  return new Response(Uint8Array.from(data),{status:206,headers:{'content-range':range.slice(0,5)+' '+range.slice(6)+'/'+atlas.bytes}});
 });
 return {pack,requests,range};
};
const swapped=(alter:(data:Entry[])=>void)=>{
 const data=structuredClone(rows) as Entry[];alter(data);return data;
};
const emit=(b:TestBuildings,chunk=wire)=>b.generate(rows,b.tiles[0],false,RUSTICO_HARBOUR_ROOF_ROW,false,chunk);
const expectedSrgb=(c:Float32Array,at:number)=>new Color().setRGB(c[at*3],c[at*3+1],c[at*3+2]).getHexString();
const materialHash=(m:ShaderMaterial)=>sha(Buffer.from(m.vertexShader+'\0'+m.fragmentShader));
function attrs(m:Draw){return Object.keys(m.geometry.attributes).sort();}
function attr(m:Draw,name:string){return m.geometry.getAttribute(name) as BufferAttribute;}
function same(a:Draw,b:Draw){
 assert.deepEqual(attrs(a),attrs(b));
 for(const k of attrs(a)){const aa=attr(a,k),bb=attr(b,k);assert.equal(aa.itemSize,bb.itemSize);assert.deepEqual(bytes(aa.array),bytes(bb.array),k);}
 assert.deepEqual(a.position.toArray(),b.position.toArray());
 assert.equal(materialHash(a.material),materialHash(b.material));
}

test('require exact manifest, compressed bytes and ordered owner, never address or neighbouring/shifted row',()=>{
 assert.equal(wire,'14fca913cea9bc4ef9c41072448765e8328dd4a91b26723ab0573c7e4b1ef9fa');
 assert.equal(wire,tile.sha256);
 assert.equal(sha(Buffer.from(JSON.stringify(rows[377]))),'1252cf3c071a7aa7d7017877ee107139722fbb7cc44454c65f40cabb78d6ae21');
 assert.equal(rusticoHarbourRoofAtlasAllows(atlas.sha256,tile),true);
 assert.equal(rusticoHarbourRoofAllows(atlas.sha256,tile,wire,rows),true);
 for(const m of [{id:'q03331'},{count:673},{offset:tile.offset+1},{bytes:tile.bytes+1},
  {bounds:[tile.bounds[0],tile.bounds[1],tile.bounds[2],tile.bounds[3]+1e-10]}]){
  assert.equal(rusticoHarbourRoofAllows(atlas.sha256,{...tile,...m},wire,rows),false);
 }
 assert.equal(rusticoHarbourRoofAllows('other',tile,wire,rows),false);
 assert.equal(rusticoHarbourRoofAllows(atlas.sha256,tile,'other',rows),false);
 assert.equal(rusticoHarbourRoofAllows(atlas.sha256,tile,undefined,rows),false);
 assert.equal(rusticoHarbourRoofAllows(atlas.sha256,tile,wire,rows.slice(1)),false);
 for(const change of [(r:Entry[])=>{r[377].footprint.reverse();},(r:Entry[])=>{r[377].height+=.01;},
  (r:Entry[])=>{r[377].minHeight=4.58;},(r:Entry[])=>{r[377].holes=[];},(r:Entry[])=>{r[377].footprint[0][0]+=1e-7;},
  (r:Entry[])=>{r[377]=r[428];},(r:Entry[])=>{[r[377],r[268]]=[r[268],r[377]];}]){
  assert.equal(rusticoHarbourRoofAllows(atlas.sha256,tile,wire,swapped(change)),false);
 }
});

test('Standard selects this alone; veto and existing optional /268 do not change any other selector',()=>{
 const usual='departure=north-rustico-harbour-low';
 for(const extra of ['','&scenery=standard','&diagnostics','&rusticoMassingReview','&northRusticoLighthouseStudy','&legacyRusticoMassing'])
  assert.equal(profile.rusticoHarbourRoofRequested(q(usual+extra)),true);
 for(const extra of ['&stockRusticoHarbourRoof','&scenery=detail','&scenery=standard&scenery=detail',
  '&scenery=unknown','&unknown','&inlandRelief','&surveyRelief','&buildingShadows'])
  assert.equal(profile.rusticoHarbourRoofRequested(q(usual+extra)),false);
 const selectors=Object.entries(profile).filter(([key,fn])=>typeof fn==='function'&&key!=='rusticoHarbourRoofRequested'&&(
  /^standard/.test(key)||/(Requested|Profile)$/.test(key)));
 const sets=['','&rusticoMassingReview','&northRusticoLighthouseStudy','&summersideTerminalWallPreview',
  '&olearyExteriorStudy&olearyWarehouseStudy&diagnostics&qa=%7B%22olearyIndustrial192%22%3Atrue%7D',
  '&dalvayExteriorStudy&dalvayGlazingStudy&dalvayWaterOptics','&basilicaExteriorStudy&basilicaYardSun','&scenery=detail'];
 for(const extra of sets){
  const baseline=q(usual+extra),veto=q(usual+extra+'&stockRusticoHarbourRoof');
  for(const [key,fn] of selectors){
   const select=fn as (opts:URLSearchParams)=>unknown;
   assert.deepEqual(select(veto),select(baseline),key+' '+extra);
  }
 }
 assert.equal(profile.standardPrinceSurveyRoof(q(usual+'&rusticoMassingReview')),false);
 assert.equal(profile.standardOpenRipplesRequested(q(usual+'&stockRusticoHarbourRoof')),true);
});

for(const neighbour of [false,true]){
 test(`authentic Three emission changes exactly the 12 roof colours in ${neighbour?'signed /268 mixed':'ordinary aggregated'} layout`,t=>{
  const {b}=owner(neighbour);
  const stock=emit(b);b.enableRusticoHarbourRoof();const active=emit(b);
  assert.equal(active.geometry.index,null);assert.equal(stock.geometry.index,null);
  assert.equal(stock.geometry.groups.length,0);assert.equal(active.geometry.groups.length,0);
  assert.equal(stock.material,active.material);assert.equal(stock.material.vertexColors,true);
  assert.deepEqual(active.geometry.drawRange,stock.geometry.drawRange);
  assert.deepEqual(active.geometry.boundingSphere,stock.geometry.boundingSphere);
  assert.deepEqual(active.position.toArray(),stock.position.toArray());
  assert.equal(stock.userData.rusticoHarbourRoofTone,undefined);
  assert.equal(active.userData.rusticoHarbourRoofTone,true);
  assert.deepEqual({...active.userData,rusticoHarbourRoofTone:undefined},{...stock.userData,rusticoHarbourRoofTone:undefined});
  assert.equal(!!active.userData.rusticoMassing,neighbour);
  assert.equal(b.rusticoHarbourRoofActive,false,'generated draw is not yet a resident scene child');
  const [lo,hi]=stock.userData.beaconTriangles,[roofLo,roofHi]=exactRoof(neighbour);
  assert.deepEqual([lo,hi],neighbour?[25221,25263]:[25104,25146]);
  assert.equal(roofLo,lo+24);assert.equal(hi-roofHi,6);
  const count=neighbour?38067:37950;
  const source=attr(stock,'color').array as Float32Array,next=attr(active,'color').array as Float32Array;
  assert.equal(source.length,count*3);assert.equal(next.length,count*3);
  assert.deepEqual(attrs(stock),attrs(active));
  const roles=attr(active,'topFlag'),style=attr(active,'facadeStyle');
  for(const k of attrs(stock))if(k!=='color')assert.deepEqual(bytes(attr(stock,k).array),bytes(attr(active,k).array),k);
  assert.deepEqual(bytes(source.subarray(0,roofLo*3)),bytes(next.subarray(0,roofLo*3)));
  assert.deepEqual(bytes(source.subarray(roofHi*3)),bytes(next.subarray(roofHi*3)));
  const expected=new Float32Array(new Color(RUSTICO_HARBOUR_ROOF_TONE).toArray());
  let deltas=0;
  for(let i=lo;i<hi;i++){
   assert.equal(style.getX(i),0);
   const roof=i>=roofLo&&i<roofHi;assert.equal(roles.getX(i),roof?1:0);
   if(!roof)continue;
   const local=next.subarray(i*3,i*3+3);
   assert.deepEqual(local,expected);
   for(let k=0;k<3;k++)if(source[i*3+k]!==local[k])deltas++;
  }
  assert.equal(deltas,36);
  assert.equal(expectedSrgb(source,roofLo),'826c58');
  assert.equal(expectedSrgb(next,roofLo),'aeb1aa');
  const wrong=swapped(r=>{r[377].minHeight=4.58;});
  const mutated=b.generate(wrong,b.tiles[0],false,377,false,wire);
  assert.equal(mutated.userData.rusticoHarbourRoofTone,undefined);
  t.diagnostic(JSON.stringify({neighbour,count,lo,hi,roof:[roofLo,roofHi],changedScalars:deltas,
   stockRGB:Array.from(source.subarray(roofLo*3,roofLo*3+3)),activeRGB:Array.from(expected),
   stockColorSHA:sha(bytes(source)),activeColorSHA:sha(bytes(next)),shader:materialHash(active.material)}));
 });
}

test('ordinary load and surgical veto each request one existing Range; /268 shares one digest',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'crypto')!;
 const real=globalThis.crypto;
 let calls=0;
 const byDigest={subtle:{digest:(algorithm:AlgorithmIdentifier,data:BufferSource)=>{calls++;return real.subtle.digest(algorithm,data);}}};
 try{
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:byDigest});
  for(const neighbour of [false,true])for(const use of [true,false]){
   const {pack,requests,range}=resource(),{b,scene}=owner(neighbour,pack);
   const opts=q('scenery=standard&departure=north-rustico-harbour-low'+(neighbour?'&rusticoMassingReview':'')+(use?'':'&stockRusticoHarbourRoof'));
   if(profile.rusticoHarbourRoofRequested(opts))b.enableRusticoHarbourRoof();
   b.wanted.add(tile.id);const start=calls;await b.load(b.tiles[0]);
   assert.deepEqual(requests,[range]);assert.equal(calls-start,Number(use||neighbour));
   assert.equal(b.diagnostics().failed,0);assert.equal(b.diagnostics().ready,1);
   const m=b.meshes.get(tile.id)!;assert.equal(m.parent,scene);
   assert.equal(b.rusticoHarbourRoofActive,use);
   assert.equal(b.rusticoMassingPreviewActive,neighbour);
   const roofAt=exactRoof(neighbour)[0];
   assert.equal(expectedSrgb(attr(m,'color').array as Float32Array,roofAt),use?'aeb1aa':'826c58');
   scene.remove(m);assert.equal(b.rusticoHarbourRoofActive,false);m.geometry.dispose();
  }
 }finally{Object.defineProperty(globalThis,'crypto',original);}
});

test('valid but unsigned bytes, unsigned metadata, no crypto and a rejected digest keep stock draw',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'crypto')!;
 const real=globalThis.crypto;
 const unsigned=body.slice();unsigned[4]^=1; // gzip mtime changes, payload still decodes byte-identically
 assert.deepEqual(gunzipSync(unsigned),gunzipSync(body));assert.notEqual(sha(unsigned),wire);
 const negatives=[
  {data:unsigned,manifest:tile,atlas:atlas.sha256,ctx:real},
  {data:body,manifest:{...tile,count:tile.count+1},atlas:atlas.sha256,ctx:real},
  {data:body,manifest:tile,atlas:'unknown',ctx:real},
  {data:body,manifest:tile,atlas:atlas.sha256,ctx:undefined},
  {data:body,manifest:tile,atlas:atlas.sha256,ctx:{subtle:{digest:async()=>{throw Error('test digest fault');}}}},
 ];
 const expected=emit(owner().b);
 try{
  for(const n of negatives){
   Object.defineProperty(globalThis,'crypto',{configurable:true,value:n.ctx});
   const {pack,requests,range}=resource(n.data,n.manifest),{b}=owner(false,pack,n.manifest,n.atlas);
   b.enableRusticoHarbourRoof();b.wanted.add(tile.id);await b.load(b.tiles[0]);
   assert.deepEqual(requests,[range]);assert.equal(b.diagnostics().failed,0);
   assert.equal(b.rusticoHarbourRoofActive,false);
   const m=b.meshes.get(tile.id)!;assert.ok(m);
   if(n.atlas===atlas.sha256)same(expected,m);
   else assert.equal(m.userData.rusticoHarbourRoofTone,undefined);
   m.geometry.dispose();
  }
 }finally{Object.defineProperty(globalThis,'crypto',original);}
});

test('stale in-flight verified chunk does not mount, exact re-entry loads one new tile',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'crypto')!;
 const real=globalThis.crypto;
 let entered=()=>{},resume=()=>{},calls=0;
 const enteredGate=new Promise<void>(r=>{entered=r;});
 const blocked=new Promise<void>(r=>{resume=r;});
 try{
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:{subtle:{digest:async (algorithm:AlgorithmIdentifier,data:BufferSource)=>{
   if(!calls++){entered();await blocked;}return real.subtle.digest(algorithm,data);
  }}}});
  const {pack,requests,range}=resource(),{b,scene}=owner(false,pack);
  b.enableRusticoHarbourRoof();b.wanted.add(tile.id);const flight=b.load(b.tiles[0]);
  await enteredGate;b.wanted.clear();resume();await flight;
  assert.equal(b.rusticoHarbourRoofActive,false);assert.equal(b.meshes.size,0);assert.equal(scene.children.length,0);
  assert.deepEqual(requests,[range]);
  b.wanted.add(tile.id);await b.load(b.tiles[0]);
  assert.deepEqual(requests,[range,range]);assert.equal(calls,2);assert.equal(b.rusticoHarbourRoofActive,true);
  assert.equal(scene.children.length,1);
 }finally{resume();Object.defineProperty(globalThis,'crypto',original);}
});
