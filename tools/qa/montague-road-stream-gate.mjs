/** Exercise Roads.update on the real packed row owners, including the stock
 * 420m stream hysteresis and all visible window boundaries. */
import * as THREE from 'three';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {Terrain} from '../../src/sim/terrain.ts';
import {Cover} from '../../src/sim/cover.ts';
import {Roads,decodeRoads} from '../../src/render/roads.ts';
import {MONTAGUE_CUTS,APPROACH_START,APPROACH_STOP,montagueSection} from '../../src/sim/montague-bridge.ts';
import {roadContactAt} from '../../src/render/road-contact.ts';
import {loadMontagueFoundation} from '../../src/sim/montague-foundation.ts';
import {MONTAGUE_FOUNDATION as spec} from '../../src/sim/montague-foundation.generated.ts';
const file=f=>fs.readFileSync(new URL('../../public/world/'+f,import.meta.url));
const unpack=f=>gunzipSync(file(f));
const tm=JSON.parse(file('terrain.json')),cm=JSON.parse(file('cover.json')),binary=unpack(tm.file);
const a=new Int16Array(binary.buffer,binary.byteOffset,binary.byteLength/2);
const old=new Terrain(tm,a),soil=await loadMontagueFoundation('/',async()=>new Response(file(spec.asset)),500);
assert(soil);
const terrain=new Terrain(tm,a,[soil.ground]),c=unpack(cm.file);
const before=new Cover(cm.width,cm.height,c),after=new Cover(cm.width,cm.height,c,undefined,cm.compressedSha256,undefined,soil.water);
const archive=unpack('roads.bin.gz'),rows=decodeRoads(archive.buffer.slice(archive.byteOffset,archive.byteOffset+archive.byteLength));
const exactOwners=new Set(),stockTiles=new Map(),candidateTiles=new Map();
function insert(out,row,record){
 for(let i=1;i<row.points.length;i++){
  const a=row.points[i-1],b=row.points[i];
  const n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/500);
  for(let j=0;j<n;j++){
   const x=a.x+(b.x-a.x)*j/n,z=a.z+(b.z-a.z)*j/n,u=a.x+(b.x-a.x)*(j+1)/n,v=a.z+(b.z-a.z)*(j+1)/n;
   const tx=Math.floor((x+u)/10000),tz=Math.floor((z+v)/10000),key=tx+','+tz;
   if(record)exactOwners.add(key);
   const tile=out.get(key)??{x:(tx+.5)*5000,z:(tz+.5)*5000,segments:[]};
   tile.segments.push(x,z,u,v,row.flags);out.set(key,tile);
  }
 }
}
for(const r of MONTAGUE_CUTS)insert(stockTiles,rows[r],true);
insert(stockTiles,rows[15330],false);insert(candidateTiles,rows[15330],false);
assert.deepEqual([...exactOwners],['8,7']);
const taken=(t,c,tiles,preview)=>
 Reflect.construct(Roads,[new THREE.Scene(),tiles,t,undefined,undefined,undefined,undefined,preview?{cover:c}:undefined,[...exactOwners]]);
const b=taken(old,before,stockTiles,false),p=taken(terrain,after,candidateTiles,true);
const travels=[
 [42380,37342],[36131,30395],[30600,25600],[30200,25600],[30176,25600],[30750,25550],
 [30750,25160],[30750,25120],[30800,26101],[54512,49388],[54070,49388],[54450,49388],[54499,49499],
 [54850,49900],[53850,48880],[54300,49000],[54499,49399],[54500,49400],[55200,50000],
 [42380,50000],[42380,49380],[42380,24500],[42380,25510],[42380,25350],[42380,25000],
];
let visibleBeyondOriginal=0,exact=0,visible=0;
const states=[];
for(const [x,z] of travels){
 b.update(x,z);p.update(x,z);
 const expected=b.visible.has('8,7'),actual=p.previewBridge.visible;
 assert.equal(actual,expected);exact++;
 if(actual){visible++;if(Math.hypot(x-42380,z-37342)>9200)visibleBeyondOriginal++;}
 states.push({x,z,stockRoadTileVisible:expected,replacementVisible:actual});
}
assert(visibleBeyondOriginal>=5&&visible>0&&visible<travels.length);
const seat=roadContactAt({terrain,cover:after});
let seam=0;
for(const station of [APPROACH_START,APPROACH_STOP]){
 const {x,z,nx,nz}=montagueSection(station);
 for(let i=0;i<=120;i++){
  const d=-4.8+i*.08;
  assert.equal(seat.weight(x+nx*d,z+nz*d),0);seam++;
 }
}
const result={exactOwnerKeys:[...exactOwners],ownerAndHysteresisChecks:exact,
 casesPreservingVisibleRoadPastBroken9200M:visibleBeyondOriginal,zeroSeatedRoadWeightCrosslineProbes:seam,states};
console.log(JSON.stringify(result,null,2));
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');
