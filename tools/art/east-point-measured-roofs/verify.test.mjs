import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {makeEastPointRoofStudy} from './mesh-study.ts';
import {roofHeight} from '../../../src/sim/roof-ridge.ts';
const file=n=>readFileSync(new URL('../../../'+n,import.meta.url));
const sha=s=>createHash('sha256').update(s).digest('hex');
const dir='data/east-point-roof-study/';
const models=JSON.parse(file(dir+'two-roof-hypotheses.json'));
const receipts=JSON.parse(file(dir+'detached-shape.json'));
const digest=a=>sha(Buffer.from(a.buffer,a.byteOffset,a.byteLength));
const stock=file('public/world/buildings/tiles.pack'),wire=stock.subarray(3260377,3269450);
const old=JSON.parse(gunzipSync(wire)).features;
assert.equal(sha(wire),'bcc9434d46fb77c23f15b94c02f0a7758f3dcfcf61cfa96f6336055347f83279');
const round=n=>Number(n.toFixed(6));
for(const q of models)test('actual signed East Point roof '+q.sourceOrdinal+' retains the plan and only two upward planes',()=>{
  assert.deepEqual(old[q.sourceOrdinal].footprint,q.sourceOuterRingWGS84);
  const a=makeEastPointRoofStudy(q);assert.ok(a);
  const {geometry:g,authority:p,ring,ridge}=a;
  try{
   const xyz=g.getAttribute('position'),n=g.getAttribute('normal'),exact=new Set();
   assert.ok(!g.index&&p.roofTriangles>=p.oldPlanTriangles&&p.roofTriangles<=p.oldPlanTriangles*3);
   const plan=Math.abs(ring.reduce((sum,v,i)=>{
     const u=ring[(i+1)%ring.length];return sum+v.x*u.z-v.z*u.x;
   },0))*.5;
   assert.ok(Math.abs(p.projectedAreaM2-plan)<1e-7);
   for(let i=0;i<xyz.count;i++){
    const x=xyz.getX(i),z=xyz.getZ(i);
    assert.ok(Math.abs(xyz.getY(i)-roofHeight({x,z},ridge))<.000003);
    assert.ok(n.getY(i)>.9);
    const v=[n.getX(i),n.getY(i),n.getZ(i)].map(round);
    exact.add(v.map(a=>Number(a.toFixed(4))).toString());
   }
   assert.equal(exact.size,2);
   const expected=receipts.find(r=>r.sourceOrdinal===q.sourceOrdinal);
   assert.equal(digest(xyz.array),expected.roofPositionsSHA256);
   assert.equal(digest(n.array),expected.normalSHA256);
   assert.ok(ring.every(v=>Array.from({length:xyz.count},(_,i)=>Math.hypot(v.x-xyz.getX(i),v.z-xyz.getZ(i))).some(e=>e<.000002)));
  }finally{g.dispose();}
});
test('malformed or unsupported studies cannot create a roof',()=>{
 const a=models[0];assert.equal(makeEastPointRoofStudy({...a,sourceOrdinal:193}),undefined);
 assert.equal(makeEastPointRoofStudy({...a,projectionLocal:{...a.projectionLocal,unitAcrossXZ:[0,0]}}),undefined);
 const b=structuredClone(a);b.sourceOuterRingWGS84[2]=b.sourceOuterRingWGS84[0];
 assert.equal(makeEastPointRoofStudy(b),undefined);
});
