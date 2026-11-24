import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ShaderMaterial,Texture} from 'three';
import {SCENERY_REVIEWS,sceneryOptions,sceneryReviewBlock} from '../src/app/scenery-profile.ts';
import {townWallVertex,townWallRequested,townFaceRegion,townTileRegion,TOWN_WALL_AREAS,TOWN_WALL_MAX_DISTANCE,
 fittedWallMaterial} from '../src/render/town-wall-optics.ts';

test('wall face data rounds inward at the height, width and eave limits',()=>{
 assert.deepEqual(townWallVertex(9.417,2.474,17.977),[941,248,1797]);
 assert.deepEqual(townWallVertex(10.009,-.327,19.633),[1000,-32,1963]);
 assert.deepEqual(townWallVertex(-1,NaN,NaN),[-100,0,0]);
 for(const vals of [[0,3,5],[1,Infinity,8],[7,-3,500],[499,3,5]] as const){
  assert.deepEqual(townWallVertex(vals[0],vals[1],vals[2]),[0,0,0]);
 }
});

test('wall fitting is explicitly Standard and local, with no distant expansion',()=>{
 for(const q of ['', '?shoreToneStudy', '?scenery=detail&townWallStudy']){
  assert.equal(townWallRequested(new URLSearchParams(q)),false,q);
 }
 assert.equal(townWallRequested(new URLSearchParams('?townWallStudy')),true);
 assert.equal(TOWN_WALL_MAX_DISTANCE,255);
 for(const {p,r} of TOWN_WALL_AREAS){
  assert.ok(townFaceRegion(p.x,p.z));
  assert.ok(!townFaceRegion(p.x+r+.1,p.z));
  assert.ok(townTileRegion(p.x-20,p.z-20,p.x+20,p.z+20));
 }
 assert.ok(!townFaceRegion(0,0));
});

test('unsupported material refuses the optical variant; existing uniform objects stay live',()=>{
 const base=new ShaderMaterial(),panorama=new Texture(),gain={value:1};
 assert.equal(fittedWallMaterial(base,{panorama,gain}),base);
 base.vertexShader='void main(){vec4 p=vec4(0.);}';
 base.fragmentShader=`
 float area(float p,float a,float b){return p;}
 void main(){
 float d=distance(wp,cameraPosition);
 if(roof>.5){} else if(roof<.5){
  vec2 grid=uv2d/vec2(2.62,3.08);
  c*=1.-.11*fine*band(uv2d.y*4.5,.0,.18);c*=.81+.19*smoothstep(0.,3.8,uv2d.y);
 }
 }`;
 const linked={value:3};
 base.uniforms={linked};
 const optics=fittedWallMaterial(base,{panorama,gain});
 assert.notEqual(optics,base);
 assert.equal(optics.uniforms.linked,linked);
 assert.equal(optics.uniforms.townWallGain,gain);
 assert.equal(optics.uniforms.townWallSky.value,panorama);
 assert.match(optics.vertexShader,/townWall=townWallFit\*\.01/);
 assert.match(optics.fragmentShader,/float pane=min\(glass,open\)/);
 assert.doesNotMatch(base.fragmentShader,/townWallGain/);
});

test('town facades can be enabled in Standard without replacing prior Dispatch studies',()=>{
 for(const flag of ['nearshoreFoamStudy','townWallStudy'])assert.ok(SCENERY_REVIEWS.some(q=>q.flag===flag));
 assert.equal(sceneryReviewBlock('townWallStudy',sceneryOptions('?townWallStudy')),undefined);
 assert.equal(sceneryReviewBlock('townWallStudy',sceneryOptions('?scenery=detail&townWallStudy')),'detail');
 assert.equal(townWallRequested(sceneryOptions('?scenery=detail')),false);
});
