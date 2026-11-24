import test from 'node:test';
import assert from 'node:assert/strict';
import {Mesh,Vector3} from 'three';
import {createSourisEastExterior} from '../src/render/souris-east/art.ts';
import {railPenumbraGLSL} from '../src/render/summerside-station/rail-penumbra.ts';

test('Souris exterior shadow submits the same visible triangles in the translation-only depth basis',()=>{
 const stockProfile=createSourisEastExterior();
 assert.equal(stockProfile.caster,undefined);stockProfile.dispose();
 const day=createSourisEastExterior({uniforms:{} as NonNullable<Parameters<typeof createSourisEastExterior>[0]>['uniforms'],penumbra:railPenumbraGLSL});
 const cast=day.caster;assert(cast);
 day.group.updateMatrixWorld(true);
 const shadow=cast.geometry.getAttribute('position'),style=cast.geometry.getAttribute('facadeStyle');
 assert.equal(shadow.count,1002);assert.equal(style.count,shadow.count);
 const p=new Vector3(),q=new Vector3();
 let n=0;
 for(const raw of day.group.children){
  assert(raw instanceof Mesh);
  const pos=raw.geometry.getAttribute('position');
  for(let i=0;i<(raw.geometry.index?.count??pos.count);i++,n++){
   p.fromBufferAttribute(pos,raw.geometry.index?.getX(i)??i).applyMatrix4(raw.matrixWorld);
   q.fromBufferAttribute(shadow,n).applyMatrix4(cast.matrixWorld);
   assert(p.distanceTo(q)<.000002);
   assert.equal(style.getX(n),0);
  }
 }
 assert.equal(n,1002);
 let disposed=0;cast.geometry.addEventListener('dispose',()=>{disposed++;});
 day.dispose();day.dispose();assert.equal(disposed,1);
});
