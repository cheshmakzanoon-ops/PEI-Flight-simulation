import A from 'node:assert/strict';
import {test} from 'node:test';
import * as T from 'three';
import {PointFillPool} from '../src/render/point-fill-pool.ts';
const centre={x:50,y:60,point:[-38843.5,3.8,27795]};
function original(){
 return new T.ShaderMaterial({
  uniforms:{peiBordenSkyFill:{value:0},control:{value:10}},
  vertexShader:'void main(){gl_Position=vec4(position,1.);\n#include <logdepthbuf_vertex>\n}',
  fragmentShader:'void main(){gl_FragDepth=1.0;}',depthFunc:T.EqualDepth,depthWrite:false,
 });
}
test('holds all point buffers and registered attributes stable until disposal',()=>{
 const source=original(),p=new PointFillPool(source,2);
 const pos=p.mesh.geometry.getAttribute('position'),view=p.mesh.geometry.getAttribute('peiBordenCentreClip');
 const copy=pos.array;
 A(p.stage(840,540,[centre]));p.admit(true);
 A.equal(p.mesh.material.uniforms.peiBordenSkyFill.value,1);
 A.equal(source.uniforms.peiBordenSkyFill.value,0);
 A.equal(p.mesh.material.uniforms.control,source.uniforms.control);
 A.equal(p.mesh.geometry.drawRange.count,1);
 A(p.owns(p.mesh.material,p.mesh.geometry));
 p.vetoDraw();A.equal(p.mesh.geometry.drawRange.count,0);A(!p.owns(p.mesh.material,p.mesh.geometry));
 A(p.mesh.geometry.drawRange.start>pos.count);
 A(p.stage(980,630,[centre,{...centre,x:51}]));
 A.equal(p.mesh.geometry.getAttribute('position'),pos);
 A.equal(p.mesh.geometry.getAttribute('peiBordenCentreClip'),view);
 A.equal(pos.array,copy);A.deepEqual(pos.updateRanges,[{start:0,count:6}]);
 A.equal(p.mesh.material.uniforms.peiBordenSkyFill.value,0);
 p.clear();A(!p.mesh.visible);p.admit(true);
 A.equal(p.mesh.material.uniforms.peiBordenSkyFill.value,0);
 p.dispose();A(!p.stage(840,540,[centre]));
});
test('duplicate points, forged screen coordinates and out-of-cell positions fail closed',()=>{
 const p=new PointFillPool(original(),3);
 A(!p.stage(980,630,[centre,centre]));
 A.equal(p.mesh.geometry.drawRange.count,0);
 A(!p.stage(980,630,[{...centre,x:980}]));
 A(!p.stage(980,630,[{...centre,point:[-38866.9,4,27799]}]));
 A(!p.stage(980,630,[]));
 A(!p.mesh.visible);
 p.dispose();
});
