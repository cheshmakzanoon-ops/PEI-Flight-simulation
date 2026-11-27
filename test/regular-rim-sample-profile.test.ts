import assert from 'node:assert/strict';
import {test} from 'node:test';
import {regularNorthRimSampleProfile as profile} from '../src/render/regular-z-rim-raster-profile.ts';
const rgba=(antialias:boolean)=>({alpha:true,depth:true,antialias});
test('exact ordinary RGBA4 and unmultisampled RGBA0 profiles only',()=>{
 assert.equal(profile(rgba(true),()=>4),'rgba4');
 assert.equal(profile(rgba(false),()=>0),'rgba0');
 for(const n of [2,8,16,-1,NaN,Infinity,'4','0',null,undefined]){
  assert.equal(profile(rgba(true),()=>n),'unsupported');
  assert.equal(profile(rgba(false),()=>n),'unsupported');
 }
 assert.equal(profile(rgba(true),()=>0),'unsupported');
 assert.equal(profile(rgba(false),()=>4),'unsupported');
});
test('unknown, RGB or non-depth contexts do not even probe the framebuffer',()=>{
 const forbidden=()=>{throw Error('unsafe path queried framebuffer')};
 assert.equal(profile(null,forbidden),'unsupported');
 for(const a of [true,false]){
  assert.equal(profile({...rgba(a),alpha:false},forbidden),'unsupported');
  assert.equal(profile({...rgba(a),depth:false},forbidden),'unsupported');
 }
});
