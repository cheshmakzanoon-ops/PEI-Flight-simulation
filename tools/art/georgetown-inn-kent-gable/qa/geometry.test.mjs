import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {makeFormerKentUpper,makeKentSide2016,kentLowerApertures,KENT_LOWER} from '../inn-kent-lower.ts';
import {makeKentGableSpecimen,INN_KENT_STUDY} from '../inn-kent-gable-study.ts';
const words=(m)=>Object.fromEntries(Object.entries(m.geometry.attributes).map(([name,v])=>[name,Array.from(v.array)]));
const hash=p=>createHash('sha256').update(readFileSync(new URL(p,import.meta.url))).digest('hex');
const model=makeKentSide2016(),upper=model.children[0],lower=model.children[1];
model.updateMatrixWorld(true);
const material=(o)=>[o.material.color.toArray(),o.material.roughness,o.material.customProgramCacheKey()];
const get=r=>lower.children.find(m=>m.userData.role===r);
const triplets=o=>{const a=o.geometry.attributes.position.array;return Array.from({length:a.length/9},(_,i)=>[0,1,2].map(j=>
 new T.Vector3(...a.subarray(i*9+j*3,i*9+j*3+3))));};
const c=kentLowerApertures();
test('every original source byte, all old P/N/UV/role/material bytes and position kept',()=>{
 assert.deepEqual([
  hash('../inn-kent-gable-study.ts'),hash('../inn-kent-glass.ts'),hash('../inn-material-experiment.ts')],
  ['aaf7dacfe08387bf25fee174a529f4caf7d9beed93194e404e8e4fe023168238','1ac2425d251bcd9a6c53c56c875dcb949352258c840f2bd4f16b96da769cb390','2d7df50a7881c9d598d3a70adddae930cb93540a1f8e065a24b19554e8f35329']);
 const old=makeFormerKentUpper(),base=makeKentGableSpecimen();
 assert.deepEqual(upper.children.map(m=>[m.name,words(m),material(m)]),old.children.map(m=>[m.name,words(m),material(m)]));
 assert.deepEqual(upper.children.map(words),base.children.map(words));
 assert.equal(model.userData.placement,false);
 assert.equal(INN_KENT_STUDY.installAuthority,false);
 assert.equal(lower.children.length,7);
});
test('reuses exact studio seam with no lower cap duplicate; only registered three lower apertures',()=>{
 const lap=triplets(get('lap')).filter(p=>p.every(q=>q.z===0));
 const seen=[Math.fround(-KENT_LOWER.halfWidth),Math.fround(KENT_LOWER.halfWidth)];
 const seam=tris=>{
  const intervals=tris.map(t=>t.filter(p=>p.z===0&&p.y===Math.fround(KENT_LOWER.jointY)).map(p=>p.x)).filter(t=>t.length===2)
   .map(t=>t.sort((a,b)=>a-b)).sort((a,b)=>a[0]-b[0]);
  assert.ok(intervals.length>1);let end=seen[0];
  for(const t of intervals){assert.equal(t[0],end);end=t[1];}
  assert.equal(end,seen[1]);
 };
 seam(lap);seam(triplets(upper.children.find(m=>m.userData.role==='blueLap')));
 const a=lap.reduce((n,[p,q,r])=>n+q.sub(p).cross(r.sub(p)).length()*.5,0);
 const intended=(KENT_LOWER.jointY-KENT_LOWER.specimenBottomY)*KENT_LOWER.halfWidth*2-c.skinHoles.reduce((s,p)=>s+(p.r-p.l)*(p.t-p.b),0);
 assert.ok(Math.abs(a-intended)<.00001);
 for(const o of lower.children)for(const f of triplets(o)){
  assert.ok(f.every(v=>v.y<=Math.fround(KENT_LOWER.jointY)&&v.y>=Math.fround(KENT_LOWER.specimenBottomY)&&v.x>=seen[0]&&v.x<=seen[1]));
  assert.ok(!f.every(v=>v.y===Math.fround(KENT_LOWER.jointY)));
 }
});
test('window voids are real opaque pane/reveal assemblies; door is separate, not invented transom glass',()=>{
 const ray=new T.Raycaster();
 function probe(x,y){
  ray.set(new T.Vector3(x,y,1.1),new T.Vector3(0,0,-1));
  return ray.intersectObject(lower,true)[0];
 }
 for(const q of c.clear.slice(0,2)){
  const pane=probe((q.l+q.r)*.5,q.b+.57);
  assert.equal(pane.object.userData.role,'glass'); assert.ok(Math.abs(pane.point.z+.144)<1e-6);
  assert.equal(probe(q.l-.05,q.b+.5).object.userData.role,'case');
 }
 assert.equal(probe(.35,2.02).object.userData.role,'lap');
 assert.equal(probe(.37,.77).object.userData.role,'glass');
 assert.equal(probe(.36,.38).object.userData.role,'case');
});
test('both red hoods are closed volumes rooted through siding, not floating decal quads',()=>{
 const e=[...triplets(get('hood')),...triplets(get('hoodShadow'))];
 const clusters=[e.filter(f=>f[0].x<0),e.filter(f=>f[0].x>0)];
 for(const ts of clusters){
  const edge=new Map(),name=v=>v.toArray().map(x=>x.toFixed(6)).join(',');
  assert.equal(ts.length,12);
  for(const tri of ts)for(let i=0;i<3;i++){
   const k=[name(tri[i]),name(tri[(i+1)%3])].sort().join('/');edge.set(k,(edge.get(k)??0)+1);
  }
  assert.ok([...edge.values()].every(n=>n===2));
  assert.ok(ts.flat().some(v=>v.z<-.02)&&ts.flat().some(v=>v.z>.38));
 }
 const tris=lower.children.reduce((s,m)=>s+m.geometry.attributes.position.count/3,0);
 assert.ok(tris<=420);
 assert.ok(lower.children.every(m=>m.material.transparent===false&&m.material.opacity===1&&m.material.map===null));
});
