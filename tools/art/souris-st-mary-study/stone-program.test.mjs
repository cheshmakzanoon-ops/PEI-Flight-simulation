import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ShaderLib} from 'three';
import {MARY_ROLES} from './souris-saint-mary-forms.ts';
import {makeDetachedMaryFinish,patchDetachedMaryShaders} from './souris-saint-mary-finishes.ts';
import {makeDetachedMaryFinishV2,patchMaryStoneV2} from './souris-st-mary-finish-v2.ts';

test('the irregular masonry variant changes only the stone shader',()=>{
  const p=ShaderLib.standard;
  for(const role of MARY_ROLES){
    const a=patchDetachedMaryShaders(p.vertexShader,p.fragmentShader,role);
    const b=patchMaryStoneV2(p.vertexShader,p.fragmentShader,role);
    if(role==='stone'){
      assert(a&&b);
      assert.equal(b.vertex,a.vertex);
      assert.notEqual(b.fragment,a.fragment);
      const starts='void marySandstone(',ends='void maryRoof(';
      const withoutSandstone=s=>s.slice(0,s.indexOf(starts)).trimEnd()+s.slice(s.indexOf(ends));
      assert.equal(withoutSandstone(b.fragment),withoutSandstone(a.fragment));
      assert.equal(patchMaryStoneV2(b.vertex,b.fragment,role),undefined);
    }else assert.deepEqual(b,a);
    const base=makeDetachedMaryFinish(role),next=makeDetachedMaryFinishV2(role);
    assert(base.color.equals(next.color));
    assert.equal(next.map,null);
    assert.equal(next.normalMap,null);
    assert.equal(next.depthWrite,true);
    assert.equal(next.transparent,false);
    base.dispose();next.dispose();
  }
});
