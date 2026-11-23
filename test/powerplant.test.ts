import test from 'node:test';
import assert from 'node:assert/strict';
import {SEA_LEVEL_DENSITY} from '../src/sim/aerodynamics.ts';
import {availableShaftW,poweredThrustN} from '../src/sim/powerplant.ts';
import {climbCases,climbTrial,normalClimbChecks} from '../tools/qa/climb-trial.ts';

test('power and actuator-disk work stay within a naturally aspirated engine budget',()=>{
  const rated=230*745.6998716, area=Math.PI*(.5*2.0066)**2;
  assert.ok(Math.abs(availableShaftW(SEA_LEVEL_DENSITY,1)-rated)<1e-8);
  assert.equal(availableShaftW(0,1),0);
  assert.equal(poweredThrustN(0,SEA_LEVEL_DENSITY,0),0);
  assert.equal(poweredThrustN(35,SEA_LEVEL_DENSITY,-1),0);
  assert.equal(poweredThrustN(0,SEA_LEVEL_DENSITY,1),3600);
  for(const rho of [.25,.50,.85,1.1,SEA_LEVEL_DENSITY,1.3]){
    for(let v=0;v<=160;v+=2){
      let last=0;
      for(const lever of [.01,.1,.25,.5,.75,1]){
        const shaft=availableShaftW(rho,lever), thrust=poweredThrustN(v,rho,lever);
        assert.ok(Number.isFinite(thrust) && thrust>=last && shaft<=rated);last=thrust;
        // Infer the induced velocity independently from momentum at the observed thrust.
        const induced=.5*(Math.sqrt(v*v+2*thrust/(rho*area))-v);
        assert.ok(thrust*(v+induced)<=.88*shaft+.02,'air power exceeds bounded shaft output');
      }
    }
  }
  assert.ok(availableShaftW(.80,1)<availableShaftW(1.0,1));
  assert.ok(poweredThrustN(62,.80,1)<poweredThrustN(62,1.0,1));
});

test('five independently settled climb gates lose rate with altitude at matched loading',()=>{
  const result=climbCases.map(c=>climbTrial(c));
  for(let i=0;i<result.length;i++){
    const r=result[i];
    assert.ok(r.leadInS>60 && r.measurementS>8);
    assert.ok(Math.abs(r.meanKeas-r.targetKeas)<.12 && r.easSpreadKt<.05);
    assert.ok(Math.abs(r.relativeDifference)<.10); // calibration trend, not independent accuracy
    if(i)assert.ok(r.measuredFpm<result[i-1].measuredFpm-40);
  }
  const a=climbTrial(climbCases[2],1/60),b=climbTrial(climbCases[2],1/120);
  assert.ok(Math.abs(a.measuredFpm-b.measuredFpm)<2);
  // Do not force the separate 90 KIAS check to pass calibration: its published gap is visible.
  const fast=normalClimbChecks.map(c=>climbTrial(c));
  assert.ok(fast[0].measuredFpm>fast[1].measuredFpm && fast[1].measuredFpm>0);
});
