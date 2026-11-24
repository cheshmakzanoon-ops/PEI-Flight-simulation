import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {DOWNTOWN_ATLAS,DOWNTOWN_TILES,downtownTilePin,downtownWireAllows,downtownSceneryCompatible} from '../src/render/summerside-roof-source.ts';

test('Summerside roof cohort checks its exact atlas chunk, including gzip metadata',async()=>{
 const index=JSON.parse(readFileSync(new URL('../public/world/buildings/index.json',import.meta.url),'utf8'));
 const packed=readFileSync(new URL('../public/world/buildings/tiles.pack',import.meta.url));
 for(const source of Object.values(DOWNTOWN_TILES)){
  const tile=index.tiles.find((t:{id:string})=>t.id===source.id);
  const pin=downtownTilePin(index.sha256,tile);
  assert.equal(pin,source);
  assert(!downtownTilePin('0'.repeat(64),tile));
  for(const update of [{id:'q03200301'},{count:tile.count+1},{offset:tile.offset+1},{bytes:tile.bytes-1},{bounds:[...tile.bounds.slice(0,3),tile.bounds.at(-1)+.000001]}])
   assert(!downtownTilePin(DOWNTOWN_ATLAS,{...tile,...update}));
  const wire=Uint8Array.from(packed.subarray(source.offset,source.offset+source.bytes));
  assert(await downtownWireAllows(source,wire.buffer));
  assert(!await downtownWireAllows(source,wire.slice(0,-1).buffer));
  const exact=gunzipSync(wire);
  wire[4]^=1; // Changing only mtime retains valid decompression and decoded data.
  assert.deepEqual(gunzipSync(wire),exact);
  assert(!await downtownWireAllows(source,wire.buffer));
 }
});

test('Summerside roofs leave station, detail, docks, and alternate ground on exact stock mode',()=>{
 for(const a of ['','?townWallStudy','?departure=spinnakers-low','?departure=summerside'])assert(downtownSceneryCompatible(new URLSearchParams(a)));
 for(const u of ['?summersideStationReview','?summersideStationReview&buildingShadows','?northBaywalkPreview&spinnakersPreview','?spinnakersPreview','?northBaywalkPreview','?northBaywalkConcrete','?scenery=detail','?buildingShadows','?inlandRelief','?surveyRelief'])
  assert(!downtownSceneryCompatible(new URLSearchParams(u)),u);
});
