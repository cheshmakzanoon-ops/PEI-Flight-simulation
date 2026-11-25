import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BEACON_GRADE as pin,BEACON_RECEIVERS as casters} from '../src/sim/beaconsfield-grade.generated.ts';
import {beaconsfieldGradeRequested} from '../src/sim/beaconsfield-grade-admit.ts';
import {loadBoundedGrade,gradeAtlasMatches} from '../src/sim/bounded-grade.ts';
const path=(s:string)=>new URL('../public/world/'+s,import.meta.url),wire=new Uint8Array(readFileSync(path(pin.file))),raw=new Uint8Array(gunzipSync(wire));
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const N=129*129,v=new DataView(raw.buffer),cm=(i:number)=>v.getInt16(2*i,true),w=(i:number)=>raw[N*2+i];
test('Museum grade is strictly opt-in and old house/independent scenery flags remain available',()=>{
 for(const q of ['','diagnostics','beaconsfieldReview&stockBeaconsfieldGrade','beaconsfieldReview&surveyRelief','beaconsfieldReview&scenery=detail','beaconsfieldReview&indianRiverReview','beaconsfieldReview&seatedForestShadows','stockBeaconsfieldGrade'])assert(!beaconsfieldGradeRequested(new URLSearchParams(q)),q);
 for(const q of ['beaconsfieldReview','diagnostics&qa=1&beaconsfieldReview','beaconsfieldReview&departure=harbour&scenery=standard'])assert(beaconsfieldGradeRequested(new URLSearchParams(q)),q);
});
test('Exact signed wire and HTTP-decoded bytes; no partial/foreign/unsigned product',async()=>{
 assert.equal(wire.byteLength,pin.wireBytes);assert.equal(raw.byteLength,N*3);
 assert.equal(wire[9],255);assert.equal(sha(wire),pin.wireSha);assert.equal(sha(raw),pin.sha256);
 const ask=(body:Uint8Array,status=200)=>loadBoundedGrade(pin,'here/',async(url)=>{
   assert.equal(url,'here/'+pin.file);return new Response(body,{status});});
 assert(await ask(wire));assert(await ask(raw));const bad=raw.slice();bad[600]^=1;
 for(const [bytes,status] of [[bad,200],[wire.slice(0,-1),200],[raw.slice(),206],[wire,404]] as const)assert.equal(await ask(bytes,status),undefined);
});
test('every positive half-cell touches full physical authority; untouched reserves never move',()=>{
 let vertices=0,halfCells=0,maximum=0;
 for(let j=0;j<129;j++)for(let i=0;i<129;i++){
  const k=j*129+i,v=cm(k);assert(v>=0&&v<=105);maximum=Math.max(maximum,v);
  if(i===0||j===0||i===128||j===128)assert.equal(v+w(k),0);
  if(v)vertices++;if(i===128||j===128)continue;
  for(const f of [[k,k+1,k+129],[k+129,k+130,k+1]]){
   if(f.some(h=>cm(h)>0)){halfCells++;assert(f.every(h=>w(h)===255));}
  }
 }
 assert.equal(vertices,1445);assert.equal(halfCells,3243);assert(maximum>80);
 assert.equal(casters.roster.length,17);assert.equal(new Set(casters.roster.map(s=>s[0]+':'+s[2])).size,17);
});
test('current physical and negative-only ownership pins still match the open shipped world',()=>{
 const h=JSON.parse(readFileSync(path('terrain.json'),'utf8')),c=JSON.parse(readFileSync(path('cover.json'),'utf8')),b=JSON.parse(readFileSync(path('buildings/index.json'),'utf8')),r=JSON.parse(readFileSync(path('roads.json'),'utf8'));
 assert(gradeAtlasMatches(pin,h.sha256,c.compressedSha256,sha(gunzipSync(readFileSync(path(c.file))))));assert(!gradeAtlasMatches(pin,h.sha256,c.compressedSha256,'other'));
 assert.equal(casters.fences.allBuildings,b.sha256);assert.equal(casters.fences.roads,r.sha256);
});

test('unknown or over-budget local shaders fail closed; unchanged rejected geometry is never resubmitted per frame',async()=>{
 // Build the same TypeScript module as the game (it imports Three.js). No GL or network involved.
 const {build}=await import('esbuild');
 const bundle=await build({stdin:{contents:"export {fragmentSamplerBudget,MuseumShadowDelta} from './src/render/beaconsfield-grade/receiver.ts'",resolveDir:process.cwd()},
  bundle:true,platform:'node',format:'esm',write:false,minify:true,define:{'import.meta.env':'{"BASE_URL":"/"}'}});
 const {fragmentSamplerBudget:admit,MuseumShadowDelta}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].contents).toString('base64'));
 assert(admit('uniform sampler2D cover, details[4]; uniform highp sampler2DArray forest;',16,1));
 assert(!admit('uniform sampler2D first[16];',16,1));
 assert(!admit('uniform sampler2DArray unsupported[N];',32,1));
 assert(!admit('uniform sampler2D cover;',15,1));
 assert(admit('/* uniform sampler2D old[64]; */ uniform sampler2D current;',16,1));
 let inspected=0;const unsupported={getAttribute(){inspected++;return undefined;}};
 const r={stock:{visible:true,geometry:{},material:{}}},q={mesh:{geometry:unsupported,material:{}},regular:{geometry:{}},grade:{grid:{}}};
 const adapter=new MuseumShadowDelta({},16);assert.equal(adapter.update(r,q),false);assert.equal(inspected,1);
 for(let i=0;i<180;i++)assert.equal(adapter.update(r,q),false);assert.equal(inspected,1);
 q.mesh.material={};assert.equal(adapter.update(r,q),false);assert.equal(inspected,2);
 r.stock.material={};assert.equal(adapter.update(r,q),false);assert.equal(inspected,3);
 assert.equal(adapter.update(r,undefined),false);assert.equal(adapter.update(r,q),false);assert.equal(inspected,4);
});
