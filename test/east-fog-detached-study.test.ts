import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {addLighthouseScenery} from '../src/render/lighthouses.ts';
import {Terrain} from '../src/sim/terrain.ts';
import {makeFogGableShell,exchangeOnlyFog,type FogShell} from '../tools/art/east-fog-study/east-fog-gable-shell.ts';
import {gunzipSync} from 'node:zlib';

const read=(s:string)=>readFileSync(new URL(s,import.meta.url));
const sha=(x:Buffer)=>createHash('sha256').update(x).digest('hex');
const archive=JSON.parse(read('../tools/art/east-fog-study/east-fog-bulk-v2.json').toString());
const plan=archive.closedBodyPlan as FogShell;
const bytes=(a:T.BufferAttribute|T.InterleavedBufferAttribute)=>{
 const v=a.array;
 return Buffer.from(v.buffer,v.byteOffset,v.byteLength);
};

test('archived East Point historic fog-house shell reproduces the exact detached review streams',()=>{
 const {geo,geometryReport}=makeFogGableShell(plan);
 assert.equal(geometryReport.triangles,134);
 assert.equal(geometryReport.orientationCertifiedEdgeCount,201);
 assert.ok(geometryReport.volume>1140&&geometryReport.volume<1190);
 assert.deepEqual(plan.body.map(d=>d.id),['low-tower-side','high-point-side']);
 assert.equal(plan.body[0].box[3],plan.body[1].box[2]);
 assert.ok(plan.body[1].ridgeY-plan.body[0].ridgeY>2.8);
 assert.equal(geo.index,null);assert.equal(geo.groups.length,0);
 for(const [k,a] of Object.entries(geo.attributes))assert.equal(sha(bytes(a)),archive.modelBytes[k],k);
 geo.dispose();
});

test('the detached exchange preserves existing tower streams and separate historic displays bit for bit',()=>{
 const spec=JSON.parse(read('../public/world/terrain.json').toString());
 const b=gunzipSync(read('../public/world/'+spec.file));
 const terrain=new Terrain(spec,new Int16Array(b.buffer,b.byteOffset,b.byteLength/2));
 const [east]=addLighthouseScenery(new T.Scene(),terrain), study=makeFogGableShell(plan);
 for(const [k,count]of [5055,1440].entries()){
  const s=east.levels[k].object.children[0] as T.Mesh<T.BufferGeometry>;
  const before=s.geometry, after=exchangeOnlyFog(before,study.geo,k===0);
  assert.equal(s.geometry,before);
  for(const [name,p] of Object.entries(before.attributes)){
   const stride=p.itemSize*4,len=stride*count;
   const v=bytes(p),n=bytes(after.attributes[name]);
   assert.ok(v.subarray(0,len).equals(n.subarray(0,len)),name);
   if(k===0)assert.ok(v.subarray(-396*stride).equals(n.subarray(-396*stride)),name+' exhibits');
  }
  after.dispose();
 }
 study.geo.dispose();
});
