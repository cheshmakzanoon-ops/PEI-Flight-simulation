import assert from 'node:assert/strict';
import test from 'node:test';
import {VICTORIA_ROW as plan} from '../src/render/victoria-row.generated.ts';
import {emitVictoriaRow,victoriaRowModel,VICTORIA_ROLES as role} from '../src/render/victoria-row.ts';

test('Victoria Row only replaces the pinned tile, ordinal and complete matching footprint',()=>{
 const f=plan.source;
 assert.equal(victoriaRowModel(plan.atlasSha256,plan.tile,plan.ordinal,f),plan);
 assert.equal(victoriaRowModel(undefined,plan.tile,plan.ordinal,f),undefined);
 assert.equal(victoriaRowModel(plan.atlasSha256,'q12000112',plan.ordinal,f),undefined);
 assert.equal(victoriaRowModel(plan.atlasSha256,plan.tile,plan.ordinal+1,f),undefined);
 assert.equal(victoriaRowModel(plan.atlasSha256,plan.tile,plan.ordinal,f.slice(1)),undefined);
 assert.equal(victoriaRowModel(plan.atlasSha256,plan.tile,plan.ordinal,f.slice().reverse()),undefined);
 assert.equal(victoriaRowModel(plan.atlasSha256,plan.tile,plan.ordinal,f,[f.slice(0,4)]),undefined);
});

test('authored glazing stays in one vertical plane per aperture, including returns close to corners',()=>{
 type Coord={x:number;y:number;z:number};
 let list:Coord[]=[],panes=0;
 const verify=()=>{
  if(!list.length)return;
  assert(list.length>=3&&list.length%3===0);
  const a=list[0],c=list.find(p=>Math.hypot(a.x-p.x,a.z-p.z)>.08)!;
  assert(c);
  const x=c.x-a.x,z=c.z-a.z,span=Math.hypot(x,z);
  for(const p of list)assert(Math.abs(x*(p.z-a.z)-z*(p.x-a.x))/span<1e-8,'Faceted pane');
  panes++;list=[];
 };
 emitVictoriaRow(plan,()=>9,(p,y,_c,_u,_v,f,_s)=>{
  if(f!==role.glass&&f!==role.shopGlass){verify();return;}
  list.push({x:p.x,y,z:p.z});
 });
 verify();
 assert(panes>130);
});
