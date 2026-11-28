/** Read-only optional verification of retained native comparison outputs. No renderer integration. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
assert.ok(process.argv[2],'usage: node verify-causal-custody.mjs <retained capture directory>');
const root=resolve(process.argv[2]),read=s=>readFileSync(resolve(root,s));
const expected=JSON.parse(readFileSync(new URL('causal-control.json',import.meta.url)));
const sha=a=>createHash('sha256').update(a).digest('hex');
const roles=['before','tessellation','grade','restore'],views={};
for(const phase of ['approach','near','exit']){
 const b=read(phase+'.json'),p=JSON.parse(b);
 assert.equal(sha(b),expected.native.phases[phase].nativeReceipt);
 assert.equal(p.frame.mode,'flight');
 const a=p.grade;
 const [base]=a.passes.before.grounds;
 for(const k of roles){
  const d=a.passes[k].grounds;
  assert.equal(d.length,1);
  assert.equal(d[0].buffer.normal,null);
  assert.deepEqual(d[0].matrix,base.matrix);
  assert.deepEqual(d[0].programSHA,base.programSHA);
  assert.ok(d[0].programSHA.length===2&&d[0].programSHA.every(x=>sha(read(x+'.glsl'))===x));
 }
 for(const [k,v] of Object.entries(p.imagesSHA))assert.equal(sha(read(phase+'-'+k+'.png')),v);
 assert.equal(a.neutralStrong,0);assert.equal(a.alpha,0);
 views[phase]={strong:a.causalStrong,travel:p.d};
}
const near=JSON.parse(read('near.json')).grade;
function lane(role,name){
 const a=near.passes[role].grounds[0].buffer[name],v=read('near-grade-'+role+'-'+name+'.raw');
 assert.equal(v.length,a.count);assert.equal(sha(v),a.sha);return v;
}
const b=lane('before','position'),n=lane('tessellation','position'),g=lane('grade','position'),r=lane('restore','position');
assert.ok(b.equals(r)&&b.equals(n.subarray(0,b.length))&&b.equals(g.subarray(0,b.length)));
assert.equal(sha(n),expected.checkedNativeNeutralFullSha);
assert.equal(sha(n.subarray(b.length)),expected.portable.neutralSuffixSHA256);
for(let i=b.length;i<n.length;i+=12){
 assert.equal(n.readUInt32LE(i),g.readUInt32LE(i));
 assert.equal(n.readUInt32LE(i+8),g.readUInt32LE(i+8));
}
assert.ok(lane('tessellation','uv').equals(lane('grade','uv')));
const before=lane('before','element'),out=lane('grade','element'),begin=20152*6;
assert.ok(before.equals(lane('restore','element'))&&out.equals(lane('tessellation','element')));
assert.ok(before.subarray(0,begin).equals(out.subarray(0,begin))&&before.subarray(begin+6).equals(out.subarray(begin+875*6)));
assert.deepEqual([...Array(3)].map((_,i)=>before.readUInt16LE(begin+2*i)),[10165,10278,10166]);
console.log(JSON.stringify({views,scope:'Exact archived near packed P/UV/indices and all four bound programs; no runtime change'},null,2));
