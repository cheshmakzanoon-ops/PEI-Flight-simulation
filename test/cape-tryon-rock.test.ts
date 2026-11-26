import {test} from 'node:test';
import assert from 'node:assert/strict';
import {markTryonRockShoreUV,tryonRockMatches} from '../src/render/cape-tryon-rock.ts';
import {ORBY_COVER_SHA} from '../src/sim/orby-shore-closure.ts';

test('Cape rock is fail-closed to the current authenticated coast and terrain',()=>{
 const sha='661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d';
 const bounds=[-64.47,45.94,-61.93,47.1];
 const cover={sourceSha:ORBY_COVER_SHA,width:4096,height:2720};
 assert(tryonRockMatches(sha,bounds,cover));
 assert(!tryonRockMatches(undefined,bounds,cover));
 assert(!tryonRockMatches('wrong',bounds,cover));
 assert(!tryonRockMatches(sha,[-64.47,45.95,-61.93,47.1],cover));
 assert(!tryonRockMatches(sha,bounds,{...cover,height:2719}));
 assert(!tryonRockMatches(sha,bounds,{...cover,sourceSha:undefined}));
});

test('Cape coast marker marks only admitted complete source-triangle spans',()=>{
 const uv=new Float32Array(42);
 for(let i=0;i<uv.length;i++)uv[i]=i%2===0?.125:.25;
 assert.equal(markTryonRockShoreUV(uv,[[9,18],[36,54]]),uv);
 for(let i=0;i<uv.length/2;i++){
  assert.equal(uv[i*2],(i>=3&&i<6)||(i>=12&&i<18)?1:.125);
  assert.equal(uv[i*2+1],.25);
 }
});
