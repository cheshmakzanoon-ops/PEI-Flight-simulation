import {strict as a} from 'node:assert';
import test from 'node:test';
import {auditOpaqueFaceWitness as audit} from './opaque-face-witness.mjs';

const frame = (...v) => Uint8Array.from(v.flatMap(x => Array.isArray(x) ? x : [x, x, x, 255]));
const white = frame(64, 255, 187, 64), black = frame(64, 0, 92, 64);
const stock = frame(64, 64, 64, 64);
const sample = (candidate, restored = stock) => ({width: 2, height: 2, stock, candidate, restored,
  roles: [{id: 'SE', white, black, mayChange: true},
    {id: 'NE', white: frame(64, 64, 222, 255), black: frame(64, 64, 35, 0), mayChange: false}]});

test('a single exact face and a shared partial-coverage pixel are in bounds', () => {
  const r = audit(sample(frame(64, 91, 70, 64)));
  a.deepEqual(r, {changed: 2, strong: 1, outside: 0, protectedOnly: 0, sharedChanged: 1, alpha: 0, rollback: 0, roles: [
    {id:'SE', visible:2, changed:2, exclusiveChanged:1, alpha:0, mayChange:true, outsideHull:null},
    {id:'NE', visible:2, changed:1, exclusiveChanged:0, alpha:0, mayChange:false, outsideHull:null},
  ]});
});

test('separates unattributed or protected-only RGB, alpha drift, and rollback', () => {
  const r = audit(sample(frame(65, [64,64,64,254], 64, 72), frame(64, 64, [64,64,64,254], 64)));
  a.deepEqual([r.changed, r.strong, r.outside, r.protectedOnly, r.alpha, r.rollback], [2,1,2,1,1,1]);
});

test('a corrupt witness alpha cannot certify the frame', () => {
  const input = sample(stock);
  input.roles[0].white = frame([64,64,64,254], 255, 187, 64);
  a.equal(audit(input).roles[0].alpha, 1);
});

test('a reciprocal negative can prove a visible protected face without a positive', () => {
  const input = sample(stock);
  input.roles[0].white = input.roles[0].black;
  const r = audit(input);
  a.deepEqual([r.changed, r.roles[0].visible, r.roles[1].visible], [0,0,2]);
});

test('malformed dimensions, length, roles, and accidental default policy fail closed', () => {
  assertInvalid({...sample(stock), width: Infinity}, RangeError);
  assertInvalid({...sample(stock), positiveDelta: 256}, RangeError);
  assertInvalid(sample(new Uint8Array(15)), TypeError);
  const input = sample(stock);
  assertInvalid({...input, roles:[...input.roles, input.roles[0]]}, TypeError);
  assertInvalid({...input, roles:[{...input.roles[0], mayChange: undefined}]}, TypeError);
  assertInvalid({...input, roles:[]}, TypeError);
});
function assertInvalid(input, type){ a.throws(() => audit(input), type); }

test('independent projected hull identifies witness drift and is not silently assumed', () => {
  const input = sample(frame(64, 91, 70, 64));
  input.roles[0].projectedHull = Uint8Array.of(0, 1, 0, 0);
  const r = audit(input);
  a.equal(r.roles[0].outsideHull, 1);
  a.equal(r.roles[1].outsideHull, null);
  assertInvalid({...input, roles: [{...input.roles[0], projectedHull: Uint8Array.of(1)}]}, TypeError);
});
