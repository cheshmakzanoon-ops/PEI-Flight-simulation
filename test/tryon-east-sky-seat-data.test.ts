import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { CAPE_TRYON_SKY_SEAT, CAPE_TRYON_FULL_SKY_SEAT } from '../src/render/cape-tryon-sky-seat.ts';
import { EAST_SKY_SEAT_POSITIONS } from '../src/render/cape-tryon-east-sky-seat-data.ts';

test('two signed East packets share one local draw without moving the verified North geometry',()=>{
 assert.equal(EAST_SKY_SEAT_POSITIONS.length,468);
 assert.equal(CAPE_TRYON_FULL_SKY_SEAT.length,495);
 assert.deepEqual(CAPE_TRYON_FULL_SKY_SEAT.slice(0,27),Array.from(CAPE_TRYON_SKY_SEAT));
 const out=Buffer.alloc(468*4);
 EAST_SKY_SEAT_POSITIONS.forEach((v,i)=>{assert.equal(Math.fround(v),v);out.writeFloatLE(v,i*4);});
 assert.equal(createHash('sha256').update(out).digest('hex'),
  'f4502fde11049f350ef1339c31997df595b0f55e5ad1ab48134fbdbedc29c175');
 const b=EAST_SKY_SEAT_POSITIONS.slice(48*9);
 assert.equal(b.filter((_,i)=>i%3===0).every(x=>x===-23.80078125),true);
});
