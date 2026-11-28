import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {planEastRim} from './roof-rim.ts';
import {proof,shapes} from './stock-owner.mjs';
const models=JSON.parse(readFileSync(new URL('../../../../data/east-point-roof-study/two-roof-hypotheses.json',import.meta.url)));
const raw={position:shapes.position.array,top:shapes.topFlag.array,fit:shapes.townWallFit.array};
for(const [i,q] of models.entries())test('q1333 signed rim '+q.sourceOrdinal+' leaves only the exact original contact open',()=>{
 const N=i===0?[32,34,10]:[26,24,8];
 const p=planEastRim(q,raw);
 assert.deepEqual([p.walls.length,p.roof.length,p.unmatchedBottomSegments],N);
 assert.ok(p.closedTop&&p.unparented);
 assert.equal(p.fitRoofY,q.projectionLocal.peakMOrtho);
 assert.ok(p.originalFlatY>p.fitRoofY);
 assert.equal(proof.vertices,11988);
});
test('unexpected source role and geometry both fail closed',()=>{
 const q=models[0],top=raw.top.slice();top[3018]=0;
 assert.throws(()=>planEastRim(q,{...raw,top}),/not a flat regular plane/);
 const position=raw.position.slice();position[3*3018+1]+=.3;
 assert.throws(()=>planEastRim(q,{...raw,position}),/not a flat regular plane/);
});
