import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DetailTemporaryError,detailHttpTemporary,detailRetryAt} from '../src/render/detail-retry.ts';

test('retryable imagery failures release the slot and allow at most two delayed retries',()=>{
  for(const code of [408,425,429,500,502,503,504])assert.equal(detailHttpTemporary(code),true,code+'');
  for(const code of [200,206,400,401,403,404,410,416])assert.equal(detailHttpTemporary(code),false,code+'');
  const e=new DetailTemporaryError('temporary');
  assert.equal(detailRetryAt(e,1,800),2050);
  assert.equal(detailRetryAt(e,2,6000),9500);
  assert.equal(detailRetryAt(e,3,10000),undefined);
  assert.equal(detailRetryAt(new Error('checksum mismatch'),1,0),undefined);
});
