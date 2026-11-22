import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BRIDGE_LENGTH, NAV_SPAN, bridgeAt, isConfederationBridge } from '../src/sim/confederation.ts';

test('joined NRN centreline follows roughly 12.9 km of water and approach spans', ()=>{
  assert.ok(BRIDGE_LENGTH>12800&&BRIDGE_LENGTH<13080);
  assert.ok(NAV_SPAN>6000&&NAV_SPAN<7500);
  const start=bridgeAt(0),end=bridgeAt(BRIDGE_LENGTH),middle=bridgeAt(NAV_SPAN);
  assert.ok(start.y>=8&&start.y<=12&&end.y>=8&&end.y<=12);
  assert.ok(middle.y>58&&middle.y<=61);
  assert.ok(isConfederationBridge(middle.x,middle.z));
  assert.ok(!isConfederationBridge(middle.x+200,middle.z));
});
