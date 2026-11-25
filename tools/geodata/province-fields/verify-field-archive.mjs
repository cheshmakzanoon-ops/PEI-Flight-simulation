/** Exercise the runtime decoder for every actual pack slice, without downloading unrelated assets. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {FieldShardSource,FIELD_SHARD_SIDE,FIELD_SHARD_HALO as H} from '../../../src/sim/field-shards.ts';
import {FIELD_DIRECTORY_PIN as pin} from '../../../src/render/province-fields.generated.ts';
const [,,dir,out]=process.argv;if(!out)throw Error('usage: verify-field-archive ARCHIVE REPORT');
const root=resolve(dir),buffers=new Map();
let transfers=0,actuallyTransferred=0;
const serve=async (input,options)=>{
 const file=new URL(String(input)).pathname.split('/').pop();
 if(!buffers.has(file))buffers.set(file,readFileSync(resolve(root,file)));
 const v=buffers.get(file),range=new Headers(options?.headers).get('Range');
 if(!range)return new Response(new Uint8Array(v));
 const m=range.match(/^bytes=(\d+)-(\d+)$/),start=Number(m[1]),end=Number(m[2]);
 ++transfers;actuallyTransferred+=end-start+1;
 return new Response(new Uint8Array(v.subarray(start,end+1)),{status:206,headers:{'Content-Range':`bytes ${start}-${end}/${v.length}`}});
};
const source=await FieldShardSource.open('https://example.test/',pin,serve);
assert.ok(source);
let positives=0,shards=0;
for(const key of source.dir.cells){
 const body=await source.load(key[1]);assert.ok(body,`Failed shard ${key[0]}`);
 for(let z=H;z<FIELD_SHARD_SIDE-H;z++)for(let x=H;x<FIELD_SHARD_SIDE-H;x++)
  positives+=body[(z*FIELD_SHARD_SIDE+x)*2+1]>0?1:0;
 shards++;
}
const info=JSON.parse(readFileSync(resolve(root,'source.json'),'utf8'));
assert.equal(positives,info.samples);assert.equal(actuallyTransferred,info.packBytes);
assert.equal(shards,source.dir.cells.size);assert.equal(positives,4767146);assert.equal(shards,1525);
// A 480 m radius cannot span three 1,024 m interiors on either axis.
// Every possible nearby set is contained in one of these four-corner groups.
const visited=new Set();let maxRangeBytes=0,maxColdFullPackBytes=0;
for(const c of source.dir.cells.values())for(const x of [c.x,c.x+1])for(const z of [c.z,c.z+1]){
 const corner=x+':'+z;if(visited.has(corner))continue;visited.add(corner);
 const adjacent=[source.dir.cells.get((x-1)+':'+(z-1)),source.dir.cells.get(x+':'+(z-1)),
  source.dir.cells.get((x-1)+':'+z),source.dir.cells.get(x+':'+z)].filter(Boolean);
 maxRangeBytes=Math.max(maxRangeBytes,adjacent.reduce((n,v)=>n+v.size,0));
 const packs=new Set(adjacent.map(c=>c.pack));
 maxColdFullPackBytes=Math.max(maxColdFullPackBytes,[...packs].reduce((n,p)=>n+source.dir.packs[p].size,0));
}
assert.equal(maxRangeBytes,14317);assert.equal(maxColdFullPackBytes,262747);
writeFileSync(out,JSON.stringify({shards,transfers,positives,actuallyTransferred,maxRangeBytes,maxColdFullPackBytes},null,2)+'\n');
console.log(shards,'shards and',positives,'strict 4m centers verified through real reader');
