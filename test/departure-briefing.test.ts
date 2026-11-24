import assert from 'node:assert/strict';
import test from 'node:test';
import { departureBriefing as draft } from '../src/app/departure-briefing.ts';
import { POINT_PRIM_DEPARTURE as pointPrim } from '../src/render/point-prim/admit.ts';
import { SITES } from '../src/sim/places.ts';
const grass = SITES.filter(s => s.id.endsWith('-coastal-grass'));
const basin = SITES.find(s => s.id === 'basin-head-low')!;

test('the ordinary routes explain where to look without telling pilots to enable an obsolete study', () => {
  assert.match(draft(pointPrim, ''), /surveyed lighthouse.*appear/);
  assert.match(draft(basin, ''), /pale sand on the seaward beach/);
  assert.equal(grass.length, 3);
  grass.forEach(s => assert.match(draft(s, '?scenery=standard'), /Look for close grass detail/));
});

test('briefings follow the stock veto, explicit studies and incompatible modes', () => {
  assert.match(draft(pointPrim, '?stockPointPrim&pointPrimStudy'), /lighthouse is off/);
  assert.match(draft(pointPrim, '?scenery=detail&pointPrimStudy'), /lighthouse is off/);
  assert.match(draft(basin, '?stockBasinSand&basinSand'), /sand treatment is off/);
  assert.match(draft(basin, '?scenery=detail'), /sand treatment is off/);
  assert.match(draft(basin, '?scenery=detail&basinSand'), /pale sand on the seaward beach/);
  for (const s of grass) {
    assert.match(draft(s, '?stockDuneGrass&duneGrassSurface'), /grass treatment is off/);
    assert.match(draft(s, '?duneGrassSurface&buildingShadows'), /grass treatment is off/);
    assert.match(draft(s, '?duneGrassSurface'), /Look for close grass detail/);
  }
  assert.equal(draft(SITES[0], '?stockDuneGrass'), SITES[0].note);
});
