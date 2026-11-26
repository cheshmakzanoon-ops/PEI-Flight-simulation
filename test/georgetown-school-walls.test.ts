import assert from 'node:assert/strict';
import {test} from 'node:test';
import {georgetownSchoolFinish} from '../src/render/georgetown-school-finish.generated.ts';
import {georgetownSchoolWallNear,schoolFinishShader} from '../src/render/school-wall-finish.ts';
import {georgetownSchoolWallsRequested,sourisWestFacingRequested} from '../src/app/scenery-profile.ts';
import {stDavidsStandardRequested} from '../src/render/st-davids/admit.ts';

const vertex='varying vec3 w;\n void main(){w=position;}';
const fragment='void main(){\n vec3 c=tint,n=normalize(normalW);\n if(roof>.5){c=tint;}\n else if(roof<.5){\n  vec2 grid=uv2d; c+=vec3(grid,1.);\n }\n gl_FragColor=vec4(c,1.);\n}';

test('exact school wall ranges preserve rendered stock roof and adjacent faces',()=>{
 const authored=schoolFinishShader(vertex,fragment,georgetownSchoolFinish);
 assert.ok(authored);
 assert.match(authored.vertexShader,/gl_VertexID>=2127&&gl_VertexID<2133\?1\./);
 assert.match(authored.vertexShader,/gl_VertexID>=2133&&gl_VertexID<2139\?2\./);
 assert.match(authored.vertexShader,/gl_VertexID>=2145&&gl_VertexID<2151\?3\./);
 assert.doesNotMatch(authored.vertexShader,/gl_VertexID>=2139|gl_VertexID>=2175|14070/);
 for(const [rank,wall] of Object.values(georgetownSchoolFinish.walls).entries()){
  assert.ok(authored.fragmentShader.includes('roof<.5&&georgetownSchoolWall=='+(rank+1)+'.'));
  assert.equal(authored.fragmentShader.split(wall.rule).length,2);
 }
 assert.equal(authored.fragmentShader.split('else if(roof<.5){\n  vec2 grid=uv2d').length,2);
 assert.ok(authored.fragmentShader.indexOf(georgetownSchoolFinish.wallPrelude)<authored.fragmentShader.indexOf(georgetownSchoolFinish.walls.kent.rule));
 assert.equal(schoolFinishShader(vertex,fragment,{...georgetownSchoolFinish,walls:{
  ...georgetownSchoolFinish.walls,graftonPlain:{...georgetownSchoolFinish.walls.graftonPlain,span:[2139,2145]},
 }}),undefined);
 assert.equal(schoolFinishShader(vertex,fragment.replace('vec2 grid=', 'vec2 window='),georgetownSchoolFinish),undefined);
 assert.equal(schoolFinishShader(authored.vertexShader,authored.fragmentShader,georgetownSchoolFinish),undefined);
 assert.equal(schoolFinishShader(vertex+vertex,fragment,georgetownSchoolFinish),undefined);
});

test('school finish opts out without disabling the original church or other Standard scenery',()=>{
 const q=(s:string)=>new URLSearchParams(s);
 assert(georgetownSchoolWallsRequested(q('departure=georgetown-low')));
 assert(georgetownSchoolWallsRequested(q('departure=georgetown-low&scenery=standard&diagnostics')));
 assert(!georgetownSchoolWallsRequested(q('departure=georgetown-low&stockGeorgetownSchoolWalls')));
 for(const flag of ['qa','buildingShadows','inlandRelief','provinceFieldsReview','scenery=detail','scenery=bad','unknown']){
  assert(!georgetownSchoolWallsRequested(q('departure=georgetown-low&'+flag)));
 }
 assert(!georgetownSchoolWallsRequested(q('scenery=standard&scenery=detail')));
 assert(stDavidsStandardRequested(q('stockGeorgetownSchoolWalls')));
 assert(sourisWestFacingRequested(q('stockGeorgetownSchoolWalls')));
 assert(!georgetownSchoolWallsRequested(q('stockStDavidsExterior')));
});


test('school coverage selects measured flight positions independently of the Cavendish barn',()=>{
 assert(georgetownSchoolWallNear(51180.58931732824,35333.689725371005));
 assert(georgetownSchoolWallNear(51142.007603889295,35301.25828019176));
 assert(!georgetownSchoolWallNear(51084+1050,35228));
 assert(!georgetownSchoolWallNear(NaN,35228));
 assert(!georgetownSchoolWallNear(51084,Infinity));
});
