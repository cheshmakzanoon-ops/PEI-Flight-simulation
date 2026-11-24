import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {ORBY_COVER_SHA,ORBY_ZERO_CELLS,allowOrbyZeroArc} from '../src/sim/orby-shore-closure.ts';
import type {Quad} from '../src/sim/strict-shore-arc.ts';

test('only the reviewed Orby shoreline cells and live cover inputs admit the zero-corner arc',()=>{
 const world=new URL('../public/world/',import.meta.url);
 const meta=JSON.parse(readFileSync(new URL('cover.json',world),'utf8'));
 const data=gunzipSync(readFileSync(new URL('cover.bin.gz',world)));
 const {width:w,height:h,compressedSha256:source}=meta;
 assert.equal(source,ORBY_COVER_SHA);
 const used=new Set<string>();
 for(const [i,j,q] of ORBY_ZERO_CELLS){
  const k=(j*w+i)*2+1,c=[data[k],data[k+2],data[k+2*w+2],data[k+2*w]].map(x=>x-128);
  assert.deepEqual(c,q);
  assert(!used.has(i+','+j));used.add(i+','+j);
  assert(allowOrbyZeroArc(i,j,w,h,source,q));
  assert(!allowOrbyZeroArc(i,j,w,h,undefined,q));
  assert(!allowOrbyZeroArc(i,j,w-1,h,source,q));
  assert(!allowOrbyZeroArc(i,j,w,h+1,source,q));
  assert(!allowOrbyZeroArc(i,j,w,h,source,[q[0]+1,q[1],q[2],q[3]] as Quad));
  assert(!allowOrbyZeroArc(i+1,j,w,h,source,q));
 }
 assert.equal(used.size,5);
});
