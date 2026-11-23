import test from 'node:test';
import assert from 'node:assert/strict';
import {windmillDragN,windmillOmegaRadS} from '../src/sim/windmilling.ts';
import {FIXED_STEP,flightConditions,neutral,spawn,step,setEngineOut} from '../src/sim/flight.ts';
import {SITES} from '../src/sim/places.ts';
import {glideSweep,glideTrial} from '../tools/qa/glide-trial.ts';

const surface=()=>({height:0,land:true,runway:true});
test('passive propeller cannot create thrust or absorb more energy than the incident air',()=>{
  const disk=Math.PI*(79*.0254)**2/4;
  for(const density of [.4,.9,1.225]) for(let v=0;v<=150;v+=.5) {
    const q=.5*density*v*v, drag=windmillDragN(v,q), omega=windmillOmegaRadS(v);
    assert.ok(drag>=0 && drag*v <= .42*q*disk*v+1e-9);
    assert.ok(omega>=0 && omega<=2400*Math.PI/30);
  }
  assert.equal(windmillDragN(0,0),0); assert.equal(windmillOmegaRadS(0),0);
  assert.ok(windmillDragN(40,980)>400 && windmillDragN(40,980)<500);
});

test('explicit failure removes thrust despite throttle, and a fresh departure restores ordinary play',()=>{
  const c=flightConditions(1406), a=spawn({...SITES[0],height:1200},surface), b={...a};
  a.throttle=1; b.throttle=0; setEngineOut(a,true); setEngineOut(b,true);
  for(let i=0;i<900;i++){step(a,neutral,surface,FIXED_STEP,c);step(b,neutral,surface,FIXED_STEP,c);}
  assert.equal(a.speed,b.speed); assert.equal(a.y,b.y); assert.equal(a.x,b.x);
  setEngineOut(a,false);
  for(let i=0;i<90;i++){step(a,neutral,surface,FIXED_STEP,c);step(b,neutral,surface,FIXED_STEP,c);}
  assert.ok(a.speed>b.speed);
  const fresh=spawn(SITES[0],surface);
  assert.equal(fresh.engineOut,false);
  const onRunway=spawn(SITES.find(s=>s.runway)!,surface);setEngineOut(onRunway,true);
  assert.equal(onRunway.engineOut,false);
});

test('windmilling shortens glide range without moving the best sampled speed to the stall',()=>{
  const {best,trials}=glideSweep(true), ordinary=glideTrial(78);
  assert.equal(best.targetKeas,78);
  assert.ok(best.rangeRatio>8.55 && best.rangeRatio<9);
  assert.ok(best.energyRangeRatio>8.55 && best.energyRangeRatio<8.95);
  assert.ok(best.rangeRatio<.75*ordinary.rangeRatio && best.sinkMps>1.3*ordinary.sinkMps);
  assert.ok(best.rangeRatio>trials[0].rangeRatio+.2 && best.rangeRatio>trials.at(-1)!.rangeRatio+.5);
  for(const t of trials) assert.ok(t.easSpreadKt<.1 && t.sinkSpreadMps<.1);
  assert.ok(Math.abs(glideTrial(78,1/60,true).rangeRatio-glideTrial(78,1/120,true).rangeRatio)<.02);
});
