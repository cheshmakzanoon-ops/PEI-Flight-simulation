import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const [, , holdoutFile, reportPath, repoPath='.']=process.argv;
if(!holdoutFile||!reportPath)throw Error('Usage: node --experimental-strip-types tools/qa/home-mesh-holdout.mjs HOLDOUT_JSON REPORT_JSON [REPOSITORY]');
const repo=path.resolve(repoPath);
const load=(f)=>import(pathToFileURL(path.join(repo,f)));
const json=(f)=>JSON.parse(fs.readFileSync(path.join(repo,f)));
const THREE=await load('node_modules/three/build/three.module.js');
const {Buildings}=await load('src/render/buildings.ts');
const {Terrain}=await load('src/sim/terrain.ts');
const {project}=await load('src/sim/geo.ts');
const {HOME_ATLAS_SHA}=await load('src/render/home-envelopes.generated.ts');
const {supportedRoofAtlas}=await load('src/sim/fitted-roofs.ts');
const manifest=json('public/world/buildings/index.json');
const packed=fs.readFileSync(path.join(repo,'public/world/buildings/tiles.pack'));
assert.equal(createHash('sha256').update(packed).digest('hex'),HOME_ATLAS_SHA);
assert.equal(manifest.sha256,HOME_ATLAS_SHA);
const ground=gunzipSync(fs.readFileSync(path.join(repo,'public/world/height.bin.gz')));
const terrain=new Terrain(json('public/world/terrain.json'),new Int16Array(ground.buffer,ground.byteOffset,ground.byteLength/2));
const wanted=JSON.parse(fs.readFileSync(holdoutFile));
const mat=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
const runtime=(active)=>Object.assign(Object.create(Buildings.prototype),{mat,t:terrain,atlasHash:manifest.sha256,fitted:supportedRoofAtlas(manifest.sha256),farms:true,homes:active});
const old=runtime(false), update=runtime(true);
const raw=new Map(manifest.tiles.map(a=>{
 const p=project(a.bounds[0],a.bounds[3]);const q=project(a.bounds[2],a.bounds[1]);
 return [a.id,{...a,x1:p.x,x2:q.x,z1:p.z,z2:q.z}];
}));
const loaded=new Map();
const get=(id,i)=>{
 let f=loaded.get(id);if(!f){
  const t=raw.get(id);
  const slice=packed.subarray(t.offset,t.offset+t.bytes);
  assert.equal(createHash('sha256').update(slice).digest('hex'),t.sha256);
  ({features:f}=JSON.parse(gunzipSync(slice)));assert.equal(f.length,t.count);loaded.set(id,f);
 }
 return f[i];
};
const empty={footprint:[]};
const miss=[];let cells=0,duplicate=0,longestVerticalDiff=0;
const percentile=(v,p)=>{
 v.sort((a,b)=>a-b);const f=(v.length-1)*p,i=Math.floor(f);
 return v[i]+(v[Math.ceil(f)]-v[i])*(f-i);
};
const stats=a=>[.1,.5,.9,.99,1].map(p=>percentile(a.slice(),p));
const result=[];
for(const r of wanted){
 const tile=raw.get(r.tile),f=get(r.tile,r.i);
 assert.deepEqual(f.footprint,r.footprint);
 const fs=Array(r.i+1).fill(empty);fs[r.i]=f;
 const mx=old.generate(fs,tile), my=update.generate(fs,tile);
 for(const m of [mx,my])m.updateMatrixWorld();
 const givenTop=my.geometry.getAttribute('topFlag');
 const givenStyle=my.geometry.getAttribute('facadeStyle');
 assert.ok(givenStyle.array.every(f=>[10,11,12].includes(f)));
 assert.ok(Array.from(givenTop.array).includes(1));
 const pts=f.footprint.map(([lon,lat])=>project(lon,lat));
 const [cx,cz]=pts.reduce(([x,z],p)=>[x+p.x/pts.length,z+p.z/pts.length],[0,0]);
 const base=terrain.meshElevation(cx,cz)+.05;
 const ray=new THREE.Raycaster(new THREE.Vector3(0,200,0),new THREE.Vector3(0,-1,0),0,450);
 const errors=[[],[]],absolute=[[],[]];
 for(const [lon,lat,dsm] of r.points){
  cells++; const {x,z}=project(lon,lat);ray.ray.origin.set(x,200,z);
  for(const [j,m] of [mx,my].entries()){
   const flags=m.geometry.getAttribute('topFlag');
   const all=ray.intersectObject(m,false).filter(q=>flags.getX(q.face.a)===1);
   if(!all.length){miss.push([r.tile,r.i,j,lon,lat]);continue;}
   const y=all[0].point.y;
   if(all.length>1){duplicate++;longestVerticalDiff=Math.max(longestVerticalDiff,y-all.at(-1).point.y);}
   errors[j].push(Math.abs(y-base-(dsm-r.expectedDatum)));
   absolute[j].push(Math.abs(y-dsm));
  }
 }
 const [before,after]=errors.map(v=>percentile(v,.9));
 const [absoluteBefore,absoluteAfter]=absolute.map(v=>percentile(v,.9));
 result.push({tile:r.tile,i:r.i,county:r.county,kind:r.kind,n:r.points.length,before,after,modelClaimsBefore:r.oldP90,modelClaimsAfter:r.p90,
  absoluteBefore,absoluteAfter,datumGap:base-r.expectedDatum,triangles:[mx.geometry.getAttribute('position').count/3,my.geometry.getAttribute('position').count/3]});
 mx.geometry.dispose();my.geometry.dispose();
}
assert.equal(miss.length,0,JSON.stringify(miss.slice(0,20)));
const summary={
 // "absolute" is the actual base-scaled rendered roof vs same raw DSM, retains underlying modeled terrain height and is NOT an orthorectified registration proof.
 kind:'Same-survey native 1 m withheld blocks drawn from accepted-fit population. Real Three Float32 mesh rays; no new release assets.',
 atlasSha:manifest.sha256,cells,buildings:result.length,atlasChunks:loaded.size,duplicate,longestVerticalDiff,
 q:[.1,.5,.9,.99,1],
 perBuildingP90:{old:stats(result.map(x=>x.before)),new:stats(result.map(x=>x.after))},
 modelToMeshP90AbsoluteDelta:{old:stats(result.map(x=>Math.abs(x.before-x.modelClaimsBefore))),new:stats(result.map(x=>Math.abs(x.after-x.modelClaimsAfter)))},
 absolutePerBuildingP90:{old:stats(result.map(x=>x.absoluteBefore)),new:stats(result.map(x=>x.absoluteAfter))},
 displayedBaseMinusNativeDatum:stats(result.map(x=>x.datumGap)),
 actualBeforeToAfter: {relativeBetter:result.filter(x=>x.after<x.before).length,relativeUnchanged:result.filter(x=>Math.abs(x.after-x.before)<=.00001).length,relativeDegraded:result.filter(x=>x.after>x.before+.00001).length,
 absoluteBetter:result.filter(x=>x.absoluteAfter<x.absoluteBefore).length,absoluteDegraded:result.filter(x=>x.absoluteAfter>x.absoluteBefore+.00001).length},
 worstOld:result.slice().sort((a,b)=>b.before-a.before).slice(0,5),
 worstNew:result.slice().sort((a,b)=>b.after-a.after).slice(0,5),
 greatestDegradation:result.slice().sort((a,b)=>(b.after-b.before)-(a.after-a.before)).slice(0,10),
 counties:{}
};
for(const county of ['PRINCE','QUEENS','KINGS']){
 const subset=result.filter(x=>x.county===county);
 summary.counties[county]={buildings:subset.length,cells:subset.reduce((n,d)=>n+d.n,0),relativeOld:stats(subset.map(x=>x.before)),relativeNew:stats(subset.map(x=>x.after)),absoluteOld:stats(subset.map(x=>x.absoluteBefore)),absoluteNew:stats(subset.map(x=>x.absoluteAfter))};
}
fs.writeFileSync(reportPath,JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
