import * as T from 'three';
import {Terrain} from '../../src/sim/terrain.ts';
import {Cover} from '../../src/sim/cover.ts';
import {World} from '../../src/render/world.ts';
import {loadCoastalSurveys} from '../../src/sim/coastal-terrain.ts';
import {loadHarbourCover} from '../../src/sim/harbour-cover.ts';
import {project} from '../../src/sim/geo.ts';
/** Source-bound socket and terrain preflight at every installed NRCan centre. This does not read back GPU buffers. */
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const [repo,out]=process.argv.slice(2);if(!repo||!out)throw Error('Usage: node bundled-ground.mjs repo output.json');
const sectionsFile=resolve(repo,'data/regional-wind/locations.json');
const sha=b=>createHash('sha256').update(b).digest('hex'),ab=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const file=p=>readFileSync(resolve(repo,'public/world',p)),meta=p=>JSON.parse(file(p));
const t=meta('terrain.json'),c=meta('cover.json'),tb=gunzipSync(file(t.file)),cg=file(c.file),cb=gunzipSync(cg);
assert.equal(sha(tb),t.sha256);assert.equal(sha(cg),c.compressedSha256);
const root='http://local.invalid/world/';
const get=async url=>{try{return new Response(file(new URL(url).pathname.slice('/world/'.length)));}catch{return new Response(null,{status:404});}};
const [survey,harbour]=await Promise.all([loadCoastalSurveys(root,get),loadHarbourCover(root,get)]);
assert(survey.length>=2&&harbour,[survey.length,Boolean(harbour)].join(","));
const terrain=new Terrain(t,new Int16Array(ab(tb)),survey),cover=new Cover(c.width,c.height,new Uint8Array(ab(cb)),harbour,sha(cg),undefined,undefined,sha(cb));
const scene=new T.Scene(),mat=new T.ShaderMaterial({side:T.DoubleSide});
const w=Object.assign(Object.create(World.prototype),{scene,terrain,cover,
 pondMeshes:[],grades:new Map,byId:new Map,reliefActive:new Set,mat,shoreFaces:[]});
const source=JSON.parse(readFileSync(sectionsFile));assert.equal(source.turbines.length,74);
const units=source.turbines.map(s=>{
 const {x,z}=project(s.longitude,s.latitude), probes=[];
 for(const [dx,dz] of [[0,0],[-3,-3],[-3,3],[3,-3],[3,3],[-4,0],[0,4],[4,0],[0,-4]]){const u=w.surface(x+dx,z+dz);probes.push([cover.distance(terrain,x+dx,z+dz),u.land,u.height,w.visualGroundHeight(x+dx,z+dz)]);}
 return {id:s.id,farm:s.farm,x,z,cover:cover.sample(terrain,x,z),minDry:Math.min(...probes.map(p=>p[0])),allLand:probes.every(p=>p[1]),centerGround:probes[0][2],oldVisual:probes[0][3],gradeSpan:Math.max(...probes.map(p=>p[3]))-Math.min(...probes.map(p=>p[3]))};});
assert(units.every(s=>s.minDry>32&&s.allLand&&Number.isFinite(s.oldVisual)&&s.gradeSpan<.64));
writeFileSync(out,JSON.stringify({sourceRegistration:sha(readFileSync(sectionsFile)),originalTerrain:sha(tb),originalCover:sha(cb),method:'Actual terrain.ts/cover.ts/World.surface plus 8-point 3-4m socket margins. Stock fine mesh precision is checked independently. No source coordinate adjusted.',units},null,2)+'\n');
for(const key of [...new Set(units.map(x=>x.farm))]){const r=units.filter(u=>u.farm===key);console.log(key,r.length,r.every(u=>u.allLand),Math.min(...r.map(u=>u.minDry)),'max pad span',Math.max(...r.map(u=>u.gradeSpan)),Object.fromEntries([...new Set(r.map(u=>u.cover))].map(c=>[c,r.filter(v=>v.cover===c).length])));}
