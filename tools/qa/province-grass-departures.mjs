/** Simulated neutral-control proof against actual stock height and exact parcel masks. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Terrain} from '../../src/sim/terrain.ts';
import {Cover} from '../../src/sim/cover.ts';
import {SITES} from '../../src/sim/places.ts';
import {spawn,step,neutral,FIXED_STEP} from '../../src/sim/flight.ts';
import {readFieldDirectory} from '../../src/sim/field-shards.ts';
const root=new URL('../../public/world/',import.meta.url),read=p=>readFileSync(new URL(p,root)),data=p=>gunzipSync(read(p));
const z=data('height.bin.gz'),c=data('cover.bin.gz'),m=JSON.parse(read('cover.json')), D=JSON.parse(read('terrain.json'));
const t=new Terrain(D,new Int16Array(z.buffer,z.byteOffset,z.length/2)),cover=new Cover(m.width,m.height,new Uint8Array(c.buffer,c.byteOffset,c.length));
const index=readFieldDirectory(Uint8Array.from(data('grass-study/index.fcr.gz')).buffer);assert(index);
const packs=new Map(),shards=new Map();
const parcel=(x,z)=>{
 const tx=Math.floor(x/1024),tz=Math.floor(z/1024),k=tx+':'+tz;
 if(!shards.has(k)){
  const r=index.cells.get(k);
  if(!r)shards.set(k,null);
  else{
   if(!packs.has(r.pack))packs.set(r.pack,read('grass-study/crop-'+String(r.pack).padStart(2,'0')+'.pack'));
   const p=packs.get(r.pack),raster=gunzipSync(p.subarray(r.offset,r.offset+r.size));
   assert.equal(raster.length,260*260*2);shards.set(k,raster);
  }
 }
 const d=shards.get(k);
 if(!d)return 0;
 const i=Math.floor((x-tx*1024)*.25)+2,j=Math.floor((z-tz*1024)*.25)+2;
 return d[(j*260+i)*2+1]/255;
};
const sample=(x,z)=>{const land=cover.distance(t,x,z)>=0;return {height:t.contactHeight(x,z,land),land,runway:false};};
const evidence=[];
for(const site of SITES.filter(s=>s.id.endsWith('-grassland'))){
 const f=spawn(site,sample),x0=f.x,z0=f.z;
 let min=1e5,overMask=0,peak=0,first=null;
 for(let k=0;k<15/FIXED_STEP;k++){
  step(f,neutral,sample,FIXED_STEP);
  const h=f.y-sample(f.x,f.z).height;min=Math.min(h,min);
  const q=parcel(f.x,f.z);peak=Math.max(q,peak);
  if(q>.50){overMask++;if(first===null)first=f.time;}
 }
 assert(f.status==='flying'&&overMask>100&&peak>.85&&min>60);
 evidence.push({id:site.id,surveyMaskFractionPeak:peak,firstQualifiedSeconds:first,verifiedStrongSamples:overMask,sampleIntervalSeconds:FIXED_STEP,
  leastStockGroundClearanceM:min,flightM:Math.hypot(f.x-x0,f.z-z0),mode:f.status});
}
assert.equal(evidence.length,3);
console.log(JSON.stringify(evidence,null,2));
