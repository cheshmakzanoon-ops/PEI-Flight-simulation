/** Export the same physical shell and measured terrain used by the streamed Souris building. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {Terrain} from '../../src/sim/terrain.ts';
import {emitSurveyRoof,type RoofPoint} from '../../src/render/survey-roof.ts';
import {SOURIS_ROOF as model,SOURIS_ROOF_SHA256} from '../../src/render/souris-roof.generated.ts';

const dir=new URL('../../public/world/',import.meta.url);
const conf=JSON.parse(readFileSync(new URL('terrain.json',dir),'utf8'));
const raw=gunzipSync(readFileSync(new URL(conf.file,dir)));
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
if(sha(raw)!==conf.sha256)throw Error('Terrain differs from its verified manifest');
const terrain=new Terrain(conf,new Int16Array(Uint8Array.from(raw).buffer));
const p=(q:RoofPoint,y:number)=>[q.x,y,q.z];
const group:number[][][]=[];
emitSurveyRoof(model,{
 roof:(a,b,c,y)=>group.push([p(a,y[0]),p(b,y[1]),p(c,y[2])]),
 riser:(a,b,low,y)=>{
  const a0=low?.[0]??terrain.meshElevation(a.x,a.z)-.6,b0=low?.[1]??terrain.meshElevation(b.x,b.z)-.6;
  group.push([p(a,a0),p(a,y[0]),p(b,y[1])],[p(a,a0),p(b,y[1]),p(b,b0)]);
 },
});
const boundary=model.levels[0].risers[0].map(ring=>ring.map(([x,z])=>[x+model.originXZ[0],z+model.originXZ[1]]));
const tier=model.levels[1].risers.flatMap(rings=>rings.map(ring=>ring.map(([x,z])=>[x+model.originXZ[0],z+model.originXZ[1]])));
console.log(JSON.stringify({survey:model.evidenceSha256,shellSha256:SOURIS_ROOF_SHA256,terrain:conf.sha256,boundary,tier,group}));
