/** Node adapter for the real Three.js Buildings tile and Terrain. Run esbuild
 * from the repository root, then node the bundle with <output-directory>.
 * All synthetic inputs below are restricted to local in-memory fallback trials.
 */
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {gunzipSync,gzipSync} from 'node:zlib';
import * as T from 'three';
import assert from 'node:assert/strict';
import {Buildings} from '../../src/render/buildings.ts';
import {Terrain} from '../../src/sim/terrain.ts';
import {COASTAL_SPECS} from '../../src/sim/coastal-surveys.generated.ts';
import {INLAND_SPECS} from '../../src/sim/inland-surveys.generated.ts';
import {WORLD_COLS,WORLD_ROWS} from '../../src/sim/coastal-terrain.ts';
import {project} from '../../src/sim/geo.ts';
import {standardPrinceSurveyRoof} from '../../src/app/scenery-profile.ts';
const out=resolve(process.argv[2]??'/tmp/pei-prince-roof-witness');mkdirSync(out,{recursive:true});
const srcFile=(p)=>readFileSync(resolve(p)),load=(p)=>JSON.parse(srcFile(p)),pub=(p)=>srcFile('public/world/'+p);
const sha=b=>createHash('sha256').update(b).digest('hex'),bin=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const atlas=JSON.parse(pub('buildings/index.json')),frame=load('tools/geodata/prince-survey-roof/local-frame.json'),owner=frame.owner,tile=atlas.tiles.find(t=>t.id===owner.tile);
assert.equal(atlas.sha256,owner.sourcePackSha);assert.equal(tile.sha256,owner.sourceTileSha);
const pack=pub('buildings/tiles.pack'),wire=pack.subarray(tile.offset,tile.offset+tile.bytes);assert.equal(sha(pack),atlas.sha256);assert.equal(sha(wire),tile.sha256);
const body=JSON.parse(gunzipSync(wire)),features=body.features;assert.deepEqual(features[owner.ordinal],owner.owner);
const spec=JSON.parse(pub('terrain.json')),heights=gunzipSync(pub(spec.file));assert.equal(sha(heights),spec.sha256);
const terrain=new Terrain(spec,new Int16Array(heights.buffer,heights.byteOffset,heights.length/2));
const focus=project(...owner.center),uv=terrain.uv(focus.x,focus.z),cell=[Math.floor(uv[0]*WORLD_COLS),Math.floor(uv[1]*WORLD_ROWS)];
assert(![...COASTAL_SPECS,...INLAND_SPECS].some(s=>s.tileX===cell[0]&&s.tileZ===cell[1]));
assert.deepEqual([focus.x,focus.z],frame.world.centerWorldXZ);
const ground=terrain.meshElevation(focus.x,focus.z);assert(Math.abs(ground-frame.world.groundAtCenter)<1e-8);
const split=(mesh)=>mesh.userData.beaconTriangles;
function outside(mesh){
 const [a,b]=split(mesh),result={};
 for(const key of ['position','topFlag','color','normal','facadeStyle','uv']){
  const attr=mesh.geometry.attributes[key],buf=attr.array,n=attr.itemSize;
  result[key]=sha(Buffer.concat([Buffer.from(buf.slice(0,a*n).buffer),Buffer.from(buf.slice(b*n).buffer)]));
 }
 return result;
}
function roof(mesh){
 mesh.updateMatrixWorld(true);const [a,b]=split(mesh),Q=mesh.geometry.attributes.position,Y=mesh.geometry.attributes.topFlag,result=[];
 for(let j=a;j<b;j+=3){if(![0,1,2].every(o=>Y.getX(j+o)>.5))continue;
  result.push([0,1,2].map(o=>new T.Vector3().fromBufferAttribute(Q,j+o).applyMatrix4(mesh.matrixWorld).toArray()));}
 return result;
}
const cases=[];
for(const mode of ['standard','stock-switch','peer-switch','historical','no-crypto','changed-valid-gzip','changed-index-count','changed-atlas','absent-byte-range']){
 let reads=0;const scene=new T.Scene();let raw=wire;
 if(mode==='changed-valid-gzip'){raw=gzipSync(Buffer.from(JSON.stringify(body)),{level:1});assert.notEqual(sha(raw),tile.sha256);}
 const slot=mode==='changed-index-count'?{...tile,count:tile.count+1}:tile;
 const pack={read:async(o,n)=>{reads++;assert.equal(o,tile.offset);assert.equal(n,tile.bytes);if(mode==='absent-byte-range')throw Error('QA unavailable');return bin(raw);}};
 const b=new Buildings(scene,terrain,[slot],pack,mode==='changed-atlas'?'0'.repeat(64):atlas.sha256);
 const query=mode==='stock-switch'?'stockPrinceSurveyRoof':mode==='peer-switch'?'stockCountyOrtho':mode==='historical'?'orthophotoSeamStudy':'';
 if(standardPrinceSurveyRoof(new URLSearchParams(query)))b.enablePrinceSurveyRoof();
 const crypto=Object.getOwnPropertyDescriptor(globalThis,'crypto');if(mode==='no-crypto')Object.defineProperty(globalThis,'crypto',{configurable:true,value:undefined});
 try{b.wanted.add(tile.id);await b.load(b.tiles[0]);}finally{if(mode==='no-crypto')Object.defineProperty(globalThis,'crypto',crypto);}
 const mesh=b.meshes.get(tile.id),active=b.princeSurveyRoofActive,accepted=mode==='standard'||mode==='peer-switch';
 assert.equal(reads,1);assert.equal(!!mesh,mode!=='absent-byte-range');assert.equal(active,accepted);assert.equal(scene.children.length,mode==='absent-byte-range'?0:1);
 const tri=mesh?mesh.geometry.attributes.position.count/3:0;assert.equal(tri,mode==='absent-byte-range'?0:mode==='changed-atlas'?6318:accepted?7798:7740);
 if(mesh&&!accepted){const legacy=b.generate(features,b.tiles[0],false,47,false,undefined);assert(roof(legacy).every(t=>t.every(p=>Math.abs(p[1]-(ground+.05+12.27))<.00001)));}
 cases.push({mode,requestedExistingChunk:reads,additionalAssets:0,mountedMeshes:scene.children.length,sourceGeometry:active,triangles:tri,failed:b.diagnostics().failed});
}
const builds=new Buildings(new T.Scene(),terrain,[tile],{},atlas.sha256);builds.enablePrinceSurveyRoof();
const g=(hash)=>builds.generate(features,builds.tiles[0],false,owner.ordinal,false,hash);
const stock=g(undefined),candidate=g(tile.sha256),oldSib=outside(stock),newSib=outside(candidate);assert.deepEqual(oldSib,newSib);
const hashes=Object.fromEntries(['src/render/prince-survey-roof.generated.ts','src/render/prince-survey-roof.ts','src/render/measured-massing.ts','src/render/buildings.ts','src/app/scenery-profile.ts','src/main.ts'].map(p=>[p,sha(srcFile(p))]));
const sameProof={baseGit:'0c156bfb',method:'Real Three.js Buildings.generate, full 315-feature production chunk, true tile offset&world transform; extracted topFlag > 0.5 triangles ONLY for true target span.',feature:47,gameAnchorY:ground+.05,sourceGroundRegistration:8.049528553080625,stockTriangles:roof(stock),candidateTriangles:roof(candidate),sourceHashes:hashes,neighborChecksums:oldSib,stockTileFaces:stock.geometry.attributes.position.count/3,candidateTileFaces:candidate.geometry.attributes.position.count/3};
const fmt=j=>JSON.stringify(j,null,2)+'\n';const meshBytes=fmt(sameProof);writeFileSync(resolve(out,'actual-triangles.json'),meshBytes);
const report={scope:'Local in-memory PackedBytes adapter, real Three.js Buildings.load and Buildings.generate. A missing required range leaves normal tile retry/failure; readable stale data produces stock.',actualTrianglesSHA256:sha(meshBytes),stockTriangleCount:sameProof.stockTriangles.length,candidateTriangleCount:sameProof.candidateTriangles.length,all314SiblingAttributes:oldSib,gameAnchorY:ground+.05,cases};
writeFileSync(resolve(out,'streaming-fallbacks.json'),fmt(report));console.log(JSON.stringify(report));
