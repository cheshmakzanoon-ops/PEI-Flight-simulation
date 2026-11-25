import {readFileSync as read} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(process.argv[2]),load=f=>import(pathToFileURL(root+'/'+f));
const [T,{Terrain},{Buildings},{project},{SPINNAKERS_DECK:W},{loadSpinnakersDeck,buildSpinnakersDeck,spinnakersDeckSurface},{buildSpinnakersShells}]=await Promise.all(
 ['node_modules/three/build/three.module.js','src/sim/terrain.ts','src/render/buildings.ts','src/sim/geo.ts','src/render/spinnakers-deck.generated.ts','src/render/spinnakers-deck.ts','src/render/spinnakers-shells.ts'].map(load));
const A=root+'/public/world/',man=JSON.parse(read(A+'terrain.json')),raw=gunzipSync(read(A+man.file)),terrain=new Terrain(man,new Int16Array(raw.buffer,raw.byteOffset,raw.byteLength/2));
const atlas=JSON.parse(read(A+'buildings/index.json')),tile=atlas.tiles.find(x=>x.id==='q032001'),wire=read(A+'buildings/'+atlas.file).subarray(tile.offset,tile.offset+tile.bytes);
const scene=new T.Scene();scene.environment=new T.Texture();
const buildings=new Buildings(scene,terrain,[tile],undefined,atlas.sha256);
buildings.enableSummersideRoofCohort();
const stock=buildings.generate(JSON.parse(gunzipSync(wire)).features,buildings.tiles[0],false,163,false,undefined,true,true);
stock.updateMatrixWorld(true);
const pack=await loadSpinnakersDeck('',async path=>new Response(read(A+path)));
const seat=spinnakersDeckSurface(pack);
const art=new T.Group();
art.add(buildSpinnakersDeck(pack,{sourceSha:W.cover,beforeBaywalk:()=>-1},terrain,seat),buildSpinnakersShells(seat));
art.updateMatrixWorld(true);
const shapes=[];
for(const [lo,hi] of stock.userData.spinnakersSpans.values()){
 const attr=stock.geometry.getAttribute('position'),box=new T.Box3();
 for(let i=lo;i<hi;i++)box.expandByPoint(new T.Vector3().fromBufferAttribute(attr,i).applyMatrix4(stock.matrixWorld));
 shapes.push(box);
}
for(const d of art.children)for(const m of d.children)shapes.push(new T.Box3().setFromObject(m));
const coord=shapes.map(b=>[b.min.toArray(),b.max.toArray()]);
const [lon,lat]=W.anchor;
const studies={
 'wharf-close':[900,600,lon,lat,138,.51,.86,26,7.5],
 'county-approach':[900,600,-63.790211,46.392695,650,.68,.74,120,12.68,7.983448275881528,120.99634345661718],
 'station-street':[600,400,-63.78850717,46.39088167,56,-.57,.829,12,10],
};
const result={scope:'Frozen before native candidate frames. Union boxes of original signed q032001 /240 and /315 stock triangles and the original deck/shell submesh bounds in world/clip space. Two pixels of allowance for renderer coverage. This is not an exact silhouette.',coord,views:{}};
for(const [name,[w,h,lng,lat,dist,east,south,agl,high,floor,eyeY]] of Object.entries(studies)){
 const c=project(lng,lat),rad=Math.hypot(east,south),x=c.x+dist*east/rad,z=c.z+dist*south/rad;
 const camera=new T.PerspectiveCamera(53,w/h,.08,350000);
 camera.position.set(x,eyeY??terrain.elevation(x,z)+agl,z);
 camera.lookAt(c.x,(floor??terrain.elevation(c.x,c.z))+high*.5,c.z);camera.updateMatrixWorld(true);
 const boxes=[];
 for(const b of shapes){
  const verts=[];let back=0;
  for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){
   const v=new T.Vector3(x,y,z);
   if(v.clone().applyMatrix4(camera.matrixWorldInverse).z>=-.08)back++;
   else {v.project(camera);verts.push([(1+v.x)*w*.5,(1-v.y)*h*.5]);}
  }
  if(back===8)continue;
  if(back){boxes.push([0,0,w,h]);continue;}
  const limits=[Math.max(0,Math.floor(Math.min(...verts.map(v=>v[0]))-2)),
  Math.max(0,Math.floor(Math.min(...verts.map(v=>v[1]))-2)),Math.min(w,Math.ceil(Math.max(...verts.map(v=>v[0]))+2)),
  Math.min(h,Math.ceil(Math.max(...verts.map(v=>v[1]))+2))];
  if(limits[2]>limits[0]&&limits[3]>limits[1])boxes.push(limits);
 }
 result.views[name]={cameraEye:camera.position.toArray(),size:[w,h],boxes};
}
console.log(JSON.stringify(result,null,2));
