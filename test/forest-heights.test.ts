import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {ForestHeights,loadForestHeights} from '../src/sim/forest-heights.ts';
import {FOREST_HEIGHTS} from '../src/sim/forest-heights.generated.ts';
import {project} from '../src/sim/geo.ts';

const path=new URL('../public/'+FOREST_HEIGHTS.asset,import.meta.url);
const gz=readFileSync(path),raw=gunzipSync(gz);
const source=readFileSync(new URL('../data/forest-envelope/efi2020-pilot.json.gz',import.meta.url));
const asset=new ForestHeights(raw);
test('three fixed source windows are portable and reproduce the active sample counts',()=>{
 const sha=(x:Buffer)=>createHash('sha256').update(x).digest('hex');
 assert.equal(sha(source),FOREST_HEIGHTS.sourceSha256);
 assert.equal(sha(raw),FOREST_HEIGHTS.sha256);
 assert.deepEqual(asset.ids,['prince','queens','kings']);
 for(const w of FOREST_HEIGHTS.windows){
  assert.equal(raw.subarray(w.offset,w.offset+4096).filter(x=>x>0).length,w.supported);
  const [l,b,r,t]=w.bounds;
  let changes=0;
  for(let i=2;i<62;i++)for(let j=2;j<62;j++){
   const p=project(l+(i+.5)/64*(r-l),t-(j+.5)/64*(t-b));
   const after=asset.height(p.x,p.z,12,.5);
   assert.ok(after>=2.6-1e-9&&after<=30+1e-9);
   if(after!==12)changes++;
  }
  assert.ok(changes>410,w.id);
  for(const lon of [l-.000001,r+.000001]){
   const p=project(lon,(t+b)/2);
   assert.equal(asset.height(p.x,p.z,12,.5),12);
  }
 }
});
test('missing or corrupt woodland layer cannot alter the original trees',async()=>{
 const okay=await loadForestHeights('/',async()=>new Response(new Uint8Array(gz)),1000);
 assert.deepEqual(okay?.ids,asset.ids);
 assert.equal(await loadForestHeights('/',async()=>new Response('404',{status:404}),1000),undefined);
 assert.equal(await loadForestHeights('/',async()=>new Response('wrong'),1000),undefined);
});
