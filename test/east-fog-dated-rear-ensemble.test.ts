import * as T from 'three';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeFogGableShell,exchangeOnlyFog} from '../tools/art/east-fog-study/east-fog-gable-shell.ts';
import {combineEastFogAuthoredSurface} from '../tools/art/east-fog-study/east-fog-combined-surface.ts';
import {eastFogTowerwardSash} from '../tools/art/east-fog-study/east-fog-towerward-sash.ts';
import {buildEastFogDatedRearEnsemble} from '../tools/art/east-fog-study/east-fog-dated-rear-ensemble.ts';
const plan=JSON.parse(readFileSync(new URL('../tools/art/east-fog-study/east-fog-bulk-v2.json',import.meta.url))).closedBodyPlan;
test('the documented #1 sash keeps all old authored role slots and one unindexed surface',()=>{
 const s=new T.BufferGeometry(),bits=(a:Float32Array)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
 const schema=[['position',3],['normal',3],['color',3],['clad',1]] as const;
 for(const [k,n] of schema)s.setAttribute(k,new T.Float32BufferAttribute(new Float32Array(8727*n),n));
 const host=makeFogGableShell(plan).geo,fitted=exchangeOnlyFog(s,host,true);
 const old=combineEastFogAuthoredSurface(fitted,plan).geometry,added=eastFogTowerwardSash(plan).geometry;
 const {geometry:g,roles}=buildEastFogDatedRearEnsemble(fitted,plan);
 assert.deepEqual([roles.sash2,roles.sash3,roles.cornice,roles.towerward,roles.end],[[5853,6645],[6645,7437],[7437,8157],[8157,8949],8949]);
 assert(g.index===null&&g.groups.length===0&&g.drawRange.count===Infinity);
 for(const [k,n] of schema){
  const b=g.getAttribute(k).array as Float32Array;
  assert.deepEqual(bits(b.subarray(0,8157*n)),bits(old.getAttribute(k).array as Float32Array));
  assert.deepEqual(bits(b.subarray(8157*n)),bits(added.getAttribute(k).array as Float32Array));
 }
 for(const q of [s,host,fitted,old,added,g])q.dispose();
});
