import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Cover} from '../src/sim/cover.ts';
import {Terrain} from '../src/sim/terrain.ts';
import {coastSegments} from '../src/sim/shoreline.ts';
import {basinBankGeometry,basinBankJoins,inBasinBank,traceBasinBank} from '../src/render/basin-channel-bank.ts';

test('Basin Head curtain traces the same cover and matches every external legacy height',()=>{
 const world=new URL('../public/world/',import.meta.url);
 const meta=(path:string)=>JSON.parse(readFileSync(new URL(path+'.json',world),'utf8'));
 const asset=(p:string)=>Uint8Array.from(gunzipSync(readFileSync(new URL(p,world))));
 const a=meta('terrain'),b=meta('cover');
 const t=new Terrain(a,new Int16Array(asset(a.file).buffer)),c=new Cover(b.width,b.height,asset(b.file));
 const s=coastSegments(c,t),target=s.filter(inBasinBank),ordinary=s.filter(x=>!inBasinBank(x));
 const joins=basinBankJoins(target,ordinary);
 assert.equal(target.length,34);
 assert.equal(joins.length,4);
 let count=0,worst=0;
 for(const line of target){
  const traced=traceBasinBank(c,t,line);assert(traced);
  assert.deepEqual(traced[0],{x:line.ax,z:line.az});
  assert.deepEqual(traced.at(-1),{x:line.bx,z:line.bz});
  for(const q of traced){worst=Math.max(worst,Math.abs(c.legacyDistance(t,q.x,q.z)));count++;}
 }
 assert(count>2500&&worst<1e-4,{count,worst});
 const out=basinBankGeometry(c,t,target,(x,z)=>t.atlasElevation(x,z)-8,joins);
 function closeY(x:number,z:number){
  const actual=[];
  for(let i=0;i<out.length;i+=3)if(out[i]===Math.fround(x)&&out[i+2]===Math.fround(z))actual.push(out[i+1]);
  assert(actual.length);return Math.max(...actual);
 }
 for(const {x,z} of joins)assert.equal(closeY(x,z),Math.fround(Math.max(-.025,t.meshElevation(x,z)+.72)));
 // A finish sampled well away from all four splices must actually use the new grade.
 assert(out.some(y=>y===Math.fround(-.025)));
 assert(out.every(Number.isFinite));
});
