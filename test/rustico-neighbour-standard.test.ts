import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {openSync,closeSync,readSync,readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import test from 'node:test';
import {BufferGeometry,Mesh,Scene,ShaderMaterial} from 'three';
import * as profile from '../src/app/scenery-profile.ts';
import {Buildings} from '../src/render/buildings.ts';
import {RUSTICO_NEIGHBOUR as R} from '../src/render/rustico-neighbour.generated.ts';
import {prepareStandardRusticoNeighbour,RUSTICO_NEIGHBOUR_DRAW as P,standardRusticoNeighbourTile,standardRusticoNeighbourSource} from '../src/render/rustico-neighbour-standard.ts';
import {PackedBytes} from '../src/sim/packed-bytes.ts';
import {Terrain} from '../src/sim/terrain.ts';

const path=(p:string)=>new URL('../public/world/'+p,import.meta.url);
const read=(p:string)=>JSON.parse(readFileSync(path(p),'utf8'));
const sha=(q:Uint8Array)=>createHash('sha256').update(q).digest('hex');
const b=(a:ArrayBufferView)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const atlas=read('buildings/index.json'),tile=atlas.tiles.find((t:{id:string})=>t.id===R.tile);
const meta=read('terrain.json'),ground=gunzipSync(readFileSync(path(meta.file)));
assert.equal(sha(ground),meta.sha256);
const terrain=new Terrain(meta,new Int16Array(ground.buffer,ground.byteOffset,ground.byteLength/2));
const wire=new Uint8Array(tile.bytes),fd=openSync(path('buildings/'+atlas.file),'r');
try{assert.equal(readSync(fd,wire,0,tile.bytes,tile.offset),tile.bytes);}finally{closeSync(fd);}
const rows=JSON.parse(gunzipSync(wire).toString('utf8')).features;
assert.equal(sha(wire),R.chunk);
const body=new URLSearchParams('departure=north-rustico-harbour-low&scenery=standard');
type Owner=Mesh<BufferGeometry,ShaderMaterial>;
type Engine=Pick<Buildings,'enableRusticoHarbourRoof'|'enableStandardRusticoNeighbour'|'rusticoHarbourRoofActive'|
 'rusticoMassingPreviewActive'|'standardRusticoNeighbourReady'|'standardRusticoNeighbourActive'|'standardRusticoNeighbourUnavailable'|
 'prepareStandardRusticoNeighbour'|'beginStandardRusticoNeighbour'|'syncStandardRusticoNeighbour'> & {
 wanted:Set<string>;meshes:Map<string,Owner>;tiles:typeof atlas.tiles;
 load(t:typeof tile):Promise<void>;
};
const Engine=Buildings as unknown as new(...args:unknown[])=>Engine;
function sample(args:{historical?:boolean;pale?:boolean;modern?:boolean;tile?:typeof tile;wire?:Uint8Array}={}){
 const scene=new Scene(),manifest=args.tile??tile,one=args.wire??wire;
 const range='bytes='+manifest.offset+'-'+(manifest.offset+manifest.bytes-1),requests:string[]=[];
 const pack=new PackedBytes('https://fixture.invalid/buildings',atlas.bytes,async (_input,opts)=>{
  const h=new Headers(opts?.headers).get('Range');assert.equal(h,range);
  requests.push(h!);
  return new Response(Uint8Array.from(one),{status:206,headers:{'content-range':'bytes '+range.slice(6)+'/'+atlas.bytes}});
 });
 const app=new Engine(scene,terrain,[manifest],pack,atlas.sha256,undefined,undefined,undefined,undefined,
  false,undefined,undefined,args.historical??false);
 if(args.pale!==false)app.enableRusticoHarbourRoof();
 if(args.modern!==false)app.enableStandardRusticoNeighbour();
 app.wanted.add(R.tile);
 const load=async()=>{
  await app.load(app.tiles[0]);
  const owner=app.meshes.get(R.tile);
  assert(owner&&owner.parent===scene);
  return owner;
 };
 return {app,scene,load,requests,range};
}
const n=(o:Owner)=>o.geometry.getAttribute('position').count;
const programme=(o:Owner)=>sha(Buffer.from(o.material.vertexShader+'\0'+o.material.fragmentShader));
const opts=(q:string)=>new URLSearchParams(body.toString()+'&'+q);

test('independent roof-only switch leaves Standard lighthouse and /377 plus explicit modes alone',()=>{
 assert(profile.standardRusticoNeighbourRequested(body));
 for(const key of ['stockRusticoLighthouse','stockRusticoHarbourRoof','diagnostics'])
  assert(profile.standardRusticoNeighbourRequested(opts(key)),key);
 const on=opts('stockRusticoNeighbourRoof');
 assert(!profile.standardRusticoNeighbourRequested(on));
 for(const f of [profile.standardRusticoLighthouseRequested,profile.rusticoHarbourRoofRequested,
  profile.standardPrinceSurveyRoof,profile.standardOpenRipplesRequested,profile.georgetownSchoolWallsRequested])
  assert.equal(f(on),f(body));
 for(const bad of ['qa','unknown','scenery=standard','departure=north-rustico-harbour-low','rusticoMassingReview',
  'northRusticoLighthouseStudy','legacyRusticoMassing','buildingShadows','surveyRelief','inlandRelief',
  'northRusticoSoil','legacyRusticoSoil','noRusticoTufts']){
  assert(!profile.standardRusticoNeighbourRequested(opts(bad)),bad);
 }
 assert(!profile.standardRusticoNeighbourRequested(new URLSearchParams('scenery=detail')));
 const ui=readFileSync(new URL('../src/app/ui.ts',import.meta.url),'utf8');
 assert.match(ui,/<p id="rustico-neighbour-roof" class="sitenote" role="status" hidden><\/p>/);
 assert.match(ui,/Begin now to fly with the original roof/);
});

test('only exact manifest, real digest and ordered q268 row can prepare, never q377 or its toggle',()=>{
 assert(standardRusticoNeighbourTile(atlas.sha256,tile));
 assert(standardRusticoNeighbourSource(atlas.sha256,tile,R.chunk,rows));
 for(const m of [{sha256:'x'},{count:673},{offset:tile.offset+1},{bytes:tile.bytes-1},
  {bounds:[tile.bounds[0],tile.bounds[1],tile.bounds[2],tile.bounds[3]+1e-9]},{id:'q03333'}])
  assert(!standardRusticoNeighbourSource(atlas.sha256,{...tile,...m},R.chunk,rows));
 for(const d of [undefined,'wrong'])assert(!standardRusticoNeighbourSource(atlas.sha256,tile,d,rows));
 const changed=structuredClone(rows);
 changed[R.ordinal].footprint.reverse();
 assert(!standardRusticoNeighbourSource(atlas.sha256,tile,R.chunk,changed));
 assert(!standardRusticoNeighbourSource(atlas.sha256,tile,R.chunk,rows.slice(1)));
});

test('one authentic Range and digest; same original material, faces and q377 bytes outside replaced measured body',async t=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'crypto')!,real=globalThis.crypto;
 let digests=0;
 Object.defineProperty(globalThis,'crypto',{configurable:true,value:{subtle:{digest(...a:Parameters<SubtleCrypto['digest']>){
  digests++;return real.subtle.digest(...a);
 }}}});
 try{
  const a=sample(),x=await a.load(),stock=x.geometry,m=x.material;
  assert(!a.app.standardRusticoNeighbourReady,'streaming alone does not allocate the alternate');
  a.app.prepareStandardRusticoNeighbour();
  assert.deepEqual(a.requests,[a.range]);assert.equal(digests,1);
  assert.equal(n(x),37950);assert(a.app.standardRusticoNeighbourReady);assert(!a.app.standardRusticoNeighbourActive);
  assert(a.app.rusticoHarbourRoofActive);assert(!a.app.rusticoMassingPreviewActive);
  assert(x.geometry===stock,'pre-Begin stock');
  a.app.beginStandardRusticoNeighbour(true);const newer=x.geometry;
  assert(a.app.standardRusticoNeighbourActive);assert(!a.app.rusticoMassingPreviewActive);
  assert(x.material===m);assert.equal(programme(x),'7debe015e3c23dd1a8c928a97bc87839d95f1f568194d17a5d5ca8ca3457df0e');
  assert.equal(n(x),38067);assert.equal(newer.index,null);
  assert.deepEqual(newer.groups,stock.groups);assert.deepEqual(newer.boundingSphere,stock.boundingSphere);
  const cap=stock.getAttribute('topFlag'),altCap=newer.getAttribute('topFlag');
  assert.equal(Array.from(cap.array.subarray(P.from,P.to)).filter(x=>x===1).length/3,6);
  assert.equal(Array.from(altCap.array.subarray(P.from,P.from+P.replacement)).filter(x=>x===1).length/3,19);
  for(const [key,prev] of Object.entries(stock.attributes)){
   const next=newer.getAttribute(key),s=next.itemSize;
   assert.equal(s,prev.itemSize,key);
   assert.deepEqual(b(prev.array.subarray(0,P.from*s)),b(next.array.subarray(0,P.from*s)),key+' prefix');
   assert.deepEqual(b(prev.array.subarray(P.to*s)),b(next.array.subarray((P.from+P.replacement)*s)),key+' suffix');
   assert.notEqual(prev.array.buffer,next.array.buffer);
  }
  assert.deepEqual(b(stock.getAttribute('color').array.subarray(25128*3,25140*3)),
   b(newer.getAttribute('color').array.subarray(25245*3,25257*3)),'/377 pale colors byte-identical');
  const legacy=sample({historical:true}),y=await legacy.load(),legacyCap=y.geometry.getAttribute('topFlag');
  legacy.app.prepareStandardRusticoNeighbour();
  const use=(g:BufferGeometry,flag:typeof altCap)=>Array.from({length:P.replacement},(_,j)=>P.from+j).filter(i=>flag.getX(i)===1)
   .flatMap(i=>Array.from(g.getAttribute('position').array.subarray(i*3,i*3+3)));
  assert.deepEqual(use(newer,altCap),use(y.geometry,legacyCap),'exact held 2020 planes');
  assert(!legacy.app.standardRusticoNeighbourReady);assert(legacy.app.rusticoMassingPreviewActive);
  legacy.app.beginStandardRusticoNeighbour(true);assert.equal(n(y),38067);
  assert.notEqual(x.material.fragmentShader,y.material.fragmentShader,'do not use legacy whole-tile shader/ID');
  const v=sample({pale:false}),z=await v.load();v.app.prepareStandardRusticoNeighbour();
  v.app.beginStandardRusticoNeighbour(true);assert(v.app.standardRusticoNeighbourActive);assert(!v.app.rusticoHarbourRoofActive);
  assert.equal(programme(x),programme(z));assert.deepEqual(v.requests,[v.range]);
  a.app.syncStandardRusticoNeighbour(false);assert.equal(x.geometry,stock);assert(!a.app.standardRusticoNeighbourActive);
  a.app.syncStandardRusticoNeighbour(true);assert.equal(x.geometry,stock,'non-Begin restore never reacquires');
  t.diagnostic(JSON.stringify({
   original:37950,alternate:38067,siblings:37884,roofTriangles:19,sameShader:programme(x),
   attrs:Object.fromEntries(Object.entries(newer.attributes).map(([k,a])=>[k,sha(b(a.array))])),
  }));
 }finally{Object.defineProperty(globalThis,'crypto',original);}
});

test('unready Begin, leave, permanent no-late mount, corrupt wire and false manifest fall back',async()=>{
 const early=sample();
 early.app.beginStandardRusticoNeighbour(true);
 const x=await early.load(),stock=x.geometry;
 early.app.syncStandardRusticoNeighbour(true);early.app.prepareStandardRusticoNeighbour();
 assert(early.app.standardRusticoNeighbourReady&&!early.app.standardRusticoNeighbourActive);
 assert.equal(n(x),37950);assert.equal(x.geometry,stock);
 early.app.beginStandardRusticoNeighbour(false);assert.equal(x.geometry,stock);
 early.app.beginStandardRusticoNeighbour(true);assert(early.app.standardRusticoNeighbourActive);
 early.app.wanted.delete(tile.id);early.app.syncStandardRusticoNeighbour(true);assert.equal(x.geometry,stock);
 early.app.wanted.add(tile.id);early.app.syncStandardRusticoNeighbour(true);assert.equal(x.geometry,stock);
 // Correct content after recompression but wrong bytes: retire only optional
 // semantics, don't pretend resource corruption alters the stock decoder.
 const raw=gunzipSync(wire),alt=Uint8Array.from(wire);alt[4]^=1;
 assert.deepEqual(gunzipSync(alt),raw);assert.notEqual(sha(alt),R.chunk);
 for(const f of [sample({wire:alt}),sample({tile:{...tile,sha256:'0'.repeat(64)}})]){
  const y=await f.load();
  f.app.prepareStandardRusticoNeighbour();f.app.beginStandardRusticoNeighbour(true);
  assert(!f.app.standardRusticoNeighbourReady&&!f.app.standardRusticoNeighbourActive);
  assert.deepEqual(f.requests,[f.range]);assert.equal(n(y),37950);
 }
});

test('construction-born geometry and shader drift cannot become a fresh preparation',async()=>{
 for(const spoof of [(m:Owner)=>{m.geometry=m.geometry.clone();},(m:Owner)=>{m.material.fragmentShader+='\n';}]){
  const a=sample(),m=await a.load();
  spoof(m);const other=m.geometry;
  a.app.prepareStandardRusticoNeighbour();a.app.beginStandardRusticoNeighbour(true);
  assert(a.app.standardRusticoNeighbourUnavailable);assert(!a.app.standardRusticoNeighbourActive);
  assert.equal(m.geometry,other);assert.equal(n(m),37950);
 }
});

test('stock fallback, unrelated mesh authority and owned disposal on drift',async()=>{
 const a=sample({modern:false}),o=await a.load(),base=o.geometry;
 const scene=a.scene;let known=true;
 const prepare=()=>prepareStandardRusticoNeighbour(o,scene,()=>known);
 const view=prepare();assert(view);
 const outside=new BufferGeometry();let release=0;
 assert(view.begin(true));const active=o.geometry;
 active.addEventListener('dispose',()=>release++);
 o.geometry=outside;view.sync(true);assert.equal(o.geometry,outside);
 o.geometry=base;view.sync(true);assert.equal(o.geometry,base);assert(!view.active);
 assert(view.begin(true));
 o.material.polygonOffset=true;view.sync(true);assert.equal(o.geometry,base);assert(!view.ready);
 o.material.polygonOffset=false;assert(view.begin(true));
 known=false;view.sync(true);assert.equal(o.geometry,base);
 known=true;assert(view.begin(true));view.sync(true,()=>false);assert.equal(o.geometry,base);
 view.sync(true,()=>true);assert.equal(o.geometry,base);
 assert(view.begin(true));
 o.material.needsUpdate=true;view.sync(true);assert.equal(o.geometry,base);assert(!view.ready);
 view.dispose();view.dispose();assert.equal(release,1);assert.equal(o.geometry,base);
});
