/** Read-only triage of original building footprints against the shipped coarse Cover.
 * Not a coastline survey, browser visibility check, or list of buildings to remove.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { basename, join } from 'node:path';
import { Cover } from '../../src/sim/cover.ts';
import { project } from '../../src/sim/geo.ts';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const whole = (n, lo, hi) => Number.isSafeInteger(n) && n >= lo && n <= hi;
const fail = reason => { throw new Error(reason); };
const check = (ok, reason) => { if (!ok) fail(reason); };
const validPoint = q => Array.isArray(q) && q.length === 2 && q.every(Number.isFinite)
  && Math.abs(q[0]) <= 180 && Math.abs(q[1]) <= 90;
const hex = str => typeof str === 'string' && /^[a-f0-9]{64}$/.test(str);

function contains(ring, x, z, boundary) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    const dx = b.x - a.x, dz = b.z - a.z;
    if (x >= Math.min(a.x, b.x) - 1e-8 && x <= Math.max(a.x, b.x) + 1e-8
      && z >= Math.min(a.z, b.z) - 1e-8 && z <= Math.max(a.z, b.z) + 1e-8
      && Math.abs(dx * (z - a.z) - dz * (x - a.x)) <= (Math.abs(dx) + Math.abs(dz)) * 1e-8) return boundary;
    if ((a.z > z) !== (b.z > z) && x < a.x + (b.x - a.x) * (z - a.z) / (b.z - a.z)) inside = !inside;
  }
  return inside;
}

function area(ring) {
  const o = ring[0];
  let area2 = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i];
    area2 += (a.x - o.x) * (b.z - o.z) - (b.x - o.x) * (a.z - o.z);
  }
  return Math.abs(area2) / 2;
}

/** Deterministic interior sample counts, not a fraction of surveyed building area. */
export function screenFootprint(outer, holes, coverAt, grid = 16) {
  const rings = [outer, ...(holes ?? [])];
  check(whole(grid, 4, 32) && rings.every(r => Array.isArray(r) && r.length >= 3 && r.every(validPoint)),
    'Invalid footprint rings or sample grid.');
  const [ring, ...voids] = rings.map(r => r.map(([lon, lat]) => project(lon, lat)));
  const areaM2 = Math.max(0, area(ring) - voids.reduce((a, r) => a + area(r), 0));
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const { x, z } of ring) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  let wet = 0, dry = 0, min = Infinity, max = -Infinity;
  for (let row = 0; row < grid; row++) {
    const z = z0 + (z1 - z0) * ((row + .5) / grid);
    for (let col = 0; col < grid; col++) {
      const x = x0 + (x1 - x0) * ((col + .5) / grid);
      if (!contains(ring, x, z, false) || voids.some(r => contains(r, x, z, true))) continue;
      const d = coverAt(x, z);
      check(Number.isFinite(d), 'Invalid Cover sample.');
      if (d < 0) wet++; else dry++;
      min = Math.min(min, d);
      max = Math.max(max, d);
    }
  }
  return { areaM2, wet, dry, coverRangeM: wet + dry ? [min, max] : null };
}

export function runCensus(repo, options = {}) {
  const world = join(repo, 'public', 'world');
  const read = (dir, file) => {
    check(typeof file === 'string' && file === basename(file) && file.length > 0 && file !== '.' && file !== '..', 'Unexpected public asset filename.');
    return readFileSync(join(dir, file));
  };
  const grid = options.grid ?? 16, limit = options.limit ?? 40;
  check(whole(grid, 4, 32) && whole(limit, 0, 200), 'Invalid grid or report limit.');
  const coverManifestBytes = read(world, 'cover.json'), buildingDir = join(world, 'buildings');
  const manifestBytes = read(buildingDir, 'index.json'), terrainBytes = read(world, 'terrain.json');
  const cm = JSON.parse(coverManifestBytes), bm = JSON.parse(manifestBytes), tm = JSON.parse(terrainBytes);
  check(Array.isArray(tm.bounds) && tm.bounds.length === 4 && tm.bounds.every(Number.isFinite)
    && tm.bounds[0] < tm.bounds[2] && tm.bounds[1] < tm.bounds[3]
    && JSON.stringify(tm.bounds) === JSON.stringify(bm.bounds)
    && JSON.stringify(tm.bounds) === JSON.stringify(cm.bounds), 'Incompatible building, Cover or terrain bounds.');
  check(whole(cm.width, 2, 8192) && whole(cm.height, 2, 8192) && hex(cm.compressedSha256), 'Invalid Cover metadata.');
  const coverBytes = read(world, cm.file);
  check(hash(coverBytes) === cm.compressedSha256, 'Cover archive checksum mismatch.');
  const cover = new Cover(cm.width, cm.height, gunzipSync(coverBytes, { maxOutputLength: cm.width * cm.height * 2 }));
  const [west, south, east, north] = tm.bounds;
  const p0 = project(west, north), p1 = project(east, south);
  const uv = { uv: (x, z) => [(x - p0.x) / (p1.x - p0.x), (z - p0.z) / (p1.z - p0.z)] };
  const distance = (x, z) => {
    check(x >= p0.x && x < p1.x && z >= p0.z && z < p1.z, 'Footprint sample outside declared Cover bounds.');
    return cover.legacyDistance(uv, x, z);
  };
  const pack = read(buildingDir, bm.file);
  check(whole(bm.count, 1, 300000) && pack.length === bm.bytes && hex(bm.sha256) && hash(pack) === bm.sha256
    && Array.isArray(bm.tiles) && bm.tileCompression === 'gzip', 'Invalid building pack or checksum.');
  const sorted = [...bm.tiles].sort((a,b) => a.offset - b.offset), seen = new Set();
  let end = 0, expectedRows = 0;
  for (const tile of sorted) {
    check(typeof tile.id === 'string' && /^q[0-3]+$/.test(tile.id) && !seen.has(tile.id)
      && whole(tile.bytes, 1, pack.length) && whole(tile.count, 1, bm.count) && tile.offset === end
      && end + tile.bytes <= pack.length && hex(tile.sha256), 'Invalid building range or tile identity.');
    end += tile.bytes; expectedRows += tile.count; seen.add(tile.id);
  }
  check(end === pack.length && expectedRows === bm.count, 'Building index does not cover the declared pack.');
  check(options.tile === undefined || seen.has(options.tile), 'Unknown building tile.');
  const groups = { allSampledDry: 0, mixed: 0, allSampledWet: 0, noInteriorSamples: 0 };
  const candidates = [];
  let rows = 0, tiles = 0;
  for (const tile of sorted) {
    if (options.tile !== undefined && tile.id !== options.tile) continue;
    const bytes = pack.subarray(tile.offset, tile.offset + tile.bytes);
    check(hash(bytes) === tile.sha256, 'Building tile checksum mismatch: ' + tile.id);
    const chunk = JSON.parse(gunzipSync(bytes, { maxOutputLength: 4_000_000 }));
    check(Array.isArray(chunk.features) && chunk.features.length === tile.count, 'Building tile row count mismatch.');
    tiles++;
    for (const [ordinal, row] of chunk.features.entries()) {
      const result = screenFootprint(row.footprint, row.holes, distance, grid);
      rows++;
      if (!result.wet && !result.dry) groups.noInteriorSamples++;
      else if (!result.wet) groups.allSampledDry++;
      else if (result.dry) groups.mixed++;
      else groups.allSampledWet++;
      if (!result.wet || limit === 0) continue;
      candidates.push({ tile: tile.id, ordinal, ...result, rowSha256: hash(JSON.stringify(row)) });
    }
  }
  candidates.sort((a, b) =>
    Number(a.dry > 0) - Number(b.dry > 0) || b.areaM2 - a.areaM2 || a.tile.localeCompare(b.tile) || a.ordinal - b.ordinal);
  return {
    scope: options.tile ?? 'province',
    source: { buildingIndex: hash(manifestBytes), buildingPack: bm.sha256, coverIndex: hash(coverManifestBytes),
      coverArchive: cm.compressedSha256, terrainIndex: hash(terrainBytes) },
    sampling: { grid, tiles, rows, groups },
    limitation: 'Original footprint versus stock coarse Cover only. Legitimate wharves, floating or raised structures, outlines and intentionally replaced shells can appear here. A count or sampled score does not qualify a removal, terrain edit or live rendering claim.',
    candidates: candidates.slice(0, limit),
  };
}

function main() {
  const opts = {};
  for (const arg of process.argv.slice(2)) {
    const m = /^--(tile|grid|limit)=(\w+)$/.exec(arg);
    check(m && !(m[1] in opts), 'Usage: node --experimental-strip-types tools/qa/coastal-buildings-census.mjs [--tile=q...] [--grid=16] [--limit=40]');
    if (m[1] !== 'tile') check(/^\d+$/.test(m[2]), 'Grid and limit must be whole numbers.');
    opts[m[1]] = m[1] === 'tile' ? m[2] : Number(m[2]);
  }
  const repo = fileURLToPath(new URL('../..', import.meta.url));
  process.stdout.write(JSON.stringify(runCensus(repo, opts), null, 2) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
