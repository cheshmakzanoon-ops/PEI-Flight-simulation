/* Whole authoritative packed row intersection, even when both endpoints lie
   far outside the crop. No full-world raster, requests or asset edits. */
import fs from 'node:fs';import path from 'node:path';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {decodeRoads} from '../../../src/render/roads.ts';
import {loadSidewalks} from '../../../src/render/sidewalks.ts';
import {loadParkingSurfaces} from '../../../src/render/parking-surfaces.ts';
import {KINGS_DRY_CROWN as S} from '../../../src/sim/kings-dry-crown.generated.ts';
const pub=process.env.PEI_PUBLIC,base=process.env.SCOUT;assert(pub&&base);
const fetcher=async u=>{try{return new Response(fs.readFileSync(path.join(pub,String(u))));}catch{return new Response(null,{status:404});}};
const B=S.boundsXZ,extra=25;
const over=(x,z,X,Z,guard)=>x-guard<=B[2]&&X+guard>=B[0]&&z-guard<=B[3]&&Z+guard>=B[1];
const seg=(a,b,guard)=>over(Math.min(a.x,b.x),Math.min(a.z,b.z),Math.max(a.x,b.x),Math.max(a.z,b.z),guard);
const road=gunzipSync(fs.readFileSync(path.join(pub,'world/roads.bin.gz')));
const sha=a=>createHash('sha256').update(a).digest('hex');
assert.equal(sha(road),S.roadsSha256);
const rows=decodeRoads(road.buffer.slice(road.byteOffset,road.byteOffset+road.byteLength));
const walks=await loadSidewalks('/world/',fetcher);const parking=await loadParkingSurfaces('/world/',fetcher);assert(walks&&parking);
let nr=0,nw=0;
const possibleRoads=[],possibleWalks=[],possibleParks=[];
for(let q=0;q<rows.length;q++){
 const r=rows[q];for(let i=1;i<r.points.length;i++){nr++;if(seg(r.points[i-1],r.points[i],extra))possibleRoads.push({q,i,flags:r.flags,ends:[r.points[i-1],r.points[i]]});}
}
for(const t of walks)for(const p of t.paths)for(let i=1;i<p.points.length;i++){nw++;if(seg(p.points[i-1],p.points[i],extra))possibleWalks.push([t.id,i]);}
for(const a of parking)if(over(...a.box,extra))possibleParks.push(a.id);
const report={bounds:B,padMetres:extra,total:{rows:rows.length,roadChords:nr,walkChords:nw,parkingTiles:parking.length},
 possibleRoads,possibleWalks,possibleParks};
fs.writeFileSync(path.join(base,'whole-actors-influence.json'),JSON.stringify(report,null,2)+'\n');
assert(!possibleRoads.length&&!possibleWalks.length&&!possibleParks.length,JSON.stringify(report));console.log(report);
