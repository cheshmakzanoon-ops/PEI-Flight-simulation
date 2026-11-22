import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';

const root = new URL('../public/world/', import.meta.url);
const asset = (file) => readFileSync(new URL(file, root));
const json = (file) => JSON.parse(asset(file));
const hash = (buffer) => createHash('sha256').update(buffer).digest('hex');

const terrain = json('terrain.json');
assert.deepEqual(terrain.bounds, [-64.47,45.94,-61.93,47.1]);
const raw = gunzipSync(asset(terrain.file));
assert.equal(hash(raw), terrain.sha256);
assert.equal(raw.length, terrain.width * terrain.height * 2);
let land = 0, min = Infinity, max = -Infinity;
for (let i=0; i<raw.length; i+=2) {
  const h = raw.readInt16LE(i);
  if (h === terrain.water) continue;
  land++; min=Math.min(h,min); max=Math.max(h,max);
}
assert.equal(land, terrain.landCells);
assert.ok(min >= -10 && max >= 130 && max <= 150);
const [west,south,east,north] = terrain.bounds;
for (const [label,lon,lat] of [
  ['West Prince',-64.1,46.86], ['Summerside',-63.79,46.4], ['Charlottetown',-63.13,46.25], ['Souris',-62.25,46.36],
]) {
  const x=Math.floor((lon-west)/(east-west)*terrain.width), y=Math.floor((north-lat)/(north-south)*terrain.height);
  assert.notEqual(raw.readInt16LE(2*(y*terrain.width+x)), terrain.water, label);
}
const color = json('color.sources.json');
assert.deepEqual(color.bounds,terrain.bounds);
const image=asset('color.webp');
assert.equal(image.toString('ascii',0,4),'RIFF');
assert.equal(image.toString('ascii',8,12),'WEBP');
assert.equal(hash(image),color.sha256);
assert.ok(color.landCoverage>=.995 && color.clearClassCoverage>=.995);

const road= json('roads.json');
const roadGzip = asset('roads.bin.gz');
assert.equal(hash(roadGzip),road.gzipSha256);
const r = gunzipSync(roadGzip);
assert.equal(hash(r),road.sha256);
assert.equal(r.toString('ascii',0,4),'PEIR');
assert.equal(r.readUInt16BE(4),1);
assert.equal(r.readUInt32BE(6),road.segments);
let total=0, i=10;
for(let k=0;k<road.segments;k++){
  const n=r.readUInt16BE(i), flags=r.readUInt8(i+2);
  assert.ok(n>=2 && flags<=31 && (flags&7)<=4);
  total+=n; i+=3;
  for(let j=0;j<n;j++,i+=8) {
    assert.ok(r.readUInt32BE(i)<=400000 && r.readUInt32BE(i+4)<=300000);
  }
}
assert.equal(i,r.length);
assert.equal(total,road.points);

const buildings=json('buildings/index.json');
const pack=asset('buildings/'+buildings.file);
assert.equal(pack.length,buildings.bytes);
assert.equal(hash(pack),buildings.sha256);
let offset=0,sum=0;
for(const tile of buildings.tiles){
  assert.equal(tile.offset,offset);
  const compressed=pack.subarray(offset,offset+tile.bytes);
  assert.equal(hash(compressed),tile.sha256);
  const decoded=JSON.parse(gunzipSync(compressed));
  assert.equal(decoded.features.length,tile.count);
  for (const {footprint,height,minHeight} of decoded.features) {
    assert.ok(Number.isFinite(height) && height>0 && height<60);
    assert.ok(Number.isFinite(minHeight) && minHeight<=height);
    assert.ok(footprint.length>=3);
    for(const [x,y] of footprint) assert.ok(x>=west && x<=east && y>=south && y<=north);
  }
  offset+=tile.bytes;
  sum+=tile.count;
}
assert.equal(offset,pack.length);
assert.equal(sum,buildings.count);
console.log(`World OK: ${land} elevation cells, ${color.landCoverage*100}% land imagery coverage, ${road.segments} road segments, ${sum} building footprints in ${buildings.tiles.length} tiles.`);

const detail=json('detail/index.json');
assert.deepEqual(detail.bounds,terrain.bounds);
assert.ok(detail.landCoverage>=.995 && detail.clearClassCoverage>=.995);
const buffers=detail.packs.map(p=>{
  const blob=asset('detail/'+p.file);
  assert.equal(blob.length,p.bytes);
  assert.equal(hash(blob),p.sha256);
  return blob;
});
const ends=Array(buffers.length).fill(0);
for(const [key,tile] of Object.entries(detail.tiles)){
  const [i,j]=key.split('-').map(Number);
  assert.ok(i>=0&&i<detail.columns&&j>=0&&j<detail.rows);
  const blob=buffers[tile.pack];
  assert.equal(tile.offset,ends[tile.pack]);
  const bytes=blob.subarray(tile.offset,tile.offset+tile.bytes);
  assert.equal(hash(bytes),tile.sha256);
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(bytes.toString('ascii',8,12),'WEBP');
  ends[tile.pack]+=tile.bytes;
}
assert.deepEqual(ends,detail.packs.map(p=>p.bytes));
console.log(`Near-detail imagery OK: ${Object.keys(detail.tiles).length} full-raster land tiles, ${detail.landCoverage*100}% covered land.`);
