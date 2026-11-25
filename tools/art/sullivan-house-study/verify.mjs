import {Raycaster,Vector3} from 'three';
import {makeSullivanDormer} from './dormer.ts';
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const model=makeSullivanDormer();model.updateMatrixWorld(true);
const r=new Raycaster();
function trace(origin,normal=[0,0,-1]){
 r.set(new Vector3(...origin),new Vector3(...normal).normalize());
 const a=r.intersectObject(model,true)[0];assert(a,`Unexpected opening at ${origin}`);return a;
}
let glass=0;
for(const p of model.userData.apertures){
 const n=new Vector3(...p.outward),c=new Vector3(...p.center);
 const t=new Vector3(n.z,0,-n.x), up=new Vector3(0,1,0);
 for(const dx of [-.056,0,.056])for(const dy of [-.145,0,.143]){
  const eye=c.clone().addScaledVector(n,2.2).addScaledVector(t,dx).addScaledVector(up,dy);
  const d=n.clone().negate().addScaledVector(t,-dx*.34).addScaledVector(up,dy*.09).normalize();
  const h=trace(eye.toArray(),d.toArray());
  assert.equal(h.object.name,'glazing',p.role);glass++;
 }
}
assert.equal(glass,54);
for(const [x,sign]of [[3.18,-1],[-3.18,1]])assert.equal(trace([x,3.48,.131],[sign,0,0]).object.name,'hood-shingles','roof cheek must have physical laps');
assert.equal(trace([0,3.63,3]).object.name,'hood-shingles');
const z=[.62,.77,1.21,3.65].map(y=>{const h=trace([2.58,y,3]);assert.equal(h.object.name,'mansard-shingles');return h.point.z;});
assert(z[0]>z[1]&&z[1]>z[2]&&z[2]>z[3]);assert((z[0]-z[1])/.15>(z[2]-z[3])/(3.65-1.21),'lower flare lost');
for(const x of [2.224,2.358,-2.38,-2.251]){
 const h=trace([x,.269,2.49]);assert.equal(h.object.name,'painted-trim');assert(h.point.z>.99,'paired brackets must project in relief');
}
for(const x of [2.30,-2.322])assert.equal(trace([x,.269,2.49]).object.name,'roof-cut','pair gap must show its real backing');
function digest(m){
 const hash=crypto.createHash('sha256'),seen=new Set();let tris=0;
 for(const o of m.children){
  hash.update(o.name);
  const n=o.geometry.attributes.position.count;assert.equal(n%3,0);tris+=n/3;assert(n>0);
  for(const k of ['position','uv','normal','color']){const p=o.geometry.attributes[k].array;assert(p.every(Number.isFinite));hash.update(new Uint8Array(p.buffer));}
  for(const k of ['map','normalMap','roughnessMap'])if(o.material[k]&&!seen.has(o.material[k])){seen.add(o.material[k]);hash.update(o.material[k].image.data);}
 }
 assert.equal(m.children.length,9);assert(tris>0&&tris<=7400);
 return {geometryAndMaterialSHA256:hash.digest('hex'),modelTriangles:tris,materialBatches:m.children.length};
}
const exact=digest(model);assert.deepEqual(digest(makeSullivanDormer()),exact);
const read=n=>fs.readFileSync(new URL(n,import.meta.url)),a=read('./evidence/fixed-stock.json');
assert.equal(crypto.createHash('sha256').update(a).digest('hex'),'fdeff4d4d0040b54ce1afe63616c4a890d0816948adbf2919814fec087556c84');
const stats=JSON.parse(a);assert.equal(stats.length,3);
assert(stats.every(x=>x.candidate==='q12313/47'&&x.span[0]===3363&&x.span[1]===3438&&x.vertexCount===19710&&x.stockRestoredIdentical&&x.outsideOnePixelId===0&&x.categoryOutsideOnePixelId===0));
assert.equal(stats[2].roofIdCorePixels,268);
const digestDescription=n=>crypto.createHash('sha256').update(read(n)).digest('hex');
assert.equal(digestDescription('./evidence/independent-owner.json'),'0dc265834f8b14f430513514058805845dd56f155bab41cea1e5ac2badfb399c');
assert.equal(digestDescription('./evidence/independent-xy-hold.json'),'b9d408b03a7b58d89e7e52f62fd64e90c66402a8a2e59243360278f4bd7aade5');
const gate=JSON.parse(read('./evidence/independent-xy-hold.json'));assert.equal(gate.nPositiveEligibleRoles,5);assert.equal(gate.nRoles,22);assert.equal(gate.numericZOpened,false);

const visualPath='./evidence/independent-dormer-result.json';assert.equal(digestDescription(visualPath),'eafbf0ec05bab3851ed215de0f69b0305247c5a0943c4b63cafff6c96648bbf5');
const visual=JSON.parse(read(visualPath));assert.equal(visual.candidateHash,exact.geometryAndMaterialSHA256);assert.equal(visual.glassAngleRaysPassed,288);
assert.equal(visual.joineryNoSkyRays.head.rays+visual.joineryNoSkyRays.sill.rays,648);
assert.equal(visual.joineryNoSkyRays.head.leaks.length+visual.joineryNoSkyRays.sill.leaks.length,0);
// Keep the independent receipt byte-exact. The release removes two
// trailing spaces from the reviewed code; reproduce those source bytes
// explicitly before checking the receipt, in addition to the geometry test.
const reviewedSpacing={
 'dormer.ts':' const cutOff=1.096;',
 'finish.ts':'   const pores=Math.max(0,(.39-micro)*1.7);value=157+21*blur+18*meso+11*grit+31*spall-16*pores;',
};
for(const [source,hash] of Object.entries(visual.sourceSHA256)){
 const released=read('./'+source).toString('utf8'),line=reviewedSpacing[source];
 const reviewed=line?released.replace(line+'\n',line+' \n'):released;
 assert.equal(crypto.createHash('sha256').update(reviewed).digest('hex'),hash);
}
console.log(JSON.stringify({...exact,independentGlassRays:288,independentHeadAndSillRays:648,physicalSashPanes:6,angledGlassRays:glass,backedIndependentBracketPairs:2,mixedPhysicalSurfaceProbes:13,exactStockViews:3,liveReplacement:false},null,2));
