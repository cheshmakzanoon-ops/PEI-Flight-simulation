/** Offline, actual streamed tile with one normal byte-range response. See the contact rebuild guide. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import * as T from 'three';
import assert from 'node:assert/strict';
import {Terrain} from '../../src/sim/terrain.ts';
import {Buildings} from '../../src/render/buildings.ts';
import {standardPrinceSurveyRoof,standardPrinceRoofContact} from '../../src/app/scenery-profile.ts';
import {princeSkyBudget} from '../../src/render/prince-roof-sky-budget.ts';
const sha=b=>createHash('sha256').update(b).digest('hex'),file=p=>readFileSync('public/world/'+p);
const manifest=JSON.parse(file('buildings/index.json')),tile=manifest.tiles.find(q=>q.id==='q0322'),wire=file('buildings/tiles.pack').subarray(tile.offset,tile.offset+tile.bytes);
const terrainSpec=JSON.parse(file('terrain.json')),h=gunzipSync(file(terrainSpec.file)),terrain=new Terrain(terrainSpec,new Int16Array(h.buffer,h.byteOffset,h.length/2));
assert.equal(sha(wire),'335c293cd1eb61e5840fc8b1b6be655cd62c9e153cc6046b0080f9854b5da3d2');
const cases=[],actualHash=manifest.sha256;let fitted,stock;
for(const mode of ['measured-only','normal-standard','peer-inland','low-budget','missing-budget','changed-ordinary-chunk','generic-legacy','unrelated-review']){
 const query=new URLSearchParams(mode==='measured-only'?'stockPrinceRoofContact':mode==='generic-legacy'?'stockPrinceSurveyRoof':mode==='peer-inland'?'stockInlandOrtho':mode==='unrelated-review'?'orthophotoSeamStudy':'');
 const room=mode==='low-budget'?191:mode==='missing-budget'?NaN:192;
 const changed=mode==='changed-ordinary-chunk',raw=changed?gzipSync(gunzipSync(wire),{level:1}):wire;
 if(changed)assert.notEqual(sha(raw),tile.sha256);
 let count=0;const source={read:async(o,n)=>{count++;assert.equal(o,tile.offset);assert.equal(n,tile.bytes);return raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength);}};
 const scene=new T.Scene(),B=new Buildings(scene,terrain,[tile],source,actualHash);
 if(standardPrinceSurveyRoof(query))B.enablePrinceSurveyRoof(standardPrinceRoofContact(query)&&princeSkyBudget(room));
 B.wanted.add(tile.id);await B.load(B.tiles[0]);assert.equal(scene.children.length,1);assert.equal(count,1);
 const mesh=B.meshes.get(tile.id),mat=mesh.material,geometry=Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([k,v])=>[k,sha(Buffer.from(v.array.buffer,v.array.byteOffset,v.array.byteLength))]));
 const survey=B.princeSurveyRoofActive,contact=B.princeRoofContactActive;
 const shouldShape=!['changed-ordinary-chunk','generic-legacy','unrelated-review'].includes(mode),
  shouldContact=mode==='normal-standard'||mode==='peer-inland';assert.equal(survey,shouldShape);assert.equal(contact,shouldContact);
 if(survey){if(!fitted)fitted=geometry;assert.deepEqual(geometry,fitted);}else{if(!stock)stock=geometry;assert.deepEqual(geometry,stock);}
 const word=mat.uniforms.princeSkyWords?.value;assert.equal(word?.byteLength??0,shouldContact?1760:0);
 assert.equal(mat.fragmentShader.includes('uniform highp uvec4 princeSkyWords[110]'),shouldContact);
 cases.push({mode,shape:survey,contact,geometry:survey?'#221 surveyed':'pre-221 generic',triangleCount:mesh.geometry.attributes.position.count/3,ownerMeshes:scene.children.length,assetReads:count,addedTextureSamplers:0,fieldUniformBytes:word?.byteLength??0});
}
const report={scope:'Actual whole q0322 mesh and full immutable vertex arrays after ordinary local PackedBytes/gzip lifecycle. True GL linkage is reviewed in native frames; this test does not claim hardware performance.',verifiedBuildingAtlasSha256:actualHash,allSixSurveyedTileAttributes:fitted,allSixGenericTileAttributes:stock,cases};
writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(cases));
