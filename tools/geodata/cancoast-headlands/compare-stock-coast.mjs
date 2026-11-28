/** Historical substrate is a regional cue; stock and measured masks keep their own authority. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';
const [root,wPath,dest]=process.argv.slice(2),url=f=>pathToFileURL(resolve(root,f));
const sha=v=>createHash('sha256').update(v).digest('hex');
const read=f=>readFileSync(url(f)),json=f=>JSON.parse(read(f));
const [{project},{Terrain},{Cover}]=await Promise.all(['geo','terrain','cover'].map(f=>import(url('src/sim/'+f+'.ts'))));
const dem=json('public/world/terrain.json'),coverSpec=json('public/world/cover.json');
const bytes=gunzipSync(read('public/world/'+dem.file)),cov=gunzipSync(read('public/world/'+coverSpec.file));
assert.equal(sha(bytes),'661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d');
assert.equal(sha(cov),'e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9');
const T=new Terrain(dem,Int16Array.from({length:bytes.length/2},(_,i)=>bytes.readInt16LE(i*2))),C=new Cover(coverSpec.width,coverSpec.height,cov);
const h=readFileSync(wPath),g=JSON.parse(h),rows={};
function distribution(x){
 x.sort((a,b)=>a-b);return [0,.1,.5,.9,1].map(p=>x[Math.floor((x.length-1)*p)]);
}
const known=['Prince-North-Cape','Queens-Cavendish','Kings-East-Point'];
assert.deepEqual(Object.keys(g),known);
for(const k of known){
 const phases=g[k],classes={};
 for(const {material,segment,number} of phases){
  assert.ok(Number.isInteger(number)&&number>0&&typeof material==='string');
  const [a,b]=segment.map(([lon,lat])=>project(lon,lat));
  const ux=b.x-a.x,uz=b.z-a.z,size=Math.hypot(ux,uz),nx=uz/size,nz=-ux/size;
  assert.ok(size>0&&size<20000&&Number.isFinite(nx+nz));
  const n=Math.max(1,Math.ceil(size/5));const q=classes[material]??={samples:[],pairs:[],classes:{},length:0,scanned:0,uniqueSourceRows:new Set()};
  q.length+=size;q.uniqueSourceRows.add(number);
  for(let j=0;j<n;j++){
   const t=(j+.5)/n,x=a.x+t*ux,z=a.z+t*uz;
   const base=C.legacyDistance(T,x,z),code=C.sample(T,x,z);
   q.samples.push(base);q.classes[code]=(q.classes[code]??0)+1;
   const p=C.legacyDistance(T,x+nx*36,z+nz*36),m=C.legacyDistance(T,x-nx*36,z-nz*36);
   // No extrapolation from an ambiguous formerly wet point or all-dry counterpart.
   if(p< -4&&m>4||p>4&&m< -4){
    const s=p>4?1:-1;
    const dx=x+s*nx*36,dz=z+s*nz*36;
    q.pairs.push({dryY:T.meshElevation(dx,dz),dryLand:T.isLand(dx,dz),dryClass:C.sample(T,dx,dz)});
   }
   q.scanned++;
  }
 }
 rows[k]=Object.fromEntries(Object.entries(classes).map(([q,s])=>[q,{
  sourceCount:s.uniqueSourceRows.size,approxGeometryLengthM:Number(s.length.toFixed(3)),samples:s.scanned,
  stockSignedDistanceFromHistoricalTraceM:distribution(s.samples).map(z=>Number(z.toFixed(4))),
  stockCoverCountsAlongHistoricalTrace:s.classes,clearOpposedStockWetDryPairs36M:s.pairs.length,
  medianCurrentCoarseDryGroundM:s.pairs.length?distribution(s.pairs.map(x=>x.dryY))[2]:null,
  exactTerrainLandFlagsInDryPairs:s.pairs.filter(x=>x.dryLand).length
 }]));
}
const out={scope:'Replay of historical federal material attributes against current stock decoded atlas. No color, erosion forecast, cross-shore boundary, survey alignment or sea-level changes.',
 geometrySHA256:sha(h),method:'Historical polyline in lon/lat -> simulator metre tangent scale; midpoints at at most 5 m. Compare bundled stock approximate signed distance (positive=dry). ±36 m along the tangent-derived left/right to inventory conservative stock sign agreements only.',
 outputs:rows};
writeFileSync(dest,JSON.stringify(out,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(rows,null,1));
