import * as T from 'three';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {addLighthouseScenery} from '../src/render/lighthouses.ts';
import {makeFogGableShell} from '../tools/art/east-fog-study/east-fog-gable-shell.ts';
import {EAST_FINISH,patchEastFogFinish} from '../tools/art/east-fog-study/east-fog-surface-finish.ts';

const plan=JSON.parse(readFileSync(new URL('../tools/art/east-fog-study/east-fog-bulk-v2.json',import.meta.url))).closedBodyPlan;
function actualPaint(){
 const scene=new T.Scene();
 const [station]=addLighthouseScenery(scene,{meshElevation:()=>0} as Parameters<typeof addLighthouseScenery>[1]);
 const mesh=station.levels[0].object.children[0] as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
 assert.equal(mesh.geometry.getAttribute('position').count,8727);
 assert.equal(mesh.material.roughness,.86);
 const shader={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}};
 mesh.material.onBeforeCompile(shader,{} as T.WebGLRenderer);
 return shader;
}
test('fitted material span covers the original wall and roof roles, not floors, peers, sashes or trim',()=>{
 const {geo,roles}=makeFogGableShell(plan);
 assert.equal(EAST_FINISH.end-EAST_FINISH.first,geo.getAttribute('position').count);
 assert.deepEqual(EAST_FINISH.ridgeU,plan.body.map((b:{ridgeU:number})=>b.ridgeU));
 assert.equal(EAST_FINISH.wingJoinV,plan.body[1].box[2]);
 assert.deepEqual([EAST_FINISH.fullRadius,EAST_FINISH.farRadius],[177,245]);
 let n=geo.getAttribute('normal');const tally={wall:0,roof:0,floor:0};
 for(const row of roles){
  tally[row.kind]+=(row.end-row.first)/3;
  for(let i=row.first;i<row.end;i++){
   const y=n.getY(i);assert.equal(y>.5?'roof':Math.abs(y)<.05?'wall':'floor',row.kind);
  }
 }
 assert.deepEqual(tally,{roof:32,wall:70,floor:32});geo.dispose();
});
test('the actual Three painted lighthouse shader gets a reversible opaque-only operation',()=>{
 const s=actualPaint(),a=patchEastFogFinish(s);assert(a);
 assert.match(a.vertexShader,/gl_VertexID>=5055&&gl_VertexID<5457/);
 assert(a.fragmentShader.indexOf('dFdx(fogFinishMetres)')<a.fragmentShader.indexOf('if(fogFinishRole>0'));
 assert(a.fragmentShader.indexOf('fogRoughness!=0.')<a.fragmentShader.indexOf('#include <lights_physical_fragment>'));
 assert(!/diffuseColor\.a\s*=|gl_FragDepth\s*=|texture\s*\(/.test(a.fragmentShader));assert.equal(patchEastFogFinish(a),undefined);
 assert(!s.fragmentShader.includes('fogFinish'));
 for(const [before,after] of [
  ['#include <roughnessmap_fragment>',''],
  ['#include <color_fragment>','#include <color_fragment>\n#include <color_fragment>'],
  ['varying vec3 vViewPosition;','varying vec2 vViewPosition;'],
 ]) assert.equal(patchEastFogFinish({...s,fragmentShader:s.fragmentShader.replace(before,after)}),undefined);
});
