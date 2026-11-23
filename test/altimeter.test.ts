import {test} from 'node:test';
import assert from 'node:assert/strict';
import {altimeterAngles} from '../src/render/instruments.ts';

test('three cyclic altitude hands remain distinct at thousand and ten-thousand crossings',()=>{
  const turns=(feet:number)=>altimeterAngles(feet).map(a=>Math.round(-a/(2*Math.PI)*1e6)/1e6);
  assert.deepEqual(turns(999),[.999,.0999,.00999]);
  assert.deepEqual(turns(1000),[0,.1,.01]);
  assert.deepEqual(turns(12450),[.45,.245,.1245]);
  assert.deepEqual(turns(99999),[.999,.9999,.99999]);
  assert.deepEqual(turns(100000),[0,0,0]);
  assert.deepEqual(turns(-20),[.98,.998,.9998]);
});
