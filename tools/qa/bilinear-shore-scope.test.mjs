import test from 'node:test';
import assert from 'node:assert/strict';
import {certifyWetScope as certify} from './bilinear-shore-scope.mjs';

const f = (values, {origin=[0,0],spacing=[1,1],width=2,height=2}={}) =>
  ({origin,spacing,width,height,values:Float64Array.from(values)});
const a = (square=[0,0,0,0]) => f(square);
const args = (stock,candidate=[255,255,255,255],authority=a()) =>
  ({stock:f(stock),candidate:f(candidate),authority,bounds:[0,0,2,2],dryThreshold:128,wetThreshold:127.5});

test('candidate may overlap unauthorized cells only where old cover is strictly wet',()=>{
  const r=certify(args([120,120,120,120]));
  assert.equal(r.rectangles,16);assert.equal(r.unauthorizedWet,16);
  assert.equal(r.unresolved,0);assert.equal(r.areaUpperBound,0);
  assert.equal(r.maxOldOnUnauthorized,120);
});
test('report conservative area, not exact cell changes or a guaranteed intersection',()=>{
  const r=certify(args([128,128,128,128],[255,255,255,255],a([1,0,1,0])));
  assert.equal(r.unauthorizedWet,8);assert.equal(r.unresolved,8);assert.equal(r.areaUpperBound,2);
});
test('exact wet threshold is not admitted, and explicitly supplied slack is conservative',()=>{
  const x=args([127,127,127,127],[127.5,127.5,127.5,127.5]);
  assert.equal(certify(x).possibleWet,0);
  assert.equal(certify({...x,candidateMargin:.1,stockMargin:1}).unresolved,16);
  assert.equal(certify({...x,candidateMargin:.1,stockMargin:.9}).unresolved,0);
});
test('distinct centre grids reveal an interior old dry peak missed at candidate corners',()=>{
  const x=args([100,100,100,100]);
  x.stock=f([100,131,100,100,131,100],{spacing:[.5,1],width:3});
  const r=certify(x);
  assert(r.unresolved>0);assert.equal(r.maxOldOnUnauthorized,131);
  assert(r.areaUpperBound<4);
});
test('four closed sub-rectangles around a coincident edge retain correctly bounded scope',()=>{
  const x=args([127,127,127,127],[0,255,0,255],a([0,1,0,1]));
  const r=certify(x);
  assert.equal(r.unresolved,0);
  assert.equal(r.maxOldOnUnauthorized,null);
  assert(certify({...x,stockMargin:1,candidateMargin:.01}).unresolved>0);
});
test('invalid grids, binary values, margins and unreasonable partitions fail closed',()=>{
  const x=args([129,129,129,129]);
  assert.throws(()=>certify({...x,authority:a([.5,0,1,0])}),TypeError);
  assert.throws(()=>certify({...x,stock:f([NaN,0,0,0])}),TypeError);
  assert.throws(()=>certify({...x,wetThreshold:Infinity}),RangeError);
  assert.throws(()=>certify({...x,stockMargin:-.5}),RangeError);
  assert.throws(()=>certify({...x,maxRectangles:2}),RangeError);
});
