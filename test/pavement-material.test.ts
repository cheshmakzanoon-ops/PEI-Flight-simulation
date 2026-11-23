import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {PAVEMENT_ASSETS} from '../src/render/pavement.generated.ts';
import {RoadPavement,PAVE_PRELOAD_AGL} from '../src/render/road-pavement.ts';

test('pavement inputs pin the two lossless RGBA files and their real-world tile scales',()=>{
 const source=JSON.parse(readFileSync('public/art/pavement/sources.json','utf8'));
 assert.equal(PAVEMENT_ASSETS.length,2);
 assert.deepEqual(PAVEMENT_ASSETS.map(x=>x.width),[2,2.5]);
 for(const [i,q] of PAVEMENT_ASSETS.entries()){
  const file=readFileSync('public/art/pavement/'+q.file);
  assert.equal(createHash('sha256').update(file).digest('hex'),q.sha256);
  assert.equal(file.length,q.bytes);
  assert.equal(file.subarray(0,4).toString(),'RIFF');
  assert.equal(file.subarray(8,12).toString(),'WEBP');
  assert.notEqual(file.indexOf('VP8L'),-1);
  assert.equal(source.assets[i].sha256,q.sha256);
  assert.equal(source.assets[i].raw.length,3);
  assert.equal(source.assets[i].license,'https://creativecommons.org/publicdomain/zero/1.0/');
 }
 assert.equal(PAVEMENT_ASSETS.reduce((n,x)=>n+x.bytes,0),1197156);
});

test('high approach and environments without bitmap decoding do not initiate pavement I/O',()=>{
 const p=new RoadPavement('/');
 p.update(PAVE_PRELOAD_AGL+.01);assert.equal(p.state,'idle');
 p.update(PAVE_PRELOAD_AGL);assert.equal(p.state,'idle');
 if(!globalThis.createImageBitmap){p.update(0);assert.equal(p.state,'idle');}
 assert.equal(p.uniforms.roadPaveBlend.value,0);
});
