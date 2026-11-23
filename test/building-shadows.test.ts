import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {BuildingShadows} from '../src/render/local-building-shadows.ts';

function fakeRenderer(){
 const initial=new THREE.Color(.1,.2,.4),clear=initial.clone();
 let target:THREE.WebGLRenderTarget|null=null,alpha=.67;
 const fake={
  capabilities:{maxTextureSize:4096},info:{render:{calls:0,triangles:0}},autoClear:false,
  getRenderTarget:()=>target,setRenderTarget:(t:THREE.WebGLRenderTarget|null)=>{target=t;},
  getClearColor:(out:THREE.Color)=>out.copy(clear),getClearAlpha:()=>alpha,
  setClearColor:(v:THREE.ColorRepresentation,a:number)=>{clear.set(v);alpha=a;},
  render:(scene:THREE.Scene)=>{fake.info.render.calls=scene.children.length;fake.info.render.triangles=scene.children.length*12;}
 };
 return {fake,clear,initial};
}
const pause=()=>new Promise(r=>setTimeout(r,166));
test('local building depth restores renderer state and receivers remain aligned to the snapped light grid',async()=>{
 const {fake,clear,initial}=fakeRenderer();
 const shadow=new BuildingShadows(fake as unknown as THREE.WebGLRenderer,new THREE.Vector3(-.60,.74,-.31));
 assert.equal(shadow.state.active,false);
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(10,8,7),new THREE.MeshBasicMaterial());
 const caster=(_x:number,_z:number,_r:number,out:THREE.Mesh[])=>{out.push(mesh);};
 const eye=new THREE.Vector3(0,28,0);
 await pause();
 shadow.render(eye,0,caster);
 assert.equal(shadow.state.active,true);
 assert.equal(shadow.state.depthDraws,1);
 assert.equal(shadow.state.depthTriangles,12);
 assert.equal(fake.getRenderTarget(),null);assert.ok(clear.equals(initial));
 assert.equal(fake.getClearAlpha(),.67);assert.equal(fake.autoClear,false);
 const basis=shadow.uniforms;
 const project=(p:THREE.Vector3)=>p.clone().applyMatrix4(basis.localCastTransform.value)
    .multiplyScalar(.5).addScalar(.5);
 const plane=new THREE.Vector3(.22,1,.18).normalize(),center=new THREE.Vector3(8,3,-12),q=project(center);
 const du=1.3/1536,dv=-.57/1536;
 const right=basis.localCastRight.value,up=basis.localCastUp.value,back=basis.localCastSun.value;
 const shifted=center.clone().addScaledVector(right,740*du).addScaledVector(up,740*dv);
 shifted.addScaledVector(back,-plane.dot(shifted.clone().sub(center))/plane.dot(back));
 const expected=q.z+basis.localCastPlaneScale.value*(du*plane.dot(right)+dv*plane.dot(up))/plane.dot(back);
 assert.ok(Math.abs(project(shifted).z-expected)<1e-10);
 assert.ok(Math.abs(project(shifted).x-q.x-du)<1e-10);
 await pause();
 eye.x+=92;
 shadow.render(eye,0,caster);
 const adv=project(center);
 for(const a of [adv.x-q.x,adv.y-q.y]){
  assert.ok(Math.abs(a*1536-Math.round(a*1536))<1e-8);
 }
 assert.equal(shadow.state.updates,2);
 shadow.render(eye,0,()=>{});
 assert.equal(shadow.state.active,false);
 shadow.render(eye.clone().setY(500),0,caster);
 assert.equal(shadow.state.active,false);
 assert.equal(shadow.state.updates,2);
});
