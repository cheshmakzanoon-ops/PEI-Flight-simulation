import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {classifiedDirt,decodeRoads} from '../src/render/roads.ts';

const raw=gunzipSync(readFileSync(new URL('../public/world/roads.bin.gz',import.meta.url)));
const array=(b:Buffer)=>Uint8Array.from(b).buffer;
test('unsealed dirt tags are pinned to the exact unmodified PEI road geometry',async()=>{
 const baseline=array(raw);
 const roads=decodeRoads(baseline);
 const bits=await classifiedDirt(baseline,roads.length);
 assert.ok(bits);
 assert.equal(createHash('sha256').update(Buffer.from(bits,'latin1')).digest('hex'),
    'f73430a914bc74ee6cd896782026b1cd403e207c29eda9c1da2a1d2a03cc8cb8');
 const tag=(n:number)=>!!(bits.charCodeAt(n>>3)&(1<<(n&7)));
 assert.equal(roads.filter((_,n)=>tag(n)).length,3366);
 assert.ok(roads.every(({flags},i)=>!(flags&24)||!tag(i)));
 // Distinct adjacent source status, not a whole-road-name approximation.
 assert.ok(tag(4557)&&!tag(4535));  // Walls Rd: dirt and gravel
 assert.ok(tag(8515)&&!tag(8518)); // Warburton Rd: dirt and paved
 assert.ok(tag(10688)&&!tag(12185)&&!tag(14474)); // New Harmony: dirt, gravel, paved
 const mutated=Buffer.from(raw);mutated[20]^=1;
 assert.equal(await classifiedDirt(array(mutated),roads.length),undefined);
 assert.equal(await classifiedDirt(baseline,roads.length-1),undefined);
});
