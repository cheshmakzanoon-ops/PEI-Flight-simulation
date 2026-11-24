import test from 'node:test';
import assert from 'node:assert/strict';
import {TOWN_WALL_AREAS,TOWN_WALL_CORE_AREAS,townWallMode,townFaceRegion,townTileRegion} from '../src/render/town-wall-optics.ts';

test('automatic close town detail stays in the three independently tested core areas',()=>{
 assert.equal(townWallMode(new URLSearchParams()),'core');
 assert.equal(townWallMode(new URLSearchParams('?townWallStudy')),'expanded');
 assert.deepEqual(TOWN_WALL_CORE_AREAS.map(x=>x.r),[250,250,250]);
 for(const [i,a] of TOWN_WALL_CORE_AREAS.entries()){
  const old=TOWN_WALL_AREAS[i];
  assert(Math.hypot(a.p.x-old.p.x,a.p.z-old.p.z)+a.r<old.r);
  assert(a.r<TOWN_WALL_AREAS[i].r);
  for(const side of [-1,1]){
   const edge={x:a.p.x+side*(a.r-.02),z:a.p.z};assert(townFaceRegion(edge.x,edge.z,TOWN_WALL_CORE_AREAS));
   const out={x:a.p.x+side*(a.r+.02),z:a.p.z};assert(!townFaceRegion(out.x,out.z,TOWN_WALL_CORE_AREAS));
   assert(townFaceRegion(out.x,out.z,TOWN_WALL_AREAS));
  }
  assert(townTileRegion(a.p.x-10,a.p.z-10,a.p.x+10,a.p.z+10,TOWN_WALL_CORE_AREAS));
 }
});

test('automatic core has exact stock paths for incompatible or explicit comparison scenes',()=>{
 for(const a of ['?stockTownWalls','?stockTownWalls&townWallStudy','?scenery=detail&townWallStudy',
  '?buildingShadows','?surveyRelief','?inlandRelief','?summersideStationReview','?stDavidsChurchReview','?northBaywalkPreview',
  '?spinnakersPreview','?cavendishDetail','?indianRiverReview'])assert.equal(townWallMode(new URLSearchParams(a)),undefined,a);
 // Keep the user's existing explicit optical-study combinations available.
 assert.equal(townWallMode(new URLSearchParams('?buildingShadows&townWallStudy')),'expanded');
});
