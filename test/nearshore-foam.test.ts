import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
 NEARSHORE_FOAM_COVER, NEARSHORE_FOAM_DEPTH, NEARSHORE_FOAM_LIMIT, NEARSHORE_FOAM_REACHES,
 nearshoreFoamGLSL, nearshoreFoamMatches, nearshoreFoamRequested, nearshoreFoamRouterGLSL,
} from '../src/render/nearshore-foam.ts';

test('the open-shore study is explicit Standard opt-in and does not govern broken foam',()=>{
 for(const input of ['', '?shoreFoamDetail','?scenery=detail','?scenery=detail&nearshoreFoamStudy','?shoreToneStudy']){
  assert.equal(nearshoreFoamRequested(new URLSearchParams(input)),false,input);
 }
 for(const input of ['?nearshoreFoamStudy','?scenery=standard&nearshoreFoamStudy&shoreFoamDetail']){
  assert.equal(nearshoreFoamRequested(new URLSearchParams(input)),true,input);
 }
});

test('only the exact decoded Cover grid authorizes the reach study',()=>{
 const known={width:4096,height:2720,sourceDecodedSha:NEARSHORE_FOAM_COVER};
 assert.ok(nearshoreFoamMatches(known));
 for(const bad of [{width:4095},{height:2721},{sourceDecodedSha:undefined},{sourceDecodedSha:'a'.repeat(64)}]){
  assert.equal(nearshoreFoamMatches({...known,...bad}),false);
 }
});

test('open-coast frames have finite unit tangent axes with no distant or full-depth override',()=>{
 const seen=new Set<string>();
 for(const {id,origin,tangent,half} of NEARSHORE_FOAM_REACHES){
  assert.ok(!seen.has(id));seen.add(id);
  assert.ok([...origin,...half].every(Number.isFinite));
  assert.ok(Math.abs(Math.hypot(...tangent)-1)<2e-8);
  assert.ok(half[0]>=45&&half[1]>=24&&Math.hypot(...half)<650);
 }
 assert.equal(NEARSHORE_FOAM_LIMIT,420);
 assert.equal(NEARSHORE_FOAM_DEPTH,32);
 assert.equal((nearshoreFoamGLSL.match(/texelFetch\(/g)??[]).length,4);
 for(const [on,want] of [[true,'true'],[false,'false']] as const){
  const generated=nearshoreFoamRouterGLSL(on);
  assert.ok(generated.includes('useBroken=experiment?'+want+':nearshoreFoamMode>=.5'));
  assert.match(generated,/dist<420\.\d+&&shore<0\.&&shore>-32\.\d+/);
  assert.match(generated,/if\(frame\.y>0\.\)\{\s*vec3 depth=nearshoreFoamDepth/);
 }
});
