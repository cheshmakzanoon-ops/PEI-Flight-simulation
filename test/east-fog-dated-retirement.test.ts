import * as T from 'three';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeFogGableShell,exchangeOnlyFog} from '../tools/art/east-fog-study/east-fog-gable-shell.ts';
import {buildEastFogDatedRearEnsemble,EAST_FOG_DATED_REAR_ROLES as R} from '../tools/art/east-fog-study/east-fog-dated-rear-ensemble.ts';
import {combineEastFogAuthoredSurface} from '../tools/art/east-fog-study/east-fog-combined-surface.ts';
import {studyEastFogCornice} from '../tools/art/east-fog-study/east-fog-cornice-study.ts';
import {buildProofSecondaryFog} from '../tools/art/east-fog-study/secondary-fog-lod.ts';
import {patchDetachedFogRetirement} from '../tools/art/east-fog-study/secondary-fog-vertex-program.ts';
import {FIXED_PROOF_LOD_METRES,solidTuckPlan} from '../tools/art/east-fog-study/solid-lod-math.ts';
const plan=JSON.parse(readFileSync(new URL('../tools/art/east-fog-study/east-fog-bulk-v2.json',import.meta.url))).closedBodyPlan;
const schema=[['position',3],['normal',3],['color',3],['clad',1]] as const;
const bits=(a:Float32Array)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const make=()=>{
 const g=new T.BufferGeometry();
 for(const [k,s] of schema)g.setAttribute(k,new T.BufferAttribute(new Float32Array(8727*s).fill(.9),s));
 const host=makeFogGableShell(plan).geo,corrected=exchangeOnlyFog(g,host,true);
 const two=combineEastFogAuthoredSurface(corrected,plan).geometry;
 const three=buildEastFogDatedRearEnsemble(corrected,plan).geometry;
 return {two,three,dispose:()=>[g,host,corrected,two,three].forEach(x=>x.dispose())};
};
test('towerward sash retires in its own convex wall without changing any older words at any fixed distance',()=>{
 const {two,three,dispose}=make();let last:Buffer|undefined,clearance=0;
 try{
  for(const d of FIXED_PROOF_LOD_METRES){
   const a=buildProofSecondaryFog(two,plan,d),b=buildProofSecondaryFog(three,plan,d);
   try{
    for(const [k,item] of schema){
     const base=a.geometry.attributes[k].array as Float32Array,next=b.geometry.attributes[k].array as Float32Array;
     assert.deepEqual(bits(next.subarray(0,8157*item)),bits(base),k+' at '+d);
     if(k!=='position'||d<=500){
      const start=R.towerward[0]*item;
      assert.deepEqual(bits(next.subarray(start)),bits((three.attributes[k].array as Float32Array).subarray(start)),k+' suffix at '+d);
     }
    }
    if(d===600)clearance=b.clearance.towerward!;
    if(d>=640){
     const words=bits((b.geometry.attributes.position.array as Float32Array).subarray(R.towerward[0]*3));
     if(last)assert.deepEqual(words,last);else last=Buffer.from(words);
    }
   }finally{a.geometry.dispose();b.geometry.dispose();}
  }
  assert(clearance>.018);
  console.log(JSON.stringify({towerwardOpaqueMarginAt600M:clearance}));
 }finally{dispose();}
});
test('the appended window must retain all its authenticated art words',()=>{
 const {three,dispose}=make();
 try{
  for(const [k] of schema){
   const words=new Uint32Array(three.attributes[k].array.buffer),i=words.length-1;
   words[i]^=1;
   assert.throws(()=>buildProofSecondaryFog(three,plan,600),new RegExp('authored ABI drift: '+k));
   words[i]^=1;
  }
 }finally{dispose();}
});
test('detached vertex branch owns separate towerward IDs, never reclassifying them as cornice',()=>{
 const root=studyEastFogCornice(plan);
 try{
  const source='#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>\nvLocal=position;vClad=clad;';
  const tuck=solidTuckPlan(plan,root);
  const original=patchDetachedFogRetirement(source,plan,tuck)!;
  const dated=patchDetachedFogRetirement(source,plan,tuck,8949)!;
  assert(original&&!original.includes('8949'));
  assert(dated.includes('eastFogSecondaryTrim=gl_VertexID>=7437&&gl_VertexID<8157;'));
  assert(dated.includes('else if((gl_VertexID>=5853&&gl_VertexID<7437)||(gl_VertexID>=8157&&gl_VertexID<8949))'));
  assert.equal(dated.replace('(gl_VertexID>=5853&&gl_VertexID<7437)||(gl_VertexID>=8157&&gl_VertexID<8949)',
   'gl_VertexID>=5853&&gl_VertexID<7437'),original);
  assert.equal(patchDetachedFogRetirement(source,plan,tuck,8727 as 8157),undefined);
  assert.equal(patchDetachedFogRetirement(dated,plan,tuck,8949),undefined);
 }finally{root.geometry.dispose();root.bulk.dispose();}
});
