import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BRIDGE_LENGTH, NAV_SPAN, bridgeAt, isConfederationBridge, BRIDGE_SUPPORTS, bridgeGirderDepth } from '../src/sim/confederation.ts';

test('joined NRN centreline follows roughly 12.9 km of water and approach spans', ()=>{
  assert.ok(BRIDGE_LENGTH>12800&&BRIDGE_LENGTH<13080);
  assert.ok(NAV_SPAN>6000&&NAV_SPAN<7500);
  const start=bridgeAt(0),end=bridgeAt(BRIDGE_LENGTH),middle=bridgeAt(NAV_SPAN);
  assert.ok(start.y>=8&&start.y<=12&&end.y>=8&&end.y<=12);
  assert.ok(middle.y>58&&middle.y<=61);
  assert.ok(isConfederationBridge(middle.x,middle.z));
  assert.ok(!isConfederationBridge(middle.x+200,middle.z));
});

test('main supports align with published controls at both approaches and the channel',()=>{
  // Independent projected station fixtures from the TP 13681 control table.
  const stations:Record<string,number>={P44:1478.34,P43:1727.58,P42:1977.10,P22:6963.34,P21:7212.75,P5:11204.91,P4:11454.67,P3:11704.19};
  for(const [id,s] of Object.entries(stations)){
    const support=BRIDGE_SUPPORTS.find(p=>p.id===id)!;
    assert.equal(support.section,'main',id);
    assert.ok(Math.abs(support.station-s)<.02,id);
    assert.equal(bridgeGirderDepth(support.station),14,id);
  }
  const p=(id:string)=>BRIDGE_SUPPORTS.find(p=>p.id===id)!.station;
  assert.ok(Math.abs((p('P21')+p('P22'))/2-NAV_SPAN)<.01);
  assert.equal(bridgeGirderDepth(NAV_SPAN),4.5);
  assert.equal(BRIDGE_SUPPORTS.length,65);
  assert.equal(new Set(BRIDGE_SUPPORTS.map(p=>p.id)).size,65);
  assert.equal(BRIDGE_SUPPORTS.filter(p=>p.section==='main').length,44);
  assert.deepEqual(BRIDGE_SUPPORTS.filter(p=>p.section==='approach').map(p=>p.id[0]),
    [...Array(14).fill('W'),...Array(7).fill('E')]);
  for(let i=1;i<BRIDGE_SUPPORTS.length;i++)
    assert.ok(BRIDGE_SUPPORTS[i].station>BRIDGE_SUPPORTS[i-1].station);
  assert.ok(BRIDGE_SUPPORTS[0].station>0&&BRIDGE_SUPPORTS.at(-1)!.station<BRIDGE_LENGTH);
  for(const id of ['W14','E7']){
    assert.equal(bridgeGirderDepth(p(id)),3.3);
    assert.ok(Math.abs(bridgeGirderDepth(p(id)+.01)-bridgeGirderDepth(p(id)-.01))<.00001);
  }
});

test('all visible supports have positive shaft length in the approximate deck profile',()=>{
  for(const {station,id,section} of BRIDGE_SUPPORTS){
    const y=bridgeAt(station).y;
    assert.ok(y-bridgeGirderDepth(station)>=(section==='main'?3.6:2.1),id);
  }
});
