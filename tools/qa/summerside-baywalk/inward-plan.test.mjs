import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const script=fileURLToPath(new URL('./inward-plan.mjs',import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
const run=(cwd,out)=>spawnSync(process.execPath,['--experimental-strip-types',script,out],{
 cwd,encoding:'utf8',timeout:20_000,
});
test('the shipped signed fields yield one conservative, typed, role-split plan without overwriting evidence',()=>{
 const tmp=mkdtempSync(join(tmpdir(),'pei-baywalk-source-test-')),out=join(tmp,'new');
 try{
  const job=run(tmp,out);
  assert.ifError(job.error);assert.equal(job.status,0,job.stderr);
  const report=JSON.parse(readFileSync(join(out,'inward-plan.json'),'utf8'));
  const {inward,rimSourceConstraint:rim,rawScopedDraft:wire}=report;
  assert.equal(report.schema,1);
  assert.equal(report.source.terrainManifest,'77c9417c6bd4f4286ea4ca86a4625be30f779f33272dd7a8a4af13e001de7e98');
  const expected={
   'xz.f64le':'32094c7d2229a320c989658634c97a2b2fb29af06aedcc3d4538bef8a71ef9c4',
   'faces.u32le':'9cbdea9673be2c21b00a10d28b9d7e38e2803a17d3671078b823a3eb9b0d3985',
   'ring.u32le':'83c45763db0ed2c24a984d392cd5e64db7d55ff358a3489fd2ff6a83893d8913',
   'ring-role.u8':'502d55f9ece68a674e4cfd7a6851b6981882b0be079749fc897c36ac079d2be5',
  };
  assert.deepEqual([inward.points,inward.triangles,inward.perimeter],[29228,57119,1335]);
  assert.ok(inward.polyArea>6686&&inward.polyArea<6688);
  assert.deepEqual(inward.perimeters,[1335]);
  assert.equal(inward.nonmanifold+inward.wrongWinding+inward.irregularCount+inward.degenerateAfterSnap,0);
  assert.ok(inward.minPositive.every(n=>n>0));
  assert.deepEqual(rim.edges,[0,374,961,0]);
  assert.equal(rim.junctions.length,2);
  const pinned={};
  for(const [k,n] of Object.entries({'xz.f64le':16*inward.points,'faces.u32le':12*inward.triangles,
                                     'ring.u32le':4*inward.perimeter,'ring-role.u8':inward.perimeter})){
   const b=readFileSync(join(out,'inward-plan.json.'+k));pinned[k]=sha(b);
   assert.equal(b.length,n);assert.equal(wire[k].bytes,n);assert.equal(wire[k].sha256,pinned[k]);assert.equal(pinned[k],expected[k]);
   if(k==='ring-role.u8')assert.equal(b.filter(x=>x===1).length,374);
  }
  const repeat=run(tmp,out);
  assert.notEqual(repeat.status,0);assert.match(repeat.stderr,/new output directory/);
  assert.equal(readdirSync(out).length,5);
  for(const [k,h] of Object.entries(pinned))assert.equal(sha(readFileSync(join(out,'inward-plan.json.'+k))),h);
 }finally{rmSync(tmp,{recursive:true,force:true});}
});
