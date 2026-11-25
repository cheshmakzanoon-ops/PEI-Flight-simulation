import assert from 'node:assert/strict';
import {test} from 'node:test';
import {MarshRootField} from '../src/render/marsh-root-field.ts';

const width=26,height=24,data=new Uint8Array(width*height);
let cells=0;
for(let i=1;i<width-1;i++)for(let j=1;j<height-1;j++){
 if((i===13&&j<17)||(j===15&&i<18))continue;
 data[j*width+i]=j>12?255:100;cells++;
}
const spec={origin:[-1720,435] as const,width,height,step:5,cells};

test('marsh vegetation query never moves a proved root or expands its exact swept extent',()=>{
 const f=new MarshRootField(spec,data);const x=-1654,z=499;
 const roots=f.distributed(x,z);
 assert(roots.length>160&&roots.length<=360);
 assert.equal(new Set(roots.map(r=>r.id)).size,roots.length);
 assert.deepEqual(f.distributed(x,z),roots);
 assert(roots.some(r=>Math.hypot(r.x-x,r.z-z)>29));
 for(const r of roots){
  assert(data[r.cellJ*width+r.cellI]>=85);
  assert(f.permits(r.x,r.z,r.permittedRadius,r.id));
  assert(!f.permits(r.x,r.z,r.permittedRadius+.000001,r.id));
  assert(!f.permits(r.x+.000001,r.z,r.permittedRadius*.4,r.id));
  assert(!f.permits(r.x,r.z,r.permittedRadius,Number.MAX_SAFE_INTEGER));
 }
 assert.deepEqual(f.distributed(x,Infinity),[]);
 const seal=new Uint8Array(data);seal[0]=1;
 assert.throws(()=>new MarshRootField(spec,seal),/perimeter/);
});

test('marsh foliage subqueries cannot exceed the explicit local distance or requested cap',()=>{
 const f=new MarshRootField(spec,data),x=-1665,z=490;
 const near=f.query(x,z,16,47);
 assert(near.length>0&&near.length<=47);
 assert(near.every(r=>Math.hypot(r.x-x,r.z-z)<=16+1e-7));
 assert.deepEqual(f.query(x,z,109),[]);
 assert.deepEqual(f.query(x,z,24,361),[]);
 assert.deepEqual(f.query(x,z,24,0),[]);
 assert.deepEqual(f.query(x,NaN,15),[]);
});
