import test from 'node:test';
import assert from 'node:assert/strict';
import { aerodynamicPolar, airDensity, equivalentAirspeed, POSITIVE_CRITICAL_ALPHA } from '../src/sim/aerodynamics.ts';
import { neutral, spawn, step } from '../src/sim/flight.ts';

test('ISA density and equivalent airspeed are consistent with dynamic pressure', () => {
  assert.ok(Math.abs(airDensity(0) - 1.225) < .001);
  assert.ok(Math.abs(airDensity(3000) - .909) < .002);
  assert.ok(Math.abs(airDensity(11000) - .364) < .002);
  assert.ok(equivalentAirspeed(52, 2500) < equivalentAirspeed(52, 0));
  assert.ok(Math.abs(airDensity(0) * equivalentAirspeed(52, 2500)**2 - airDensity(2500) * 52**2) < 1e-8);
});

test('polar keeps a continuous stall break, loses lift and increases drag', () => {
  assert.ok(aerodynamicPolar(.26).cl > aerodynamicPolar(.35).cl);
  assert.ok(aerodynamicPolar(.35).cd > aerodynamicPolar(.26).cd);
  assert.equal(aerodynamicPolar(POSITIVE_CRITICAL_ALPHA + .001).separated, true);
  assert.equal(aerodynamicPolar(.09).separated, false);
  for (let angle = -Math.PI/2; angle < Math.PI/2; angle += .001) {
    const a = aerodynamicPolar(angle);
    const b = aerodynamicPolar(angle+.001);
    assert.ok(a.cd > 0 && Number.isFinite(a.cl));
    assert.ok(Math.abs(a.cl-b.cl)<.04 && Math.abs(a.cd-b.cd)<.02);
  }
});

test('an accelerated stall can occur above a low-speed warning threshold and unload', () => {
  const surface = () => ({height:0,land:true,runway:false});
  const f = spawn({id:'check',name:'Check',region:'',lat:46.5,lon:-63,height:2000,heading:0,note:''},surface);
  f.pitch = .37; f.gamma = 0; f.speed = 44;
  step(f, {...neutral,pitch:1}, surface);
  assert.equal(f.stalled, true);
  assert.ok(f.speed > 40);
  for (let i=0; i<180 && f.stalled; i++) step(f,{...neutral,pitch:-.5},surface);
  assert.equal(f.stalled, false);
  assert.equal(f.status, 'flying');
});
