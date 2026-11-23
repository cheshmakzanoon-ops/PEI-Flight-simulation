import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {ForestStream} from '../src/sim/forest-stream.ts';
import {project} from '../src/sim/geo.ts';
const dir=new URL('../public/world/woodland/stream-v1/',import.meta.url);
const manifest=readFileSync(new URL('index.json',dir),'utf8');
const index=JSON.parse(manifest);
const resolve=(name:string)=>readFileSync(new URL(name,dir));
const [west,south,east,north]=index.bounds;
const target=index.tiles.find((x:{id:string})=>x.id==='13-11');
const source=index.packs[target.pack];
const raw=gunzipSync(resolve(source.file).subarray(target.offset,target.offset+target.bytes));
const px=Array.from({length:300*300},(_,k)=>[k%300+10,Math.floor(k/300)+10])
  .find(([x,y])=>raw[y*324+x]>28&&raw[y*324+x+1]>28&&raw[(y+1)*324+x]>28&&raw[(y+1)*324+x+1]>28)!;
const loc=project(west+(east-west)*(13+(px[0]-1.5)/320)/32,north-(north-south)*(11+(px[1]-1.5)/320)/22);
const fixture=(corrupt=false)=>{
 const responses: string[]=[];
 const fetcher:typeof fetch=async (input,init)=>{
  const file=String(input).split('/').pop()!;
  if(file==='index.json')return new Response(manifest);
  const body=resolve(file),range=new Headers(init?.headers).get('Range')!;
  const [,start,end]=/^bytes=(\d+)-(\d+)$/.exec(range)!;
  const requested=body.subarray(Number(start),Number(end)+1);
  responses.push(file+' '+range);
  const data=corrupt&&file===source.file&&Number(start)===target.offset?new Uint8Array(requested.length):new Uint8Array(requested);
  return new Response(data,{status:206,headers:{'Content-Range':'bytes '+start+'-'+end+'/'+body.length}});
 };
 return {fetcher,responses};
};
test('warm uses a bounded valid region while unsupported and missing locations use the original height',async()=>{
 const {fetcher,responses}=fixture();
 const stream=new ForestStream('/',fetcher);
 assert.equal(stream.height(loc.x,loc.z,11,.5),11);
 await stream.warm(loc.x,loc.z,1200);
 assert.ok(stream.height(loc.x,loc.z,11,.5)>11);
 assert.equal(stream.height(loc.x+500000,loc.z,11,.5),11);
 assert.ok(responses.some(x=>x===source.file+' bytes='+target.offset+'-'+(target.offset+target.bytes-1)));
 assert.ok(stream.state.resident<=26);
 assert.ok(stream.state.inflight<=2);
});
test('malformed chunks and a missing catalogue retain former scenery',async()=>{
 const {fetcher}=fixture(true);
 const a=new ForestStream('/',fetcher);await a.warm(loc.x,loc.z,1200);
 assert.equal(a.height(loc.x,loc.z,11,.5),11);assert.ok(a.state.failed>=1);
 const b=new ForestStream('/',async()=>new Response('404',{status:404}));await b.warm(loc.x,loc.z,200);
 assert.equal(b.height(loc.x,loc.z,11,.5),11);assert.equal(b.state.missing,true);
});
