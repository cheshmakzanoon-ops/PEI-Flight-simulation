import assert from 'node:assert/strict';
import test from 'node:test';
import {sceneryFrameInvariant as score} from './scenery-frame-invariant.mjs';

const frame=(...edits)=>{
 const data=Uint8Array.from({length:48},(_,i)=>i%4===3?255:120);
 for(const [x,y,rgba] of edits)data.set(rgba,(y*4+x)*4);
 return {width:4,height:3,data};
};
const box=[1,0,3,3],dark=[101,102,103,255],pale=[193,185,177,232];
const stock=frame([0,0,pale]);

test('accepts localized RGB changes with exact restore even if prior alpha is not opaque',()=>{
 const out=score({stock,alternate:frame([0,0,pale],[2,1,dark]),restored:stock,box});
 assert.equal(out.pass,true);assert.equal(out.strong,1);assert.equal(out.originalNonopaque,1);
 assert.equal(out.alpha,0);assert.equal(out.stockRestoreExact,true);
});
test('classifies revealed native scene separately but never waives the alpha gate',()=>{
 const uncovered=frame([0,0,pale],[1,2,pale]);
 const out=score({stock,alternate:uncovered,restored:stock,uncovered,box});
 assert.equal(out.pass,false);assert.equal(out.alpha,1);assert.equal(out.outsideAlpha,0);
 assert.deepEqual(out.uncoveredWitness,{exactRgbaAtChangedAlpha:1,unmatched:0});
 assert.deepEqual(out.alphaSamples,[{x:1,y:2,stock:255,alternate:232,uncovered:232,sameUncoveredRgba:true}]);
});
test('same uncovered alpha alone is not a matching native pixel',()=>{
 const out=score({stock,alternate:frame([0,0,pale],[2,1,pale]),restored:stock,
  uncovered:frame([0,0,pale],[2,1,[0,0,0,232]]),box});
 assert.equal(out.pass,false);
 assert.deepEqual(out.uncoveredWitness,{exactRgbaAtChangedAlpha:0,unmatched:1});
});
test('refuses external differences and incomplete rollback independently',()=>{
 const out=score({stock,alternate:frame([0,0,pale],[3,1,dark]),restored:frame([0,0,pale],[1,1,dark]),box});
 assert.equal(out.outsideRgb,1);assert.equal(out.undoDelta,1);assert.equal(out.pass,false);
 const out2=score({stock,alternate:frame([0,0,pale],[2,1,dark]),restored:frame([0,0,pale],[1,1,dark]),box});
 assert.equal(out2.outsideRgb,0);assert.equal(out2.undoDelta,1);assert.equal(out2.pass,false);
});
test('rejects out-of-frame boxes, undersized buffers and visual no-ops',()=>{
 assert.throws(()=>score({stock,alternate:stock,restored:stock,box:[0,0,5,3]}),/half-open/);
 assert.throws(()=>score({stock,alternate:{...stock,data:new Uint8Array(1)},restored:stock,box}),/native RGBA/);
 assert.equal(score({stock,alternate:stock,restored:stock,box}).pass,false);
});
