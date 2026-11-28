import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {originalFieldPigment,makeFieldPigmentTexture,fieldPigmentFragment,detachedFieldMaterials} from './field-pigments.ts';
const pin='dbd87dc1e7ae3df088e46f03d3bd50147f93b43e6c9704e64477735885af85f4';
const fakeShader='uniform sampler2D imageMap,coverMap,detailMap,paintMap;\n void main(){\n float d=distance(cameraPosition,p);\n col*=1.+detailFade*(.13*(noise(p.xz*.46)-.5));\n gl_FragColor=vec4(mist(col,d,p.y),1.);\n}';
test('fixed original RG8 field is byte-identical and zero-mean before filtering',()=>{
 const a=originalFieldPigment(),b=originalFieldPigment();
 assert.equal(createHash('sha256').update(a.raw).digest('hex'),pin);
 assert.deepEqual(a,b);assert.equal(a.raw.length,32768);
 assert.deepEqual(a.audit,[.022,.019,.032]);
 assert(a.mean.every(x=>Math.abs(x)<1e-5));
 const t=makeFieldPigmentTexture().texture;
 assert.equal(t.internalFormat,'RG8');assert.equal(t.format,T.RGFormat);
 assert.equal(t.colorSpace,T.NoColorSpace);assert(t.generateMipmaps);
 assert.equal(t.flipY,false);assert.equal(t.unpackAlignment,1);
 assert.equal(t.wrapS,T.ClampToEdgeWrapping);assert.equal(t.wrapT,T.ClampToEdgeWrapping);
 assert.equal(t.minFilter,T.LinearMipmapLinearFilter); assert.equal(t.anisotropy,1);t.dispose();
});
test('only a unique known native grain anchor, derivative before application, diagnostics opt-in',()=>{
 assert.equal(fieldPigmentFragment(fakeShader+fakeShader),undefined);
 assert.equal(fieldPigmentFragment(fakeShader.replace('noise(p.xz*.46)','noise(p.xz*.45)')),undefined);
 const f=fieldPigmentFragment(fakeShader),t=fieldPigmentFragment(fakeShader,true);
 assert.equal(f.match(/textureGrad\(ngFieldPigments/g).length,1);
 assert(f.indexOf('dFdx(p.xz)')<f.indexOf('float ngFieldUse='));
 assert(f.includes('}else{ col*=1.+detailFade*(.13*(noise(p.xz*.46)-.5));}'));
 assert(f.includes('gl_FragColor=vec4(mist(col,d,p.y),1.);'));
 assert(!f.includes('gl_FragColor.rgb='));
 assert(t.includes('gl_FragColor.rgb=vec3(ngFieldDiagnostic)'));
});
test('detached lease keeps the original alpha/opaque settings and all borrowed texture source revisions',()=>{
 const t0=new T.Texture(),t1=new T.Texture(),m=new T.ShaderMaterial({
  fragmentShader:fakeShader,uniforms:{imageMap:{value:t0},coverMap:{value:t1}}
 });
 const s=m.fragmentShader,v=m.version,versions=[t0.source.version,t1.source.version];
 assert.equal(detachedFieldMaterials(m,{fragmentShader:s+'...',vertexShader:m.vertexShader}),undefined);
 const l=detachedFieldMaterials(m,m);
 assert(l);assert.equal(l.strength.value,0);
 assert.equal(l.material.uniforms.imageMap,m.uniforms.imageMap);
 assert.equal(l.material.uniforms.coverMap,m.uniforms.coverMap);
 assert.deepEqual([t0.source.version,t1.source.version],versions);
 assert.equal(m.fragmentShader,s);assert.equal(m.version,v);
 let disposed=0,borrowed=0;
 l.texture.addEventListener('dispose',()=>disposed++);t0.addEventListener('dispose',()=>borrowed++);
 l.strength.value=1;l.dispose();l.dispose();
 assert.equal(disposed,1);assert.equal(borrowed,0);assert.equal(l.strength.value,0);
 assert.equal(m.fragmentShader,s);
 m.dispose();t0.dispose();t1.dispose();
});
