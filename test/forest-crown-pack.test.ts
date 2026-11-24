import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {sceneryOptions,sceneryReviewBlock} from '../src/app/scenery-profile.ts';
const root=new URL('../public/world/woodland/crown-v1/',import.meta.url);
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const get=(name:string)=>readFileSync(new URL(name,root));
const S=324;
test('live-crown ratio packs are pinned, bounded and share exact four-pixel halos',()=>{
 const raw=get('index.json');
 assert.equal(sha(raw),'54e8689b87a9dc0009ca79e92635460afb459813100d95f634af4be8cf86655a');
 const index=JSON.parse(raw.toString()) as {bytes:number;bounds:number[];cols:number;rows:number;tileInterior:number;tileBorder:number;
 packs:{file:string;bytes:number;sha256:string}[];tiles:{id:string;pack:number;offset:number;bytes:number;decodedBytes:number;positive:number;sha256:string}[]};
 assert.deepEqual(index.bounds,[-64.47,45.94,-61.93,47.1]);
 assert.deepEqual([index.cols,index.rows,index.tileInterior,index.tileBorder,index.tiles.length],[32,22,320,2,239]);
 const packs=index.packs.map((q,i)=>{
  assert.equal(q.file,'crown-'+String(i).padStart(2,'0')+'.pack');
  const b=get(q.file);
  assert.equal(b.length,q.bytes);assert.ok(b.length<=548000);
  assert.equal(sha(b),q.sha256);
  return b;
 });
 assert.equal(packs.reduce((n,b)=>n+b.length,0),index.bytes);assert.ok(index.bytes<6000000);
 const was=packs.map(()=>0),cells=new Map<string,Buffer>();
 for(const r of index.tiles){
  assert.ok(!cells.has(r.id));assert.equal(was[r.pack],r.offset);
  was[r.pack]+=r.bytes;
  const t=gunzipSync(packs[r.pack].subarray(r.offset,was[r.pack]),{maxOutputLength:S*S});
  assert.equal(t.length,S*S);assert.equal(t.length,r.decodedBytes);assert.equal(sha(t),r.sha256);
  let n=0;
  for(let z=0;z<S;z++)for(let x=0;x<S;x++){
   const q=t[z*S+x];assert.ok(q<=105);
   if(q&&x>=2&&z>=2&&x<322&&z<322)n++;
  }
  assert.equal(n,r.positive);cells.set(r.id,t);
 }
 assert.deepEqual(was,packs.map(b=>b.length));
 let samples=0;
 for(const [id,a] of cells){
  const [i,j]=id.split('-').map(Number),e=cells.get(i+1+'-'+j),s=cells.get(i+'-'+(j+1));
  for(let k=0;k<S;k++)for(let d=0;d<4;d++){
   if(e){assert.equal(a[k*S+320+d],e[k*S+d]);samples++;}
   if(s){assert.equal(a[(320+d)*S+k],s[d*S+k]);samples++;}
  }
 }
 assert.ok(samples>300000);
});
test('stand-based near crowns are opt-in and cannot take terrain or shadow-owned paths',()=>{
 assert.equal(sceneryOptions('').has('woodland3D'),false);
 assert.equal(sceneryOptions('?woodland3D').has('woodlandCrownBase'),false);
 assert.equal(sceneryOptions('?woodlandCrownBase').has('woodland3D'),true);
 for(const flag of ['surveyRelief','inlandRelief','indianRiverReview','buildingShadows','seatedForestShadows',
   'duneReliefStudy','duneGrassSurface','duneSandDetail']){
  const q=sceneryOptions('?'+flag+'&woodlandCrownBase');
  assert.equal(q.has('woodland3D'),false);
  assert.equal(sceneryReviewBlock('woodlandCrownBase',q),'terrain');
 }
 assert.equal(sceneryReviewBlock('woodlandCrownBase',sceneryOptions('?scenery=detail&woodlandCrownBase')),'detail');
});
test('optional pack limits reject a streaming excess before consuming the rest',async()=>{
 const {boundedPackedBody,PackedBytes}=await import('../src/sim/packed-bytes.ts');
 let cancelled=false,records=0;
 const stream=new ReadableStream<Uint8Array>({
  pull(out){records++;out.enqueue(new Uint8Array(4));},
  cancel(){cancelled=true;}
 },{highWaterMark:0});
 await assert.rejects(boundedPackedBody(stream,6),/exceeds limit/);
 assert.ok(cancelled);assert.equal(records,2);
 const full=new PackedBytes('http://local.example/forest',16,async()=>{
  const r=new Response(new Uint8Array(17),{status:200});
  return r;
 },true);
 await assert.rejects(full.read(0,4),/exceeds limit/);
 const partial=new PackedBytes('http://local.example/forest',16,async()=>{
  const r=new Response(new Uint8Array(5),{status:206,headers:{'Content-Range':'bytes 0-3/16'}});
  return r;
 },true);
 await assert.rejects(partial.read(0,4),/exceeds limit/);
});
