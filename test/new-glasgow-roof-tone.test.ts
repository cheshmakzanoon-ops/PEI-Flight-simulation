import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {closeSync,openSync,readFileSync,readSync} from 'node:fs';
import test from 'node:test';
import {gunzipSync} from 'node:zlib';
import {Color,Scene, type BufferAttribute,type BufferGeometry,type Mesh,type ShaderMaterial} from 'three';
import * as profile from '../src/app/scenery-profile.ts';
import {basinCanneryFinishConsent} from '../src/app/basin-cannery-option.ts';
import {eastRimConsent} from '../src/app/east-roof-rim-option.ts';
import {northCapeLightOption} from '../src/app/north-cape-light-option.ts';
import {northCapeStandOption} from '../src/app/north-cape-stand-option.ts';
import {railShingleConsent} from '../src/app/rail-shingle-option.ts';
import {eastPointWallOption} from '../src/render/east-wall-preview.ts';
import {standardSeawardRoof} from '../src/render/quartermaster-seaward/lease.ts';
import {queensDispatchStandProfile} from '../src/render/queens-dispatch-contract.ts';
import {Buildings} from '../src/render/buildings.ts';
import {NEW_GLASGOW_ROOF_ROW as row,NEW_GLASGOW_ROOF_TONE as tone,newGlasgowRoofAllows} from '../src/render/new-glasgow-roof-tone.ts';
import {PackedBytes} from '../src/sim/packed-bytes.ts';
import {Terrain} from '../src/sim/terrain.ts';

const asset=(p:string)=>new URL('../public/world/'+p,import.meta.url);
const json=(p:string)=>JSON.parse(readFileSync(asset(p),'utf8'));
const digest=(a:Uint8Array)=>createHash('sha256').update(a).digest('hex');
const atlas=json('buildings/index.json'),tile=atlas.tiles.find((t:{id:string})=>t.id==='q03301');
const terrainSpec=json('terrain.json'),terrainWords=gunzipSync(readFileSync(asset(terrainSpec.file)));
const terrain=new Terrain(terrainSpec,new Int16Array(terrainWords.buffer,terrainWords.byteOffset,terrainWords.byteLength/2));
const fd=openSync(asset('buildings/'+atlas.file),'r'),wire=new Uint8Array(tile.bytes);
try{assert.equal(readSync(fd,wire,0,wire.length,tile.offset),wire.length);}finally{closeSync(fd);}
const chunk=digest(wire),rows=JSON.parse(gunzipSync(wire).toString('utf8')).features;
const query=(s:string)=>profile.sceneryOptions('departure=new-glasgow-field-edge'+s);
type B=Pick<Buildings,'enableNewGlasgowRoofTone'|'newGlasgowRoofToneActive'|'diagnostics'> & {
  wanted:Set<string>;tiles:typeof atlas.tiles;meshes:Map<string,Mesh<BufferGeometry,ShaderMaterial>>;
  load:(t:typeof tile)=>Promise<void>;
  generate:(r:typeof rows,t:typeof tile,wharf:boolean,selector:number,barn:boolean,hash:string)=>Mesh<BufferGeometry,ShaderMaterial>;
};
const NewBuildings=Buildings as unknown as new(...args:unknown[])=>B;
const owner=(pack?:PackedBytes)=> {
 const scene=new Scene(),b=new NewBuildings(scene,terrain,[tile],pack,atlas.sha256);
 return {scene,b};
};
const bytes=(a:ArrayBufferView)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);

test('New Glasgow pale rooftop requires the exact signed source owner and leaves other comparisons alone',()=>{
 assert.equal(chunk,'88b950823701ee69cf16f7f8db068be81d5cf057293c84a5c32127120631777b');
 assert.equal(newGlasgowRoofAllows(atlas.sha256,tile,chunk,rows),true);
 assert.equal(newGlasgowRoofAllows('other atlas',tile,chunk,rows),false);
 assert.equal(newGlasgowRoofAllows(atlas.sha256,tile,undefined,rows),false);
 assert.equal(newGlasgowRoofAllows(atlas.sha256,{...tile,offset:tile.offset+1},chunk,rows),false);
 for(const edit of [(r:any)=>{r[row].footprint.reverse();},(r:any)=>{r[row].height+=.01;},
  (r:any)=>{r[row].holes=[];},(r:any)=>{[r[11],r[row]]=[r[row],r[11]];}]){
  const altered=structuredClone(rows);edit(altered);
  assert.equal(newGlasgowRoofAllows(atlas.sha256,tile,chunk,altered),false);
 }
 for(const suffix of ['','&diagnostics','&scenery=standard','&stockRusticoHarbourRoof']){
  const active=query(suffix),control=query(suffix+'&stockNewGlasgowRoofTone');
  assert.equal(profile.newGlasgowRoofToneRequested(active),true);
  assert.equal(profile.newGlasgowRoofToneRequested(control),false);
  const selectors=Object.entries(profile).filter(([name,value])=>
   typeof value==='function'&&name!=='newGlasgowRoofToneRequested'&&(/^standard/.test(name)||/(Requested|Profile)$/.test(name)));
  for(const [name,check] of selectors){
   const f=check as (q:URLSearchParams)=>unknown;
   const projected=profile.sceneryOptions(profile.withoutNewGlasgowRoofStock(control.toString()));
   assert.deepEqual(f(projected),f(active),name);
  }
 }
 for(const suffix of ['&scenery=detail','&scenery=standard&scenery=standard','&departure=east-light',
  '&surveyRelief','&inlandRelief','&buildingShadows','&unknown','&qa'])
  assert.equal(profile.newGlasgowRoofToneRequested(query(suffix)),false);
});

test('stock roof flag does not modify other raw owner consents or hide unknown arguments',()=>{
 const remove=profile.withoutNewGlasgowRoofStock,key=profile.NEW_GLASGOW_ROOF_STOCK;
 const known=[
  [eastRimConsent,'?departure=east-light&eastPointRimPreview=1'],
  [railShingleConsent,'?departure=spinnakers-low&railShinglePreview=1'],
  [basinCanneryFinishConsent,'?departure=basin-head-low&basinChannel&basinCanneryFinish=1'],
  [(s:string)=>northCapeLightOption(s).route,'?departure=northcape-light-low&northCapeLightPreview'],
  [(s:string)=>eastPointWallOption(s).requested,'?departure=east-light&eastPointWallPreview=1'],
  [(s:string)=>northCapeStandOption(s).requested,'?departure=northcape-wind-low&northCapeStandReview'],
  [(s:string)=>standardSeawardRoof(new URLSearchParams(s)),'?departure=harbour-low&diagnostics'],
  [(s:string)=>queensDispatchStandProfile(new URLSearchParams(s)),'?departure=queens-woodland-view&diagnostics'],
 ] as const;
 for(const [check,base] of known){
  assert.equal(check(base),true);
  assert.equal(remove(base+'&'+key),base);
  assert.equal(check(remove(base+'&'+key)),true);
  const hostile=base+'&unknown=literal%20value&'+key;
  assert.equal(remove(hostile),base+'&unknown=literal%20value');
  assert.equal(check(remove(hostile)),false);
 }
 const ownCapeVeto='?departure=northcape-wind-low&stockNorthCapeStandReview&northCapeStandReview';
 assert.equal(northCapeStandOption(remove(ownCapeVeto+'&'+key)).requested,false);
 const ownRoofVeto='?departure=harbour-low&stockQuartermasterSeawardRoof';
 assert.equal(standardSeawardRoof(new URLSearchParams(remove(ownRoofVeto+'&'+key))),false);
 const literal='?dep%61rture=east-light&&eastPointRimPreview=%31&diagnostics&diagnostics';
 assert.equal(remove('?'+key+'&'+literal.slice(1)+'&%73tockNewGlasgowRoofTone=1'),literal);
 assert.equal(eastRimConsent(remove(literal+'&'+key)),false);
});

test('only the exact flat stock roof RGB changes in the real Three building geometry',()=>{
 const {b}=owner(),emit=()=>b.generate(rows,b.tiles[0],false,row,false,chunk);
 const stock=emit();b.enableNewGlasgowRoofTone();const art=emit();
 assert.equal(stock.material,art.material);
 assert.equal(art.geometry.index,null);
 assert.deepEqual(stock.geometry.drawRange,art.geometry.drawRange);
 assert.deepEqual(stock.geometry.boundingSphere,art.geometry.boundingSphere);
 assert.deepEqual(stock.position.toArray(),art.position.toArray());
 assert.equal(stock.userData.newGlasgowRoofTone,undefined);
 assert.equal(art.userData.newGlasgowRoofTone,true);
 assert.equal(b.newGlasgowRoofToneActive,false);
 const grounds=Object.keys(stock.geometry.attributes).sort();
 assert.deepEqual(grounds,Object.keys(art.geometry.attributes).sort());
 for(const a of grounds)if(a!=='color')assert.deepEqual(bytes(art.geometry.attributes[a].array),bytes(stock.geometry.attributes[a].array),a);
 const [lo,hi]=stock.userData.beaconTriangles as [number,number];
 const a=stock.geometry.attributes.color.array as Float32Array,c=art.geometry.attributes.color.array as Float32Array;
 const top=stock.geometry.attributes.topFlag as BufferAttribute,shade=new Float32Array(new Color(tone).toArray());
 let roof=0;
 for(let k=0;k<top.count;k++){
  if(k>=lo&&k<hi&&top.getX(k)===1){
   roof++;assert.deepEqual(c.subarray(k*3,k*3+3),shade);
   assert.notDeepEqual(a.subarray(k*3,k*3+3),shade);
  }else assert.deepEqual(c.subarray(k*3,k*3+3),a.subarray(k*3,k*3+3));
 }
 assert.equal(roof,18); // six roof triangles in the signed eight-corner plan
});

test('reuse the normal building range and keep original geometry on an unusable digest',async()=>{
 let digestOkay=true,checks=0;
 const crypto=globalThis.crypto,property=Object.getOwnPropertyDescriptor(globalThis,'crypto')!;
 const wrap={subtle:{digest:async (name:AlgorithmIdentifier,source:BufferSource)=>{
  checks++;
  return digestOkay?crypto.subtle.digest(name,source):new ArrayBuffer(32);
 }}};
 try{
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:wrap});
  for(const [requested,good] of [[false,true],[true,true],[true,false]]){
   digestOkay=good;
   const req:string[]=[];
   const pack=new PackedBytes('https://fixture.invalid/world/buildings/tiles.pack',atlas.bytes,async (_url,o)=>{
    req.push(new Headers(o?.headers).get('Range')||'');
    return new Response(Uint8Array.from(wire),{status:206,headers:{'content-range':'bytes 1153102-1160684/3844984'}});
   });
   const {b,scene}=owner(pack);
   if(requested)b.enableNewGlasgowRoofTone();
   b.wanted.add(tile.id);const before=checks;
   await b.load(b.tiles[0]);
   assert.deepEqual(req,['bytes=1153102-1160684']);assert.equal(checks-before,Number(requested));
   assert.equal(b.diagnostics().failed,0);assert.equal(b.meshes.get(tile.id)?.parent,scene);
   assert.equal(b.newGlasgowRoofToneActive,requested&&good);
  }
 }finally{Object.defineProperty(globalThis,'crypto',property);}
});
