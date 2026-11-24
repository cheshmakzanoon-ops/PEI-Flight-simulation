/** Source-derived conservative overlay extents only, no imagery or rendered state.
 * Run esbuild --bundle --platform=node --define:import.meta.env.BASE_URL='"/"'.
 */
import fs from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {Terrain} from '../../src/sim/terrain.ts';
import {project} from '../../src/sim/geo.ts';
import {decodeRoads} from '../../src/render/roads.ts';
import {loadSidewalks,walkSections} from '../../src/render/sidewalks.ts';
import {loadParkingSurfaces} from '../../src/render/parking-surfaces.ts';
import {SIDEWALKS} from '../../src/render/sidewalks.generated.ts';
import {MAPPED_PARKING} from '../../src/render/parking-surfaces.generated.ts';
import {RUNWAYS} from '../../src/sim/places.ts';
const pub='public/',W=pub+'world/';
const read=f=>fs.readFileSync(W+f),zip=f=>gunzipSync(read(f)),j=f=>JSON.parse(read(f));
const ab=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const dig=b=>createHash('sha256').update(b).digest('hex');
const tech=j('terrain.json'),h=zip('height.bin.gz'),cover=read('cover.bin.gz'),cs=j('cover.json');
const t=new Terrain(tech,new Int16Array(ab(h))); const road=zip('roads.bin.gz'),routes=decodeRoads(ab(road));
if(dig(h)!==tech.sha256||dig(cover)!==cs.compressedSha256)throw Error('unverified source terrain');
const step=24,x0=Math.floor(t.left/step)*step,z0=Math.floor(t.top/step)*step;
const [w,n]=[Math.ceil((t.right-x0)/step),Math.ceil((t.bottom-z0)/step)];
if(w>9000||n>6500)throw Error('guard extension unreviewed');
const row=Array.from({length:n},()=>new Uint8Array(w)),meta={};
function put(kind,a,b,pad){
 const [l,d,r,s]=[Math.min(a.x,b.x)-pad,Math.min(a.z,b.z)-pad,Math.max(a.x,b.x)+pad,Math.max(a.z,b.z)+pad];
 const minI=Math.max(0,Math.floor((l-x0)/step)),maxI=Math.min(w-1,Math.floor((r-x0)/step));
 const minJ=Math.max(0,Math.floor((d-z0)/step)),maxJ=Math.min(n-1,Math.floor((s-z0)/step));
 for(let z=minJ;z<=maxJ;z++)row[z].fill(1,minI,maxI+1);
 meta[kind]=(meta[kind]??0)+1;
}
function poly(kind,p,q){
 if(!p.length)throw Error('empty watched overlay');
 const a={x:Infinity,z:Infinity},b={x:-Infinity,z:-Infinity};
 for(const c of p){a.x=Math.min(a.x,c.x);a.z=Math.min(a.z,c.z);b.x=Math.max(b.x,c.x);b.z=Math.max(b.z,c.z);}
 put(kind,a,b,q);
}
const half=[2,2.8,3.6,4.8,6.4];
for(const u of routes)for(let k=1;k<u.points.length;k++){
 const a=u.points[k-1],b=u.points[k],dx=b.x-a.x,dz=b.z-a.z,L=Math.hypot(dx,dz);
 if(L<.05)continue;
 const m=Math.ceil(L/22);
 // Sign-safe padding of each centreline piece encompasses the exact
 // source road widths even when a physical ribbon is hidden/unavailable.
 for(let i=0;i<m;i++)put('road',{x:a.x+dx*i/m,z:a.z+dz*i/m},{x:a.x+dx*(i+1)/m,z:a.z+dz*(i+1)/m},half[u.flags&7]+2.00);
}
const pack=read('buildings/tiles.pack'),idx=j('buildings/index.json');
if(dig(pack)!==idx.sha256)throw Error('unverified AEB pack');
for(const f of idx.tiles){
 const take=pack.subarray(f.offset,f.offset+f.bytes);
 if(dig(take)!==f.sha256)throw Error('unverified AEB chunk '+f.id);
 for(const u of JSON.parse(gunzipSync(take)).features)if(u.footprint.length>=3)
  poly('roof',u.footprint.map(p=>project(p[0],p[1])),3.02);
}
const get=async u=>{
 const p=pub+new URL(u).pathname.slice(1);
 try{return new Response(fs.readFileSync(p));}catch{return new Response(null,{status:404});}
};
const [walk,park]=await Promise.all([loadSidewalks('http://local-pin/world/',get,10000),loadParkingSurfaces('http://local-pin/world/',get,10000)]);
if(!walk?.length||!park?.length)throw Error('unverified walking/parking pack');
for(const u of walk)for(const p of u.paths){
 const sections=walkSections(p);
 for(let i=1;i<sections.length;i++)poly('path',sections[i-1].concat(sections[i]),1.24);
}
for(const u of park)for(const lot of u.lots)for(const ring of lot[1].concat(lot[2]))
 poly('parking',ring[0].map(q=>({x:u.ox+q[0]*.001,z:u.oz+q[1]*.001})),1.28);
for(const q of RUNWAYS)put('airfield',q.p,q.q,q.width+22);
const first=[0],pairs=[];
let cells=0;
for(const z of row){
 for(let i=0;i<w;i++)if(z[i]){
  const start=i;
  while(i+1<w&&z[i+1])i++;
  pairs.push(start,i);cells+=i-start+1;
 }
 first.push(pairs.length/2);
}
const bytes=Buffer.alloc(24+4*first.length+2*pairs.length);
bytes.writeUInt32BE(0x46534831,0);bytes.writeInt32LE(x0,4);bytes.writeInt32LE(z0,8);
bytes.writeUInt16LE(w,12);bytes.writeUInt16LE(n,14);bytes.writeUInt16LE(step,16);
bytes.writeUInt16LE(1,18);bytes.writeUInt32LE(pairs.length/2,20);
for(let i=0;i<first.length;i++)bytes.writeUInt32LE(first[i],24+i*4);
for(let i=0;i<pairs.length;i++)bytes.writeUInt16LE(pairs[i],24+first.length*4+i*2);
const wire=gzipSync(bytes,{level:9});
const path='woodland/v1/canopy-receiver-fence-24m.bin.gz';
fs.writeFileSync(W+path,wire);
const pins={terrain:dig(h),cover:dig(cover),coverDecoded:dig(gunzipSync(cover)),road:dig(road),buildings:idx.sha256,sidewalk:SIDEWALKS.sha256,parking:MAPPED_PARKING.sha256};
const plan={path,x0,z0,width:w,height:n,strideM:step,wireBytes:wire.length,rawBytes:bytes.length,rawSha:dig(bytes),wireSha:dig(wire),pins};
fs.writeFileSync('src/render/canopy-fence.generated.ts','// Generated: conservative extents of existing attributed overlay data, not a new real landscape.\nexport const CANOPY_FENCE='+JSON.stringify(plan,null,2)+' as const;\n');
const note={...plan,sourcePaddedOverlays:meta,cells,runs:pairs.length/2};
fs.writeFileSync('docs/qa/canopy-receiver-fence-source.json',JSON.stringify(note,null,2)+'\n');console.log(JSON.stringify(note,null,2));
