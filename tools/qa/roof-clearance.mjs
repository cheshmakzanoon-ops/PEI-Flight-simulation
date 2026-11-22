/** Independent exhaustive join of the original building rings against candidate stem centres.
 * `node --experimental-strip-types tools/qa/roof-clearance.mjs /path/to/full/project`
 * Does not read the bake tool, generated keys, key packing helper, or shared tree RNG.
 * All four million addressable tiles are compared by PUBLIC runtime API. No scenery changes.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';

const root=resolve(process.argv[2] || '.');
const read=relative => readFileSync(resolve(root, relative));
const sim=relative => import(pathToFileURL(resolve(root, 'src/sim', relative + '.ts')).href);
const [{Terrain}, {Cover}, {project,geographic}, {runwayAt}, {fillRoofTile}] = await Promise.all(
  ['terrain','cover','geo','places','tree-clearance'].map(sim));
const raw=gunzipSync(read('public/world/height.bin.gz'));
const terrain=new Terrain(JSON.parse(read('public/world/terrain.json')), new Int16Array(raw.buffer,raw.byteOffset,raw.byteLength/2));
const c=JSON.parse(read('public/world/cover.json'));
const cover=new Cover(c.width,c.height,gunzipSync(read('public/world/cover.bin.gz')));
const {tiles}=JSON.parse(read('public/world/buildings/index.json'));
const roofs=read('public/world/buildings/tiles.pack');
const reference=new Set();
const anchors={
  'Charlottetown':{...project(-63.128,46.235),r:3100},
  'Cavendish vicinity':{...project(-63.405,46.483),r:3300}
};
const selection={};

// Frozen, independent transcription of the original 12-m pitched stem distribution.
function random(col,row,seed) {
  let n=Math.imul(col^seed,2246822519)^Math.imul(row,3266489917);
  n=Math.imul(n^(n>>>15),2246822519);
  return ((n^(n>>>13))>>>0)/4294967296;
}
function contains(p,ring) {
  let inside=false;
  for(let k=0;k<ring.length;k++) {
    const a=ring[k], b=ring[(k+1)%ring.length];
    if((a.z>p.z)!==(b.z>p.z) && p.x<a.x+(p.z-a.z)*(b.x-a.x)/(b.z-a.z)) inside=!inside;
  }
  return inside;
}
// Actual cut-outs in the source must be respected. The format supports them even if this data cut has none.
const square=(x0,z0,x1,z1)=>[{x:x0,z:z0},{x:x1,z:z0},{x:x1,z:z1},{x:x0,z:z1}];
const exterior=square(0,0,10,10), courtyard=square(3,3,7,7);
const insideRoof=(p,outer,holes)=>contains(p,outer)&&!holes.some(h=>contains(p,h));
assert(insideRoof({x:2,z:5},exterior,[courtyard]));
assert(!insideRoof({x:5,z:5},exterior,[courtyard]));

let buildings=0,affected=0,stemRoofPairs=0,holesInSource=0;
for(const tile of tiles) {
  const features=JSON.parse(gunzipSync(roofs.subarray(tile.offset,tile.offset+tile.bytes))).features;
  for(const f of features) {
    buildings++;
    const ring=f.footprint.map(([lon,lat])=>project(lon,lat));
    const holes=(f.holes||[]).map(r=>r.map(([lon,lat])=>project(lon,lat)));
    holesInSource+=holes.length;
    const X=ring.map(p=>p.x), Z=ring.map(p=>p.z);
    const xmin=Math.min(...X),xmax=Math.max(...X),zmin=Math.min(...Z),zmax=Math.max(...Z);
    let count=0, tallestAbove=0;
    for(let j=Math.floor(zmin/12);j<=Math.floor(zmax/12);j++) for(let i=Math.floor(xmin/12);i<=Math.floor(xmax/12);i++) {
      const x=(i+random(i,j,11))*12,z=(j+random(i,j,84))*12;
      if(x<xmin||x>xmax||z<zmin||z>zmax||!insideRoof({x,z},ring,holes))continue;
      if(!terrain.isLand(x,z)||cover.sample(terrain,x,z)!==10||runwayAt(x,z))continue;
      reference.add(`${i},${j}`); count++;tallestAbove=Math.max(tallestAbove,8.2+random(i,j,35)*10.8-f.height);
    }
    if(!count)continue;
    affected++;stemRoofPairs+=count;
    const x=(xmin+xmax)/2,z=(zmin+zmax)/2;
    for(const [name,a] of Object.entries(anchors)) {
      const d=Math.hypot(a.x-x,a.z-z);
      if(d>a.r||xmax-xmin>70||zmax-zmin>70||f.height>13||tallestAbove<4)continue;
      const score=count+Math.min(tallestAbove,7)/30-d/14000;
      if(selection[name]?.score>=score)continue;
      selection[name]={...geographic(x,z),score,height:f.height,count,above:tallestAbove,fromAnchor:d};
    }
  }
}
let visited=0,nonempty=0,actual=0,unexpected=0;
const missing=new Set(reference), b=new Uint32Array(8);
// Query the entire supported signed tile plane, not just tiles with expected hits.
for(let z=-1024;z<1024;z++)for(let x=-1024;x<1024;x++) {
  const flagged=fillRoofTile(x,z,b); visited++;
  if(!flagged){assert.equal(b[0]|b[1]|b[2]|b[3]|b[4]|b[5]|b[6]|b[7],0);continue;}
  nonempty++;let tileCount=0;
  for(let n=0;n<256;n++) if((b[n>>>5]>>>(n&31))&1) {
    actual++;tileCount++;
    const key=`${16*x+(n%16)},${16*z+Math.floor(n/16)}`;
    if(!missing.delete(key))unexpected++;
  }
  assert(tileCount>0,'Runtime marked an empty tile');
}
const sha=createHash('sha256').update([...reference].sort().join('\n')).digest('hex');
console.log(JSON.stringify({buildings,affected,stemRoofPairs,uniqueExpected:reference.size,holesInSource,tilesChecked:visited,
  nonempty,actual,missing:missing.size,unexpected,referenceSetSHA256:sha,visualInspectionCandidates:selection},null,2));
assert.equal(missing.size,0,'Roof stem not excluded');assert.equal(unexpected,0,'Non-roof stem wrongly excluded');
