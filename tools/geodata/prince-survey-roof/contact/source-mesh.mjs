/** Export actual, complete measured building mesh for sky-ray tracing. This is offline.
 * Bundle with esbuild to a temporary .mjs at repository root. */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Terrain} from '../../../../src/sim/terrain.ts';
import {Buildings} from '../../../../src/render/buildings.ts';
import {project} from '../../../../src/sim/geo.ts';
const sha=x=>createHash('sha256').update(x).digest('hex');
const frame=JSON.parse(readFileSync('tools/geodata/prince-survey-roof/local-frame.json'));
const read=s=>readFileSync('public/world/'+s), spec=JSON.parse(read('terrain.json')), atlas=JSON.parse(read('buildings/index.json'));
const tile=atlas.tiles.find(p=>p.id===frame.owner.tile),pack=read('buildings/tiles.pack');
assert.equal(sha(pack),frame.owner.sourcePackSha);const raw=pack.subarray(tile.offset,tile.offset+tile.bytes);assert.equal(sha(raw),frame.owner.sourceTileSha);
const records=JSON.parse(gunzipSync(raw)).features,heights=gunzipSync(read(spec.file));assert.equal(sha(heights),spec.sha256);
const t=new Terrain(spec,new Int16Array(heights.buffer,heights.byteOffset,heights.length/2)),B=new Buildings(new THREE.Scene(),t,[tile],{},atlas.sha256);
B.enablePrinceSurveyRoof(false);const mesh=B.generate(records,B.tiles[0],false,47,false,tile.sha256);assert(mesh.userData.princeSurveyRoof);
mesh.updateMatrixWorld(true);const [a,b]=mesh.userData.beaconTriangles,P=mesh.geometry.attributes.position,R=mesh.geometry.attributes.topFlag,origin=project(...frame.owner.center),base=t.meshElevation(origin.x,origin.z)+.05;
const faces=[];for(let i=a;i<b;i+=3){faces.push([R.getX(i),...[0,1,2].flatMap(j=>{const q=new THREE.Vector3().fromBufferAttribute(P,i+j).applyMatrix4(mesh.matrixWorld);return [q.x-origin.x,q.y-base,q.z-origin.z];})]);}
assert.equal(faces.length,98);const txt=faces.length+'\n'+faces.map(f=>f.join(' ')).join('\n')+'\n';writeFileSync(process.argv[2],txt);console.log(sha(txt),faces.length,base);
