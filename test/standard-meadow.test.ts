import assert from 'node:assert/strict';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { sceneryOptions, standardMeadowRequested } from '../src/app/scenery-profile.ts';
import { StandardMeadow } from '../src/render/meadow-standard.ts';
import { MEADOW_TILES } from '../src/render/meadow-tiles.generated.ts';
import { CANOPY_FENCE } from '../src/render/canopy-fence.generated.ts';
import type { Cover } from '../src/sim/cover.ts';

test('plain Standard streams meadow optics independently; stock or review modes stay stock', () => {
  const q = sceneryOptions;
  assert(standardMeadowRequested(q('?departure=prince-grassland')));
  for (const flag of ['scenery=detail','surveyRelief','basinSand','regionalCanopyStudy','duneGrassSurface','buildingShadows','meadowTexture','stockMeadow'])
    assert(!standardMeadowRequested(q('?' + flag)), flag);
  assert(!q('?stockMeadow&meadowTexture').has('meadowTexture'));
});
test('decoded Cover is authenticated only near eligible low flight; late proof cannot change a distant view', async () => {
  let loads = 0, release: (sha: string)=>void = () => {};
  const p = new Promise<string>(resolve => { release = resolve; });
  const geo = {} as Cover;
  const m = new StandardMeadow(geo, () => { loads++; return p; });
  assert.equal(m.update(0, false, () => { throw Error('should not inspect ground at height'); }), 0);
  m.update(1, true, () => false);
  m.update(1.1, true, () => { throw Error('polling too early'); });
  m.update(1.3, true, () => true);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(loads, 1);
  assert.equal(m.state.proof, 'checking');
  release(CANOPY_FENCE.pins.coverDecoded);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(m.update(4, false, () => true), 0);
  assert.equal(m.update(5, true, () => true), 0);
  assert.equal(m.update(6, true, () => true), 1);
  assert.equal(m.update(7, false, () => true), 0);
  const wrong = new StandardMeadow(geo, async () => 'unchanged length, wrong bytes');
  wrong.update(1, true, () => true);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(wrong.state, { proof: 'stock', strength: 0 });
});
test('the generated tile roster covers every pinned grass cell with potentially eligible shore taps', () => {
  const a=gunzipSync(readFileSync(new URL('../public/world/cover.bin.gz', import.meta.url)));
  const w=4096,h=2720,ix=32,iz=22;
  let witnesses=0;
  for(let z=0;z<h;z++)for(let x=0;x<w;x++){
    if(a[2*(z*w+x)]!==30)continue;
    let possible=false;
    for(let j=Math.max(0,z-1);j<=Math.min(h-1,z+1)&&!possible;j++)
      for(let i=Math.max(0,x-1);i<=Math.min(w-1,x+1);i++)
        if(a[2*(j*w+i)+1]>=221){possible=true;break;}
    if(!possible)continue;
    const j0=Math.floor(z*iz/h),j1=Math.floor((z+1-EPSILON)*iz/h),i=Math.floor(x*ix/w);
    assert(MEADOW_TILES.has(i+'-'+j0)&&MEADOW_TILES.has(i+'-'+j1));
    witnesses++;
  }
  assert.equal(witnesses,526313);
  assert.equal(MEADOW_TILES.size,238);
});
const EPSILON=1e-7;
