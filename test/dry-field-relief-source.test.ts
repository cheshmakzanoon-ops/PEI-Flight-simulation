import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const file=(name:string)=>readFileSync(new URL('../tools/qa/dry-field-relief/'+name,import.meta.url));
test('detached field study retains its exact signed crop payload and empty rim',()=>{
 const bytes=file('dated-grade-cm.bin');
 assert.equal(bytes.length,1683);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'70ebceb7390a284eb770c7bb225c433fbf34d8a568d704e31a76d5d531e53067');
 let moved=0,high=0;
 for(let y=0;y<17;y++)for(let x=0;x<33;x++){
  const i=y*33+x,z=bytes.readInt16LE(2*i),w=bytes[1122+i];
  assert(z<=0&&z>=-149);
  assert.equal(!w,!z);
  if(y===0||x===0||y===16||x===32)assert(z===0&&w===0);
  moved+=Number(z!==0);high+=Number(w>=240);
 }
 assert.equal(moved,347);assert.equal(high,87);
});
