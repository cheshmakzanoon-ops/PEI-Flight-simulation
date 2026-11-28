import * as T from 'three';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeFogGableShell,exchangeOnlyFog} from '../tools/art/east-fog-study/east-fog-gable-shell.ts';
import {combineEastFogAuthoredSurface,EAST_FOG_COMBINED_ROLES as R} from '../tools/art/east-fog-study/east-fog-combined-surface.ts';
import {buildProofSecondaryFog,sashMove} from '../tools/art/east-fog-study/secondary-fog-lod.ts';
const plan=JSON.parse(readFileSync(new URL('../tools/art/east-fog-study/east-fog-bulk-v2.json',import.meta.url))).closedBodyPlan;
const schema=[['position',3],['normal',3],['color',3],['clad',1]];
const make=(n)=>{const g=new T.BufferGeometry();
 for(const [k,s] of schema)g.setAttribute(k,new T.BufferAttribute(new Float32Array(n*s).fill(.9),s));
 return g;};
const bits=(a)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
test('actual authored sashes and trim continuously retire wholly within the same middle shell',()=>{
 const q=make(8727),g=make(1836),host=makeFogGableShell(plan).geo;
 const corrected=exchangeOnlyFog(q,host,true),middle=exchangeOnlyFog(g,host,false);
 const combo=combineEastFogAuthoredSurface(corrected,plan).geometry;
 let prev=0,first,last,seen={};
 for(const d of [438,500,534,560,580,594,600,605,610,619,639.999,640,689.95,690.05,749.95,750.05]){
  const w=buildProofSecondaryFog(combo,plan,d),z=w.geometry;assert(w.sashTranslation>=prev);prev=w.sashTranslation;
  for(const [k,s] of schema){
   const a=z.getAttribute(k).array,b=combo.getAttribute(k).array,mid=middle.getAttribute(k).array;
   assert.deepEqual(bits(a.subarray(0,5853*s)),bits(b.subarray(0,5853*s)));
   assert.deepEqual(bits(a.subarray(5055*s,5457*s)),bits(mid.subarray(1440*s,1842*s)));
   if(d<=500||k==='color'||k==='clad')assert.deepEqual(bits(a),bits(b));
   if(k==='normal')assert.deepEqual(bits(a.subarray(5853*s,7437*s)),bits(b.subarray(5853*s,7437*s)));
  }
  if(d===600)first=w.clearance;
  if(d>=640){
   const p=Buffer.from(bits(z.attributes.position.array));
   if(!last)last=p;else assert.deepEqual(p,last);
  }
  z.dispose();seen[d]=w.clearance;
 }
 assert(first.sashes>.018&&first.trimTower>.003&&first.trimPoint>.003);
 assert(sashMove(500)===0&&Math.abs(sashMove(640)-.14)<1e-10);
 console.log(JSON.stringify({firstFullySeated:600,clearanceM:first,at640:seen[640]}));
 [q,g,host,corrected,middle,combo].forEach(x=>x.dispose());
});
test('new shader-level or unproven geometry is refused by the fixed proof',()=>{
 const q=make(8727),host=makeFogGableShell(plan).geo,corrected=exchangeOnlyFog(q,host,true);
 const combo=combineEastFogAuthoredSurface(corrected,plan).geometry;
 for(const x of [NaN,Infinity,-500,501,1000])assert.throws(()=>buildProofSecondaryFog(combo,plan,x),/fixed proof/);
 combo.morphAttributes.position=[combo.attributes.position.clone()];
 assert.throws(()=>buildProofSecondaryFog(combo,plan,600),/source layout/);delete combo.morphAttributes.position;
 const ordinary=combo.attributes.position;
 combo.setAttribute('position',new T.InstancedBufferAttribute(ordinary.array,3));
 assert.throws(()=>buildProofSecondaryFog(combo,plan,600),/close detail source words/);
 combo.setAttribute('position',ordinary);
 combo.attributes.color.setX(7437,.3);
 assert.throws(()=>buildProofSecondaryFog(combo,plan,600),/authored ABI drift/);
 [q,host,corrected,combo].forEach(x=>x.dispose());
});
