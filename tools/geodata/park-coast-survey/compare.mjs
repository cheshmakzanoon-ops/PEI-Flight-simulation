// Publication-time historical substrate check. No scene edits or hydrologic claim.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { project } from '../../../src/sim/geo.ts';
import { Terrain } from '../../../src/sim/terrain.ts';
import { Cover } from '../../../src/sim/cover.ts';

const [_node,_file,source,target]=process.argv;
const dir=new URL('../../../',import.meta.url);
const path=(f)=>fileURLToPath(new URL(f,dir));
const sha=v=>createHash('sha256').update(v).digest('hex');
const canBytes=readFileSync(path('data/cancoast-headland-study/segments.json'));
const parkBytes=readFileSync(source);
const {points,boundsWGS84:bounds}=JSON.parse(parkBytes);
const can=JSON.parse(canBytes)['Queens-Cavendish'].map(s=>({
  ...s, ab:s.segment.map(([lon,lat])=>project(lon,lat))
}));
assert.equal(can.length,271);
assert.deepEqual(bounds,[-63.458,46.474,-63.398,46.513]);
const main=JSON.parse(readFileSync(path('public/world/terrain.json'))),
      cover=JSON.parse(readFileSync(path('public/world/cover.json')));
const d=gunzipSync(readFileSync(path('public/world/'+main.file))),
      m=gunzipSync(readFileSync(path('public/world/'+cover.file)));
const terrainSHA=sha(d),coverSHA=sha(m);
assert.equal(terrainSHA,'661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d');
assert.equal(coverSHA,'e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9');
const t=new Terrain(main,Int16Array.from({length:d.length/2},(_,i)=>d.readInt16LE(2*i)));
const c=new Cover(cover.width,cover.height,m);
const fmt=n=>Math.round(n*1e4)/1e4;
function metric(xz,[a,b]){
  const dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz;
  assert.ok(den>0);
  const u=Math.max(0,Math.min(1,((xz.x-a.x)*dx+(xz.z-a.z)*dz)/den));
  return Math.hypot(xz.x-a.x-dx*u,xz.z-a.z-dz*u);
}
const byRows={};
for(const k of ['ground','remote']){
  const rows=points[k].map(r=>{
    assert.equal(r.substrate,'Till');
    const [lon,lat]=r.wgs84;
    assert.ok(lon>=bounds[0]&&lon<=bounds[2]&&lat>=bounds[1]&&lat<=bounds[3]);
    const p=project(lon,lat);
    const winner=can.map(s=>({s,dist:metric(p,s.ab)})).reduce((a,b)=>a.dist<=b.dist?a:b);
    return {line:r.csvLine,q:winner.s.number,fromHistoricalClassifierM:fmt(winner.dist),
      stockSignedApproximateCoastM:fmt(c.legacyDistance(t,p.x,p.z)),stockCover:c.sample(t,p.x,p.z),
      sourceClass:r.substrate,classifier:winner.s.material};
  });
  assert.equal(new Set(rows.map(r=>r.line)).size,rows.length);
  const pct=(key)=>{const a=rows.map(r=>r[key]).sort((a,b)=>a-b);
    return [0,.1,.5,.9,1].map(p=>a[Math.floor(p*(a.length-1))]);};
  const near=rows.filter(r=>r.fromHistoricalClassifierM<=25);
  byRows[k]={rows:rows.length,percentiles:[0,10,50,90,100],
   nearestClippedHistoricalClassifierM:pct('fromHistoricalClassifierM'),
   stockApproximateSignedCoastM:pct('stockSignedApproximateCoastM'),
   under25mBetweenHistoricalRecords:{count:near.length,
     agreedBroadTill:near.filter(r=>r.sourceClass==='Till'&&r.classifier==='Thick and continuous till').length},
   samples:rows};
}
assert.equal(byRows.ground.rows,60);
assert.equal(byRows.remote.rows,58);
const out={scope:'Compare two independent historical logs on their shared 2D spatial footprint, and separately report the decoded stock coastline screen. Do not infer a present shoreline, tidal or legal position, geology at sample resolution, or erosion rate.',
 pins:{terrainSHA,coverSHA,parkSHA:sha(parkBytes),canCoastSHA:sha(canBytes)},...byRows};
writeFileSync(target,JSON.stringify(out,null,2)+'\n',{flag:'wx'});
