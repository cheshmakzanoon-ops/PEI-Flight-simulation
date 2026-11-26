import assert from 'node:assert/strict';
import {test} from 'node:test';
import {BASIN_HEAD_DEPARTURE,basinHeadDispatchState,sceneryOptions,switchBasinHeadDispatchURL} from '../src/app/scenery-profile.ts';
import {departureBriefing} from '../src/app/departure-briefing.ts';
import {SITES} from '../src/sim/places.ts';
const host='https://flight.example/game/',id=BASIN_HEAD_DEPARTURE;
test('opening only the existing inlet package is an explicit Basin Head reload',()=>{
 const start=host+'?diagnostics&stockOpenRipples&departure=cavendish#route';
 assert(!sceneryOptions(new URL(start).search).has('basinChannel'));
 assert.equal(switchBasinHeadDispatchURL(start,true,'cavendish'),start);
 const chosen=new URL(switchBasinHeadDispatchURL(start,true,id));
 assert.equal(chosen.pathname,'/game/');
 assert.equal(chosen.hash,'#route');
 assert.deepEqual([...chosen.searchParams.keys()].sort(),['basinChannel','departure','diagnostics','stockOpenRipples']);
 assert.equal(chosen.searchParams.get('departure'),id);
 assert(basinHeadDispatchState(chosen.search).selected);
 const close=new URL(switchBasinHeadDispatchURL(chosen.href,false,id));
 assert.deepEqual([...close.searchParams.keys()].sort(),['departure','diagnostics','stockOpenRipples']);
 assert.equal(close.searchParams.get('departure'),id);
 assert(!basinHeadDispatchState(close.search).selected);
});
test('the shortcut does not mix Detail, a separate wharf or incompatible variations',()=>{
 for(const tail of ['scenery=detail','basinWharf','noBasinBank','buildingShadows','unrelated=keep',
                    'scenery=standard&scenery=standard','qa']){
  const href=host+'?'+tail;
  assert(!basinHeadDispatchState(new URL(href).search).compatible,tail);
  assert.equal(switchBasinHeadDispatchURL(href,true,id),href);
 }
 const existing=host+'?departure='+id+'&basinChannel&basinWharf&unrelated=keep';
 const closed=new URL(switchBasinHeadDispatchURL(existing,false,'cavendish'));
 assert(closed.searchParams.has('basinWharf')&&closed.searchParams.has('unrelated'));
 assert(!closed.searchParams.has('basinChannel'));
 assert.equal(closed.searchParams.get('departure'),'cavendish');
});
test('the Basin Head briefing describes the selected view and normal sand independently',()=>{
 const site=SITES.find(q=>q.id===id)!;
 assert(!departureBriefing(site,'?diagnostics').includes('Cannery'));
 assert(departureBriefing(site,'?diagnostics').includes('pale sand'));
 assert(departureBriefing(site,'?basinChannel').includes('Cannery and footbridge'));
 assert(!departureBriefing(site,'?basinChannel&noBasinBank').includes('Cannery'));
});
