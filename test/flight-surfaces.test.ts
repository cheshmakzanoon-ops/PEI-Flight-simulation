import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deflectionAt,deflectionTarget} from '../src/render/flight-surfaces.ts';
import {RAD} from '../src/sim/geo.ts';

test('visual controls animate opposite ailerons and linked elevators with return to neutral',()=>{
  const pullRight={pitch:1,roll:1};
  assert.deepEqual(deflectionTarget(pullRight,-1),{aileron:16*RAD,elevator:-19*RAD});
  assert.deepEqual(deflectionTarget(pullRight,1),{aileron:-21*RAD,elevator:-19*RAD});
  assert.equal(deflectionTarget({pitch:5,roll:-9},1).aileron,16*RAD);
  assert.equal(deflectionAt(0,2,0),0);
  const next=deflectionAt(0,.25,.07);assert.ok(next>0&&next<.25);
  assert.ok(deflectionAt(next,0,.07)<next);
});
