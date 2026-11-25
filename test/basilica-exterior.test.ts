import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {Group,Scene,Mesh} from 'three';
import {sceneryOptions,basilicaExteriorRequested,standardCountyOrtho,standardPrinceSurveyRoof} from '../src/app/scenery-profile.ts';
import {basilicaSiteSupports,mountBasilicaStudy} from '../src/render/basilica-study-seat.ts';
import {addBasilicaExterior,BASILICA_ART_REFERENCE} from '../src/render/basilica-exterior.ts';
import {addBasilica} from '../src/render/basilica.ts';
import {regularRoadGround} from '../src/render/road-contact.ts';
import {Cover} from '../src/sim/cover.ts';
import {Terrain} from '../src/sim/terrain.ts';
import {verifyDecodedCover} from '../src/sim/cover-proof.ts';

const study='basilicaExteriorStudy',stock='stockBasilicaExterior';
test('local Basilica study is explicit, source-compatible only, independent of other Standard comparisons',()=>{
 for(const s of [study,study+'&diagnostics&qa=x',study+'&scenery=standard&departure=harbour-low',study+'&stockPrinceSurveyRoof'])
  assert(basilicaExteriorRequested(sceneryOptions(s)),s);
 for(const s of ['',stock,study+'&'+stock,study+'&scenery=detail',study+'&scenery=unknown',study+'&scenery=standard&scenery=detail',
  study+'&surveyRelief',study+'&inlandRelief',study+'&buildingShadows',study+'&sourceGrassStudy',study+'&woodlandView',study+'&unrecognized'])
  assert(!basilicaExteriorRequested(sceneryOptions(s)),s);
 for(const s of ['',study,stock,study+'&'+stock]){assert(standardCountyOrtho(sceneryOptions(s)));assert(standardPrinceSurveyRoof(sceneryOptions(s)));}
 assert(!standardPrinceSurveyRoof(sceneryOptions(study+'&stockPrinceSurveyRoof')));
});
test('changed, signed nonlocal terrain or water/colliding receivers cannot inherit the Basilica home N112 seat',()=>{
 const t={spec:{width:4096,height:2720,bounds:[-64.47,45.94,-61.93,47.1]},isLand:()=>true,surveyGrids:[]};
 const c={sourceSha:'46a4f4736a885576fa0529cd0f91bacdbfd47e3bfd719130ba3446c52c245863',width:4096,height:2720,waterInsets:[],distance:()=>200};
 const h='661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d';
 assert(basilicaSiteSupports(t as Terrain,h,c as Cover));
 assert(!basilicaSiteSupports(t as Terrain,'other',c as Cover));assert(!basilicaSiteSupports(t as Terrain,h,{...c,sourceSha:'other'} as Cover));
 assert(!basilicaSiteSupports({...t,surveyGrids:[{spec:{tileX:16,tileZ:16}}]} as Terrain,h,c as Cover));
 assert(basilicaSiteSupports({...t,surveyGrids:[{spec:{tileX:15,tileZ:16}}]} as Terrain,h,c as Cover));
 assert(!basilicaSiteSupports(t as Terrain,h,{...c,waterInsets:[{intersects:()=>true}]} as Cover));
 assert(!basilicaSiteSupports(t as Terrain,h,{...c,distance:()=>NaN} as Cover));
 assert(!basilicaSiteSupports({...t,isLand:()=>false} as Terrain,h,c as Cover));
});
test('a missing or malformed local package can never attach a partial second Basilica',async()=>{
 const stage=new Scene(),keeper=new Group();stage.add(keeper);const t={elevation:()=>7},g=()=>7;
 assert(!await mountBasilicaStudy(stage,t,g,async()=>{throw Error('missing')}));
 assert(!await mountBasilicaStudy(stage,t,g,async()=>({addBasilicaExterior(s){s.add(new Group());throw Error('interrupted')}})));
 assert(!await mountBasilicaStudy(stage,t,g,async()=>({addBasilicaExterior(s){const a=new Group();s.add(a,new Group());return a;}})));
 assert.deepEqual(stage.children,[keeper]);
});
test('real released atlas admits one fully seated landmark, retains both old game summits and distinct authored material batches',async()=>{
 const dir=new URL('../public/world/',import.meta.url);
 const read=(s:string)=>readFileSync(new URL(s,dir)),get=(s:string)=>JSON.parse(read(s).toString());
 const ts=get('terrain.json'),cs=get('cover.json'),bytes=gunzipSync(read(ts.file)),cb=gunzipSync(read(cs.file));
 const sha=(x:Uint8Array)=>createHash('sha256').update(x).digest('hex');
 assert.equal(sha(bytes),ts.sha256);assert.equal(sha(read(cs.file)),cs.compressedSha256);
 const t=new Terrain(ts,new Int16Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/2));
 const c=new Cover(cs.width,cs.height,cb,undefined,cs.compressedSha256);
 assert(basilicaSiteSupports(t,sha(bytes),c));assert.equal(await verifyDecodedCover(c),'e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9');
 const s=new Scene(),stockScene=new Scene(),old=addBasilica(stockScene,t),floor=regularRoadGround(t);
 assert(await mountBasilicaStudy(s,t,floor,async()=>({addBasilicaExterior})));
 assert.equal(s.children.length,1);const a=s.children[0];assert.deepEqual(a.position.toArray(),old.position.toArray());
 const tops=(q:Group)=>{const b=[-Infinity,-Infinity];for(const o of q.children){const p=(o as Mesh).geometry.getAttribute('position');
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);assert(Number.isFinite(x+y+p.getZ(i)));b[x<0?0:1]=Math.max(b[x<0?0:1],y);}}return b;};
 assert.deepEqual(tops(a as Group),tops(old));assert.equal(Math.round(tops(a as Group)[0]*100)/100,BASILICA_ART_REFERENCE.stockSummit);
 assert.equal(a.children.length,9);let tri=0;const roles=new Set<string>();
 for(const o of a.children){const m=o as Mesh;tri+=(m.geometry.index?.count??m.geometry.getAttribute('position').count)/3;
  roles.add((m.material as {name:string}).name);
 }
 assert.deepEqual([...roles].sort(),['copper','glass','iron','recess','slate','spire','stone','trim','wood'].map(x=>'basilica-exterior:'+x));
 assert.equal(tri,30931);assert.equal(a.userData.basilicaGroundWitness.length,3);
 const feet=a.userData.basilicaGroundWitness.map((w:any)=>w.groundY),low=a.userData.basilicaLandingY-.9;
 assert(Math.abs(low-Math.max(...feet)-.06)<1e-8);assert(low-Math.min(...feet)<.09);
});
