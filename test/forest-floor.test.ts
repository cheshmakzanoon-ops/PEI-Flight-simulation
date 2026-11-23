import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {ForestFloor} from '../src/render/forest-floor.ts';
import {FOREST_FLOOR_ASSETS} from '../src/render/forest-floor.generated.ts';

test('woodland ground art uses two pinned lossless inputs and has no unconditional loader',()=>{
 const receipt=JSON.parse(readFileSync('public/art/forest-floor/sources.json','utf8'));
 assert.equal(FOREST_FLOOR_ASSETS.length,2);
 for(const [i,a] of FOREST_FLOOR_ASSETS.entries()){
  const b=readFileSync('public/art/forest-floor/'+a.file);
  assert.equal(b.length,a.bytes);
  assert.equal(b.subarray(0,4).toString(),'RIFF');
  assert.equal(b.subarray(8,12).toString(),'WEBP');
  assert.notEqual(b.indexOf('VP8L'),-1);
  assert.equal(createHash('sha256').update(b).digest('hex'),a.sha256);
  assert.equal(receipt.assets[i].licence,'https://creativecommons.org/publicdomain/zero/1.0/');
  assert.equal(receipt.assets[i].widthMetres,2);
 }
 const material=new ForestFloor('/');
 material.update(false);assert.equal(material.state,'idle');assert.equal(material.uniforms.forestFloorMix.value,0);
 assert.equal(material.uniforms.forestFloorA.value,null);assert.equal(material.uniforms.forestFloorB.value,null);
});
