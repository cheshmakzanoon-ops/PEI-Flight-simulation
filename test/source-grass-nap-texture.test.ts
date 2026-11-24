import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {NoColorSpace,RepeatWrapping,LinearMipmapLinearFilter} from 'three';
import {makeShortGrassNap,shortGrassHeightFade,sourceGrassNapGLSL} from '../src/render/source-grass-nap.ts';
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
test('altitude holds all flight frames and vanishing clearance at near onset',()=>{
 for(const h of [NaN,Infinity,-Infinity,-1,.611,.62,6.85,6.9,13,75.9,800])assert.equal(shortGrassHeightFade(h),0);
 for(const h of [1.25,1.81,2.5,3.52])assert.equal(shortGrassHeightFade(h),1);
 let old=1;
 for(let i=0;i<=330;i++){
  const y=shortGrassHeightFade(3.52+i/100);
  assert.ok(y<=old+1e-12&&y>=0);old=y;
 }
});
test('original height/albedo-look texture is deterministic, mip-filtered and bounded',()=>{
 const h=performance.now(),a=makeShortGrassNap(),t=performance.now()-h,b=makeShortGrassNap();
 const A=a.image.data as Uint8Array,B=b.image.data as Uint8Array;
 assert.equal(a.image.width,256);assert.equal(a.image.height,256);
 assert.strictEqual(A.byteLength,256*256*4);
 assert.ok(A.every((x,i)=>B[i]===x));
 assert.equal(a.colorSpace,NoColorSpace);assert.equal(a.wrapS,RepeatWrapping);assert.equal(a.wrapT,RepeatWrapping);
 assert.equal(a.minFilter,LinearMipmapLinearFilter);assert.equal(a.generateMipmaps,true);
 const by=Array.from({length:4},()=>[255,0,0]);
 for(let i=0;i<A.length;i++){const x=by[i%4];x[0]=Math.min(x[0],A[i]);x[1]=Math.max(x[1],A[i]);x[2]+=A[i];}
 assert.ok(by[0][1]>200&&by[0][0]>0&&by[0][0]<55);
 assert.ok(by[3][1]<251&&by[3][1]>158);
 assert.ok(sourceGrassNapGLSL.includes('vec2 ex,vec2 ez'));
 assert.ok(!sourceGrassNapGLSL.includes('dFdx')&&!sourceGrassNapGLSL.includes('dFdy'));
 console.log(JSON.stringify({sha256:sha(A),bytes:A.length,buildMsCloudNodeOnly:t,byteChannelMinMaxSum:by}));
 a.dispose();b.dispose();
});
