import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {makeFogGableShell,exchangeOnlyFog} from '../tools/art/east-fog-study/east-fog-gable-shell.ts';
import {studyEastFogCornice} from '../tools/art/east-fog-study/east-fog-cornice-study.ts';
import {combineEastFogAuthoredSurface} from '../tools/art/east-fog-study/east-fog-combined-surface.ts';
import {buildEastFogDatedRearEnsemble} from '../tools/art/east-fog-study/east-fog-dated-rear-ensemble.ts';
import {solidTuckPlan} from '../tools/art/east-fog-study/solid-lod-math.ts';
import {patchDetachedFogRetirement} from '../tools/art/east-fog-study/secondary-fog-vertex-program.ts';
import {FROZEN_SASH_CLOSURES as A,patchDetachedFogSashClosure,sashClosurePosition} from '../tools/art/east-fog-study/sash-distance-closure.ts';
const plan=JSON.parse(readFileSync(new URL('../tools/art/east-fog-study/east-fog-bulk-v2.json',import.meta.url),'utf8')).closedBodyPlan;
const stock='#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>\nvLocal=position;vClad=clad;';

test('only each sash suffix degenerates at the exact terminal interior anchor',()=>{
 const g=new T.BufferGeometry();
 for(const [k,c] of [['position',3],['normal',3],['color',3],['clad',1]] as const)
  g.setAttribute(k,new T.Float32BufferAttribute(new Float32Array(c*8727).fill(.123),c));
 const body=makeFogGableShell(plan).geo,base=exchangeOnlyFog(g,body,true);
 const q=[combineEastFogAuthoredSurface(base,plan).geometry,buildEastFogDatedRearEnsemble(base,plan).geometry];
 try{
  for(const [k,n] of [8157,8949].entries()){
   const p=q[k].getAttribute('position'),nc=n as 8157|8949;
   assert.equal(p.count,n);
   for(let i=0;i<n;i++){
    const v=[p.getX(i),p.getY(i),p.getZ(i)] as const;
    assert.equal(sashClosurePosition(v,i,nc,499.9),v);assert.equal(sashClosurePosition(v,i,nc,500),v);
    const a=A.find(a=>i>=a.first&&i<a.end);
    for(const d of [600,601,728])assert.equal(sashClosurePosition(v,i,nc,d),a?.anchor??v);
    if(!a)assert.equal(sashClosurePosition(v,i,nc,551),v);
    else if(i===a.first)assert.notDeepEqual(sashClosurePosition(v,i,nc,535),a.anchor);
   }
  }
  const [x0,z0]=plan.originXZ,cc=Math.cos(plan.yaw),ss=Math.sin(plan.yaw);
  const [u0,u1,v0,v1]=plan.body[1].box;
  for(const r of A){
   const [x,y,z]=r.anchor,u=cc*(x-x0)-ss*(z-z0),v=ss*(x-x0)+cc*(z-z0);
   assert.ok(u-u0>=.0249&&u-u0<.0251);
   assert.ok(u<u1&&v>v0+1.5&&v<v1-1.5&&y>plan.planeBottom);
   assert.deepEqual(r.anchor.map(Math.fround),r.anchor);
  }
 }finally{[g,body,base,...q].forEach(x=>x.dispose());}
});

test('one exact vertex-only path adds endpoint closure without changing body, trim or material',()=>{
 const model=studyEastFogCornice(plan);const cornice=solidTuckPlan(plan,model);
 try{
  for(const n of [8157,8949] as const){
   const a=patchDetachedFogSashClosure(stock,plan,cornice,n)!;
   const prior=patchDetachedFogRetirement(stock,plan,cornice,n)!;
   const needle=/\n   vec3 eastFogSashClosurePivot=.*?\n   }/s;
   assert.match(a,needle);assert.equal(a.replace(needle,''),prior);
   assert.match(a,/if\(eastFogSecondaryRange>=600\.\)transformed=eastFogSashClosurePivot;/);
   assert.match(a,/eastFogSashClosure\*eastFogSashClosure/);
   assert.doesNotMatch(a,/\bdiscard\b|alpha|gl_Position=/);
   if(n===8157)assert.doesNotMatch(a,/16\.185306549072266/);
   else assert.match(a,/16\.185306549072266/);
   assert.equal(patchDetachedFogSashClosure(a,plan,cornice,n),undefined);
  }
 }finally{model.geometry.dispose();model.bulk.dispose();}
});
