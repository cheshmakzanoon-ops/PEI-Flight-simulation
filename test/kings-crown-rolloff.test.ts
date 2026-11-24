import assert from 'node:assert/strict';
import test from 'node:test';
import {BufferAttribute} from 'three';
import {CoastalGrid,GROUND_LIFT,SURVEY_LOD} from '../src/sim/coastal-terrain.ts';
import {KingsCrownMorph,kingsCrownBlendForDistance,KINGS_CROWN_FULL_M,KINGS_CROWN_ZERO_M} from '../src/render/kings-crown-rolloff.ts';

test('Crown contribution reaches zero before either stock N112 tier transition',()=>{
 assert.equal(KINGS_CROWN_FULL_M,4500);assert.equal(KINGS_CROWN_ZERO_M,5200);
 assert.equal(kingsCrownBlendForDistance(5300),0);assert.equal(kingsCrownBlendForDistance(6200),0);
 assert.equal(kingsCrownBlendForDistance(4500),1);assert.equal(kingsCrownBlendForDistance(4850),.5);
 assert.equal(kingsCrownBlendForDistance(NaN),0);
 let last=1;
 for(let r=4500;r<=5225;r+=.5){
  const v=kingsCrownBlendForDistance(r);assert(v<=last&&v>=0);last=v;
  assert(v-kingsCrownBlendForDistance(r+25)<.054);
 }
});

test('A real near position buffer changes only published nonzero offset Y samples; full return is byte exact',()=>{
 const n=(SURVEY_LOD+1)**2;
 const grid=new CoastalGrid({left:0,top:0,right:32*112*32,bottom:22*112*32},{spec:{
  id:'synthetic-grade-proof',tileX:21,tileZ:12,relativeToParent:true,sparseRelative:true,
  firstX:4,firstZ:6,cellsX:1,cellsZ:1,sub:4,sha256:'empty synthetic test',
 },samples:Int16Array.from({length:25},(_,i)=>i===12?980:i===13?-240:0)},(x,z)=>x*.0001+z*.0003);
 const xyz=new Float32Array((n+25)*3).fill(.625),p=new BufferAttribute(xyz,3);
 for(let j=0;j<grid.nz;j++)for(let i=0;i<grid.nx;i++)p.setY(n+j*grid.nx+i,grid.indexHeight(i,j)+GROUND_LIFT);
 const before=xyz.slice(),m=new KingsCrownMorph(p,grid);assert.equal(m.movedCount,2);
 const base=[12,13].map(k=>Math.fround(grid.parentHeight(grid.x0+k%grid.nx*grid.stepX,grid.z0+Math.floor(k/grid.nx)*grid.stepZ)+GROUND_LIFT));
 m.set(.5);assert.deepEqual(m.strength,{value:.5});
 for(let j=0;j<xyz.length;j++){
  const hit=[(n+12)*3+1,(n+13)*3+1].indexOf(j);
  if(hit<0)assert.equal(xyz[j],before[j]);else assert.equal(xyz[j],Math.fround((before[j]+base[hit])*.5));
 }
 assert.equal(p.updateRanges.length,1);assert.equal(p.updateRanges[0].count,6);
 m.set(1);assert.deepEqual(xyz,before);
});
