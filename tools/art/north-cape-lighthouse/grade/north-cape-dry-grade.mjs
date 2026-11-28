#!/usr/bin/env node
/** Offline screening only. Rebuild the packed regular stock owner, not the live world. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {PlaneGeometry} from 'three';
import {gradeFaceProof} from './north-cape-grade-face.mjs';
import {readNorthCapeGradeExclusions} from './north-cape-grade-exclusions.mjs';

const [repository,destination,...options]=process.argv.slice(2);
assert.ok(options.length===0||options.length===1&&options[0]==='--counterfactual');
assert.ok(repository&&destination,'usage: node north-cape-dry-grade.mjs <repository root> <new evidence JSON>');
const root=resolve(repository),url=p=>pathToFileURL(resolve(root,p));
const sha=b=>createHash('sha256').update(b).digest('hex');
const parser=p=>JSON.parse(readFileSync(url(p),'utf8'));
const input=(p,name,compressedHash,decodedHash)=>{
 const stored=readFileSync(url(p+'/'+name));
 assert.equal(sha(stored),compressedHash);
 const raw=gunzipSync(stored);
 assert.equal(sha(raw),decodedHash);
 return raw;
};
const {Cover}=await import(url('src/sim/cover.ts'));
const {Terrain}=await import(url('src/sim/terrain.ts'));
const {project}=await import(url('src/sim/geo.ts'));
const {WORLD_COLS,WORLD_ROWS,GROUND_LIFT,SURVEY_LOD}=await import(url('src/sim/coastal-terrain.ts'));
assert.deepEqual([WORLD_COLS,WORLD_ROWS,GROUND_LIFT,SURVEY_LOD],[32,22,.12,112]);

const terrainSpec=parser('public/world/terrain.json'),coverSpec=parser('public/world/cover.json');
const terrainBytes=input('public/world',terrainSpec.file,'02f3aa212664f267b013f476762940c5ffc0a4af74a5bbf7267e812ae4f3ffa4',
 '661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d');
const coverBytes=input('public/world',coverSpec.file,'46a4f4736a885576fa0529cd0f91bacdbfd47e3bfd719130ba3446c52c245863',
 'e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9');
const signed16=bytes=>Int16Array.from({length:bytes.length/2},(_,k)=>bytes.readInt16LE(2*k));
const terrain=new Terrain(terrainSpec,signed16(terrainBytes));
const cover=new Cover(coverSpec.width,coverSpec.height,coverBytes);

const dir='data/north-cape-lighthouse-study',source=parser(dir+'/source.json');
const D=384,N=112;
assert.deepEqual([source.width,source.height,source.validSamples],[D,D,D*D]);
assert.deepEqual(source.registration.geotransform,[2281139,1,0,350642,0,-1]);
const [west,,,north]=source.registration.geotransform;
const grade=signed16(input(dir,source.file,
 '239dccfabd5480a090f04b89fbdbee3ac3bd49203d8b8196329e597936567f32',
 '86a65e3c3f326aca699096711f151aeee7e65eb3f7f32068dce2f7d1873339e3'));
assert.equal(grade.length,D*D);
const points=Array.from(grade,(_,k)=>[west+k%D+.5,north-Math.floor(k/D)-.5]).map(p=>p.join(' '));
const gp=spawnSync('gdaltransform',['-s_srs','EPSG:3979','-t_srs','EPSG:4326'],{
 input:points.join('\n')+'\n',encoding:'utf8',maxBuffer:20*1024*1024,
 env:{...process.env,LC_ALL:'C',PROJ_NETWORK:'OFF'},
});
assert.equal(gp.status,0,gp.stderr);
assert.equal(gp.stderr,'');
const coords=gp.stdout.trim().split('\n').map(line=>{
 const [lon,lat,z]=line.split(/\s+/).map(Number);assert.ok(lon<-63.99&&lon>-64.01&&lat>47.05&&lat<47.07&&z===0,line);
 const q=project(lon,lat),[u,v]=terrain.uv(q.x,q.z);
 const i=Math.floor(u*WORLD_COLS);
 assert.ok(i===5||i===6);assert.equal(Math.floor(v*WORLD_ROWS),0);
 return {...q, owner:i===5};
});
assert.equal(coords.length,grade.length);

// Equivalent to the regular portion of World.patch. No adaptive grades, seams or collision.
const w=(terrain.right-terrain.left)/WORLD_COLS,h=(terrain.bottom-terrain.top)/WORLD_ROWS;
const x0=terrain.left+5*w,z0=terrain.top,tx=x0+w/2,tz=z0+h/2;
const plane=new PlaneGeometry(w,h,N,N).rotateX(-Math.PI/2);
const pos=plane.attributes.position,idx=plane.index;
assert.ok(idx);
for(let i=0;i<pos.count;i++){
 const x=pos.getX(i)+tx,z=pos.getZ(i)+tz;
 pos.setY(i,terrain.atlasElevation(x,z)+GROUND_LIFT);
 plane.attributes.uv.setXY(i,...terrain.uv(x,z));
}
const a=N+1;
const xAxis=Array.from({length:a},(_,i)=>pos.getX(i)+tx);
const zAxis=Array.from({length:a},(_,i)=>pos.getZ(i*a)+tz);
const band=(axis,v)=>{
 assert.ok(v>=axis[0]&&v<axis[N]); let lo=0,hi=N;
 while(hi-lo>1){const m=(lo+hi)>>1;if(v<axis[m])hi=m;else lo=m;}
 return lo;
};
function packedHeight(x,z){
 const i=band(xAxis,x),j=band(zAxis,z);
 const dx=xAxis[i+1]-xAxis[i],dz=zAxis[j+1]-zAxis[j];
 const u=(x-xAxis[i])/dx,v=(z-zAxis[j])/dz,k=j*a+i;
 const [nw,ne,sw,se]=[k,k+1,k+a,k+a+1].map(n=>pos.getY(n));
 const first=u+v<=1;
 const y=first?nw+(ne-nw)*u+(sw-nw)*v:se+(sw-se)*(1-u)+(ne-se)*(1-v);
 const ox=first?ne-nw:se-sw,oz=first?sw-nw:se-ne;
 return {y,face:2*(j*N+i)+Number(!first),slope:Math.hypot(ox/dx,oz/dz)};
}
const locator=project(source.reference.longitude,source.reference.latitude);
const seat=packedHeight(locator.x,locator.z);
assert.equal(seat.face,20151);
const seatVertices=[0,1,2].map(k=>idx.getX(3*seat.face+k));
assert.deepEqual(seatVertices,[10277,10278,10165]);
const pb=Buffer.from(pos.array.buffer,pos.array.byteOffset,pos.array.byteLength);
assert.deepEqual(seatVertices.flatMap(i=>[0,4,8].map(j=>pb.readUInt32LE(i*12+j))),
 [1160603669,1085813795,1155426707,1160826500,1084606665,1155426707,1160826500,1083417045,1154998000]);

assert.equal(terrainSpec.verticalDatum,'CGVD2013');
assert.equal(source.registration.vertical,'EPSG:6647 (CGVD2013)');
assert.equal(terrainSpec.sources[0].etag,source.source.etag);
const exclusions=await readNorthCapeGradeExclusions(url,coords,project,locator);
const rows=coords.map(({x,z,owner},i)=>{
 // Runtime seam exchange can replace the outside rows; omit every face that touches them.
 const within=owner&&x>=xAxis[1]&&x<xAxis[N-1]&&z>=zAxis[1]&&z<zAxis[N-1];
 assert.notEqual(grade[i],-32768);
 const stock=within?packedHeight(x,z):null,cm=grade[i],m=cm/100;
 return {m, owner, within, stock, protected:within?exclusions.classify({x,z}):'outside', rawDelta:stock?m-stock.y:NaN, gradeDelta:stock?m-(stock.y-GROUND_LIFT):NaN,
  land:terrain.isLand(x,z), code:cover.sample(terrain,x,z), sign:cover.legacyDistance(terrain,x,z)};
});
const isInterior=(i,classes)=>rows[i].within&&rows[i].land&&classes.includes(rows[i].code)&&rows[i].sign>=55&&rows[i].m>=2;
const cohorts={all:Uint8Array.from(rows,row=>+row.within),dryGrass:new Uint8Array(rows.length),dryGrassOrCrop:new Uint8Array(rows.length),
 dryGrassAwayFromMappedObjects:new Uint8Array(rows.length)};
const erosion=[-2*D,-2,-D-1,-D+1,0,D-1,D+1,2,2*D];
for(let r=2;r<D-2;r++)for(let c=2;c<D-2;c++){
 const i=r*D+c;
 cohorts.dryGrass[i]=Number(erosion.every(o=>isInterior(i+o,[30])));
 cohorts.dryGrassAwayFromMappedObjects[i]=Number(cohorts.dryGrass[i]&&erosion.every(o=>!rows[i+o].protected));
 cohorts.dryGrassOrCrop[i]=Number(erosion.every(o=>isInterior(i+o,[30,40])));
}
function percent(v,p){return Number(v[Math.floor((v.length-1)*p)].toFixed(6));}
function distribution(v){
 assert.ok(v.length>0);
 v.sort((a,b)=>a-b);
 return Object.fromEntries([0,.1,.5,.9,.95,.99,1].map(p=>[p,percent(v,p)]));
}
function substantial(mask,dir){
 const visited=new Uint8Array(rows.length),result=[];
 for(let i=0;i<rows.length;i++){
  if(visited[i]||!mask[i]||dir*rows[i].gradeDelta<.5)continue;
  let loR=D,loC=D,hiR=-1,hiC=-1;const group=[i];visited[i]=1;
  for(let k=0;k<group.length;k++){
   const j=group[k],r=Math.floor(j/D),c=j%D;
   loR=Math.min(loR,r);hiR=Math.max(hiR,r);loC=Math.min(loC,c);hiC=Math.max(hiC,c);
   for(const n of [r>0?j-D:-1,r<D-1?j+D:-1,c>0?j-1:-1,c<D-1?j+1:-1]){
    if(n<0||visited[n]||!mask[n]||dir*rows[n].gradeDelta<.5)continue;
    visited[n]=1;group.push(n);
   }
  }
  if(group.length>=9)result.push({count:group.length,window:[loC,loR,hiC,hiR],
   medianDeltaM:distribution(group.map(j=>rows[j].gradeDelta))[.5]});
 }
 result.sort((a,b)=>b.count-a.count||a.window[1]-b.window[1]||a.window[0]-b.window[0]);
 return {componentsOfAtLeast9:result.length,large:result.slice(0,10)};
}
const summaries={};
for(const [name,mask] of Object.entries(cohorts)){
 const eligible=rows.map((_,i)=>i).filter(i=>mask[i]),subset=eligible.map(i=>rows[i]);
 const slope=[];const slopeRatioGain=[];
 for(const i of eligible){
  const r=Math.floor(i/D),c=i%D;if(r<2||r>=D-2||c<2||c>=D-2)continue;
  if(!erosion.every(o=>mask[i+o]))continue;
  const a=(rows[i+2].m-rows[i-2].m)/4,b=(rows[i+2*D].m-rows[i-2*D].m)/4;
  const stock=(o)=>rows[i+o].stock.y;
  const x=(stock(2)-stock(-2))/4,z=(stock(2*D)-stock(-2*D))/4;
  slope.push(Math.hypot(a,b));slopeRatioGain.push(Math.hypot(a-x,b-z));
 }
 summaries[name]={cells:subset.length,sourceMinusPackedDisplayedM:distribution(subset.map(q=>q.rawDelta)),
  sourceMinusPackedNoRenderLiftM:distribution(subset.map(q=>q.gradeDelta)),
  absoluteDifferenceNoRenderLiftM:distribution(subset.map(q=>Math.abs(q.gradeDelta))),
  sourceSlope4mRisePerRun:distribution(slope),slopeVectorDifference4mRisePerRun:distribution(slopeRatioGain),
  atLeastHalfMetreHigher:substantial(mask,1),atLeastHalfMetreLower:substantial(mask,-1)};
}
const facets=new Map();
for(let i=0;i<rows.length;i++){
 const row=rows[i]; if(!row.within)continue;
 const f=row.stock.face;
 const record=facets.get(f)??{admitted:0,window:[D,D,-1,-1]};
 if(cohorts.dryGrassAwayFromMappedObjects[i]){
  record.admitted++;
 }
 const c=i%D,r=Math.floor(i/D),box=record.window;
 record.window=[Math.min(box[0],c),Math.min(box[1],r),Math.max(box[2],c),Math.max(box[3],r)];
 facets.set(f,record);
}
// Screen exact source-origin rectangles that remain inside one stock facet even at nine reserve taps.
const supportFaces=[];
for(const [face,record] of facets){
 const [c0,r0,c1,r1]=record.window;
 if(record.admitted<64)continue;
 const heights=new Uint16Array(c1-c0+2);
 let optimum=null;
 for(let r=r0;r<=r1;r++){
  for(let c=c0;c<=c1;c++){
   const i=r*D+c,k=c-c0;
   const ok=cohorts.dryGrassAwayFromMappedObjects[i]&&rows[i].gradeDelta>=.35&&
    erosion.every(o=>rows[i+o].stock?.face===face);
   heights[k]=ok?heights[k]+1:0;
  }
  const stack=[];
  for(let j=0;j<heights.length;j++){
   let left=j;
   while(stack.length&&stack.at(-1)[1]>heights[j]){
    const [l,h]=stack.pop();left=l;
    const w=j-l,area=w*h,window=[c0+l,r-h+1,c0+j-1,r];
    if(w>=8&&h>=8&&(!optimum||area>optimum.area))
     optimum={face,window,area};
   }
   if(!stack.length||heights[j]>stack.at(-1)[1])stack.push([left,heights[j]]);
  }
 }
 if(optimum)supportFaces.push(optimum);
}
supportFaces.sort((a,b)=>b.area-a.area||a.face-b.face);
const report={
 scope:'Offline regular stock 5-0 packed terrain against Federal DTM; not native GPU, exact survey residual, coastline/cover correction, foundation, grade proposal, or artwork.',
 rowsNorthFirst:true,pixelCentres:'EPSG:3979 east and north ±½ m -> GDAL EPSG:4326 [lon lat] -> existing local tangent frame',
 stockGeometrySHA256:{position:sha(pb),index:sha(Buffer.from(idx.array.buffer,idx.array.byteOffset,idx.array.byteLength))},
 sourceVertical:'Both the sharp DTM and the coarse atlas declare CGVD2013 and the same Federal DTM ETag. No vertical bias is fitted.',
 renderLiftM:GROUND_LIFT,cohort:'Only interior faces of tile 5-0; adjacent tile 6-0 and every face touching stock seam rows are excluded. Dry interior uses current atlas land, 55 m signed mask, DTM at least 2 m and bundled approximate cover class 30 or class 30/40 across nine 1–2 m offsets. The additional mapped-object cohort rejects the documented stock road, sidewalk, parking, building and lighthouse locator buffers across the same nine taps. No exact shoreline or exhaustive obstructions.',
 mappedConflictsInStrictGrass:rows.reduce((a,r,i)=>(cohorts.dryGrass[i]&&r.protected&&(a[r.protected]=(a[r.protected]??0)+1),a),{}),
 mappedExclusions:exclusions.receipt,
 excludedAdjacentTileCells:rows.filter(r=>!r.owner).length,
 excludedStockSeamFaceCells:rows.filter(r=>r.owner&&!r.within).length,
 classificationStock:rows.filter(r=>r.within).reduce((a,r)=>(a[r.code]=(a[r.code]??0)+1,a),{}),
 packedSeat:{face:seat.face,ebo:seatVertices,displayedY:seat.y},
 candidateRectangles:supportFaces.slice(0,8),
 detachedSingleFace:gradeFaceProof({plane,witness:supportFaces[0],rows,coords,D,tx,tz,packedHeight,stockUV:(x,z)=>terrain.uv(x,z),lift:GROUND_LIFT,counterfactual:options.length===1}),
 summaries,
};
writeFileSync(destination,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
plane.dispose();
