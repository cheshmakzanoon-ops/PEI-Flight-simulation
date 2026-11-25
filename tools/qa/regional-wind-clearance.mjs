import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {project} from '../../src/sim/geo.ts';
import {decodeRoads} from '../../src/render/roads.ts';
import {decodeSidewalks} from '../../src/render/sidewalks.ts';
import {SIDEWALKS} from '../../src/render/sidewalks.generated.ts';
import {decodeParkingSurfaces} from '../../src/render/parking-surfaces.ts';
import {MAPPED_PARKING} from '../../src/render/parking-surfaces.generated.ts';
const [repo,outFile]=process.argv.slice(2);if(!repo||!outFile)throw Error('Usage: node bundled-clearance.mjs repo output.json');
const root=resolve(repo,'public/world');
const load=p=>readFileSync(resolve(root,p)),j=p=>JSON.parse(load(p));
const sha=b=>createHash('sha256').update(b).digest('hex'),ab=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.length);
const segGap=(p,a,b)=>{const x=b[0]-a[0],z=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*z)/Math.max(x*x+z*z,1e-10)));return Math.hypot(p[0]-a[0]-t*x,p[1]-a[1]-t*z)};
const contains=(p,poly)=>{
 let yes=false;for(const[a,b] of poly.map((x,i)=>[x,poly[(i+1)%poly.length]])){
  if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<a[0]+(p[1]-a[1])*(b[0]-a[0])/(b[1]-a[1]))yes=!yes;
 }return yes;
};

const register=JSON.parse(readFileSync(resolve(repo,'data/regional-wind/locations.json'))).turbines;
const units=register.map(u=>{const {x,z}=project(u.longitude,u.latitude);return {id:u.id,farm:u.farm,longitude:u.longitude,latitude:u.latitude,p:[x,z],guard:3,near:{road:null,building:null,sidewalk:null,parking:null}}});
const scan=(kind,poly,half,owner,closed, set=units)=>{
 const lo=[Infinity,Infinity],hi=[-Infinity,-Infinity];for(const q of poly)for(let i=0;i<2;i++){lo[i]=Math.min(lo[i],q[i]);hi[i]=Math.max(hi[i],q[i]);}
 for(const u of set){const p=u.p; if(p[0]<lo[0]-165||p[0]>hi[0]+165||p[1]<lo[1]-165||p[1]>hi[1]+165)continue;
  let d=closed&&contains(p,poly)?0:Infinity;for(let i=1;i<poly.length;i++)d=Math.min(d,segGap(p,poly[i-1],poly[i]));if(closed)d=Math.min(d,segGap(p,poly.at(-1),poly[0]));
  d-=half;if(!u.near[kind]||d<u.near[kind].distance)u.near[kind]={...owner,distance:d};
 }};const P=({x,z})=>[x,z];
const ro=gunzipSync(load('roads.bin.gz'));const road=sha(ro);assert.equal(road,j('roads.json').sha256);for(const [i,r] of decodeRoads(ab(ro)).entries())scan('road',r.points.map(P),[2,2.8,3.6,4.8,6.4][r.flags&7],{row:i},false);
const b=j('buildings/index.json'),packed=load('buildings/tiles.pack');assert.equal(sha(packed),b.sha256);for(const t of b.tiles){const [W,S,E,N]=t.bounds; const near=units.filter(u=>u.longitude>W-.003&&u.longitude<E+.003&&u.latitude>S-.003&&u.latitude<N+.003);if(!near.length)continue;
 const zz=packed.subarray(t.offset,t.offset+t.bytes);assert.equal(sha(zz),t.sha256);
 for(const [i,f] of JSON.parse(gunzipSync(zz)).features.entries())scan('building',f.footprint.map(pt=>P(project(...pt))),0,{tile:t.id,ordinal:i,height:f.height},true,near);}
const wa=gunzipSync(load(SIDEWALKS.asset));assert.equal(sha(wa),SIDEWALKS.sha256);
for(const t of decodeSidewalks(ab(wa)))for(const [i,r] of t.paths.entries())scan('sidewalk',r.points.map(P),r.width/2,{tile:t.id,row:i},false);
const pa=gunzipSync(load(MAPPED_PARKING.asset));assert.equal(sha(pa),MAPPED_PARKING.sha256);
for(const t of decodeParkingSurfaces(ab(pa)))for(const [row,p] of t.lots.entries())for(const group of p.slice(1))for(const polygon of group)scan('parking',polygon[0].map(([x,z])=>[t.ox+x*.001,t.oz+z*.001]),0,{tile:t.id,row},true);
assert.equal(units.length,74);for(const u of units)for(const n of Object.values(u.near))assert(!n||n.distance>3,u.id);
const out={method:'Actual original AEB/NRN/mapped parking/walkways signed geometry. Distance from exact registered mast XY to nearest footprint/ribbon within or incident on conservative 165m search. Negative road means one ordinary centerline ribbon contains the register, not a survey of the true tower/pad.',pins:{road,building:b.sha256,sidewalk:SIDEWALKS.sha256,parking:MAPPED_PARKING.sha256},units};
writeFileSync(outFile,JSON.stringify(out,null,2)+'\n');
for(const u of units)for(const [k,v] of Object.entries(u.near))if(v&&v.distance<=3.0)console.log('CONFLICT',u.id,k,v);
for(const k of ['road','building','parking','sidewalk'])console.log(k,units.filter(u=>u.near[k]).length,Math.min(...units.map(u=>u.near[k]?.distance??Infinity)));
