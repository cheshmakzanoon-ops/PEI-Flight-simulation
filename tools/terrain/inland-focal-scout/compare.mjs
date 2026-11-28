/** Compare unresampled native source centres with the regular atlas 112 mesh. Offline only. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { PlaneGeometry } from 'three';
import { project } from '../../../src/sim/geo.ts';
import { Terrain } from '../../../src/sim/terrain.ts';
import { Cover } from '../../../src/sim/cover.ts';
import { WORLD_COLS, WORLD_ROWS, GROUND_LIFT, SURVEY_LOD, facet } from '../../../src/sim/coastal-terrain.ts';

const [source,output]=process.argv.slice(2);
assert.ok(source&&output,'Usage: compare.mjs DATA_DIRECTORY NEW_REPORT.json');
const world=new URL('../../../public/world/',import.meta.url);
const worldRead=f=>readFileSync(new URL(f,world));
const input=f=>readFileSync(resolve(source,f));
const sha=b=>createHash('sha256').update(b).digest('hex');
const terrainSpec=JSON.parse(worldRead('terrain.json')),coverSpec=JSON.parse(worldRead('cover.json'));
const tRaw=gunzipSync(worldRead(terrainSpec.file)),cRaw=gunzipSync(worldRead(coverSpec.file));
const terrainSHA=sha(tRaw),coverSHA=sha(cRaw);
assert.equal(terrainSHA,'661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d');
assert.equal(coverSHA,'e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9');
const signed16=b=>Int16Array.from({length:b.length/2},(_,i)=>b.readInt16LE(i*2));
const t=new Terrain(terrainSpec,signed16(tRaw)),c=new Cover(coverSpec.width,coverSpec.height,cRaw);
const wire=input('intake.json'),m=JSON.parse(wire);
const D=320,N=SURVEY_LOD,A=N+1,width=(t.right-t.left)/WORLD_COLS,depth=(t.bottom-t.top)/WORLD_ROWS;
assert.deepEqual([m.width,m.height,N,WORLD_COLS,WORLD_ROWS,GROUND_LIFT],[D,D,112,32,22,.12]);
const patches=new Map();
function patch(column,row){
 const id=column+'-'+row,old=patches.get(id);if(old)return old;
 const midX=t.left+(column+.5)*width,midZ=t.top+(row+.5)*depth;
 const g=new PlaneGeometry(width,depth,N,N).rotateX(-Math.PI/2);
 const pos=g.getAttribute('position');
 for(let k=0;k<pos.count;k++)pos.setY(k,t.atlasElevation(pos.getX(k)+midX,pos.getZ(k)+midZ)+GROUND_LIFT);
 const X=Float64Array.from({length:A},(_,i)=>pos.getX(i)+midX);
 const Z=Float64Array.from({length:A},(_,j)=>pos.getZ(j*A)+midZ);
 const ys=Float32Array.from({length:pos.count},(_,j)=>pos.getY(j));
 assert.equal(g.index.count,N*N*6);
 g.dispose();
 patches.set(id,{id,X,Z,ys});return patches.get(id);
}
function index(a,q){
 let l=0,r=a.length-1;
 assert.ok(q>=a[l]-.001&&q<=a[r]+.001);
 while(r-l>1){const y=(l+r)>>1;if(q<a[y])r=y;else l=y;}
 return l;
}
function mesh(x,z){
 const [u,v]=t.uv(x,z),q=patch(Math.floor(u*WORLD_COLS),Math.floor(v*WORLD_ROWS));
 const i=index(q.X,x),j=index(q.Z,z),k=j*A+i;
 const U=(x-q.X[i])/(q.X[i+1]-q.X[i]),V=(z-q.Z[j])/(q.Z[j+1]-q.Z[j]);
 return {base:facet(U,V,q.ys[k],q.ys[k+1],q.ys[k+A],q.ys[k+A+1])-GROUND_LIFT,tile:q.id,col:i,row:j};
}
const fmt=n=>Math.round(n*1e4)/1e4;
function pct(v){
 if(!v.length)return null;
 const a=[...v].sort((a,b)=>a-b);
 return [0,.1,.5,.9,1].map(p=>fmt(a[Math.floor(p*(a.length-1))]));
}
function compare(w){
 assert.match(w.route,/^[a-z-]+$/);assert.equal(w.file,w.route+'.cm.i16.gz');
 const compressed=input(w.file);
 assert.equal(sha(compressed),w.compressedSHA256);
 const raw=gunzipSync(compressed,{maxOutputLength:D*D*2});assert.equal(sha(raw),w.publishedInt16Sha256);
 assert.equal(raw.length,D*D*2);assert.deepEqual(w.geoTransform.slice(1,3),[1,0]);assert.deepEqual(w.geoTransform.slice(4),[0,-1]);
 const vals=signed16(raw);
 assert.ok(vals.every(y=>y!==-32768));
 const [west,,,north]=w.geoTransform,lines=Array.from(vals,(_,k)=>[west+k%D+.5,north-Math.floor(k/D)-.5].join(' '));
 const gp=spawnSync('gdaltransform',['-s_srs','EPSG:3979','-t_srs','EPSG:4326'],{
   input:lines.join('\n')+'\n',encoding:'utf8',maxBuffer:20*1024*1024,env:{...process.env,LC_ALL:'C',PROJ_NETWORK:'OFF'},
 });
 assert.equal(gp.status,0,gp.stderr);
 const points=gp.stdout.trim().split('\n');assert.equal(points.length,vals.length);
 const deltas=[],byClass={},local={};
 let wet=0;
 for(let k=0;k<points.length;k++){
  const [lon,lat,zDatum]=points[k].split(/\s+/).map(Number);
  assert.ok(Math.abs(lon-w.reportedAnchor.wgs84[0])<.006&&Math.abs(lat-w.reportedAnchor.wgs84[1])<.006&&zDatum===0);
  const {x,z}=project(lon,lat);
  if(!t.isLand(x,z)||c.legacyDistance(t,x,z)<=80){wet++;continue;}
  const base=mesh(x,z),y=vals[k]/100,residual=y-base.base,
        classCode=c.sample(t,x,z),cell=base.tile+'/'+base.col+'/'+base.row;
  const old=local[cell]??{v:[],open:0};
  old.v.push(residual);old.open+=+(classCode===30||classCode===40);local[cell]=old;
  (byClass[classCode]??=[]).push(residual);
  deltas.push(residual);
 }
 const cells=Object.entries(local).filter(([,q])=>q.v.length>=1500&&q.open/q.v.length>=.90).map(([cell,q])=>({
   cell,dryCentreSamples:q.v.length,grassCroplandFraction:fmt(q.open/q.v.length),
   forecastAbsoluteHeightSeparationM:pct(q.v.map(Math.abs))[3]
 }));
 cells.sort((a,b)=>b.forecastAbsoluteHeightSeparationM-a.forecastAbsoluteHeightSeparationM||a.cell.localeCompare(b.cell));
 return {route:w.route,keptNativeCentres:deltas.length,omittedForDryScreen:wet,percentiles:[0,10,50,90,100],
  measuredMinusRegularStockM:pct(deltas),absoluteSeparationM:pct(deltas.map(Math.abs)),
  decoded2021Cover:Object.fromEntries(Object.entries(byClass).map(([klass,v])=>[klass,{samples:v.length,
    signedM:pct(v),absoluteM:pct(v.map(Math.abs))}])),
  openGroundScreen:cells.slice(0,4)};
}
assert.deepEqual(m.windows.map(t=>t.route),['miscouche-woodlot-pass','hunter-river-trail','kings-meadow-low']);
const windows=m.windows.map(compare);
const report={scope:'Approximate detached bare-earth comparison to a reconstructed regular 112 mesh, without stock local relief, road/building/plant masks or render/collision. These are not live elevations, quality percentages or admission.',
 pins:{terrainSHA,coverSHA,intakeSHA:sha(wire)}, method:'Geotransform unwarped 1 m source pixel centres (local CGVD2013 values) to sim horizontal projection. Use the regular stock 112 Float32 lattice, original facet interpolation, remove 0.12 m visual lift. Keep only base terrain/cover land centres >80 m from approximate coast. Open-ground rule is decoded WorldCover 30/40, not independent proprietary imagery or protected-obstacle scope.',
 windows};
writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
