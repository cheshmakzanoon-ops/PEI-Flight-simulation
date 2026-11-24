import assert from 'node:assert/strict';
import test from 'node:test';
import {blendGrassSeam,duneGrassBase,duneGrassInfrastructure} from '../src/render/dune-grass-surface.ts';
import {CANOPY_FENCE} from '../src/render/canopy-fence.generated.ts';
import {sceneryOptions,sceneryReviewBlock} from '../src/app/scenery-profile.ts';
import {DUNE_GRASS_AUTHORITY as A} from '../src/render/dune-grass-authority.generated.ts';

test('dune grass is standalone opt-in, with exact common atlas protection',()=>{
 const p=CANOPY_FENCE.pins;
 assert(duneGrassBase(p.terrain,p.cover,p.coverDecoded));
 assert(!duneGrassBase(p.terrain,p.cover,''));
 assert(duneGrassInfrastructure(p.road,p.buildings,p.sidewalk,p.parking));
 assert(!duneGrassInfrastructure(p.road,p.buildings,undefined,p.parking));
 assert(!sceneryOptions('?scenery=detail').has('duneGrassSurface'));
 assert.equal(sceneryReviewBlock('duneGrassSurface',sceneryOptions('?duneGrassSurface&scenery=detail')),'detail');
 assert.equal(sceneryReviewBlock('duneGrassSurface',sceneryOptions('?duneGrassSurface&duneSandDetail')),undefined);
 for(const mode of ['surveyRelief','inlandRelief','sourceGrassStudy','buildingShadows','hogIslandPhotoStudy','basinChannel','duneReliefStudy']){
  assert.equal(sceneryReviewBlock('duneGrassSurface',sceneryOptions('?duneGrassSurface&'+mode)),'terrain');
 }
 assert(A.index.every(s=>s.terrainYMax<=100));
});
test('same edge and shared corner don’t expose a half-loaded surface',()=>{
 assert.equal(blendGrassSeam(1,0,1,1,1,0),0);
 assert.equal(blendGrassSeam(1,.45,1,0,1,0),.45);
 assert.equal(blendGrassSeam(.45,1,1,0,1,0),.45);
 assert.equal(blendGrassSeam(1,.45,.95,.30,1,1),.30);
 assert.equal(blendGrassSeam(.95,.30,1,.45,1,1),.30);
 assert.equal(blendGrassSeam(1,.8,.65,0,1,1),0);
 assert.equal(blendGrassSeam(1,0,0,0,.5,.5),.25);
});
test('shared 2m texture phase stays the same with different five-metre crop origins',()=>{
 const ns=[...A.index];
 const a=ns.find(c=>c.tile[0]===17&&c.tile[1]===12)!;
 const b=ns.find(c=>c.tile[0]===17&&c.tile[1]===13)!;
 assert(a&&b&&Math.abs(a.grid[1]-b.grid[1])%2===1);
 const f=(n:number)=>n-Math.floor(n);
 for(const axis of [0,1] as const){
  const p=64018.125;
  const o=Math.fround(a.uvOrigin[axis]),x=Math.fround(b.uvOrigin[axis]);
  assert(Math.abs(f((p-o)*.5+f(o*.5))-f((p-x)*.5+f(x*.5)))<1e-8);
 }
});
