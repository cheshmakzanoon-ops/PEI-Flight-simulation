import test from 'node:test';
import assert from 'node:assert/strict';
import {glideSweep,glideTrial} from '../tools/qa/glide-trial.ts';

test('independent clean power-off flights bracket the best range at the reference mass',()=>{
  const {trials,best}=glideSweep();
  assert.equal(best.targetKeas,78); // discrete 2-kt sweep of the fictional airframe, not a POH speed
  for(const t of trials) {
    assert.ok(Math.abs(t.averageKeas-t.targetKeas)<.05);
    assert.ok(t.easSpreadKt<.1 && t.sinkSpreadMps<.1,'unsettled measurement window');
    assert.ok(t.heightLostM>0 && t.endHeightM>0 && t.horizontalM>0);
    assert.equal(t.trackTrueDeg,0);
    assert.ok(t.averageKtas>t.averageKeas && t.averageKtas>t.meanGroundSpeedKt);
  }
  assert.ok(best.rangeRatio>12.2 && best.rangeRatio<12.6);
  assert.ok(best.deltaKineticHeightM<0 && Math.abs(best.deltaKineticHeightM)<.02*best.heightLostM);
  assert.ok(best.energyRangeRatio>12.2 && best.energyRangeRatio<12.4);
  assert.ok(best.rangeRatio>trials[0].rangeRatio+.5 && best.rangeRatio>trials.at(-1)!.rangeRatio+1);
});

test('glide range and kinetic-energy accounting converge at independent 60 and 120 Hz steps',()=>{
  const at60=glideTrial(78,1/60), at120=glideTrial(78,1/120);
  assert.ok(Math.abs(at60.rangeRatio-at120.rangeRatio)<.02);
  assert.ok(Math.abs(at60.deltaKineticHeightM-at120.deltaKineticHeightM)<.01);
});
