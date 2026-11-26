import test from 'node:test';
import assert from 'node:assert/strict';
import {certifyWetScope as certify,certifyDryScope} from './bilinear-shore-scope.mjs';

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

const dryArgs = (stock,candidate,authority=a()) =>
  ({stock:f(stock),candidate:f(candidate),authority,bounds:[0,0,2,2],
    stockLandThreshold:128,candidateLandThreshold:128});

test('a restored bank includes equality, while original equality is already land',()=>{
  const shared=dryArgs([128,128,128,128],[128,128,128,128],a([1,0,1,0]));
  assert.deepEqual(certifyDryScope(shared),{
    rectangles:16,possibleDry:16,unauthorizedDry:8,unresolved:0,
    areaUpperBound:0,minOldOnUnauthorized:128,
  });
  assert.deepEqual(certifyDryScope({...shared,stockMargin:.01}),{
    rectangles:16,possibleDry:16,unauthorizedDry:8,unresolved:8,
    areaUpperBound:2,minOldOnUnauthorized:128,
  });
});
test('stock water and proposed land separated by independent authorization have zero possible exterior restore',()=>{
  const saved=dryArgs([127,127,127,127],[130,130,130,130],a([1,1,1,1]));
  const r=certifyDryScope(saved);
  assert.equal(r.possibleDry,16);assert.equal(r.unauthorizedDry,0);
  assert.equal(r.unresolved,0);assert.equal(r.minOldOnUnauthorized,null);
  const exposed=certifyDryScope({...saved,authority:a()});
  assert.equal(exposed.unresolved,16);assert.equal(exposed.areaUpperBound,4);
});
test('a stock wet trough at a different grid spacing is considered between candidate centres',()=>{
  const probe=dryArgs([129,129,129,129],[130,130,130,130]);
  probe.stock=f([130,120,130,130,120,130],{spacing:[.5,1],width:3});
  const r=certifyDryScope(probe);
  assert.ok(r.unresolved>0&&r.unresolved<r.rectangles);
  assert.equal(r.minOldOnUnauthorized,120);
  const shy=dryArgs([127,127,127,127],[127.875,127.875,127.875,127.875]);
  assert.equal(certifyDryScope(shy).possibleDry,0);
  assert.equal(certifyDryScope({...shy,candidateMargin:.125}).unresolved,16);
});

test('the exact Brudenell stock Cover cell cannot be assigned a positive land mask without closure',()=>{
  const x=50291.30527756,z=35157.14481990,x1=50338.90708094,z1=35204.55175267;
  // This cell is between four texel centres, not between raster edges.
  const spacing=[x1-x,z1-z];
  const stock=f([12,-4,-4,-20],{origin:[x-spacing[0]/2,z-spacing[1]/2],spacing});
  const candidate=f([1],{origin:[x,z],spacing,width:1,height:1});
  const authority=f([0],{origin:[x,z],spacing,width:1,height:1});
  const q=certifyDryScope({stock,candidate,authority,bounds:[x,z,x1,z1],
    stockLandThreshold:0,candidateLandThreshold:0});
  assert.ok(q.rectangles>=1&&q.unresolved>=1);
  assert.ok(Math.abs(q.minOldOnUnauthorized+20)<1e-7);
  assert.ok(Math.abs(q.areaUpperBound-spacing[0]*spacing[1])<1e-7);
});
