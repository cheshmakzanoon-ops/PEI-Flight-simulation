import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_FLIGHT_CONDITIONS, FIXED_STEP, flightConditions, neutral, spawn, step} from '../src/sim/flight.ts';
import {SITES} from '../src/sim/places.ts';

const surface = () => ({height:0, land:true, runway:true});
const airStart = () => spawn({...SITES[0], lon:-63.2, lat:46.5, heading:0, height:1200}, surface);
const near = (a:number,b:number,tolerance=1e-8) => assert.ok(Math.abs(a-b)<=tolerance,`${a} ≠ ${b}`);

test('default mass and wind reproduce the original fixed-step player trajectory', () => {
  const f = airStart(), explicit = {...f};
  const u = {...neutral, roll:.2, yaw:.04};
  for (let i=0; i<2700; i++) {
    step(f,u,surface);
    step(explicit,u,surface,FIXED_STEP,DEFAULT_FLIGHT_CONDITIONS);
  }
  assert.deepEqual(f,explicit);
  // From the actual unmodified cf2d2ab production integrator, identical inputs.
  for (const [value,want] of [
    [f.x,1034.30258659427],[f.y,1218.7795811148535],[f.z,-1236.8612091483046],[f.speed,59.189386125269195],[f.heading,1.3029238525801414],
  ]) near(value,want);
});

test('wind is a signed ground-track offset, not an airspeed or force increment', () => {
  const calm = flightConditions(1406), breeze = flightConditions(1406,2,-3);
  const a = airStart(), b = {...a};
  for (let i=0;i<1800;i++) {
    step(a,neutral,surface,FIXED_STEP,calm);
    step(b,neutral,surface,FIXED_STEP,breeze);
  }
  near(a.x,0); // north heading stays on the meridian in explicit calm
  near(b.x-a.x,40); near(b.z-a.z,60);
  assert.equal(a.speed,b.speed); assert.equal(a.y,b.y); assert.equal(a.gamma,b.gamma);
  const onRunway = spawn(SITES.find(s=>s.runway)!,surface), also = {...onRunway};
  for (let i=0;i<90;i++) {
    step(onRunway,neutral,surface,FIXED_STEP,calm);
    step(also,neutral,surface,FIXED_STEP,breeze);
  }
  assert.equal(onRunway.status,'rolling'); assert.deepEqual(onRunway,also);
});

test('control and mass setups reject nonphysical inputs before stepping', () => {
  for (const m of [0,-5,NaN,Infinity]) assert.throws(()=>flightConditions(m),RangeError);
  assert.throws(()=>flightConditions(1406,Infinity),RangeError);
  assert.throws(()=>flightConditions(1406,0,NaN),RangeError);
  const light=airStart(), heavy={...light};
  step(light,neutral,surface,FIXED_STEP,flightConditions(1100));
  step(heavy,neutral,surface,FIXED_STEP,flightConditions(1450));
  assert.ok(light.gamma>heavy.gamma);
});
