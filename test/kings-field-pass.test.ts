import assert from 'node:assert/strict';
import {test} from 'node:test';
import {kingsFieldPassRequested,queensFieldPassRequested,princeFieldPassRequested,sceneryOptions,forestFloorProfile,standardInlandOrtho,standardMeadowRequested,standardOpenRipplesRequested,runway03PavementRequested} from '../src/app/scenery-profile.ts';
import {KINGS_FIELD_TILE,KINGS_FIELD_CELLS,MappedFieldPass,QUEENS_MAPPED_PASS,PRINCE_MAPPED_PASS,kingsFieldShader,withinKingsFieldPass,withinMappedPass} from '../src/render/kings-field-pass.ts';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {readFieldDirectory} from '../src/sim/field-shards.ts';
import {project} from '../src/sim/geo.ts';
import {KINGS_MAPPED_FARMLAND_DEPARTURE as route,PRINCE_MAPPED_FARMLAND_DEPARTURE as prince,SITES} from '../src/sim/places.ts';

test('Kings pass is separate from existing Standard and explicit review options',()=>{
 for(const query of ['', '?scenery=standard','?departure=kings-mapped-farmland-pass','?diagnostics']){
  const q=sceneryOptions(query);
  assert.equal(kingsFieldPassRequested(q),true);assert.equal(q.has('provinceFieldsReview'),false);
 }
 for(const key of ['stockKingsFieldPass','provinceFieldsReview','cropRowsReview','sourceGrassStudy','sourceGrassNap',
    'surveyRelief','inlandRelief','buildingShadows','northCapeWind','kingsDryCrownStudy','seatedForestShadows']){
  assert.equal(kingsFieldPassRequested(sceneryOptions('?'+key)),false,key);
 }
 for(const q of ['?qa','?unrelatedMode','?scenery=standard&scenery=detail'])
  assert.equal(kingsFieldPassRequested(sceneryOptions(q)),false);
 const normal=sceneryOptions(''),off=sceneryOptions('?stockKingsFieldPass');
 for(const independent of [forestFloorProfile,standardInlandOrtho,standardMeadowRequested,standardOpenRipplesRequested,runway03PavementRequested])
  assert.deepEqual(independent(normal),independent(off),independent.name);
});
test('a foreign or ambiguously shaped terrain shader cannot take the local effect',()=>{
 const head=' void main(){',light=' float light=clamp(dot(n,sun),0.,1.);';
 const stock='old helpers\n'+head+'\n	original woodland, grass and ortho\n'+light+'\n  rest of stock\n}';
 const next=kingsFieldShader(stock);
 assert.ok(next);
 assert.equal(next.split('paintProvinceFields(col,n,p,d,coast);').length,2);
 assert.ok(next.includes('original woodland, grass and ortho\n paintProvinceFields(col,n,p,d,coast);\n'+light));
 assert.ok(next.endsWith('  rest of stock\n}'));
 for(const a of [next,stock+head,stock+light,'void main(){}',stock+' shadeSourceGrass',stock+' paintDatedFields'])
  assert.equal(kingsFieldShader(a),undefined);
});
test('departure and demonstrated low path are inside; climbs, invalid states and other sites withdraw',()=>{
 const p={...project(route.lon,route.lat),y:100};
 assert.ok(withinKingsFieldPass(p,62));
 assert.ok(withinKingsFieldPass({...p,x:43004.239,z:12211.232},59));
 for(const above of [415,-1,NaN,Infinity])assert.equal(withinKingsFieldPass(p,above),false);
 assert.equal(withinKingsFieldPass({...p,x:p.x+1121},62),false);
 assert.equal(withinKingsFieldPass({...p,z:Infinity},62),false);
});

test('all four local chunks are from one pinned pack; receiver is the distinct original terrain tile',()=>{
 assert.equal(KINGS_FIELD_TILE,'23-13');
 const file=new URL('../public/world/fields-province/v2/index.fcr.gz',import.meta.url);
 const dir=readFieldDirectory(Uint8Array.from(gunzipSync(readFileSync(file))).buffer);
 assert.ok(dir);
 const cells=KINGS_FIELD_CELLS.map(k=>dir.cells.get(k));
 assert.deepEqual(cells.map(v=>v?.pack),[32,32,32,32]);
 assert.deepEqual(cells.map(v=>[v?.offset,v?.size]),[[37864,1830],[39694,2105],[41799,362],[46902,2239]]);
});

test('Queens keeps a distinct Standard switch, one original receiver and its three signed source ranges',()=>{
 const a=sceneryOptions('?stockKingsFieldPass'),b=sceneryOptions('?stockQueensFieldPass');
 assert.equal(kingsFieldPassRequested(a),false);assert.equal(queensFieldPassRequested(a),true);
 assert.equal(kingsFieldPassRequested(b),true);assert.equal(queensFieldPassRequested(b),false);
 for(const q of ['?qa','?scenery=detail','?surveyRelief','?provinceFieldsReview','?custom'])
   assert.equal(queensFieldPassRequested(sceneryOptions(q)),false);
 const route=SITES.find(p=>p.id===QUEENS_MAPPED_PASS.id);assert.ok(route);
 const c=project(route.lon,route.lat);
 assert.deepEqual(QUEENS_MAPPED_PASS.center,[c.x,c.z]);assert.equal(QUEENS_MAPPED_PASS.tile,'12-13');
 assert.equal(withinMappedPass({...c,y:80},62,QUEENS_MAPPED_PASS),true);
 assert.equal(withinMappedPass({...c,x:c.x+1120.1,y:80},62,QUEENS_MAPPED_PASS),false);
 const raw=gunzipSync(readFileSync(new URL('../public/world/fields-province/v2/index.fcr.gz',import.meta.url)));
 const dir=readFieldDirectory(Uint8Array.from(raw).buffer);assert.ok(dir);
 const ranges=QUEENS_MAPPED_PASS.cells.map(k=>dir.cells.get(k));
 assert.deepEqual(ranges.map(r=>[r?.pack,r?.offset,r?.size]),[[19,15128,1856],[19,23916,1567],[19,21721,2195]]);
});

test('Prince mapped pass lives in its own exact existing terrain owner and does not replace Prince fields comparison',()=>{
 assert.equal(prince.id,PRINCE_MAPPED_PASS.id);
 assert.ok(!SITES.some(q=>q.id===prince.id));
 assert.ok(SITES.some(q=>q.id==='prince-fields'));
 const p=project(prince.lon,prince.lat);
 assert.deepEqual(PRINCE_MAPPED_PASS.center,[p.x,p.z]);assert.equal(PRINCE_MAPPED_PASS.tile,'9-13');
 assert.equal(withinMappedPass({...p,y:80},62,PRINCE_MAPPED_PASS),true);
 assert.equal(withinMappedPass({...p,z:p.z-1121,y:80},62,PRINCE_MAPPED_PASS),false);
 const select=sceneryOptions('?stockPrinceFieldPass');
 assert.equal(princeFieldPassRequested(select),false);
 assert.equal(queensFieldPassRequested(select),true);assert.equal(kingsFieldPassRequested(select),true);
 assert.equal(princeFieldPassRequested(sceneryOptions('?stockQueensFieldPass')),true);
 assert.equal(princeFieldPassRequested(sceneryOptions('?provinceFieldsReview')),false);
 const raw=gunzipSync(readFileSync(new URL('../public/world/fields-province/v2/index.fcr.gz',import.meta.url)));
 const dir=readFieldDirectory(Uint8Array.from(raw).buffer);assert.ok(dir);
 assert.deepEqual(PRINCE_MAPPED_PASS.cells.map(k=>{const v=dir.cells.get(k);return [v?.pack,v?.offset,v?.size];}),
  [[14,84771,2702],[14,114277,771],[14,87473,3448],[14,115048,1184]]);
});


test('a loaded field route cannot compile indefinitely as a candidate terrain owner comes and goes',()=>{
 const pass=new MappedFieldPass('/fake/',{} as never,{} as never,{} as never);
 let prepares=0,disposed=0;
 // Isolate the controller from WebGL and transport; real shaders and leases
 // are exercised separately by the compiled browser replay.
 const internals=pass as unknown as {linkAttempts:number;art:unknown;prepare:()=>void};
 internals.art={study:{stream:{state:{ready:2},update(){}}},dispose(){disposed++;}};
 internals.prepare=()=>{prepares++;};
 internals.linkAttempts=2;
 const point={x:43194.39622103769,y:90,z:11510.405016114737},data=()=>Promise.resolve(true);
 pass.update(false,false,data,point,62,()=>undefined);
 pass.update(true,true,data,point,62,()=>[{} as never]);
 assert.equal(prepares,0);
 assert.equal(pass.state.phase,'unavailable');
 pass.leave();assert.equal(disposed,1);assert.equal(internals.linkAttempts,0);
});
