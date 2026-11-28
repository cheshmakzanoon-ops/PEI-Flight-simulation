import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cropFootprint,signedSweptCanopy,type Rect} from '../tools/geodata/province-fields/corn-seat/crop-footprint.ts';
const mk=(n:number[],width=3,height=3)=>cropFootprint({width,height,step:4,x0:-32,z0:8,bytes:Uint8Array.from(n)});
test('the inner zero texel rejects a rectangle even when its four corners and its root are otherwise supported',()=>{
 const lo=mk([255,255,255,255,0,255,255,255,255]);
 assert.equal(lo([-30,10,-22,18]),0);
 assert.equal(lo([-30,10,-30,10]),255);
});
test('fractional centre interpolation is identical for positive and negative origins, including exact 64 bound',()=>{
 const lo=mk([0,128,0,128,128,0,0,0,0]);
 assert.equal(lo([-28,10,-28,10]),64);
 assert.equal(lo([-27,11,-26,14]),104);
 assert.equal(lo([-32,8,-32,8]),0);
});
test('source words are immutable and clipped boxes including the illegal end are refused',()=>{
 const bytes=new Uint8Array(9).fill(255);
 const lo=cropFootprint({width:3,height:3,step:4,x0:0,z0:0,bytes});
 bytes.fill(0);
 assert.equal(lo([2,2,10,10]),255);
 for(const b of [[-1,2,2,3],[2,4,5,3],[2,2,13,4],[NaN,2,4,2]] as Rect[])assert.equal(lo(b),0);
 assert.throws(()=>cropFootprint({width:3,height:3,x0:0,z0:0,step:0,bytes}),RangeError);
});
test('independent dense random boxes never undercut checked breakpoints',()=>{
 let seed=52823;
 const next=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/2**32;};
 for(let k=0;k<24;k++){
  const d=Array.from({length:25},()=>Math.floor(next()*256));
  const lo=mk(d,5,5);
  for(let j=0;j<25;j++){
   const x=-32+20*next(),z=8+20*next(),X=x+next()*(-12-x),Z=z+next()*(28-z);
   const min=lo([x,z,X,Z]);
   for(let i=0;i<=20;i++)for(let n=0;n<=20;n++){
    const u=x+i/20*(X-x),v=z+n/20*(Z-z);
    assert.ok(lo([u,v,u,v])+1e-8>=min);
   }
  }
 }
});
test('ground contact at the root is not authority for leaf tips, and padding is fail closed',()=>{
 const lo=mk([0,0,0,0,255,0,0,0,0]);
 assert.equal(lo([-26,14,-26,14]),255);
 assert.equal(signedSweptCanopy(lo,-26,14,-.8,-.8,.8,.8),true);
 assert.equal(signedSweptCanopy(lo,-26,14,-3,-3,3,3),false);
 assert.equal(signedSweptCanopy(lo,-26,14,-.8,-.8,.8,.8,0),false);
});
