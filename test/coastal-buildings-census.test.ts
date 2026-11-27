import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { runCensus, screenFootprint } from '../tools/qa/coastal-buildings-census.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const square = [[-63.21, 46.49], [-63.19, 46.49], [-63.19, 46.51], [-63.21, 46.51]];
const hole = [[-63.205, 46.495], [-63.195, 46.495], [-63.195, 46.505], [-63.205, 46.505]];

test('the coastal sample includes interior cells, excludes holes and preserves wet/dry sign', () => {
  const full = screenFootprint(square, undefined, (x: number) => x < 0 ? -4 : 4, 8);
  const cut = screenFootprint([...square].reverse(), [hole], (x: number) => x < 0 ? -4 : 4, 8);
  assert.deepEqual([full.wet, full.dry], [32, 32]);
  assert.deepEqual([cut.wet, cut.dry], [24, 24]);
  assert.deepEqual(cut.coverRangeM, [-4, 4]);
  assert(Math.abs(cut.areaM2 / full.areaM2 - .75) < 1e-10);
  const diamond = [[-63.21, 46.5], [-63.2, 46.49], [-63.19, 46.5], [-63.2, 46.51]];
  const insideOnly = screenFootprint(diamond, [], () => 1, 4);
  assert.deepEqual([insideOnly.wet, insideOnly.dry], [0, 4]);
});

test('the coastal sampler never substitutes an exterior centre for an unsampled ring', () => {
  const empty = screenFootprint([[0, 1], [1, 1], [2, 1]], [], () => {
    throw new Error('A degenerate ring has no interior.');
  }, 8);
  assert.deepEqual(empty, { areaM2: 0, wet: 0, dry: 0, coverRangeM: null });
  assert.throws(() => screenFootprint(square, [], () => NaN, 8), /Cover sample/);
  assert.throws(() => screenFootprint(square, [], () => 0, 3), /sample grid/);
});

test('the exact Summerside assets reproduce flooded-platform leads, not removals', () => {
  const report = runCensus(root, { tile: 'q032001', limit: 40 });
  assert.deepEqual(report.sampling, {
    grid: 16, tiles: 1, rows: 399, groups: {
      allSampledDry: 382, mixed: 7, allSampledWet: 10, noInteriorSamples: 0,
    },
  });
  for (const ordinal of [18, 75, 331]) {
    const key = report.candidates.find((q: { ordinal: number }) => q.ordinal === ordinal);
    assert(key && key.wet > 0 && key.dry === 0 && key.coverRangeM[1] < 0);
  }
  assert.match(report.limitation, /does not qualify a removal/);
});

test('bounded source selection rejects unknown tiles and unbounded options', () => {
  assert.throws(() => runCensus(root, { tile: 'q9999' }), /Unknown building tile/);
  assert.throws(() => runCensus(root, { grid: 256 }), /Invalid grid or report limit/);
  assert.throws(() => runCensus(root, { limit: 201 }), /Invalid grid or report limit/);
});

test('the source gate rejects altered Cover bytes, range metadata and tile digests', () => {
  const temp = mkdtempSync(join(tmpdir(), 'pei-coast-census-'));
  try {
    const world = join(temp, 'public', 'world');
    mkdirSync(join(world, 'buildings'), { recursive: true });
    const checksum = (data: Buffer) => createHash('sha256').update(data).digest('hex');
    const bounds = [-64, 46, -62, 47];
    const encoded = gzipSync(Buffer.from([3, 127, 3, 127, 3, 127, 3, 127]));
    const packed = gzipSync(JSON.stringify({ features: [{ footprint: square, height: 5 }] }));
    const manifest = {
      ...{ bounds, count: 1, file: 'test.pack', bytes: packed.length, sha256: checksum(packed), tileCompression: 'gzip' },
      tiles: [{ id: 'q0', offset: 0, bytes: packed.length, count: 1, sha256: checksum(packed) }],
    };
    const put = (file: string, data: object) => writeFileSync(join(world, file), JSON.stringify(data));
    put('terrain.json', { bounds });
    put('buildings/index.json', manifest);
    const coverManifest = { bounds, width: 2, height: 2, file: 'sample.gz', compressedSha256: checksum(encoded) };
    put('cover.json', { ...coverManifest, bounds: [-65, 46, -62, 47] });
    assert.throws(() => runCensus(temp), /Incompatible building, Cover or terrain bounds/);
    put('cover.json', coverManifest);
    writeFileSync(join(world, 'sample.gz'), encoded);
    writeFileSync(join(world, 'buildings', 'test.pack'), packed);
    assert.equal(runCensus(temp).sampling.groups.allSampledWet, 1);
    const changed = Buffer.from(encoded);
    changed[0] ^= 1;
    writeFileSync(join(world, 'sample.gz'), changed);
    assert.throws(() => runCensus(temp), /Cover archive checksum/);
    writeFileSync(join(world, 'sample.gz'), encoded);
    manifest.tiles[0].offset = 1;
    put('buildings/index.json', manifest);
    assert.throws(() => runCensus(temp), /Invalid building range/);
    manifest.tiles[0].offset = 0;
    manifest.tiles[0].sha256 = '0'.repeat(64);
    put('buildings/index.json', manifest);
    assert.throws(() => runCensus(temp), /Building tile checksum/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
