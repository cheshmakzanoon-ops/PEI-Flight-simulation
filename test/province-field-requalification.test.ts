import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {checkedFieldRelief} from '../src/render/fields-pilot.ts';
import {checkedFieldOwners} from '../src/render/province-field-owners.ts';
import {fieldLayersMatch} from '../src/render/province-fields.ts';
import {FIELD_DIRECTORY_PIN as pin,FIELD_SITE_PINS as site} from '../src/render/province-fields.generated.ts';
import {FieldShardSource} from '../src/sim/field-shards.ts';
const parent={packedSize:111398,rawSize:118760,packedHash:'2c724896d98aea2e83dcdefe849e4159e4f3455ebd762434fee23da0791ee4d8',rawHash:'061f4917037dc66a73cf3ab078e93e99d7bebf90a93a151fbc13b88107bb6563'};
function respond(bytes:Uint8Array){return async()=>new Response(new Uint8Array(bytes));}
test('corrected generation authenticates both directory representations; old pins and stale-sized responses cannot admit a layer',async()=>{
 const wire=readFileSync(new URL('../public/world/fields-province/v2/index.fcr.gz',import.meta.url));
 const raw=gunzipSync(wire);
 for(const representation of [wire,raw]){
  const correct=await FieldShardSource.open('/world/fields-province/v2/',pin,respond(representation));
  assert.equal(correct?.dir.cells.size,1525);assert.equal(correct?.dir.packs.length,42);
  assert.equal(await FieldShardSource.open('/world/fields-province/v2/',parent,respond(representation)),undefined);
 }
 for(const size of [parent.packedSize,parent.rawSize])assert.equal(await FieldShardSource.open('v2/',pin,respond(new Uint8Array(size))),undefined);
});
test('relief is authenticated independently and Expanded farmland never needs the historical three-site mask',async()=>{
 const original=readFileSync(new URL('../public/world/furrow-relief.webp',import.meta.url));const urls:string[]=[];
 const relief=await checkedFieldRelief('/world/',async path=>{urls.push(String(path));return new Response(new Uint8Array(original));});
 assert.equal(relief?.byteLength,original.length);assert.deepEqual(urls,['/world/furrow-relief.webp']);
 const corrupt=new Uint8Array(original);corrupt[5]^=1;
 assert.equal(await checkedFieldRelief('/world/',respond(corrupt)),undefined);
});
test('updated source owners refuse stale pins, incomplete infrastructure, and unverified decoded cover',async()=>{
 assert.equal(await checkedFieldOwners(site.owners),true);assert.equal(await checkedFieldOwners('0'.repeat(64)),false);
 const args=[site.roads,site.buildings,site.sidewalk,site.parking,site.coverDecoded] as [string|undefined,string|undefined,string|undefined,string|undefined,string|undefined];
 assert.equal(fieldLayersMatch(...args),true);
 for(let i=0;i<args.length;i++){
  const q=[...args]as typeof args;q[i]=undefined;assert.equal(fieldLayersMatch(...q),false);
  q[i]='f'.repeat(64);assert.equal(fieldLayersMatch(...q),false);
 }
});
