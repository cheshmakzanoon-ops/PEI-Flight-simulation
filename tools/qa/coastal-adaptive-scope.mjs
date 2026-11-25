import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import * as T from 'three';
import {Terrain} from '../../src/sim/terrain.ts';
import {Cover} from '../../src/sim/cover.ts';
import {World} from '../../src/render/world.ts';
import {loadCoastalSurveys} from '../../src/sim/coastal-terrain.ts';
import {loadHarbourCover} from '../../src/sim/harbour-cover.ts';
const root=process.cwd()+'/public/';
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
import {project} from '../../src/sim/geo.ts';
import {ReliefSeed} from '../../src/sim/relief-seed.ts';
import {adaptiveGround} from '../../src/render/adaptive-ground.ts';
import {WORLD_COLS,WORLD_ROWS} from '../../src/sim/coastal-terrain.ts';
const dims=[(terrain.right-terrain.left)/WORLD_COLS,(terrain.bottom-terrain.top)/WORLD_ROWS];
const index=j('terrain-adaptive/v1/index.json');
const controls=JSON.parse(fs.readFileSync('docs/qa/coastal-terrain-intake-sites.json','utf-8'));
const contains=new Set(terrain.coastalGrids.map(g=>g.spec.tileX+'-'+g.spec.tileZ));
const summary={};
for(const q of controls){
 const p=project(q.lon,q.lat);const i=Math.floor((p.x-terrain.left)/dims[0]),k=Math.floor((p.z-terrain.top)/dims[1]),id=i+'-'+k;
 const seed=index.tiles.find(t=>t.id===id);
 summary[q.id]={id,surveyAlreadyOwns:contains.has(id),seedAvailable:!!seed};
 if(!seed||contains.has(id))continue;
 const a=f('terrain-adaptive/v1/'+index.packs[seed.pack].file).subarray(seed.offset,seed.offset+seed.bytes),raw=gunzipSync(a);
 assert(sha(a)===seed.archiveSha256&&sha(raw)===seed.sha256);
 const r=new ReliefSeed(ab(raw),true,seed.cells);
 const x=terrain.left+i*dims[0],z=terrain.top+k*dims[1],t=world.patch(x,z,...dims,112);
 const d=adaptiveGround(t.geometry,r,terrain,x,z,...dims);
 const coarse=[Math.floor((p.x-x)*112/dims[0]),Math.floor((p.z-z)*112/dims[1])];
 const [cx,cz]=coarse;
 const km=[];
 for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){
  const I=cx+dx,J=cz+dz;km.push([dx,dz,r.accepts(I,J)]);
 }
 summary[q.id]={...summary[q.id],indexCellN:seed.cells,renderRefinedCount:d.relief.refinedCells,mappingCell:coarse,nearestCandidateCellsIn5x5:km.filter(v=>v[2]).length};
}
console.log(JSON.stringify({scope:'Decoded published 16m optional members only; no assertion of ground kept outside these cells.',sources:{terrain:sha(raw),cover:sha(cr)},byAnchor:summary},null,2));
