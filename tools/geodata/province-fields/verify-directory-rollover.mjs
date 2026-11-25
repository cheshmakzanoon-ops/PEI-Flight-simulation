/** Optional migration audit: use the parent checkout for its real, retired
 * directory. Never ship its misregistered masks in the current application. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {FieldShardSource} from '../../../src/sim/field-shards.ts';
import {FIELD_DIRECTORY_PIN as current} from '../../../src/render/province-fields.generated.ts';
const [,,oldFile,newFile,out]=process.argv;if(!out)throw Error('usage: verify-directory-rollover OLD_INDEX NEW_INDEX OUT_JSON');
const old=readFileSync(oldFile),next=readFileSync(newFile);
const prior={packedSize:111398,rawSize:118760,packedHash:'2c724896d98aea2e83dcdefe849e4159e4f3455ebd762434fee23da0791ee4d8',rawHash:'061f4917037dc66a73cf3ab078e93e99d7bebf90a93a151fbc13b88107bb6563'};
const rows=[];
for(const [id,wire,pin] of [['retired',old,prior],['current',next,current]]){
 const raw=gunzipSync(wire);assert.equal(createHash('sha256').update(wire).digest('hex'),pin.packedHash);
 assert.equal(createHash('sha256').update(raw).digest('hex'),pin.rawHash);
 for(const [form,bytes] of [['compressed',wire],['hostDecoded',raw]]){
  const read=async()=>new Response(new Uint8Array(bytes));
  const opts=x=>FieldShardSource.open('/world/fields-province/v2/',x,read);
  const boot=await opts(current),oldBoot=await opts(prior);
  assert.equal(!!boot,id==='current');assert.equal(!!oldBoot,id==='retired');
  rows.push({generation:id,form,bytes:bytes.length,acceptedByV2:!!boot,acceptedByRetired:!!oldBoot});
 }
}
writeFileSync(out,JSON.stringify({historicalBase:'6cc58ecd707881269bd79198af7eff9a613e2155',rows},null,2)+'\n');
