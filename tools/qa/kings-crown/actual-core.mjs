import fs from 'node:fs';import path from 'node:path';
import assert from 'node:assert/strict';import * as T from 'three';
import {loadAtlas,World} from '../../../src/render/world.ts';
import {project} from '../../../src/sim/geo.ts';
const pub=process.env.PEI_PUBLIC,here=process.env.SCOUT;assert(pub&&here);
const tex=()=>new T.Texture();T.TextureLoader.prototype.load=tex;T.TextureLoader.prototype.loadAsync=async()=>tex();
const canvas=Object.fromEntries(['save','translate','fillRect','rotate','scale','fillText','restore'].map(x=>[x,()=>{}]));
globalThis.document={createElement:()=>({getContext:()=>canvas})};
globalThis.fetch=async url=>{try{return new Response(fs.readFileSync(path.join(pub,String(url))));}catch{return new Response(null,{status:404});}};
const loaded=await loadAtlas(()=>{}),{terrain:t,img,cover:c,sky,bench,southLake,sourisLighting}=loaded;
const s=new T.Scene(),world=new World(s,t,img,{capabilities:{maxTextureSize:4096}},c,sky,bench,southLake,sourisLighting);
world.details.load=async()=>undefined;
const {x,z}=project(-62.78097303602431,46.437590751262626);
world.update(new T.Vector3(x,85,z-175),20);s.updateMatrixWorld(true);
const p=fs.readFileSync(path.join(here,'dry-2112-world-centres.f64')),q=new Float64Array(p.buffer,p.byteOffset,p.byteLength/8);
const values=new Float64Array(q.length/2*5);
let max=0,rays=0,lods=new Set(),active=[];
const rv=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0));
for(let i=0;i<q.length;i+=2){
 const x=q[i],z=q[i+1],j=i*2.5;
 const [u,v]=t.uv(x,z),id=Math.floor(u*32)+'-'+Math.floor(v*22),tile=world.byId.get(id);
 lods.add(id+':'+tile?.lod);
 const signed=c.distance(t,x,z),ground=world.groundHeight(x,z),surface=world.visualGroundHeight(x,z);
 values[j]=signed;values[j+1]=ground;values[j+2]=surface;values[j+3]=tile?.lod??0;values[j+4]=c.sample(t,x,z);
 if(i%214===0&&signed>12&&tile?.fine){
  rv.ray.origin.set(x,500,z);
  const hit=rv.intersectObject(tile.fine,false)[0];assert(hit);
  const eps=Math.abs(hit.point.y-surface);max=Math.max(max,eps);rays++;
 }
}
assert(rays>100&&max<.005);
const out={viewXZ:[x,z],sourcePins:{terrain:loaded.terrainSha,cover:c.sourceSha},actualNearLOD:[...lods],checkedDirectThreeRays:rays,maxFacetQueryDisagreementM:max,landCells:values.length/5};
fs.writeFileSync(path.join(here,'game-wide-field.json'),JSON.stringify(out,null,2)+'\n');
fs.writeFileSync(path.join(here,'dry-2112-stock.f64'),Buffer.from(values.buffer));
console.log(out);
import {Roads,decodeRoads} from '../../../src/render/roads.ts';
import {loadSidewalks} from '../../../src/render/sidewalks.ts';
import {loadParkingSurfaces} from '../../../src/render/parking-surfaces.ts';
import {Buildings} from '../../../src/render/buildings.ts';
import {Vegetation} from '../../../src/render/vegetation.ts';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
globalThis.fetch=async (url,o)=>{try{
 const u=path.join(pub,String(url)),rg=new Headers(o?.headers).get('range');
 if(!rg)return new Response(fs.readFileSync(u));
 const m=/^bytes=(\d+)-(\d+)$/.exec(rg);assert(m);
 const lo=Number(m[1]),hi=Number(m[2]),size=hi-lo+1,fd=fs.openSync(u,'r');
 try{
  const st=fs.fstatSync(fd);assert(hi<st.size&&size<2000000);
  const b=Buffer.alloc(size);assert.equal(fs.readSync(fd,b,0,size,lo),size);
  return new Response(b,{status:206,headers:{'Content-Range':`bytes ${lo}-${hi}/${st.size}`,'Accept-Ranges':'bytes'}});
 }finally{fs.closeSync(fd);}
}catch{return new Response(null,{status:404});}};
const close=(x,z,r=0)=>Math.abs(x-out.viewXZ[0])<350+r&&Math.abs(z-out.viewXZ[1])<425+r;
const split=(xs)=>xs.map(({x,z})=>[x,z]);
const R=gunzipSync(fs.readFileSync(path.join(pub,'world/roads.bin.gz')));
const rawHash=createHash('sha256').update(R).digest('hex'),roads=decodeRoads(R.buffer.slice(R.byteOffset,R.byteOffset+R.length));
assert.equal(rawHash,'72528a1b26b68ee345e5047f30f2c9b49a3c18edeaccaf3e759ead296d3276c1');
const [foot,parks,building,renderRoads]=await Promise.all([loadSidewalks('/world/'),loadParkingSurfaces('/world/'),Buildings.create(s,t),Roads.create(s,t)]);
assert(foot&&parks&&building&&renderRoads.sourceGeometrySha256===rawHash);
const [atX,atZ]=out.viewXZ;
building.update(atX,atZ);renderRoads.update(atX,atZ,80);
await new Promise(r=>setTimeout(r,150));
building.update(atX,atZ);s.updateMatrixWorld(true);
const A=[];
for(const [key,m] of building.meshes){
 let count=0,x0=Infinity,z0=Infinity,x1=-Infinity,z1=-Infinity;
 const p=m.geometry.getAttribute('position');
 for(let i=0;i<p.count;i++){
  const x=p.getX(i)+m.position.x,z=p.getZ(i)+m.position.z;
  if(!close(x,z))continue;x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z);count++;
 }
 if(count)A.push({key,count,box:[x0,z0,x1,z1]});
}
const tri=[];
for(const [key,m] of renderRoads.visible){
 const p=m.geometry.getAttribute('position'),v=i=>[p.getX(i)+m.position.x,p.getZ(i)+m.position.z];
 for(let i=0;i<p.count;i+=3){
  const a=[v(i),v(i+1),v(i+2)];
  if(a.some(([x,z])=>close(x,z,35)))tri.push({key,vertices:a});
 }
}
const veg=new Vegetation(new T.Scene(),t,c);veg.update(atX,atZ,120);
const stamps=[];
for(let i=0;i<veg.geom.instanceCount;i++){
 const x=veg.stems.getX(i),z=veg.stems.getZ(i),h=veg.shapes.getX(i),w=veg.shapes.getY(i);
 if(close(x,z,15))stamps.push({xz:[x,z],h,w,stockStemY:veg.stems.getY(i),stockShadowBox:[x+.43*h-.71*w,z+.21*h-.595*w,x+.43*h+.71*w,z+.21*h+.595*w]});
}
const pathList=foot.flatMap(tile=>tile.paths).filter(p=>p.points.some(({x,z})=>close(x,z,60))).map(p=>({points:split(p.points),width:p.width,style:p.style}));
const parkList=parks.filter(q=>q.box.some(Number.isFinite)&&close((q.box[0]+q.box[2])*.5,(q.box[1]+q.box[3])*.5,Math.hypot(q.box[2]-q.box[0],q.box[3]-q.box[1])*.5)).map(t=>({id:t.id,box:t.box,lots:t.lots.length}));
const rows=roads.map((r,i)=>({ordinal:i,flags:r.flags,points:split(r.points)})).filter(r=>r.points.some(([x,z])=>close(x,z,110)));
const packed={roadSourceSha256:rawHash,drawRoadTriangles:tri,packedNearRows:rows,sidewalkPaths:pathList,parkingTiles:parkList,buildingsNear:A,treeRootsAndShadowBounds:stamps,actualBuildTilesReady:building.meshes.size,actualBuildSourceSha:building.sourceAtlasSha256};
fs.writeFileSync(path.join(here,'protected-near.json'),JSON.stringify(packed,null,2)+'\n');
console.log(JSON.stringify({roadTriangles:tri.length,rows:rows.length,sidewalks:pathList.length,parking:parkList.length,buildings:A.length,stems:stamps.length}));
