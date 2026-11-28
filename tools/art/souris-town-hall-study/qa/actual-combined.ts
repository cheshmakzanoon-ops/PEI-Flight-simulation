import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import * as T from 'three';
import {buildSourisTownHall} from '../src/hall.ts';
import {buildSourisTownHallCombinedStudy} from '../src/combined-studies.ts';
import {buildDetachedEntrySteps} from '../src/stairs-study.ts';
import {RUNS} from '../src/stair-recipe.generated.ts';
import {CORE_OUTLINE} from '../src/lower-core.ts';
import {area} from '../src/survey.ts';
import {meshDigests} from './mesh-digests.ts';

const H=(x:Buffer|string)=>createHash('sha256').update(x).digest('hex');
const json=(p:string)=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const base=buildSourisTownHall({textured:false});
const rear=buildSourisTownHall({textured:false,frontGable:true,rearSurvey:true});
const standaloneSteps=buildDetachedEntrySteps(RUNS,(base.getObjectByName('trim') as T.Mesh).material as T.Material);
const composed=buildSourisTownHallCombinedStudy();
assert.equal(T.REVISION,'187');
assert.deepEqual(meshDigests(base),json('../proof/rear-neutral-mesh.json'));
assert.deepEqual(meshDigests(composed.hall),meshDigests(rear));
assert.deepEqual(meshDigests(composed.steps),meshDigests(standaloneSteps));
assert.deepEqual(composed.root.children,[composed.hall,composed.steps]);

type Face={minV:number;maxV:number;key:string};
function facets(g:T.Group):Face[]{
 const order=['color','normal','position','uv'] as const;
 return g.children.flatMap(object=>{
  assert(object instanceof T.Mesh && object.geometry instanceof T.BufferGeometry);
  assert(object.position.equals(new T.Vector3())&&object.quaternion.equals(new T.Quaternion())&&object.scale.equals(new T.Vector3(1,1,1)));
  assert(!object.geometry.index&&Object.keys(object.geometry.attributes).length===order.length);
  const attributes=order.map(k=>object.geometry.getAttribute(k));
  const P=object.geometry.getAttribute('position');
  assert(P.count>0&&P.count%3===0);
  assert(attributes.every(x=>x.count===P.count&&x.array instanceof Float32Array));
  const included:Face[]=[];
  for(let i=0;i<P.count;i+=3){
   const v=[-P.getZ(i),-P.getZ(i+1),-P.getZ(i+2)];
   const raw=attributes.map(x=>{
    const a=x.array,one=3*x.itemSize*Float32Array.BYTES_PER_ELEMENT;
    return Buffer.from(a.buffer,a.byteOffset+(i/3)*one,one);
   });
   // Equality below uses exact bytes, including original role, winding, UV and order of the live channels.
   included.push({minV:Math.min(...v),maxV:Math.max(...v),key:object.name+'@'+Buffer.concat(raw).toString('hex')});
  }
  return included;
 });
}
function minus(a:readonly Face[],b:readonly Face[]){
 const counts=new Map<string,number>();
 for(const f of b)counts.set(f.key,(counts.get(f.key)??0)+1);
 return a.filter(f=>{const n=counts.get(f.key)??0;if(n<=0)return true;counts.set(f.key,n-1);return false;});
}
const a=facets(base), b=facets(rear), f=facets(composed.steps);
const removed=minus(a,b),added=minus(b,a);
assert(removed.length>0&&added.length>0);
const seen=[...removed,...added], bed=Math.min(...seen.map(p=>p.minV));
const oldEntryMin=Math.min(...f.map(q=>q.minV)), oldEntryMax=Math.max(...f.map(q=>q.maxV));
assert.equal(f.length,852);
assert.equal(oldEntryMax,Math.fround(.319));
const minCoreV=Math.min(...CORE_OUTLINE.map(q=>q[1]));
assert(minCoreV>9.34&&minCoreV<9.36);
// No geometric symbol which differs between the prior two B/C exports
// extends into the front six metres, even when a long triangle straddles a cut.
assert(bed>6&&bed-oldEntryMax>5.68);
const front=(s:readonly Face[])=>s.filter(x=>x.minV<=6).map(x=>x.key).sort();
assert.deepEqual(front(a),front(b));
const equivalentFrontBytes=front(b).length*3*(3+3+3+2)*Float32Array.BYTES_PER_ELEMENT;
const rootParent=new T.Group();rootParent.add(composed.root);composed.root.updateMatrixWorld(true);
assert(composed.root.matrixWorld.equals(new T.Matrix4()));
assert(composed.hall.matrixWorld.equals(composed.steps.matrixWorld));
const cm=(o:T.Object3D)=>{assert(o instanceof T.Mesh&&o.material instanceof T.Material);return o;};
const trim=cm(composed.hall.getObjectByName('trim')!).material;
assert.equal(cm(composed.steps.getObjectByName('stoneTreads')!).material,trim);
assert.equal(cm(composed.steps.getObjectByName('stoneCheeks')!).material,trim);
assert.notEqual(cm(composed.steps.getObjectByName('surfaceRail')!).material,trim);
const combinedMeshes=[...composed.hall.children,...composed.steps.children].map(cm);
assert.equal(composed.root.getObjectByName('terrain'),undefined);
const gs=new Set(combinedMeshes.map(o=>o.geometry)),ms=new Set(combinedMeshes.map(o=>o.material));
let gReleases=0,mReleases=0,unalteredMaterials=0;
for(const g of gs)g.addEventListener('dispose',()=>gReleases++);
for(const m of ms)m.addEventListener('dispose',()=>mReleases++);
(cm(rear.getObjectByName('trim')!).material).addEventListener('dispose',()=>unalteredMaterials++);
composed.dispose();composed.dispose();
assert.equal(gReleases,gs.size);assert.equal(mReleases,ms.size);assert.equal(unalteredMaterials,0);
assert.equal(rootParent.children.length,0);
assert.deepEqual(meshDigests(base),json('../proof/rear-neutral-mesh.json'));
const hash=(s:unknown)=>H(JSON.stringify(s));
const rr=json('../proof/rear-roof-geometry.json'), er=json('../proof/entrance-geometry-check.json');
assert.equal(rr.rearCoverage.heldRays,20);assert.equal(rr.rearCoverage.seamMiss,0);assert.equal(er.artifact.triangles,852);
console.log(JSON.stringify({
 phase:'DETACHED COMPOSITION ONLY. No new measured surfaces, placement or renderer activation.',
 three:T.REVISION,
 inheritedScope:{oldMainRoofHeldRays:95,rearLowHeldRays:20,oldRearCoreP90M:rr.rearCoverage.previous[2],
  authoredRearCoreP90M:rr.rearCoverage.lowered[2],lowerCorePlanAreaM2:Math.abs(area(CORE_OUTLINE)),
  cutsAndClosure:'unchanged previous lower-rear option',entryRunRises:RUNS.map(q=>q.tops.length),
  entrySillAndDryContact:'unchanged previous optional studio; no terrain emitted by this assembly',
  withheld:'upper east, unsupported extent/finish of rear wood addition, treads as construction data, whole placement'},
 emittedCompound:{bodyAndRearMeshes:rear.children.length,actualStairMeshes:standaloneSteps.children.length,
  bodyAndRearFacets:b.length,standaloneEntriesFacets:f.length,totalFacets:b.length+f.length,
  sourceAddedFacetsVersusTwoUnchangedModuleOutputs:0,newTextureMaps:0,frontGroupIdentity:'same matrix, no shift'},
 separation:{foremostEntryV:oldEntryMin,rearmostEntryV:oldEntryMax,
  currentCoreForemostV:minCoreV,computedForemostRearDifferenceV:bed,
  entryToClosestDifferingTypedFaceSeparationM:bed-oldEntryMax,
  fullFrontByteMultisetExactThroughV:6,exactFrontFaces:front(b).length,equivalentFrontBytes,
  differentDefaultToRearRemovedTypedFaces:removed.length,differentDefaultToRearAddedTypedFaces:added.length},
 custody:{proofDefaultMeshSha:H(fs.readFileSync(new URL('../proof/rear-neutral-mesh.json',import.meta.url))),
  actualNeutralSha:hash(meshDigests(base)),exactCompoundHallAndStandaloneRearSha:hash(meshDigests(rear)),
  exactCompoundAndStandaloneEntrySha:hash(meshDigests(standaloneSteps)),
  allReleasesOwnedOnce:[gReleases,mReleases],unrelatedMaterialReleases:unalteredMaterials}
},null,2));
