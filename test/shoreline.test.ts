import test from 'node:test';
import assert from 'node:assert/strict';
import { Cover } from '../src/sim/cover.ts';
import { Terrain } from '../src/sim/terrain.ts';
import { coastSegments } from '../src/sim/shoreline.ts';

const t=new Terrain({width:2,height:2,bounds:[-64,46,-63,47]},new Int16Array([10,-32768,10,-32768]));
const cover=(a:number,b:number,c:number,d:number)=>new Cover(2,2,new Uint8Array([0,a,0,b,0,d,0,c]));
test('shoreline faces join the shader shoreline without a metre-grid offset',()=>{
  const c=cover(137,119,119,137),segments=coastSegments(c,t);
  assert.equal(segments.length,1);
  for(const {ax,az,bx,bz} of segments){
    assert.ok(Math.abs(c.distance(t,ax,az))<1e-8);
    assert.ok(Math.abs(c.distance(t,bx,bz))<1e-8);
    assert.ok(Math.abs(ax-bx)<1e-8);
    assert.notEqual(az,bz);
  }
});
test('ambiguous coast cells emit two edge-connected segments; uniform cells emit none',()=>{
  const c=cover(130,119,130,119);
  const s=coastSegments(c,t);
  assert.equal(s.length,2);
  for(const {ax,az,bx,bz} of s){
    assert.ok(Math.abs(c.distance(t,ax,az))<1e-8);
    assert.ok(Math.abs(c.distance(t,bx,bz))<1e-8);
  }
  assert.deepEqual(coastSegments(cover(115,115,115,115),t),[]);
  assert.deepEqual(coastSegments(cover(145,145,145,145),t),[]);
});
