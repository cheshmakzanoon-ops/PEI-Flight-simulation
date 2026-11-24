import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {BufferAttribute,type Mesh,type MeshStandardMaterial} from 'three';
import {Terrain} from '../src/sim/terrain.ts';
import {POINT_PRIM,POINT_PRIM_DEPARTURE,pointPrimLayers,pointPrimNear,pointPrimOwner,pointPrimRequested,pointPrimDepartureAvailable,pointPrimWire} from '../src/render/point-prim/admit.ts';
import {POINT_PRIM_GRADE as pin} from '../src/render/point-prim/stamp.ts';
import {loadPointPrimGrade,pointPrimArtMatches,preparePointPrimAssets} from '../src/render/point-prim/assets.ts';
import {buildPointPrim} from '../src/render/point-prim/art.ts';
import {SITES} from '../src/sim/places.ts';

const wire=new Uint8Array(readFileSync(new URL('../public/world/point-prim-grade.bin.gz',import.meta.url)));
const decoded=new Uint8Array(gunzipSync(wire));
const good=()=>new Response(wire,{headers:{'Content-Length':String(pin.wireBytes)}});
const t=new Terrain({width:2,height:2,bounds:[-64.47,45.94,-61.93,47.1]},new Int16Array([3,3,3,3]));
test('Point Prim is ordinary Standard and preserves independently authored comparisons',()=>{
 assert.equal(pointPrimRequested(new URLSearchParams()),true);
 assert(pointPrimDepartureAvailable(new URLSearchParams('stockPointPrim')));
 assert(!pointPrimDepartureAvailable(new URLSearchParams('scenery=detail')));
 assert(pointPrimDepartureAvailable(new URLSearchParams('scenery=detail&pointPrimStudy')));
 for(const flag of ['regionalCanopyStudy','miscoucheCanopyStudy','beaconsfieldReview','duneReliefStudy']){
  assert(!pointPrimRequested(new URLSearchParams(flag)));
  assert(pointPrimRequested(new URLSearchParams(flag+'&pointPrimStudy')));
 }
 assert.equal(pointPrimRequested(new URLSearchParams('pointPrimStudy')),true);
 const old=['stockPointPrim','scenery=detail','surveyRelief','inlandRelief','buildingShadows','indianRiverReview','northCapeWind','seatedRoads',
  'seatedForestShadows','woodland3D','canopyLight','sourceGrassNap'];
 for(const flag of old){
  const q=new URLSearchParams('pointPrimStudy&'+flag),original=q.toString();
  assert.equal(pointPrimRequested(q),false,flag);assert.equal(q.toString(),original,'never rewrite existing fields');
 }
 assert.equal(SITES.some(s=>s.id===POINT_PRIM_DEPARTURE.id),false);
 assert.equal(pointPrimLayers(POINT_PRIM.road,POINT_PRIM.atlas,POINT_PRIM.sidewalk,POINT_PRIM.parking),true);
 assert.equal(pointPrimLayers(POINT_PRIM.road,POINT_PRIM.atlas,undefined,POINT_PRIM.parking),false);
 const [x,z]=POINT_PRIM.origin;
 assert(pointPrimNear(x,72,z,{x:x+120,y:78,z},false));
 assert(!pointPrimNear(x,72,z,{x:x+1081,y:78,z},false));
 assert(pointPrimNear(x,72,z,{x:x+1081,y:78,z},true));
 assert(!pointPrimNear(x,72,z,{x:x+1350,y:78,z},true));
 assert(!pointPrimNear(x,350,z,{x,y:140,z},true));
});
test('Only the one exact ordinary q100 wire and manifest translation are authorized',async()=>{
 const i=JSON.parse(readFileSync(new URL('../public/world/buildings/index.json',import.meta.url),'utf8')),p=readFileSync(new URL('../public/world/buildings/tiles.pack',import.meta.url));
 const a=i.tiles.find(t=>t.id==='q100');
 assert(pointPrimOwner(i.sha256,a));assert(!pointPrimOwner(i.sha256,{...a,bytes:a.bytes+1}));
 assert(!pointPrimOwner(i.sha256,{...a,bounds:[...a.bounds.slice(0,3),a.bounds[3]+.00001]}));
 const raw=Uint8Array.from(p.subarray(a.offset,a.offset+a.bytes));
 assert(await pointPrimWire(raw.buffer));raw[raw.length-8]^=32;
 assert.equal(await pointPrimWire(raw.buffer),false);
});
test('The exact 1,465-byte grade and the explicit HTTP-decoded case are admitted',async()=>{
 assert.equal(wire.length,1465);assert.equal(decoded.length,28227);
 const make=await loadPointPrimGrade('relative/',async url=>{
  assert.equal(url,'relative/point-prim-grade.bin.gz');return good();
 });
 assert(make);assert.equal(make(t,()=>3).grid.spec,pin);
 const http=await loadPointPrimGrade('relative/',async()=>new Response(decoded,{headers:{
  'Content-Encoding':'gzip','Content-Length':String(pin.wireBytes)
 }}));
 assert(http);assert.equal(http(t,()=>3).grid.spec,pin);
});
test('Point Prim partial/missing/oversized/corrupt/truncated/late data fail without requesting it twice',async()=>{
 const broken=wire.slice();broken[100]^=4;
 const raised=[
  new Response(null,{status:404}),new Response(wire,{status:206}),new Response(broken),
  new Response(wire.slice(0,-1)),new Response(new Uint8Array(pin.wireBytes+1)),
  new Response(decoded),new Response(decoded,{headers:{'Content-Encoding':'br'}})
 ];
 for(const r of raised){
  let n=0; assert.equal(await loadPointPrimGrade('',async()=>{n++;return r;}),undefined);assert.equal(n,1);
 }
 let aborted=false;
 const late=await loadPointPrimGrade('',async(_p,opts)=>{
  opts?.signal?.addEventListener('abort',()=>aborted=true);
  await new Promise(r=>setTimeout(r,110));return good();
 },24);
 assert.equal(late,undefined);assert(aborted);
});
test('The plain dynamically prepared art is authenticated; faults never build the cedar map or install anything',async()=>{
 const goodGroup=buildPointPrim('flight',false);
 assert(await pointPrimArtMatches(goodGroup));
 const w=goodGroup.children[0] as Mesh;
 w.geometry.getAttribute('position').setX(4,w.geometry.getAttribute('position').getX(4)+.02);
 assert.equal(await pointPrimArtMatches(goodGroup),false);
 for(const sabotage of ['layout','draw range','transparent']){
  const g=buildPointPrim('flight',false),m=g.children[0] as Mesh;
  if(sabotage==='layout')m.geometry.setAttribute('uv',new BufferAttribute(m.geometry.getAttribute('uv').array,1));
  if(sabotage==='draw range')m.geometry.setDrawRange(0,3);
  if(sabotage==='transparent'){const mm=m.material as MeshStandardMaterial;mm.opacity=.21;mm.transparent=true;}
  assert.equal(await pointPrimArtMatches(g),false,sabotage);
 }
 let n=0;
 const art=async()=>({buildPointPrim:(tier,withPaint)=>{n++;assert.equal(withPaint,false);return buildPointPrim(tier,false);}});
 assert.equal(await preparePointPrimAssets(t,'',art,async()=>new Response(null,{status:404})),undefined);
 assert.equal(n,0);
 const out=await preparePointPrimAssets(t,'',art,async()=>good());
 assert(out);assert.equal(n,1);assert.equal(out.group.visible,false);assert.equal(out.group.parent,null);
 assert.equal(out.group.matrix.elements[13],POINT_PRIM.datum);
 const missing=await preparePointPrimAssets(t,'',()=>Promise.reject(Error('no module')),async()=>good());
 assert.equal(missing,undefined);assert.equal(n,1);
});
