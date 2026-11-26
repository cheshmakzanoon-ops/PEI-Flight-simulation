import assert from 'node:assert/strict';
import {test} from 'node:test';
import {kingsFieldPassRequested,sceneryOptions,forestFloorProfile,standardInlandOrtho,standardMeadowRequested,standardOpenRipplesRequested,runway03PavementRequested} from '../src/app/scenery-profile.ts';
import {KINGS_FIELD_TILE,KINGS_FIELD_CELLS,kingsFieldShader,withinKingsFieldPass} from '../src/render/kings-field-pass.ts';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {readFieldDirectory} from '../src/sim/field-shards.ts';
import {project} from '../src/sim/geo.ts';
import {KINGS_MAPPED_FARMLAND_DEPARTURE as route} from '../src/sim/places.ts';

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
