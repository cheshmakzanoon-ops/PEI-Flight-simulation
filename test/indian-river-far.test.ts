import assert from 'node:assert/strict';
import {test} from 'node:test';
import {PerspectiveCamera,Vector3} from 'three';
import {buildStMarysFar,useStMarysFar} from '../src/render/indian-river/far.ts';
import {projectedVerticalPixels} from '../src/render/indian-river/screen-size.ts';

test('far model is one texture-free indexed landmark draw with a bounded budget',()=>{
 const m=buildStMarysFar();
 assert.equal(m.geometry.index?.count,2437*3);
 assert.equal(m.userData.quality,'far');
 assert.equal(m.material.map,null);
 assert.equal(m.geometry.groups.length,0);
 assert(m.geometry.getAttribute('color').count>0);
 m.geometry.dispose();m.material.dispose();
});
test('actual device height and zoom keep the same measured silhouette gate',()=>{
 const camera=new PerspectiveCamera(53,1.6,.08,350000);
 const samples=[new Vector3(3,24,-10),new Vector3(2,56,8),new Vector3(-8,27,2),new Vector3(0,46,-10)];
 camera.position.set(130,74,-550);camera.lookAt(new Vector3(0,33,0));camera.updateMatrixWorld();
 const scratch=new Vector3();
 for(const zoom of [.8,1,1.3]){
  camera.zoom=zoom;camera.updateProjectionMatrix();
  const actual=samples.map(q=>q.clone().project(camera).y);
  const height=projectedVerticalPixels(samples,camera,1001,scratch);
  assert(Math.abs(height-(Math.max(...actual)-Math.min(...actual))*500.5)<1e-10);
 }
 assert.equal(projectedVerticalPixels([...samples,camera.position],camera,1001,scratch),Infinity);
 assert(!useStMarysFar(false,429,50));assert(!useStMarysFar(false,770,86.1));
 assert(useStMarysFar(false,430,86));assert(useStMarysFar(true,395,100));
 assert(!useStMarysFar(true,394.9,40));assert(!useStMarysFar(true,700,100.1));
 assert(!useStMarysFar(true,800,Infinity));
});
