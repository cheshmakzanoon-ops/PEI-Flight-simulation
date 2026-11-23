import test from 'node:test';
import assert from 'node:assert/strict';
import {stallTrial} from '../tools/qa/stall-trial.ts';

test('near-1g power-off entry reaches maximum lift coefficient before the separation warning',()=>{
  const r=stallTrial(), p=r.maximumLiftCoefficient, s=r.separationFlag;
  assert.ok(p.keas>57 && p.keas<60 && p.approachRateKtPerS>.4 && p.approachRateKtPerS<1);
  assert.ok(p.loadFactor>.96 && p.loadFactor<1.02);
  assert.ok(p.angleOfAttackDeg<s.angleOfAttackDeg && p.keas>s.keas);
  assert.ok(s.loadFactor<p.loadFactor-.15 && s.liftCoefficient < p.liftCoefficient*.85);
  assert.ok(r.elapsedBetweenEventsS>.3 && r.elapsedBetweenEventsS<2);
  assert.ok(r.recovery.minimumKeas<=s.keas);
  // A clear flag alone is not a recovery: require five sustained seconds at target glide speed/sink.
  assert.ok(r.recovery.secondsToSettledGlide>r.recovery.firstClearS+5);
  assert.equal(r.recovery.settledForS,5);
  assert.ok(r.recovery.heightLostToSettledGlideM>0 && r.recovery.heightLostToSettledGlideM<200);
  assert.ok(Math.abs(r.recovery.finalKeas-78)<.5);
});

test('power-off stall measurements do not depend on one fixed-step boundary',()=>{
  const a=stallTrial(1/60), b=stallTrial(1/120);
  assert.ok(Math.abs(a.maximumLiftCoefficient.keas-b.maximumLiftCoefficient.keas)<.1);
  assert.ok(Math.abs(a.separationFlag.keas-b.separationFlag.keas)<.1);
  assert.ok(Math.abs(a.recovery.heightLostToSettledGlideM-b.recovery.heightLostToSettledGlideM)<2);
});
