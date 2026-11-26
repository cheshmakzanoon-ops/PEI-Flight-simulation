import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {INLAND_ORTHO_WINDOWS,inlandSourceWindows} from '../src/render/inland-ortho-windows.ts';

const root = new URL('../public/world/',import.meta.url);
const file = (str: string) => readFileSync(new URL(str,root));
const sha = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');

test('eastern joins are admitted by the actual signed cover and atlas bytes',()=>{
 const index=file('detail/index.json'), bytes=gunzipSync(file('cover.bin.gz'));
 assert.equal(sha(index),'a92bad71e77dfb72cf02c7e4934543a86f9ac528f0cee057ddcdb16c724e1207');
 assert.equal(sha(bytes),'e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9');
 const atlas=JSON.parse(index.toString()),cover={bytes,width:4096,height:2720};
 const all=inlandSourceWindows(cover), signed=new Map<number,Buffer>();
 for (const [name,first,second] of [
  ['kings-central-cropland','21-13','22-13'],
  ['queens-south-grassland','20-20','20-21'],
  ['kings-shared-fields','21-17','22-17'],
  ['queens-eastern-grassland','19-13','20-13'],
 ] as const) {
  const plan=INLAND_ORTHO_WINDOWS.find(x=>x.name===name);
  assert.ok(plan && all.includes(name));
  assert.deepEqual([plan.first,plan.second],[first,second]);
  for (const [id,digest] of [[first,plan.nsha],[second,plan.ssha]]) {
   const slice=atlas.tiles[id], desc=atlas.packs[slice.pack];
   if (!signed.has(slice.pack)) {
    const data=file('detail/'+desc.file);
    assert.equal(sha(data),desc.sha256);assert.equal(data.length,desc.bytes);
    signed.set(slice.pack,data);
   }
   const raw=signed.get(slice.pack)!.subarray(slice.offset,slice.offset+slice.bytes);
   assert.equal(raw.length,slice.bytes);
   assert.equal(sha(raw),digest);
   assert.equal(slice.sha256,digest);
  }
  const [x,z]=plan.coverBox, pos=2*(z*cover.width+x)+1;
  const held=bytes[pos];
  assert.equal(held,255);bytes[pos]^=1;
  assert.deepEqual(inlandSourceWindows(cover),all.filter(x=>x!==name));
  bytes[pos]=held;
 }
 assert.deepEqual(inlandSourceWindows(cover),all);
});
