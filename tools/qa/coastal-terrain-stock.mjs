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
import {WORLD_COLS,WORLD_ROWS} from '../../src/sim/coastal-terrain.ts';
import {geographic,project} from '../../src/sim/geo.ts';
const width=(terrain.right-terrain.left)/WORLD_COLS,depth=(terrain.bottom-terrain.top)/WORLD_ROWS;
const namedTryon=process.argv[2]==='--tryon-dated-window';
const siteInputs=JSON.parse(fs.readFileSync('docs/qa/coastal-terrain-intake-sites.json','utf-8'))
 .filter(site=>!namedTryon||site.id==='cape-tryon');
const shape=(i,z,lod)=>{
 const x0=terrain.left+i*width,z0=terrain.top+z*depth,id=i+'-'+z;
 return {id,i,j:z,x0,z0,w:width,d:depth,lod,fine:world.patch(x0,z0,width,depth,lod)};
};
const ray= new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0),0,185);
const bySite={};
for(const s of siteInputs){
 const {x,z}=project(s.lon,s.lat), i=Math.floor((x-terrain.left)/width),k=Math.floor((z-terrain.top)/depth);
 const cache=new Map(),samples=[];
 world.byId.clear();
 for(let j=k-1;j<=k+1;j++)for(let a=i-1;a<=i+1;a++) {
  const owner=shape(a,j,112);world.byId.set(owner.id,owner);owner.fine.updateMatrixWorld();
  cache.set(owner.id,owner);
 }
 let rayChecks=0,maxRay=0;
 for(let b=namedTryon?-200:-118;b<=(namedTryon?210:118);b+=2)
  for(let a=namedTryon?-230:-118;a<=(namedTryon?230:118);a+=2){
  const X=x+a,Z=z+b,ix=Math.floor((X-terrain.left)/width),iz=Math.floor((Z-terrain.top)/depth);
  const owner=cache.get(ix+'-'+iz);assert(owner);
  const visual=world.visualGroundHeight(X,Z),g=world.surface(X,Z),d=cover.distance(terrain,X,Z);
  if(a%34===0&&b%34===0){
   ray.ray.origin.set(X,160,Z);const m=ray.intersectObject(owner.fine,false)[0];
   assert(m);rayChecks++;maxRay=Math.max(maxRay,Math.abs(m.point.y-visual));
  }
  if(namedTryon){
   const {lon,lat}=geographic(X,Z);samples.push([X,Z,visual,g.height,d,Number(g.land),lon,lat,ix,iz]);
  }else samples.push([X,Z,visual,g.height,d,Number(g.land)]);
 }
 bySite[s.id]={county:s.county,x,z,owner:i+'-'+k,rayChecks,maxRay,samples};
}
console.log(JSON.stringify({baseline:{terrainDataSHA:sha(raw),coverDataSHA:sha(cr)},shape:'Base Standard owner and loaded East/West survey cohort; no optional Point Prim grade persists in this geometry runner.',pins:{terrain:sha(raw),cover:sha(cr)},bySite}));
