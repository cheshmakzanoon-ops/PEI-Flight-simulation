/** Native actual Three, EFI and World replay; no browser, terrain edits or scene mocks. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as T from 'three';
import {Terrain} from '../../src/sim/terrain.ts';
import {Cover} from '../../src/sim/cover.ts';
import {ForestStream} from '../../src/sim/forest-stream.ts';
import {World} from '../../src/render/world.ts';
import {Vegetation} from '../../src/render/vegetation.ts';
import {RegionalCanopies} from '../../src/render/regional-canopy/controller.ts';
import {createRegionalCanopy} from '../../src/render/regional-canopy/mesh.ts';
import {readRegionalCanopy} from '../../src/render/regional-canopy/assets.ts';
import {regionalBase,regionalForestSeat,regionalLayers} from '../../src/render/regional-canopy/ground.ts';
import {regionalDigest,REGIONAL_STANDS,REGIONAL_SOURCE,REGIONAL_DRAW_M} from '../../src/render/regional-canopy/spec.ts';
import {REGIONAL_CANOPY_DEPARTURES} from '../../src/render/regional-canopy/departures.ts';
import {project} from '../../src/sim/geo.ts';
const read=(file)=>readFileSync('public/world/'+file),json=(file)=>JSON.parse(read(file));
const height=gunzipSync(read('height.bin.gz')),data=gunzipSync(read('cover.bin.gz')),crev=json('cover.json'),trev=json('terrain.json');
const terrain=new Terrain(trev,new Int16Array(height.buffer,height.byteOffset,height.length/2));
const cover=new Cover(crev.width,crev.height,Uint8Array.from(data),undefined,crev.compressedSha256);
const fixtureHelpers=['save','translate','fillRect','rotate','scale','fillText','restore'];
globalThis.document={createElement:()=>({getContext:()=>Object.fromEntries(fixtureHelpers.map(k=>[k,()=>{}]))})};
T.TextureLoader.prototype.load=function(){return new T.Texture();};
assert(regionalBase(terrain,cover,trev.sha256));
assert(regionalLayers(REGIONAL_SOURCE.road,REGIONAL_SOURCE.structures,REGIONAL_SOURCE.sidewalk,REGIONAL_SOURCE.parking));
let wallClock=6;
const server=async(path,init)=>{
 const all=read(path.split('/world/')[1]);
 if(!init?.headers?.Range)return new Response(all);
 const [,a,b]=init.headers.Range.match(/^bytes=(\d+)-(\d+)$/);const start=Number(a),end=Number(b);
 return new Response(all.subarray(start,end+1),{status:206,headers:{'Content-Range':`bytes ${start}-${end}/${all.length}`}});
};
const wait=async(f,n=20)=>{
 for(let i=0;i<n;i++){if(f())return;await new Promise(r=>setTimeout(r,8));}
 assert(f(),'native regional scenery condition did not resolve');
};
const scene=new T.Scene(),sky=new T.Texture();sky.mapping=T.EquirectangularReflectionMapping;scene.environment=sky;
const world=new World(scene,terrain,new T.Texture(),{capabilities:{maxTextureSize:4096}},cover,sky);
world.details.load=async()=>undefined;
const forest=new ForestStream('/',server),vegetation=new Vegetation(scene,terrain,cover,undefined,forest);
const getStock=()=>({stem:vegetation.stems.array.slice(),shape:vegetation.shapes.array.slice(),hedge:vegetation.hedgeGround.array.slice(),n:vegetation.geom.instanceCount});
const rawCanopy=vegetation.crownFillMaterial(),reports=[];
let reads=0;
const loader=(base,s)=>readRegionalCanopy(base,s,async(...a)=>{reads++;return server(...a);}).then(rows=>rows?{rows,create:createRegionalCanopy}:undefined);
const controller=new RegionalCanopies(world,scene,vegetation,forest,'/world/',REGIONAL_STANDS,loader);
controller.qualifyLayers(true);
for(const [i,s] of REGIONAL_STANDS.entries()){
 const [x,z]=s.center,selected=REGIONAL_CANOPY_DEPARTURES[i],start=project(selected.lon,selected.lat);
 const p0={x:start.x,y:terrain.meshElevation(start.x,start.z)+112,z:start.z},eye0=new T.Vector3(p0.x-16.8,p0.y+4.2,p0.z);
 const p1={x:x-45,y:terrain.meshElevation(x,z)+112,z},eye1=new T.Vector3(x-61.8,p1.y+4.2,z);
 await forest.warm(p0.x,p0.z);
 await wait(()=>forest.hasHeightPlan(s.owner,s.efiSha),80);
 world.update(eye0,wallClock++);vegetation.update(p0.x,p0.z,p0.y);
 const launchCenter=world.rollingCanopyOwner(s.canopyBounds);assert.equal(launchCenter?.key,s.owner);
 const stock=vegetation.captureStockCanopy(s.bounds,s.stockCount);
 assert(stock,JSON.stringify({id:s.id,forest:forest.state,vegetation:vegetation.geom.instanceCount}));
 assert.equal(await regionalDigest(stock),s.stockSha,'raw live EFI and actual ordered stock instance values');
 const base=reads;
 controller.update(p0,eye0,112,116,false,false,1);assert.equal(reads,base);
 controller.update(p0,{...eye0,y:733},702,711,true,true,2);assert.equal(reads,base);
 for(let j=0;j<80&&controller.state.stands[i].pack!=='ready';j++){
  controller.update(p0,eye0,112,116,true,true,3+j);
  await new Promise(r=>setTimeout(r,8));
 }
 assert.equal(controller.state.stands[i].pack,'ready');assert.equal(reads,base+1);
 const before=getStock();
 for(const [pause,t] of [[true,500],[false,600],[false,1120]])controller.update(p0,eye0,112,116,!pause,true,t);
 assert.equal(controller.state.active,s.id);assert.equal(controller.state.draw,s.count);
 const m=scene.getObjectByName('Regional canopy '+s.id);assert(m?.visible);
 assert.equal(m.material.uniforms.canopy,rawCanopy.uniforms.canopy);assert(!m.castShadow&&!m.receiveShadow);
 assert(m.geometry!==vegetation.geom&&m.material!==rawCanopy);assert.equal(m.geometry.index.count,6);
 assert.equal(m.geometry.instanceCount,s.count);assert.deepEqual(getStock(),before);
 const ground=world.byId.get(s.owner).fine,phys=world.surface(x,z),beforeVisual=world.visualGroundHeight(x,z);
 const stems=m.geometry.attributes.stem,shapes=m.geometry.attributes.shape;
 const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0));scene.updateMatrixWorld(true);
 let maxSeat=0,minY=Infinity,maxY=-Infinity;
 for(let j=0;j<stems.count;j++){
  const x=stems.getX(j),z=stems.getZ(j),y=stems.getY(j);ray.ray.origin.set(x,130,z);
  const h=ray.intersectObject(ground,false)[0];assert(h&&regionalForestSeat(terrain,cover,x,z,shapes.getX(j),shapes.getY(j)));
  const expected=(j*37+11)%101<10?(s.county==='Queens'?2:3):((j*17+5)%37<18?0:1);
  assert.equal(shapes.getZ(j),expected);assert.equal(shapes.getW(j),Math.fround(.86+.19*((j*2251)%997)/997));
  maxSeat=Math.max(maxSeat,Math.abs(y+.16-h.point.y));minY=Math.min(minY,h.point.y);maxY=Math.max(maxY,h.point.y);
 }
 assert(maxSeat<.00005);
 // Stock may change its selected slots on the real ordinary route. The verified
 // in-region slice stays byte-exact, so this is not a per-frame async outage.
 vegetation.update(p1.x,p1.z,p1.y);
 controller.update(p1,eye1,112,116,true,true,1220);assert.equal(controller.state.gain,1);
 assert.equal(controller.state.draw,s.count);assert.equal(await regionalDigest(vegetation.captureStockCanopy(s.bounds,s.stockCount)),s.stockSha);
 assert.equal(scene.getObjectByName(m.name),m);
 // Force an intentional change to one actual selected value, then restore exact
 // data to prove stock is never hidden even if the admission signature fails.
 const data=vegetation.stems.array;let hit=-1;
 for(let j=0;j<vegetation.hedgeStart;j++)if(data[j*3]>=s.bounds[0]&&data[j*3]<=s.bounds[2]&&data[j*3+2]>=s.bounds[1]&&data[j*3+2]<=s.bounds[3]){hit=j;break;}
 assert(hit>=0);
 const slotWords=new Uint32Array(vegetation.shapes.array.buffer),k=hit*4,actual=slotWords[k];slotWords[k]^=1;vegetation.forestRevision++;
 controller.update(p1,eye1,112,116,true,true,1300);assert(!m.visible&&!controller.state.draw);
 slotWords[k]=actual;vegetation.forestRevision++;
 controller.update(p1,eye1,112,116,true,true,1310);assert(!m.visible);
 controller.update(p1,eye1,112,116,true,true,1800);assert(m.visible);
 controller.update({x:x+REGIONAL_DRAW_M,y:116,z},new T.Vector3(x+680,113,z),103,100,true,true,1801);assert(!m.visible);
 assert.deepEqual(world.surface(x,z),phys);assert.equal(world.visualGroundHeight(x,z),beforeVisual);
 controller.update(p1,eye1,112,116,true,true,1820);controller.update(p1,eye1,112,116,true,true,2360);assert(m.visible);
 assert.equal(reads,base+1);
 world.update(new T.Vector3(x-9000,p1.y,z),wallClock++);
 controller.update(p1,eye1,112,116,true,true,2400);assert(!m.visible&&!controller.state.draw);
 world.update(eye1,wallClock++);controller.update(p1,eye1,112,116,true,true,2410);controller.update(p1,eye1,112,116,true,true,2900);
 assert(controller.state.draw===s.count&&reads===base+1);assert.equal(world.rollingCanopyOwner(s.canopyBounds)?.key,s.owner);
 controller.clear();assert.equal(controller.state.draw,0);
 reports.push({id:s.id,gate:s.owner,efi:forest.hasHeightPlan(s.owner,s.efiSha),roots:stems.count,minY,maxY,maxSeat,triangles:stems.count*2,
  afterMoveExact:true,oneBitRosterInvalidation:true,source:await regionalDigest(stock)});
}
console.log(JSON.stringify({reports,reads},null,2));
