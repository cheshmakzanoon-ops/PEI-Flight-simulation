import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {georgetownRoofStudy} from '../tools/art/georgetown-q137-roof-study/geometry.ts';

const read = (p: string) => readFileSync(new URL('../tools/art/georgetown-q137-roof-study/' + p,import.meta.url));
const mesh = JSON.parse(read('mesh.json').toString()), evidence = JSON.parse(read('evidence.json').toString());

test('Georgetown fitted cores are separate from the illustrative connector and proof floor', () => {
  const core = georgetownRoofStudy(mesh);
  assert.deepEqual(core.roles,['south','north']);
  assert.deepEqual(core.geometry.groups.map(g => g.count),[96,96]);
  assert.deepEqual(georgetownRoofStudy(mesh,'context').geometry.groups.map(g => g.count),[96,96,54,144]);
  const closed = georgetownRoofStudy(mesh,'closure-proof').geometry;
  assert.deepEqual(closed.groups.map(g => g.count),[96,96,54,144,246]);
  const {position,normal} = closed.attributes;
  assert.equal(position.count,636);
  const key = (i: number) => [position.getX(i),position.getY(i),position.getZ(i)].join(',');
  const directed = new Set<string>(), vertices = new Set<string>();
  for (let i=0; i<position.count; i+=3) {
    assert.ok(Math.abs(Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i))-1)<1e-6);
    if (i<82*3) assert.ok(normal.getY(i)>0);
    if (i>=130*3) assert.ok(normal.getY(i)<0);
    const v = [key(i),key(i+1),key(i+2)];
    for (let j=0;j<3;j++) {
      vertices.add(v[j]);
      const edge = v[j]+'|'+v[(j+1)%3];
      assert.ok(!directed.has(edge));
      directed.add(edge);
    }
  }
  assert.equal(vertices.size,108);
  assert.equal(directed.size,636);
  for (const k of directed) assert.ok(directed.has(k.split('|').reverse().join('|')));
  assert.throws(() => georgetownRoofStudy({...mesh,groups:{...mesh.groups,south:[999]}}),/study indices/);
});

test('Georgetown receipts preserve the failed native gate and dated source custody', () => {
  for (const [p,hash] of Object.entries(evidence.sourceReceiptsSHA256)) {
    assert.equal(createHash('sha256').update(read(p)).digest('hex'),hash);
  }
  assert.equal(evidence.studyState,'held');
  assert.equal(evidence.standardExposure,false);
  assert.deepEqual(evidence.native.change,{strong:678,rgb:678,alpha:4,outside:0,oldSupport:678,newSupport:564});
  assert.equal(evidence.native.restored,true);
  assert.equal(evidence.native.stockChurchIndex - evidence.native.candidate.index,66);
});
