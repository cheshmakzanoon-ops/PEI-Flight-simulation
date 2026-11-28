/** Offline selection screen for route-scale terrain work. NOT a browser/render or flight-safety test. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { geographic } from '../../src/sim/geo.ts';
import { Terrain } from '../../src/sim/terrain.ts';
import { Cover } from '../../src/sim/cover.ts';
import { SITES, KINGS_MAPPED_FARMLAND_DEPARTURE, PRINCE_MAPPED_FARMLAND_DEPARTURE, runwayAt } from '../../src/sim/places.ts';
import { neutral, FIXED_STEP, spawn, step } from '../../src/sim/flight.ts';
import { ReliefSeed, PARENT_INTERVALS as P } from '../../src/sim/relief-seed.ts';
import { RELIEF_INDEX_SHA } from '../../src/sim/relief-index.generated.ts';
import { validReliefPlan } from '../../src/sim/relief-pack.ts';
import { POINT_PRIM_DEPARTURE } from '../../src/render/point-prim/admit.ts';
import { REGIONAL_CANOPY_DEPARTURES } from '../../src/render/regional-canopy/departures.ts';

const hash=b=>createHash('sha256').update(b).digest('hex');
const world=new URL('../../public/world/',import.meta.url);
const bytes=f=>readFileSync(new URL(f,world));
const json=b=>JSON.parse(b);
const terrainSpec=json(bytes('terrain.json')),coverSpec=json(bytes('cover.json'));
assert.deepEqual(terrainSpec.bounds,coverSpec.bounds);
const coverArchive=bytes(coverSpec.file),rawTerrain=gunzipSync(bytes(terrainSpec.file)),rawCover=gunzipSync(coverArchive);
const terrainSHA=hash(rawTerrain),coverSHA=hash(rawCover);
assert.equal(terrainSHA,terrainSpec.sha256);
assert.equal(coverSHA,'e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9');
const terrain=new Terrain(terrainSpec,Int16Array.from({length:rawTerrain.length/2},(_,i)=>rawTerrain.readInt16LE(i*2)));
const cover=new Cover(coverSpec.width,coverSpec.height,rawCover);
const indexBytes=bytes('terrain-adaptive/v1/index.json');
assert.equal(hash(indexBytes),RELIEF_INDEX_SHA);
const index=json(indexBytes),roads=json(bytes('roads.json')),buildings=json(bytes('buildings/index.json'));
assert.deepEqual(index.bounds,terrainSpec.bounds);
assert.equal(hash(coverArchive),coverSpec.compressedSha256);
assert.equal(hash(gunzipSync(bytes('roads.bin.gz'))),roads.sha256);
assert.equal(hash(bytes('buildings/'+buildings.file)),buildings.sha256);
assert.ok(validReliefPlan(index,{terrain:terrainSHA,cover:coverSpec.compressedSha256,road:roads.sha256,buildings:buildings.sha256,
  hedges:hash(bytes('woodland/hedgerows-v1/index.json'))}),'relief index base pins');
const packed=index.packs.map(p=>{
  const b=bytes('terrain-adaptive/v1/'+p.file);
  assert.equal(b.length,p.bytes);assert.equal(hash(b),p.sha256);return b;
});
const W=(terrain.right-terrain.left)/index.cols,H=(terrain.bottom-terrain.top)/index.rows;
const sidewalkVeto='8-13';
const tileData=[],flat=[];
for(const item of index.tiles){
  const [column,row]=item.id.split('-').map(Number),x=terrain.left+column*W,z=terrain.top+row*H;
  const chunk=packed[item.pack].subarray(item.offset,item.offset+item.bytes);
  assert.equal(hash(chunk),item.archiveSha256);
  const bin=gunzipSync(chunk,{maxOutputLength:360000});assert.equal(hash(bin),item.sha256);
  const seed=new ReliefSeed(bin.buffer.slice(bin.byteOffset,bin.byteOffset+bin.byteLength),true,item.cells);
  let moat=0,dry=0,finite=0;
  for(let j=1;j<P-1;j++)for(let i=1;i<P-1;i++){
    if(!seed.accepts(i,j))continue;
    if(i<=1||j<=1||i>=P-2||j>=P-2){moat++;continue;}
    const u=(i+.5)/P,v=(j+.5)/P,lx=x+u*W,lz=z+v*H;
    if(!terrain.isLand(lx,lz)||cover.legacyDistance(terrain,lx,lz)<=0)continue;
    dry++;
    if(!Number.isFinite(seed.height(u,v)))continue;
    finite++;
    if(item.id!==sidewalkVeto)flat.push({x:lx,z:lz,tile:item.id,col:i,row:j});
  }
  tileData.push({tile:item.id,mask:item.cells,outerVisibleMoat:moat,dryCentre:dry,supportedDryCentre:finite});
}
const fmt=(n,k=3)=>Number(n.toFixed(k));
const dist=(x,z,p)=>Math.hypot(x-p.x,z-p.z);
function squaredDistance(p,a,b){
 const x=b.x-a.x,z=b.z-a.z,l=x*x+z*z;
 const f=l?Math.max(0,Math.min(1,((p.x-a.x)*x+(p.z-a.z)*z)/l)):0;
 return (p.x-a.x-x*f)**2+(p.z-a.z-z*f)**2;
}
function surface(x,z){
  const land=cover.legacyDistance(terrain,x,z)>=0,r=runwayAt(x,z);
  return {land,runway:!!r,height:terrain.contactHeight(x,z,land)};
}
const lengthSeconds=18,rayWidth=250;
const places=[...SITES,POINT_PRIM_DEPARTURE,...REGIONAL_CANOPY_DEPARTURES,KINGS_MAPPED_FARMLAND_DEPARTURE,PRINCE_MAPPED_FARMLAND_DEPARTURE];
assert.equal(new Set(places.map(s=>s.id)).size,places.length);
const result=[];
for(const s of places){
  if(s.runway){result.push({route:s.id,region:s.region,excluded:'runway start: no takeoff inputs are simulated'});continue;}
  const f=spawn(s,surface),start={x:f.x,z:f.z};
  const pts=[{...start,time:0,agl:f.y-surface(f.x,f.z).height,land:surface(f.x,f.z).land}];
  for(let i=1;i<=90*lengthSeconds;i++){
    step(f,neutral,surface,FIXED_STEP);
    if(i%90===0||f.status!=='flying')pts.push({x:f.x,z:f.z,time:f.time,
      agl:f.y-surface(f.x,f.z).height,land:surface(f.x,f.z).land});
    if(f.status!=='flying')break;
  }
  const bx=[Math.min(...pts.map(p=>p.x))-rayWidth,Math.max(...pts.map(p=>p.x))+rayWidth],
        bz=[Math.min(...pts.map(p=>p.z))-rayWidth,Math.max(...pts.map(p=>p.z))+rayWidth];
  const local=flat.filter(p=>p.x>=bx[0]&&p.x<=bx[1]&&p.z>=bz[0]&&p.z<=bz[1]);
  const near=[],tiles=new Set(),segments=pts.slice(1);
  for(const p of local){
    const d=segments.reduce((min,b,i)=>Math.min(min,squaredDistance(p,pts[i],b)),Infinity);
    if(d<=rayWidth**2){near.push({tile:p.tile,col:p.col,row:p.row,d:Math.sqrt(d)});tiles.add(p.tile);}
  }
  near.sort((a,b)=>a.d-b.d||a.tile.localeCompare(b.tile)||a.row-b.row||a.col-b.col);
  const closest=near[0],a=pts[Math.min(12,pts.length-1)];
  const wgs=geographic(a.x,a.z);
  result.push({route:s.id,region:s.region,modelSeconds:fmt(f.time),modelStatus:f.status,maxApproximateAGL:fmt(Math.max(...pts.map(p=>p.agl))),
    travelFromSpawnM:fmt(dist(f.x,f.z,start)),
    scoutAnchor:{modelSeconds:fmt(a.time),wgs84:[fmt(wgs.lon,9),fmt(wgs.lat,9)]},landSamplesOnCourse:pts.filter(p=>p.land).length,sampleCount:pts.length,
    candidateCentresWithin250M:near.length,candidateTiles:[...tiles].sort(),
    closestSignedCandidate:closest?{id:closest.tile,col:closest.col,row:closest.row,metresFromCourse:fmt(closest.d)}:null});
}
const predicted=result.filter(r=>!r.excluded),county={};
for(const r of predicted){
  const c=county[r.region]??={neutralTracks:0,tracksWithAnyCandidate:0,tracksFullyBelow175M:0};
  c.neutralTracks++;c.tracksWithAnyCandidate+=+(r.candidateCentresWithin250M>0);
  c.tracksFullyBelow175M+=+(r.maxApproximateAGL<175);
}
const out={scope:'Uninstrumented inputs to stock fixed-step dynamics and legacy cover only; no visuals, authenticated optional route append, current topography or live admission claim.',
 assumptions:{startRoster:'Base geography, the ordinary Point Prim offering, declared mapped farmland and regional canopy routes; excludes separately authenticated route appends.',
  centreBounds:'Exact signed mask after a one-extra-cell inner moat and the known 8-13 hard safety veto. Uses dry, source-finite cell centres only.',
  uncertainty:'18 neutral seconds with one-second position interpolation through existing short-course model; excludes special coastal/inland surveys, dynamics of scenery assets, camera/LOD/stream readiness, and side excursions.',
  halfWidthM:rayWidth},pins:{terrainSHA,coverSHA,reliefIndexSHA:RELIEF_INDEX_SHA},
 actualTerrainCandidates:{maskTiles:tileData.length,signedCells:tileData.reduce((n,t)=>n+t.mask,0),screenedDryCentreCount:flat.length,
   representedParentCellAreaKm2:fmt(flat.length*W*H/P**2/1e6),approximateTerrainRasterLandKm2:fmt(terrainSpec.landCells*(W*index.cols)*(H*index.rows)/(terrainSpec.width*terrainSpec.height)/1e6)},siteGroups:county,
 screen:result.sort((a,b)=>a.route.localeCompare(b.route))};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(out,null,2)+'\n',{flag:'wx'});
else console.log(JSON.stringify(out,null,2));
