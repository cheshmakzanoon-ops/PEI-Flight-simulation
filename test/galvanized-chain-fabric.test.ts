import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createChainFabricStudy,stripePixel} from '../tools/art/galvanized-chain-fabric/fabric.ts';

const seats=[{x:-1.3,y:0,z:0},{x:1.4,y:.31,z:0},{x:1.4,y:.42,z:2.6},{x:-1.3,y:.17,z:2.6}];
const source={seats,height:1.48,aperture:.051,gauge:.0027};

test('real close supports and fabric grade close around four source posts, with no duplicate pole',()=>{
 const near=createChainFabricStudy({...source,closed:true}),mid=createChainFabricStudy({...source,closed:true,close:false});
 try{
  assert.equal(near.group.parent,null);
  assert.equal(near.posts,4);assert.equal(near.spans,4);assert.equal(mid.posts,4);assert.equal(mid.spans,4);
  assert.equal(near.group.children.length,2);assert.equal(mid.group.children.length,1);
  const f=near.fabric!;
  assert.notEqual(f,undefined);assert.equal(mid.fabric,undefined);
  assert.equal(f.geometry.getAttribute('position').count,24);
  assert.deepEqual([f.material.alphaToCoverage,f.material.transparent,f.material.depthWrite,f.material.side],
   [true,false,true,T.DoubleSide]);
  assert.deepEqual([f.material.blending,f.material.blendSrc,f.material.blendDst,f.material.blendSrcAlpha,f.material.blendDstAlpha],
   [T.CustomBlending,T.OneFactor,T.ZeroFactor,T.ZeroFactor,T.OneFactor]);
  const p=f.geometry.getAttribute('position'),uv=f.geometry.getAttribute('uv');
  for(let s=0;s<4;s++){
   const a=seats[s],b=seats[(s+1)%4],dx=b.x-a.x,dz=b.z-a.z,L=Math.hypot(dx,dz),ym=b.y-a.y;
   for(let i=s*6;i<s*6+6;i++){
    const t=uv.getX(i)/L;assert.ok(t>0&&t<1);
    assert.ok(Math.abs(p.getX(i)-(a.x+dx*t))<2e-6&&Math.abs(p.getZ(i)-(a.z+dz*t))<2e-6);
    assert.ok(Math.abs(p.getY(i)-(a.y+ym*t+uv.getY(i)))<2e-6);
   }
  }
  const y=near.supports.geometry.boundingBox!;
  assert.ok(Math.abs(y.min.y+.105)<1e-6&&Math.abs(y.max.y-(.42+1.48+.044))<1e-6);
  assert.equal(near.triangles,328);assert.equal(mid.triangles,160);
 }finally{near.dispose();mid.dispose();}
});

test('analytic periodic projection keeps average coverage through subpixel shifts',()=>{
 for(const duty of [.045,.075,.130]){
  for(let i=-13;i<=13;i++){
   const p=i*.0537;
   assert.ok(Math.abs(stripePixel(p,1,duty)-duty)<2e-12);
   assert.ok(Math.abs(stripePixel(p,2,duty)-stripePixel(p+7,2,duty))<2e-12);
   for(const w of [.02,.1,.42,.91]){
    const a=stripePixel(p,w,duty),b=stripePixel(1-p,w,duty);
    assert.ok(a>=0&&a<=1&&Math.abs(a-b)<2e-12);
   }
  }
 }
 assert.equal(stripePixel(.5,0,.05),1);
 assert.equal(stripePixel(.23,0,.05),0);
});

test('only the wire material uses analytic coverage and no map; invalid sites stay unavailable',()=>{
 assert.throws(()=>createChainFabricStudy({...source,seats:[seats[0],seats[0]]}),/footing/);
 assert.throws(()=>createChainFabricStudy({...source,seats:[seats[0],{x:1,y:2,z:0}]}),/grade/);
 assert.throws(()=>createChainFabricStudy({...source,gauge:.05}),/dimensions/);
 const m=createChainFabricStudy(source);
 try{
  const w=m.fabric!.material;
  const q={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}};
  w.onBeforeCompile(q as Parameters<typeof w.onBeforeCompile>[0],undefined as unknown as T.WebGLRenderer);
  assert.match(q.vertexShader,/fenceMetres=uv/);
  assert.match(q.fragmentShader,/diffuseColor.a\*=fenceCover\(\);/);
  assert.match(q.fragmentShader,/alphaTest\+max\(\.00006,fwidth\(diffuseColor.a\)\)/);
  assert.deepEqual(Object.keys(q.uniforms),['fencePitch','fenceDuty']);
  assert.ok(!w.map&&!m.supports.material.map);
  assert.doesNotMatch(T.ShaderLib.standard.fragmentShader,/fenceCover\(/);
 }finally{m.dispose();}
});
