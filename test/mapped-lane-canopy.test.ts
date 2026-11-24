import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import type {Cover} from '../src/sim/cover.ts';
import type {Terrain} from '../src/sim/terrain.ts';
import {MAPPED_LANE_CANOPY_CORPUS as ROOTS} from '../src/render/mapped-lane-canopy.generated.ts';
import {OPEN_LANE_SOURCE as P,mappedLaneCanopy,mappedLaneCanopyRequested} from '../src/render/mapped-lane-canopy.ts';

const terrain={isLand:()=>true} as unknown as Terrain;
const cover={sourceSha:P.cover,sourceDecodedSha:P.coverDecoded,sample:()=>10,distance:()=>254} as unknown as Cover;
const seal=(q=cover,ground=terrain,height=P.terrain,road=P.road)=>mappedLaneCanopy(ground,q,height,road);
test('open lane preview is explicit, unbundled, Standard and roster-compatible',()=>{
 for(const flag of ['scenery=detail','woodland3D','woodlandView','woodlandCrownBase','woodlandBark','seatedForestShadows','canopyLight',
   'indianRiverReview','surveyRelief','inlandRelief','seatedRoads'])
  assert(!mappedLaneCanopyRequested(new URLSearchParams('mappedLaneCanopyStudy&'+flag)),flag);
 assert(!mappedLaneCanopyRequested(new URLSearchParams('gravelSurfaceStudy')));
 assert(mappedLaneCanopyRequested(new URLSearchParams('mappedLaneCanopyStudy&gravelSurfaceStudy')));
});
test('signed roots remain within an exact source, canonical seed and original fallback canopy',()=>{
 assert.equal(createHash('sha256').update(JSON.stringify(ROOTS)).digest('hex'),'c55251765d06b940a1e86a46c149bbadbf99e5eae9cf72cc3d74703f4675f4b8');
 const verified=seal();assert(verified);
 assert.equal(verified.size,4);
 assert.equal(createHash('sha256').update(JSON.stringify(ROOTS.slice(0,3))).digest('hex'),'b57a6a151e6a4a8b751dc2ae2a04e94d4265953ec0327e83c031e1448705b53b');
 assert.deepEqual(ROOTS.map(q=>q.ordinal),[15680,6877,12313,4474]);
 for(const q of ROOTS)for(const s of q.roots){
  const [x,z]=s.xz,[h,w]=s.fallback;
  assert(verified.excludes(x,z,h,w));
  assert(!verified.excludes(x+.01,z,h,w)&&!verified.excludes(x,z+.01,h,w));
  assert(!verified.excludes(x,z,h+.001,w)&&!verified.excludes(x,z,h,w+.001));
  assert(verified.forOwner(s.tile.join(':'))?.(x,z,h,w));
  assert(!verified.forOwner('0:0'));
 }
});
test('stale source, modified shapes, misowned seed, old height or missing continuation fail the entire table',()=>{
 assert(!mappedLaneCanopy(terrain,cover,'stale',P.road));
 assert(!mappedLaneCanopy(terrain,cover,P.terrain,undefined));
 assert(!seal({...cover,sourceDecodedSha:undefined} as Cover));
 assert(!seal({...cover,sample:()=>50} as unknown as Cover));
 assert(!seal({...cover,distance:()=>-5} as unknown as Cover));
 assert(!seal(cover,{isLand:()=>false} as unknown as Terrain));
 assert(!mappedLaneCanopy(terrain,cover,P.terrain,P.road,[{...ROOTS[0],before:undefined},ROOTS[1]]));
 assert(!mappedLaneCanopy(terrain,cover,P.terrain,P.road,[ROOTS[0],ROOTS[0]]));
 const root=ROOTS[1].roots[0];
 assert(!mappedLaneCanopy(terrain,cover,P.terrain,P.road,[ROOTS[0],{...ROOTS[1],roots:[{...root,tile:[0,0]}]}]));
 assert(!mappedLaneCanopy(terrain,cover,P.terrain,P.road,[ROOTS[0],{...ROOTS[1],roots:[{...root,fallback:[12.3,7.2]}]}]));
});

test('Old Lake QA seed is one exact fallback canopy, not a tile-wide clearing',()=>{
 const q=ROOTS[3],r=q.roots[0],verified=seal();assert(verified);
 assert.equal(q.ordinal,4474);
 assert.equal(q.segment,2);
 assert.deepEqual(r,{tile:[171,49],cell:116,xz:[32886.828125,9494.3779296875],fallback:[12.815755844116211,14.37600040435791]});
 const [x,z]=r.xz,[h,w]=r.fallback;
 assert(verified.forOwner('171:49')?.(x,z,h,w));
 assert(!verified.forOwner('171:48'));
 assert(!verified.forOwner('171:49')?.(32895.712595220655,9485.470257653855,17.296599467657508,19.235153675573233));
 assert(!mappedLaneCanopy(terrain,cover,P.terrain,P.road,[...ROOTS.slice(0,3),{...q,roots:[{...r,cell:r.cell+1}]}]));
});
