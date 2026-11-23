import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
/** Run real predecessor/candidate Three.js geometry against source-block holdouts. */
const [,,R,D,source,out]=process.argv;
if(!out)throw Error('Usage: hangar4-mesh.mjs PREDECESSOR CANDIDATE HOLDOUT_JSON OUTPUT_JSON');
const use=(b,f)=>import(pathToFileURL(path.resolve(b,f)));
const {Buildings:A}=await use(R,'src/render/buildings.ts');
const {Buildings:B}=await use(D,'src/render/buildings.ts');
const {Terrain}=await use(R,'src/sim/terrain.ts');
const {project}=await use(R,'src/sim/geo.ts');
const {matchesHangar4}=await use(D,'src/render/hangar4.ts');
const {HANGAR4:model}=await use(D,'src/render/hangar4.generated.ts');
const {supportedRoofAtlas}=await use(R,'src/sim/fitted-roofs.ts');
const Three=await use(R,'node_modules/three/build/three.module.js');
const bytes=n=>fs.readFileSync(path.join(R,'public/world',n));
const sha=b=>createHash('sha256').update(b).digest('hex');
const atlas=JSON.parse(bytes('buildings/index.json')),pack=bytes('buildings/tiles.pack');assert.equal(sha(pack),model.atlasSha);
const fixture=JSON.parse(fs.readFileSync(source));
const terrain0=gunzipSync(bytes('height.bin.gz'));
const terrain=new Terrain(JSON.parse(bytes('terrain.json')),new Int16Array(terrain0.buffer,terrain0.byteOffset,terrain0.byteLength/2));
const tile=atlas.tiles.find(t=>t.id===model.tile),x=project(tile.bounds[0],tile.bounds[3]),z=project(tile.bounds[2],tile.bounds[1]);
Object.assign(tile,{x1:x.x,x2:z.x,z1:x.z,z2:z.z});
const buffer=pack.subarray(tile.offset,tile.offset+tile.bytes);assert.equal(sha(buffer),tile.sha256);
const rows=JSON.parse(gunzipSync(buffer)).features,f=rows[model.row];
assert.deepEqual(f.footprint,fixture.plan);assert.ok(matchesHangar4(atlas.sha256,tile.id,0,fixture.plan));
assert.equal(matchesHangar4(atlas.sha256,tile.id,1,fixture.plan),false);
assert.equal(matchesHangar4('unrecognized atlas',tile.id,0,fixture.plan),false);
assert.equal(matchesHangar4(atlas.sha256,tile.id,0,fixture.plan,[fixture.plan]),false);
assert.equal(matchesHangar4(atlas.sha256,tile.id,0,fixture.plan.slice().reverse()),false);
const m=new Three.MeshBasicMaterial({side:Three.DoubleSide});
const create=(M)=>Object.assign(Object.create(M.prototype),{mat:m,t:terrain,atlasHash:atlas.sha256,
 fitted:supportedRoofAtlas(atlas.sha256),homes:true,farms:true,sourisMcleanMat:m,sourisMat:m,
 montagueMat:m,victoriaMat:m,waterStreetMat:m});
const old=create(A),next=create(B),before=old.generate([f],tile),after=next.generate([f],tile);
for(const obj of [before,after])obj.updateMatrixWorld();
const ray=new Three.Raycaster(new Three.Vector3(0,150,0),new Three.Vector3(0,-1,0),0,360);
const trueBounds=[],errors=[[],[]],missing=[];
for(const [lon,lat,h]of fixture.points){
 const {x,z}=project(lon,lat);ray.ray.origin.set(x,150,z);
 for(const [i,m]of [before,after].entries()){
  const r=ray.intersectObject(m,false).find(hit=>m.geometry.attributes.topFlag.getX(hit.face.a)===1);
  if(!r)missing.push([i,lon,lat]);else errors[i].push(Math.abs(r.point.y-h));
 }
}
assert.equal(missing.length,0,JSON.stringify(missing.slice(0,10)));
const buf=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const control=rows.map((f,i)=>i?f:{footprint:[]}),orig=old.generate(control,tile),updated=next.generate(control,tile);
let exact=0;
for(const [key,attr]of Object.entries(orig.geometry.attributes)){
 assert.ok(buf(attr.array).equals(buf(updated.geometry.attributes[key].array)),key+' protected geometry');
 exact+=attr.array.byteLength;
}
const pcts=(v,qs)=>{v=v.slice().sort((a,b)=>a-b);return qs.map(p=>{const x=(v.length-1)*p,i=Math.floor(x);return v[i]+(v[Math.ceil(x)]-v[i])*(x-i);});};
const q=[.5,.9,.95,1];
const xy=after.geometry.attributes.position,flag=after.geometry.attributes.topFlag;
for(let i=0;i<xy.count;i+=3){
 if(flag.getX(i)!==1)continue;
 trueBounds.push([0,1,2].map(j=>{
  const v=new Three.Vector3().fromBufferAttribute(xy,i+j).applyMatrix4(after.matrixWorld);
  return v.toArray();
 }));
}
assert.ok(errors[0].length===819&&pcts(errors[1],[.9])[0]<.51);
const result={owner:model.tile+'/0',atlas:atlas.sha256,withheld:fixture.points.length,q,absoluteErrors:{stock:pcts(errors[0],q),pilot:pcts(errors[1],q)},
  exactlyPreservedNeighbours:{vertices:orig.geometry.attributes.position.count,attributes:6,bytes:exact},
  triangles:[before.geometry.attributes.position.count/3,after.geometry.attributes.position.count/3],
  distinctRuntimePlacements:1,roofProjectionForIndependentGEOS:trueBounds};
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,roofProjectionForIndependentGEOS:undefined},null,2));
