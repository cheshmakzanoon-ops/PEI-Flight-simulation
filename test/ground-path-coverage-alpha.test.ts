import assert from 'node:assert/strict';
import test from 'node:test';
import {AddEquation,CustomBlending,DepthTexture,NormalBlending,OneFactor,Vector3,ZeroFactor,type ShaderMaterial} from 'three';
import {confederationMaterial} from '../src/render/confederation-trail-material.ts';
import {sidewalkMaterial} from '../src/render/sidewalk-material.ts';
import {castMaterial} from '../src/render/basilica-cast-material.ts';
import {supportsOpaqueCoverage} from '../src/render/opaque-coverage-alpha.ts';

test('the original Trail and sidewalk lofts keep opaque sample colours on a multisampled alpha canvas',()=>{
 const context=(alpha:boolean,antialias:boolean,samples:number)=>({
  SAMPLES:0x80a9,getContextAttributes:()=>({alpha,antialias}),getParameter:()=>samples,
 });
 const sun=new Vector3(-.6,.74,-.31);
 const mat=[(keep:boolean)=>sidewalkMaterial(sun,undefined,keep),
   (keep:boolean)=>confederationMaterial(sun,true,undefined,keep)];
 for(const make of mat){
  const old=make(false),m=make(supportsOpaqueCoverage(context(true,true,4)));
  assert.equal(m.blending,CustomBlending);
  assert.deepEqual([m.blendEquation,m.blendSrc,m.blendDst],[AddEquation,OneFactor,ZeroFactor]);
  assert.deepEqual([m.blendEquationAlpha,m.blendSrcAlpha,m.blendDstAlpha],[AddEquation,ZeroFactor,OneFactor]);
  for(const k of ['vertexShader','fragmentShader','side','transparent','depthWrite','depthTest','alphaToCoverage'] as const)
   assert.equal(m[k],old[k],k);
  assert.equal(old.blending,NormalBlending);
  for(const contextValue of [context(false,true,4),context(true,true,1),context(true,false,0)])
   assert.equal(make(supportsOpaqueCoverage(contextValue)).blending,NormalBlending);
 }
 const fallback=confederationMaterial(sun,false,undefined,true);
 assert.equal(fallback.blending,NormalBlending);
 assert.equal(fallback.alphaToCoverage,false);
 assert.match(fallback.fragmentShader,/coverage<\.51/);
});

test('the existing basilica sidewalk receiver clone retains the guarded coverage blend',()=>{
 const depth=new DepthTexture();
 const sun=new Vector3(-.6,.74,-.31);
 for(const preserve of [false,true]){
  const base=sidewalkMaterial(sun,undefined,preserve);
  const m=castMaterial(base,'walk',{bsLive:{value:1},bsSourceDepth:{value:depth}}) as ShaderMaterial;
  assert.notEqual(m,base);
  assert.notEqual(m.fragmentShader,base.fragmentShader);
  assert.equal(m.uniforms.walkAltitude,base.uniforms.walkAltitude);
  for(const k of ['blendEquation','blendSrc','blendDst','blendEquationAlpha','blendSrcAlpha','blendDstAlpha',
   'blending','alphaToCoverage','transparent','depthTest','depthWrite'] as const)assert.equal(m[k],base[k],k);
  m.dispose();base.dispose();
 }
 depth.dispose();
});
