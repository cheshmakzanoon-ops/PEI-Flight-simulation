/** Read-only exact current shipped emitter. No global app bootstrap or fetch. */
import {readFileSync as read} from 'node:fs';import {createHash} from 'node:crypto';import {gunzipSync} from 'node:zlib';
import {registerHooks} from 'node:module';import {join,resolve} from 'node:path';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
import * as T from 'three';
import {nativeFieldSeat} from './native-field-seat.ts';
const REPO=resolve(process.argv[2]);const url=pathToFileURL(REPO+'/').href,src=url+'src/';
registerHooks({resolve(spec,ctx,next){
 if(ctx.parentURL?.startsWith(src)&&(!spec.startsWith('./')&&!spec.startsWith('../')&&!spec.startsWith('/')&&!spec.startsWith('node:')&&!spec.includes(':')))
   return next(spec,{...ctx,parentURL:import.meta.url});
 return next(spec,ctx);
},load(h,ctx,next){
 const f=next(h,ctx);
 if(h.startsWith(src)&&h.endsWith('.ts')&&f.source){
  const txt=typeof f.source==='string'?f.source:Buffer.from(f.source).toString();
  if(txt.includes('import.meta.env'))return {...f,source:"import.meta.env={BASE_URL:'/'};\n"+txt};
 }
 return f;
}});
const srcModule=name=>import(src+name);
const [{Terrain},{Cover},{World},{Buildings},{project,METRES_PER_LON,METRES_PER_LAT},sites,{decodeRoads},coastal,inland]=await Promise.all([
 srcModule('sim/terrain.ts'),srcModule('sim/cover.ts'),srcModule('render/world.ts'),srcModule('render/buildings.ts'),srcModule('sim/geo.ts'),
 srcModule('sim/places.ts'),srcModule('render/roads.ts'),srcModule('sim/coastal-surveys.generated.ts'),srcModule('sim/inland-surveys.generated.ts')]);
const sha=b=>createHash('sha256').update(b).digest('hex');
const ab=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const raw=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const f=s=>read(join(REPO,'public/world',s));
const H=JSON.parse(f('terrain.json')),C=JSON.parse(f('cover.json')),D=gunzipSync(f(H.file)),Cv=f(C.file);
assert.equal(sha(D),H.sha256);assert.equal(sha(Cv),C.compressedSha256);
const land=new Terrain(H,new Int16Array(ab(D)));
const cover=new Cover(C.width,C.height,new Uint8Array(ab(gunzipSync(Cv))),undefined,C.compressedSha256);
const tab=JSON.parse(f('buildings/index.json')),wire=f('buildings/'+tab.file);
assert.equal(sha(wire),tab.sha256);
const tile=tab.tiles.find(t=>t.id==='q1010'),sl=wire.subarray(tile.offset,tile.offset+tile.bytes);
assert.equal(sha(sl),tile.sha256);
const [a,b,c,d]=tile.bounds,A=project(a,d),Z=project(c,b);
const loc=project(-62-44/60-46.1/3600,45+56/60+59.5/3600),features=JSON.parse(gunzipSync(sl)).features;
assert.equal(features.length,366);
const target=features[84];assert.equal(target.height,15.42);
const ring=target.footprint.map(p=>project(...p)),near=features.map((q,i)=>[i,Math.min(...q.footprint.map(p=>{
 const {x,z}=project(...p);return Math.hypot(x-loc.x,z-loc.z);
}))]).sort((a,b)=>a[1]-b[1]).slice(0,5);
assert.equal(near[0][0],84);
const xy=[Math.min(...ring.map(r=>r.x)),Math.min(...ring.map(r=>r.z)),Math.max(...ring.map(r=>r.x)),Math.max(...ring.map(r=>r.z))];
const diameter=Math.max(...ring.flatMap(a=>ring.map(b=>Math.hypot(a.x-b.x,a.z-b.z))));
const crossRoadProbe=(q,a,b)=>{const x=b.x-a.x,z=b.z-a.z,k=Math.max(0,Math.min(1,((q.x-a.x)*x+(q.z-a.z)*z)/(x*x+z*z)));return Math.hypot(q.x-a.x-k*x,q.z-a.z-k*z);};
const pinToRing=Math.min(...ring.map((p,i)=>crossRoadProbe(loc,p,ring[(i+1)%ring.length])));
const pos=ring.reduce((m,n)=>[m[0]+n.x/ring.length,m[1]+n.z/ring.length],[0,0]);
const area=Math.abs(ring.reduce((sum,r,i)=>{const p=ring[(i+1)%ring.length];
 return sum+(r.x-pos[0])*(p.z-pos[1])-(r.z-pos[1])*(p.x-pos[0]);},0))*.5;
const pointIn=(q)=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
 const [u,v]=[ring[i],ring[j]];
 if((u.z>q.z)!==(v.z>q.z)&&q.x<(v.x-u.x)*(q.z-u.z)/(v.z-u.z)+u.x)inside=!inside;
 }return inside;};
const wt=(land.right-land.left)/32,dt=(land.bottom-land.top)/22;
const i=Math.floor((loc.x-land.left)/wt),j=Math.floor((loc.z-land.top)/dt);
assert(i===21&&j===21);
assert([...coastal.COASTAL_SPECS,...inland.INLAND_SPECS].every(s=>s.tileX!==i||s.tileZ!==j));
const probe=Object.assign(Object.create(World.prototype),{terrain:land,mat:new T.MeshBasicMaterial()});
const t=probe.patch(land.left+i*wt,land.top+j*dt,wt,dt,112),orig=t.geometry;
const X=orig.attributes.position.array.map((s,k)=>Math.fround(s+Math.fround(t.position.toArray()[k%3])));
const seat=nativeFieldSeat(X,orig.index.array,112);
const world=Object.assign(Object.create(Buildings.prototype),{mat:new T.ShaderMaterial(),t:land,atlasHash:tab.sha256});
const m=world.generate(features,{...tile,x1:A.x,z1:A.z,x2:Z.x,z2:Z.z},false,84,false,tile.sha256);
const s=m.userData.beaconTriangles;assert(s?.length===2);
const attr=m.geometry.attributes;
const q=Object.fromEntries(Object.entries(attr).map(([k,v])=>[k,{
 count:v.count,completeSHA256:sha(raw(v.array)),exact84SHA256:sha(raw(v.array.subarray(s[0]*v.itemSize,s[1]*v.itemSize)))}]));
const ys=(flag)=>Array.from({length:s[1]-s[0]},(_,i)=>s[0]+i).filter(i=>attr.topFlag.getX(i)===flag).map(i=>attr.position.getY(i));
const yRoof=ys(1),walls=ys(0);assert(yRoof.length>0&&walls.length>0);
const vals=r=>[Math.min(...r),Math.max(...r)];
function ladder(a,b,start,spacing){
 const q=[a,b];
 for(let i=Math.floor((a-start)/spacing)-2;i<=Math.ceil((b-start)/spacing)+2;i++){
  const v=start+i*spacing;if(v>a&&v<b)q.push(v);
 }
 return q;
}
const yNodes=[];
const Xs=ladder(xy[0],xy[2],land.left+((land.right-land.left)/H.width)*.5,(land.right-land.left)/H.width);
const Zs=ladder(xy[1],xy[3],land.top+((land.bottom-land.top)/H.height)*.5,(land.bottom-land.top)/H.height);
const B=[];for(const x of Xs)for(const z of Zs)B.push(cover.legacyDistance(land,x,z));
const demClass=new Set(),regularSamples=[];
for(let k=0;k<=60;k++)for(let u=0;u<=60;u++){
 const x=xy[0]+k/60*(xy[2]-xy[0]),z=xy[1]+u/60*(xy[3]-xy[1]);
 const old=seat(x,z);assert(Number.isFinite(old));
 const d=land.contactHeight(x,z,cover.legacyDistance(land,x,z)>0);
 if(!pointIn({x,z}))continue;
 demClass.add(cover.sample(land,x,z));regularSamples.push([old,d,old-d]);
}
const Rd=zlibFile('roads.json','roads.bin.gz');
function zlibFile(receipt,data){
 const h=JSON.parse(f(receipt)),w=gunzipSync(f(data));assert.equal(sha(w),h.sha256);return ab(w);
}
const r=decodeRoads(Rd);const dist=(q,a,b)=>{
 const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((q.x-a.x)*dx+(q.z-a.z)*dz)/(dx*dx+dz*dz)));
 return Math.hypot(q.x-a.x-t*dx,q.z-a.z-t*dz);
};
let road=[];
const extent=Math.hypot(xy[2]-xy[0],xy[3]-xy[1])*.5;
const ownCenter={x:(xy[0]+xy[2])*.5,z:(xy[1]+xy[3])*.5};
for(const [id,x]of r.entries())for(let k=1;k<x.points.length;k++){
 const [a,b]=x.points.slice(k-1,k+1);if(a.x===b.x&&a.z===b.z)continue;
 road.push([id,k-1,dist(ownCenter,a,b)-extent-[2.,2.8,3.6,4.8,6.4][x.flags&7]]);
}
road.sort((a,b)=>a[2]-b[2]);
const S=[...sites.SITES,...Object.values(sites).filter(v=>v?.id&&v.lon&&v.lat)];
const ss=S.map(s=>{const w=project(s.lon,s.lat);return {id:s.id,distanceM:Math.hypot(w.x-loc.x,w.z-loc.z)};}).sort((a,b)=>a.distanceM-b.distanceM).slice(0,4);
const {makeWoodIslandsDetached}=await import('./wood-islands.ts'),study=makeWoodIslandsDetached();
const bBox=study.geometry.boundingBox,wholeLongExtent=bBox.max.z-bBox.min.z;
const p0=study.geometry.attributes.position;
let lo=Infinity,hi=-Infinity;
for(let i=0;i<p0.count;i++)if(p0.getY(i)===0){lo=Math.min(lo,p0.getZ(i));hi=Math.max(hi,p0.getZ(i));}
assert(wholeLongExtent>diameter&&hi-lo>diameter);
study.dispose();
const out={
 scope:'Canonical source CPU emitter snapshot, not native submitted scene or live camera. Detached appearance only.',
 actualProjectionBasis:[METRES_PER_LON,METRES_PER_LAT],
 placementHold:['2020 automatic roof segmentation is not wall/house or roof-component inventory','0.1 arc-second station locator is not a tower floor pin or measured bearing','No contemporary post-relocation foundation survey nor preferred native co-owner comparison','Long untested distance from current registered ordinary departures'],
 owners:{foldedTile:'21-21',aeb:'q1010/84',ownerTileWireSha:tile.sha256,ownerTileWireBytes:sl.length,fullAtlasSha:tab.sha256,
  original8PointRingSHA256:sha(JSON.stringify(target.footprint)),areaM2:area,stationLocatorInsideOldAEB:pointIn(loc),
  heightReturnAboveGround:target.height,minHeightReturnAboveGround:target.minHeight,neighborsByVertexFromOfficialLocator:near.slice(1)},
 submittedCPU:{aebTileVertexCount:attr.position.count,subjectInterval:s,roofTriangles:yRoof.length/3,
  roofDistinctY:[...new Set(yRoof)],wallYMinMax:vals(walls),attributes:q,
  groundGeometry:{positionSha:sha(raw(orig.attributes.position.array)),indexSha:sha(raw(orig.index.array)),uvSha:sha(raw(orig.attributes.uv.array))}},
 independentPlacementVeto:{bound:'Any point pair contained by the original roof ring must have distance <= maximum ring diameter. The detached body and eave knowingly exceed that bound even before placement and independently of rotation. No evidence that the complete as-built wall footprint equals this ring.',
  oldMaxPlanDiameterM:diameter,presentRoundedLocatorDistanceFromOldPerimeterM:pinToRing,detachedLongDimensionM:wholeLongExtent,
  detachedY0SupportLongDimensionM:hi-lo,anyRigidUnscaledContainmentInExactOldRing:false,
  roadWidthsAreOnlyComparedToOldRing:true},
 ground:{bboxCoverMinMaxM:vals(B),categoricalCover:[...demClass],gridProbeCount:regularSamples.length,
  actualPackedN112Y:vals(regularSamples.map(x=>x[0])),cpuCollisionY:vals(regularSamples.map(x=>x[1])),
  visualVsCollisionY:vals(regularSamples.map(x=>x[2])),minimumRoadwearClearanceToWholeOldBoundingCircumcircleM:road[0][2]},
 nearestPublishedSpawnsNotRecordedApproaches:ss};
console.log(JSON.stringify(out,null,2));
m.geometry.dispose();orig.dispose();world.mat.dispose();probe.mat.dispose();
