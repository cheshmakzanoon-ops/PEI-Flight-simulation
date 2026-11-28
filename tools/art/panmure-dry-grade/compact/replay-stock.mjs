import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import * as T from 'three';
import {Terrain} from '../../../../src/sim/terrain.ts';
import {Cover} from '../../../../src/sim/cover.ts';
import {World} from '../../../../src/render/world.ts';
import {loadCoastalSurveys} from '../../../../src/sim/coastal-terrain.ts';
import {loadHarbourCover} from '../../../../src/sim/harbour-cover.ts';
const root=process.cwd()+'/public/';
assert(fs.existsSync(root+'world/terrain.json'),'run from the repo root after world setup');
const sha=b=>createHash('sha256').update(b).digest('hex'),ab=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const f=p=>fs.readFileSync(root+'world/'+p),j=p=>JSON.parse(f(p));
const t=j('terrain.json'),c=j('cover.json'),raw=gunzipSync(f(t.file)),cw=f(c.file),cr=gunzipSync(cw);
assert.equal(sha(raw),t.sha256);assert.equal(sha(cw),c.compressedSha256);
const url='http://local.invalid/world/';
const get=async input=>{try{return new Response(fs.readFileSync(root+new URL(input).pathname.slice(1)));}catch{return new Response(null,{status:404});}};
const [survey,harbour]=await Promise.all([loadCoastalSurveys(url,get),loadHarbourCover(url,get)]);
assert(survey.length>=2&&harbour);
const terrain=new Terrain(t,new Int16Array(ab(raw)),survey),cover=new Cover(c.width,c.height,new Uint8Array(ab(cr)),harbour,sha(cw),undefined,undefined,sha(cr));
const world=Object.assign(Object.create(World.prototype),{terrain,cover,pondMeshes:[],grades:new Map,byId:new Map,reliefActive:new Set,mat:new T.MeshBasicMaterial()});
import {WORLD_COLS,WORLD_ROWS} from '../../../../src/sim/coastal-terrain.ts';
const width=(terrain.right-terrain.left)/WORLD_COLS,depth=(terrain.bottom-terrain.top)/WORLD_ROWS;
const shape=(i,z,lod)=>{
 const x0=terrain.left+i*width,z0=terrain.top+z*depth,id=i+'-'+z;
 return {id,i,j:z,x0,z0,w:width,d:depth,lod,fine:world.patch(x0,z0,width,depth,lod)};
};
import {METRES_PER_LAT,METRES_PER_LON,ORIGIN} from '../../../../src/sim/geo.ts';
const dest=process.argv[2];assert(dest&&!fs.existsSync(dest));fs.mkdirSync(dest);
const o=shape(25,18,112);o.fine.updateMatrixWorld(true);const geom=o.fine.geometry;
assert.equal(geom.getAttribute('position').count,12769);assert.equal(geom.index.count,75264);
assert.equal(o.fine.userData.subdiv,112);assert(!o.fine.userData.localGrade&&!o.fine.userData.coastalSurvey);
const files={};
for(const [k,a] of [['position',geom.getAttribute('position')],['normal',geom.getAttribute('normal')],['uv',geom.getAttribute('uv')],['index',geom.index]]){
 const b=Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength);
 const name=k+'.'+(a.array instanceof Uint16Array?'u16le':'f32le');
 fs.writeFileSync(dest+'/'+name,b,{flag:'wx'});files[k]={name,bytes:b.length,sha:sha(b),components:a.itemSize};
}
const receipts={
 owner:o.id,n112:[o.i,o.j,o.lod],stockCellSize:[o.w/112,o.d/112],stockPlanBounds:[o.x0,o.z0,o.x0+o.w,o.z0+o.d],
 worldBounds:[terrain.left,terrain.top,terrain.right,terrain.bottom],worldProjection:{lon:ORIGIN.lon,lat:ORIGIN.lat,metresPerLon:METRES_PER_LON,metresPerLat:METRES_PER_LAT},
 source:{terrain:sha(raw),cover:sha(cr),coverCompressed:sha(cw),coverShape:[cover.width,cover.height]},
 matrix:o.fine.matrixWorld.elements,harbourPlan:[...cover.waterInsets.map(x=>x.bounds??null)],files,
 role:'CPU reconstruction using current repo exact regular N112 World.patch and pinned source; no actual GPU bytes, no active art.'};
fs.writeFileSync(dest+'/receipt.json',JSON.stringify(receipts,null,2)+'\n',{flag:'wx'});
