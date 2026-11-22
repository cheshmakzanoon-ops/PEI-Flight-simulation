import test from 'node:test';
import assert from 'node:assert/strict';
import { DIALS, dialAngle } from '../src/render/instruments.ts';

test('cockpit needles share scale and units with labeled dial ticks',()=>{
  const [speed,altitude,power,vertical]=DIALS;
  assert.equal(dialAngle(speed,90),0);
  assert.equal(dialAngle(speed,-4),dialAngle(speed,0));
  assert.equal(dialAngle(power,50),0);
  assert.equal(dialAngle(vertical,0),0);
  assert.ok(dialAngle(vertical,-1000)<0 && dialAngle(vertical,1000)>0);
  assert.equal(dialAngle(altitude,1250),Math.PI/2);
  assert.equal(dialAngle(altitude,-250),Math.PI*1.5);
});
