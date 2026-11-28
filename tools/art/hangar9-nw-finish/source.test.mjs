import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync as read} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync as inflate} from 'node:zlib';
import {Scene,Texture} from 'three';
import {Terrain} from '../../../src/sim/terrain.ts';
import {Buildings} from '../../../src/render/buildings.ts';
import {H9_NW_SCOPE as P, exactH9NwStudySources, makeH9NwCladdingStudy} from './hangar9-nw-cladding.ts';

const file=n=>read(new URL('../../../public/world/'+n,import.meta.url));
const j=n=>JSON.parse(file(n));
const sha=v=>createHash('sha256').update(v).digest('hex');
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const atlas=j('buildings/index.json'),t=atlas.tiles.find(q=>q.id===P.tile);
const terrainSpec=j('terrain.json'),h=inflate(file(terrainSpec.file));
const terrain=new Terrain(terrainSpec,new Int16Array(h.buffer,h.byteOffset,h.length/2));
const pack=file('buildings/'+atlas.file);
const wire=pack.subarray(t.offset,t.offset+t.bytes);
const scope=JSON.parse(inflate(wire));
function digestAttrs(mesh){
 return Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([k,a])=>[k,sha(bytes(a.array))]));
}
async function owner(contact=true){
 assert.equal(sha(pack),P.packedSource);assert.equal(sha(wire),P.wireSource);
 const b=new Buildings(new Scene(),terrain,[t],{read:async(o,n)=>{
   assert.deepEqual([o,n],[t.offset,t.bytes]);
   return wire.buffer.slice(wire.byteOffset,wire.byteOffset+wire.byteLength);
 }},atlas.sha256);
 b.enablePrinceSurveyRoof(contact);
 b.wanted.add(t.id);await b.load(b.tiles[0]);
 const mesh=b.meshes.get(t.id);
 assert(mesh && mesh.geometry.index===null && mesh.geometry.groups.length===0);
 return mesh;
}

test('exact signed field, all six original attributes, both NW triangle IDs nonindexed',async()=>{
 const mesh=await owner(),geom=mesh.geometry;
 assert.equal(scope.features.length,315);
 assert.equal(sha(JSON.stringify(scope.features[64])),'080518d219c7bb62777295c9339f506e3fa283ca06b50ddebf936c53ded78141');
 assert.deepEqual(digestAttrs(mesh),{
   position:P.positionSHA,uv:'6e917999ce5afeb296b67c50ff03316905e8e9517278001c9fb670afc3fd8483',
   color:'b317438a8a2c736ff2d7a48b6db987971d0183852ccfa15f519b2fda69e10f9e',
   topFlag:'8447f4c6505373da98aefe24637ba8909bb88605106bdc95bc70ee64f372c2e0',
   facadeStyle:'bbebcd84311966741678a9e995c9f215e25e77fd6657c030d58dd51fa190b2f1',
   normal:'f05e92c861fb4503ce952b6fb188817e0e90afeb739ab6d46e1cf4fe84d1cb6e'});
 const s=(name)=>{const a=geom.attributes[name];return [...a.array.slice(a.itemSize*P.vertexStart,a.itemSize*P.vertexEnd)];};
 assert.equal(geom.attributes.position.count,P.ownerCount);
 assert.deepEqual(s('facadeStyle'),[0,0,0,0,0,0]);
 assert.deepEqual(s('topFlag'),[0,0,0,0,0,0]);
 assert.deepEqual(s('uv'),[0,0,0,P.uvHeight,P.uvWidth,P.uvHeight,0,0,P.uvWidth,P.uvHeight,P.uvWidth,0]);
 const basis=[-.8324959874153137,-0,-.5540310144424438];
 assert.deepEqual(s('normal'),Array.from({length:6},()=>basis).flat());
 assert.equal(P.vertexStart%3,0);assert.equal(P.vertexEnd-P.vertexStart,6);
});

test('strict standard shader replacement at one stock generic wall clause, not roof/light/output',async()=>{
 const {material:m}=await owner(),old=[m.vertexShader,m.fragmentShader];
 const src=await exactH9NwStudySources(...old);
 assert(src);
 assert.match(src.vertexShader,/gl_VertexID>=4935&&gl_VertexID<4941/);
 assert.match(src.fragmentShader,/h9StudyRole==1 && roof<\.5 && facade==0\. && h9StudyGain==1\./);
 assert.equal(src.fragmentShader.split('vec2 grid=uv2d/vec2(2.62,3.08);').length,2);
 const last='c*=.61+.51*k;';
 assert.equal(src.fragmentShader.slice(src.fragmentShader.lastIndexOf(last)),
   old[1].slice(old[1].lastIndexOf(last)));
 assert.equal(await exactH9NwStudySources(old[0]+'\n',old[1]),undefined);
 assert.equal(await exactH9NwStudySources(old[0],old[1]+'\n'),undefined);
 assert.equal(await exactH9NwStudySources(src.vertexShader,src.fragmentShader),undefined);
 const foreign=await owner(false);
 assert.equal(await makeH9NwCladdingStudy(foreign.material),undefined);
});

test('literal async snapshots, no deep borrowed texture clone, no geometry/material/scene mutation',async()=>{
 const o=await owner(),m=o.material,sourceBefore=m.fragmentShader,originalGeom=o.geometry,originalParent=o.parent;
 const tex=new Texture();const wrapped={value:tex};m.uniforms.detachedSentinel=wrapped;
 const refs=m.uniforms,ver=m.version,sv=tex.source.version;
 const study=await makeH9NwCladdingStudy(m);
 assert(study);
 assert.equal(study.material.uniforms.detachedSentinel,wrapped);
 assert.equal(tex.source.version,sv);assert.equal(m.uniforms,refs);assert.equal(m.version,ver);
 assert.equal(study.material.uniforms.h9StudyGain.value,0);
 study.setGain(1);assert.equal(study.material.uniforms.h9StudyGain.value,1);
 study.setGain(0);assert.equal(study.material.uniforms.h9StudyGain.value,0);
 assert.throws(()=>study.setGain(.5));
 study.dispose();study.dispose();assert.throws(()=>study.setGain(1));
 assert.equal(m.fragmentShader,sourceBefore);assert.equal(o.material,m);
 assert.equal(o.geometry,originalGeom);assert.equal(o.parent,originalParent);
 assert.equal(sha(bytes(o.geometry.attributes.position.array)),P.positionSHA);
 assert.equal(tex.source.version,sv);assert.equal(m.uniforms.detachedSentinel,wrapped);
});

test('refuse stock draw-state mismatch and concurrent stock-program swaps',async()=>{
 const {material:m}=await owner();
 for(const [prop,change] of [['wireframe',true],['transparent',true],['depthWrite',false],['alphaToCoverage',true],['onBeforeCompile',()=>{}]]){
  const old=m[prop];m[prop]=change;
  assert.equal(await makeH9NwCladdingStudy(m),undefined);m[prop]=old;
 }
 const p=makeH9NwCladdingStudy(m);
 m.fragmentShader+='\n';
 assert.equal(await p,undefined);
});
