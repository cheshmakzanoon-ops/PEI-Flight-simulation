import assert from 'node:assert/strict';
import {test} from 'node:test';
import {project} from '../src/sim/geo.ts';
import {WATER_STREET_PLAN} from '../src/render/water-street.generated.ts';
import {emitWaterStreetShell,waterStreetModel} from '../src/render/water-street.ts';

test('the Water Street fit requires exact original atlas identity and ordinal outline',()=>{
 const d=WATER_STREET_PLAN;
 assert.deepEqual(d.shells.map(r=>r.i),[108,137,172,267,326]);
 for(const r of d.shells){
  assert.equal(waterStreetModel(d.atlasSha256,d.tile,r.i,r.source),r);
  assert.equal(waterStreetModel('different',d.tile,r.i,r.source),undefined);
  assert.equal(waterStreetModel(d.atlasSha256,'offsite',r.i,r.source),undefined);
  assert.equal(waterStreetModel(d.atlasSha256,d.tile,-1,r.source),undefined);
  assert.equal(waterStreetModel(d.atlasSha256,d.tile,r.i,r.source,[r.source]),undefined);
  const shifted=r.source.map(([a,b],i)=>[i===0?a+.000001:a,b] as const);
  assert.equal(waterStreetModel(d.atlasSha256,d.tile,r.i,shifted),undefined);
 }
});

test('real roof patches and glazing remain inside the unchanged outline and beyond planar paint',()=>{
 const d=WATER_STREET_PLAN;
 let physicalReveals=0,roofs=0,risers=0;
 for(const r of d.shells){
  const ring=r.source.map(([x,z])=>project(x,z));
  const footprint=(x:number,z:number)=>{
   let near=Infinity,inside=false;
   for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[j],b=ring[i],dx=b.x-a.x,dz=b.z-a.z;
    if((a.z>z)!==(b.z>z)&&x<(z-a.z)*dx/dz+a.x)inside=!inside;
    const p=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));
    near=Math.min(near,Math.hypot(x-a.x-p*dx,z-a.z-p*dz));
   }
   return {inside,near};
  };
  emitWaterStreetShell(r,()=>r.floorGround-.05,(p,y,_c,_u,_v,role,style)=>{
   const f=footprint(p.x,p.z);
   assert.ok(f.inside||f.near<.0001,JSON.stringify({id:r.i,p,y,role,f}));
   assert.ok(Number.isFinite(y)&&style>=13&&style<=19);
   if(role===24){
    assert.ok(f.near>.14,'Glass unexpectedly painted across the outer wall');
    physicalReveals++;
   }else if(role===21)roofs++;
   else if(role===22)risers++;
  });
 }
 assert.ok(physicalReveals>900&&roofs>190&&risers===60);
});
