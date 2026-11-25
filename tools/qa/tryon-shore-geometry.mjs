import {SITES} from '../../src/sim/places.ts';
import {spawn,step,neutral,FIXED_STEP} from '../../src/sim/flight.ts';
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
import { TRYON_SHORE_CELLS } from '../../src/sim/open-coast-closure.ts';
const material=new T.ShaderMaterial();
const worldWith=(input,active)=>{
 const scene=new T.Scene(),w=Object.assign(Object.create(World.prototype),{scene,terrain,cover:input,
  pondMeshes:[],grades:new Map,byId:new Map,reliefActive:new Set,mat:material,shoreFaces:[]});
 w.addShoreFaces(material,undefined,false,undefined,false,undefined,true,active);
 return w;
};
const triangles=w=>{
 const a=[];
 for(const m of w.shoreFaces){
  const p=m.geometry.attributes.position.array;
  for(let i=0;i<p.length;i+=9)a.push(Buffer.from(p.buffer,p.byteOffset+i*4,36).toString('hex'));
 }
 return a.sort();
};
const base=worldWith(cover,false),repair=worldWith(cover,true);
assert.deepEqual(repair.legacyShoreState,base.legacyShoreState);
assert.deepEqual(repair.tryonCoastState,{chunks:1,refined:0});
assert.deepEqual(repair.openCoastState,{chunks:2,refined:0});
assert.deepEqual(repair.panmureCoastState,{chunks:1,refined:0});
assert.equal(base.tryonCoastState,null);
const old=triangles(base),cur=triangles(repair);
assert.deepEqual(cur,old);
const far=[-250000,300000],extentX=(terrain.right-terrain.left)/cover.width,extentZ=(terrain.bottom-terrain.top)/cover.height;
let geometryBuild,exactContactProbeCount=0;const probes=[];
for(const [i,j] of TRYON_SHORE_CELLS){
 const x=terrain.left+(i+1)*extentX,z=terrain.top+(j+1)*extentZ;
 for(let a=-16;a<=16;a++)for(let b=-16;b<=16;b++){
  const X=x+a*2.16,Z=z+b*2.16;
  assert.deepEqual(repair.surface(X,Z),base.surface(X,Z));
  assert.equal(repair.visualGroundHeight(X,Z),base.visualGroundHeight(X,Z));
  exactContactProbeCount++;
 }
 const arc=repair.tryonCoast;
 const apply=([a,b])=>arc.update(a,b,q=>repair.visualGroundSignature(q),(x,z)=>repair.visualGroundHeight(x,z));
 const near=()=>repair.scene.children.filter(t=>t.name==='Cape Tryon coverage repair'&&t.visible);
 apply([x,z]);assert.equal(near().length,1);
 const p=near()[0].geometry.attributes.position.array;
 assert(p.length>30);
 const h=sha(Buffer.from(p.buffer));
 apply(far);assert.equal(near().length,0);
 apply([x,z]);assert.equal(near().length,1);
 assert.equal(sha(Buffer.from(near()[0].geometry.attributes.position.array.buffer)),h);
 if(!geometryBuild)geometryBuild={triangles:p.length/9,sha:h,visibleNearDraws:1};
 assert.equal(geometryBuild.sha,h);
 probes.push({i,j,contactProbes:33**2,reentryExact:true});
}
const bad=new Cover(c.width,c.height,new Uint8Array(ab(cr)),harbour,'not-this-cover');
assert.equal(worldWith(bad,true).tryonCoastState,null);
const site=SITES.find(s=>s.id==='cape-tryon-coast');assert(site);
const surface=(x,z)=>repair.surface(x,z),stockSurface=(x,z)=>base.surface(x,z);
const flight=spawn(site,surface),compare=spawn(site,stockSurface);
const start={x:flight.x,z:flight.z,altitude:flight.y},initial=surface(start.x,start.z);
assert(!initial.land&&start.altitude>81&&start.altitude<82);
let minVirtualTerrainClearanceM=Infinity,landTicks=0,steps=0;
const motion=()=>Math.hypot(flight.x-start.x,flight.z-start.z);
for(;steps<1850&&motion()<870;steps++){
 step(flight,neutral,surface);step(compare,neutral,stockSurface);
 assert.deepEqual(flight,compare);
 const ground=surface(flight.x,flight.z);landTicks+=Number(ground.land);
 minVirtualTerrainClearanceM=Math.min(minVirtualTerrainClearanceM,flight.y-ground.height);
}
assert(motion()>=870&&flight.status==='flying'&&minVirtualTerrainClearanceM>49&&landTicks>1);
const neutralCorridor={site:site.id,initial,initialAltitudeM:start.altitude,fixedStepHz:Math.round(1/FIXED_STEP),motionM:motion(),
 minVirtualTerrainClearanceM,steps,overLandTicks:landTicks,exactInStockComparison:true,notForNavigation:true};
console.log(JSON.stringify({stockTriangles:old.length,stockBatches:base.shoreFaces.length,exactFloat32:true,
 baselineCover:sha(cr),wrongCoverRejected:true,groundAndContactUnchanged:true,geometryBuild,exactContactProbeCount,neutralCorridor,sites:probes},null,2));
