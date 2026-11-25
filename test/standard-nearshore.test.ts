import assert from 'node:assert/strict';
import test from 'node:test';
import { StandardNearshore, inNearshoreLocalView } from '../src/render/nearshore-standard.ts';
import { NEARSHORE_FOAM_REACHES, NEARSHORE_FOAM_COVER } from '../src/render/nearshore-foam.ts';
import { sceneryOptions, standardNearshoreRequested } from '../src/app/scenery-profile.ts';
import type { Cover } from '../src/sim/cover.ts';

test('local Standard surf does not override a stock choice or another authored shoreline', ()=>{
  assert(standardNearshoreRequested(sceneryOptions('')));
  for(const a of ['nearshoreFoamStudy','stockNearshoreFoam','scenery=detail','legacyShoreArcs','shoreToneStudy','basinChannel','surveyRelief'])
    assert(!standardNearshoreRequested(sceneryOptions('?'+a)));
  assert(!sceneryOptions('?stockNearshoreFoam&nearshoreFoamStudy').has('nearshoreFoamStudy'));
});

test('native cover proof is demanded by a low live eye, never authorizes distant or held scenery',async()=>{
  const [r]=NEARSHORE_FOAM_REACHES,inside={x:r.origin[0],z:r.origin[1],y:63};
  const dead={...inside,z:inside.z+1700};
  assert(inNearshoreLocalView(inside));
  assert(!inNearshoreLocalView(dead));
  assert(!inNearshoreLocalView({...inside,y:436}));
  let requests=0,resolve:(n:string)=>void=()=>{};
  const held=new Promise<string>(done=>{resolve=done;}),c={} as Cover;
  const model=new StandardNearshore(c,()=>{requests++;return held;});
  assert.equal(model.update(inside,0,false,false),0);
  assert.equal(model.update(dead,1,true,true),0);
  assert.equal(model.update(inside,2,false,true),0);
  assert.equal(requests,0);
  model.update(inside,3,true,true);await new Promise(done=>setTimeout(done,0));
  assert.equal(requests,1);assert.equal(model.state.proof,'waiting');
  model.update(dead,4,true,true);resolve(NEARSHORE_FOAM_COVER);await new Promise(done=>setTimeout(done,0));
  assert.equal(model.update(dead,5,true,true),0);
  assert.equal(model.update(inside,6,false,true),0);
  assert.equal(model.update(inside,7,true,true),0);
  assert.equal(model.update(inside,7.5,false,true),1);
  assert.equal(model.update(dead,8,true,true),0);
  assert.equal(model.update(inside,9,true,true),0);
  const wrong=new StandardNearshore(c,async()=>NEARSHORE_FOAM_COVER.replace('e505','550e'));
  wrong.update(inside,0,true,true);await new Promise(done=>setTimeout(done,0));
  assert.equal(wrong.update(inside,2,true,true),0);
  assert.deepEqual(wrong.state,{proof:'stock',gain:0});
});
