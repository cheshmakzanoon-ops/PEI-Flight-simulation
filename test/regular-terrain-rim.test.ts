import assert from 'node:assert/strict';
import {test} from 'node:test';
import {PlaneGeometry} from 'three';
import {project} from '../src/sim/geo.ts';
import {PINNED_TERRAIN,RIM_VERTEX,STOCK_TERRAIN_VERTEX,clipWorldZOnOwnedRim,patchRegularNorthRimVertex} from '../src/render/regular-z-rim-clip-v2.ts';

const bounds=[-64.47,45.94,-61.93,47.1];
const a=project(bounds[0],bounds[3]),b=project(bounds[2],bounds[1]);
const atlas={left:a.x,right:b.x,top:a.z,bottom:b.z,spec:{width:4096,height:2720,bounds}};
const w=(b.x-a.x)/32,h=(b.z-a.z)/22,F=Math.fround;
test('only two authenticated south owners can select a bounded clip-Z program',()=>{
 for(const id of ['20-17','20-19']){
  assert.equal(patchRegularNorthRimVertex(STOCK_TERRAIN_VERTEX,id,atlas,PINNED_TERRAIN),RIM_VERTEX);
  assert.equal(patchRegularNorthRimVertex(STOCK_TERRAIN_VERTEX+' ',id,atlas,PINNED_TERRAIN),undefined);
  assert.equal(patchRegularNorthRimVertex(STOCK_TERRAIN_VERTEX,id,atlas,'unknown'),undefined);
 }
 for(const id of ['20-16','20-18','18-15','18-16']){
  assert.equal(patchRegularNorthRimVertex(STOCK_TERRAIN_VERTEX,id,atlas,PINNED_TERRAIN),undefined);
 }
 const shifted={...atlas,spec:{...atlas.spec,bounds:[-64.46,...bounds.slice(1)]}};
 assert.equal(patchRegularNorthRimVertex(STOCK_TERRAIN_VERTEX,'20-17',shifted,PINNED_TERRAIN),undefined);
 assert(RIM_VERTEX.indexOf('p=w.xyz;vuv=uv;')<RIM_VERTEX.indexOf('w.z=peiRegularNorthRimZ;'));
});
test('actual N112 stock positions show one ULP separation and protect both corners',()=>{
 const g=new PlaneGeometry(w,h,112,112).rotateX(-Math.PI/2);
 try{
  const p=g.getAttribute('position'),edge0=p.getZ(0),edge1=p.getZ(112*113);
  for(const j of [17,19]){
   const north=F(F(a.z+(j-1)*h+h/2)+edge1),south=F(F(a.z+j*h+h/2)+edge0);
   assert.equal(north,F(a.z+j*h));
   assert.equal(south-north,.00390625);
   for(let k=0;k<=113;k++){
    assert.equal(clipWorldZOnOwnedRim(p.getZ(k),k,south,0),south);
    assert.equal(clipWorldZOnOwnedRim(p.getZ(k),k,south,north),k>0&&k<112?north:south);
   }
  }
 }finally{g.dispose();}
});
