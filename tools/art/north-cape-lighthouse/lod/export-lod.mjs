import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {makeNorthCapeDetachedStudy} from '../north-cape-lens-draft.ts';
const sha=b=>createHash('sha256').update(b).digest('hex');
const result={};
for(const [key,near,count] of [['near',true,3924],['middle',false,560]]){
 const m=makeNorthCapeDetachedStudy(near); assert.equal(m.triangles,count);
 result[key]=Object.fromEntries([['opaque',m.exterior],['glass',m.panes]].map(([a,b])=>[a,Object.fromEntries(
  ['position','normal','color'].map(t=>{
   const v=b.geometry.attributes[t].array,x=Buffer.from(v.buffer,v.byteOffset,v.byteLength);
   return [t,{words:x.toString('base64'),sha256:sha(x)}];
  })
 )]));
 m.dispose();
}
writeFileSync(process.argv[2],JSON.stringify(result)+'\n',{flag:'wx'});
