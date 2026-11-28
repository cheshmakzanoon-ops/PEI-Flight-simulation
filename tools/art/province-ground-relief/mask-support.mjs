import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {FieldShardSource} from '../../../src/sim/field-shards.ts';
import {GRASS_DIRECTORY_PIN} from '../../../src/render/province-grass.generated.ts';
const [repo,rule,out]=process.argv.slice(2);
const plan=JSON.parse(readFileSync(rule));
const read=n=>readFileSync(resolve(repo,'public/world',n));
const sha=b=>createHash('sha256').update(b).digest('hex');
const local=async(url,o={})=>{
 assert(url.startsWith('atlas:grass-study/'));
 const path=url.slice(6),bytes=read(path),r=new Headers(o.headers??{}).get('range');
 if(!r)return new Response(new Uint8Array(bytes),{status:200,headers:{'Content-Length':String(bytes.length)}});
 const match=/^bytes=(\d+)-(\d+)$/.exec(r);
 assert(match);
 const a=Number(match[1]),b=Number(match[2]);assert(a<=b&&b<bytes.length);
 const raw=bytes.subarray(a,b+1);
 return new Response(new Uint8Array(raw),{status:206,headers:{'Content-Range':`bytes ${a}-${b}/${bytes.length}`,'Content-Length':String(raw.length)}});
};
const f=await FieldShardSource.open('atlas:grass-study/',GRASS_DIRECTORY_PIN,local);
assert(f&&f.dir.cells.size===3331);
const rows={};
mkdirSync(out);
for(const w of plan.windows){
 const c=f.dir.cells.get(w.grassShard);assert(c);
 const p=await f.load(c);assert(p&&sha(p)===c.decodedHash&&p.byteLength===135200);
 const name=w.id+'-signed-grass.rg8';
 writeFileSync(resolve(out,name),p,{flag:'wx'});
 rows[w.id]={name,boxStart:[c.x*1024,c.z*1024],spanM:1024,cellM:4,side:260,haloCells:2,shard:c.key,sha256:sha(p)};
}
writeFileSync(resolve(out,'mask-receipt.json'),JSON.stringify({directory:GRASS_DIRECTORY_PIN,rows},null,2)+'\n',{flag:'wx'});
