import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {test} from 'node:test';

const here=p=>fileURLToPath(new URL(p,import.meta.url));
const sum=b=>createHash('sha256').update(b).digest('hex');
function run(cwd,name,...args){
 return spawnSync(process.execPath,['--experimental-strip-types',here(name),...args],{cwd,encoding:'utf8',timeout:20_000});
}
test('audited native seat and wet boundary reproduce without adding a dry edge or overwriting evidence',()=>{
 const root=mkdtempSync(join(tmpdir(),'pei-seated-court-')),plan=join(root,'plan'),seat=join(root,'seated'),bad=join(root,'bad-plan');
 try{
  for(const [name,args] of [['inward-plan.mjs',[plan]],['seat-native.mjs',[plan,seat]]]){
   const x=run(root,name,...args);assert.ifError(x.error);assert.equal(x.status,0,x.stderr);
  }
  const report=JSON.parse(readFileSync(join(seat,'seated-rim.json')));
  assert.deepEqual([report.capVertices,report.wetEdges,report.wetTriangles,report.wetVertices,report.skippedDryEdges],[29228,374,748,375,961]);
  const names=['cap.xyz.f32le','wet-rim-only.xyz.f32le','wet-rim-with-cap.u32le'];
  const [cap,lower,faces]=names.map(n=>readFileSync(join(seat,n)));
  for(const [i,data] of [cap,lower,faces].entries())assert.equal(sum(data),report.assets[names[i]].sha256);
  const boundary=readFileSync(join(plan,'inward-plan.json.ring.u32le')),role=readFileSync(join(plan,'inward-plan.json.ring-role.u8'));
  const edge=(a,b)=>Math.min(a,b)+':'+Math.max(a,b),wet=new Set(),dry=new Set();
  for(let i=0;i<role.length;i++){
   const set=role[i]===1?wet:dry;set.add(edge(boundary.readUInt32LE(i*4),boundary.readUInt32LE((i+1)%role.length*4)));
  }
  for(let i=0;i<faces.length;i+=24){
   const a=faces.readUInt32LE(i+4),b=faces.readUInt32LE(i);
   assert.ok(wet.delete(edge(a,b))&&!dry.has(edge(a,b)));
   assert.equal(faces.readUInt32LE(i+12),b);
   for(const [top,off] of [[a,8],[b,20]]){
    const low=faces.readUInt32LE(i+off)-report.capVertices;assert.ok(low>=0&&low<report.wetVertices);
    assert.equal(lower.readFloatLE(12*low),cap.readFloatLE(12*top));
    assert.equal(lower.readFloatLE(12*low+8),cap.readFloatLE(12*top+8));
    assert.ok(lower.readFloatLE(12*low+4)<report.oceanY&&cap.readFloatLE(12*top+4)>report.oceanY);
   }
  }
  assert.equal(wet.size,0);
  assert.notEqual(run(root,'seat-native.mjs',plan,seat).status,0);
  assert.equal(sum(readFileSync(join(seat,names[0]))),sum(cap));
  mkdirSync(bad);
  for(const n of ['xz.f64le','faces.u32le','ring.u32le','ring-role.u8']){
   const path='inward-plan.json.'+n,data=readFileSync(join(plan,path));if(n==='ring-role.u8')data[0]^=1;
   writeFileSync(join(bad,path),data);
  }
  const rejected=join(root,'rejected');assert.notEqual(run(root,'seat-native.mjs',bad,rejected).status,0);assert.ok(!existsSync(rejected));
 }finally{rmSync(root,{recursive:true,force:true});}
});
