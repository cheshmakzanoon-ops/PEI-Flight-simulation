/** Whole original/candidate triangles, camera-matched from actual render captures. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const [, , repoDir, preDir, witnessPath, posePath, out, opt]=process.argv;
if(!out||opt!==undefined&&opt!=='--roofs-only')throw Error('CANDIDATE_ROOT PREDECESSOR_ROOT EXACT_WITNESS_JSON POSE_RESULTS_JSON PROJECTED_OUT [--roofs-only]');
const repo=path.resolve(repoDir),pre=path.resolve(preDir);
const load=(r,f)=>import(pathToFileURL(path.join(r,f)));
const j=p=>JSON.parse(fs.readFileSync(p));
const three=await load(repo,'node_modules/three/build/three.module.js');
const {Buildings:Next}=await load(repo,'src/render/buildings.ts');
const {Buildings:Old}=await load(pre,'src/render/buildings.ts');
const {Terrain}=await load(repo,'src/sim/terrain.ts');
const {project}=await load(repo,'src/sim/geo.ts');
const {supportedRoofAtlas}=await load(repo,'src/sim/fitted-roofs.ts');
const atlasPath=path.join(repo,'public/world/buildings'),idx=j(path.join(atlasPath,'index.json')),packed=fs.readFileSync(path.join(atlasPath,'tiles.pack'));
const hash=a=>createHash('sha256').update(a).digest('hex');assert.equal(hash(packed),idx.sha256);
const h=gunzipSync(fs.readFileSync(path.join(repo,'public/world/height.bin.gz')));
const t=new Terrain(j(path.join(repo,'public/world/terrain.json')),new Int16Array(h.buffer,h.byteOffset,h.byteLength/2));
const mat=new three.MeshBasicMaterial({side:three.DoubleSide});
const args=Type=>Object.assign(Object.create(Type.prototype),{mat,t,atlasHash:idx.sha256,fitted:supportedRoofAtlas(idx.sha256),farms:true,homes:true,sourisMcleanMat:mat,montagueMat:mat,waterStreetMat:mat,victoriaMat:mat,sourisMat:mat});
const A=args(Old),B=args(Next);
const named=new Map(idx.tiles.map(tile=>{
 const a=project(tile.bounds[0],tile.bounds[3]),b=project(tile.bounds[2],tile.bounds[1]), raw=packed.subarray(tile.offset,tile.offset+tile.bytes);
 assert.equal(hash(raw),tile.sha256);
 const features=jBuffer(raw).features;
 return [tile.id,{tile:{...tile,x1:a.x,x2:b.x,z1:a.z,z2:b.z},features}];
}));
function jBuffer(data){return JSON.parse(gunzipSync(data));}
const witness=j(witnessPath), poses=j(posePath), empty={footprint:[]}, report={};
for(const fixture of poses){
 const {name,width,height,diag,pose}=fixture;
 const cam=new three.PerspectiveCamera(53,width/height,.08,350000);
 const pt=project(pose.lon,pose.lat);
 cam.position.set(diag.x,diag.eyeY,diag.z);cam.lookAt(pt.x,diag.baseH+pose.h*.5,pt.z);cam.updateMatrixWorld();
 const result=[];
 for(const row of witness){
  if(!diag.owners.includes(row.tile))continue;
  const {tile,features}=named.get(row.tile),feature=features[row.i];assert.deepEqual(feature.footprint,row.footprint);
  const b=project(...feature.footprint[0]);if(Math.hypot(b.x-diag.x,b.z-diag.z)>3200)continue;
  const list=Array(row.i+1).fill(empty);list[row.i]=feature;
  for(const render of [A,B]){
   const m=render.generate(list,tile);m.updateMatrixWorld();
   const pa=m.geometry.attributes.position;
   for(let k=0;k<pa.count;k+=3){
    if(opt==='--roofs-only'&&m.geometry.attributes.topFlag.getX(k)!==1)continue;
    const clip=[0,1,2].map(i=>new three.Vector3().fromBufferAttribute(pa,k+i).applyMatrix4(m.matrixWorld));
    const valid=clip.map(p=>p.clone().applyMatrix4(cam.matrixWorldInverse).z<-.08);
    // These nearby source masks are off-camera if behind the camera.
    // Crossing depth must be a consciously audited case rather than a broad pixel exemption.
    if(!valid.some(Boolean))continue;
    assert.ok(valid.every(Boolean),name+' clip across near on '+row.tile+'/'+row.i);
    const q=clip.map(p=>p.project(cam));
    if(q.every(p=>p.x<-1)||q.every(p=>p.x>1)||q.every(p=>p.y<-1)||q.every(p=>p.y>1))continue;
    result.push(q.map(p=>[(1+p.x)*width/2,(1-p.y)*height/2]));
   }
   m.geometry.dispose();
  }
 }
 report[name]={width,height,triangles:result};
}
fs.writeFileSync(out,JSON.stringify(report)+'\n');
mat.dispose();
