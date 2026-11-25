import {protectedOwnerContract} from '../../../src/render/province-field-owners.ts';
import fs from 'node:fs';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';import * as T from 'three';
import {Terrain} from '../../../src/sim/terrain.ts';
import {WORLD_COLS,WORLD_ROWS,SURVEY_LOD} from '../../../src/sim/coastal-terrain.ts';
import {COASTAL_SPECS} from '../../../src/sim/coastal-surveys.generated.ts';
import {INLAND_SPECS} from '../../../src/sim/inland-surveys.generated.ts';
import {BANK_TILE} from '../../../src/render/basin-channel-bank.ts';
import {BOWLEY_POND} from '../../../src/sim/bowley-pond.generated.ts';
import {MONTAGUE_FOUNDATION} from '../../../src/sim/montague-foundation.generated.ts';
import {QUARTERMASTER} from '../../../src/sim/quartermaster.generated.ts';
import {RUNWAYS} from '../../../src/sim/places.ts';
import {SIDEWALKS} from '../../../src/render/sidewalks.generated.ts';
import {MAPPED_PARKING} from '../../../src/render/parking-surfaces.generated.ts';
import {decodeRoads} from '../../../src/render/roads.ts';
import {decodeSidewalks,walkSections} from '../../../src/render/sidewalks.ts';
import {decodeParkingSurfaces} from '../../../src/render/parking-surfaces.ts';
import {World} from '../../../src/render/world.ts';
import {project,geographic,ORIGIN,METRES_PER_LON,METRES_PER_LAT} from '../../../src/sim/geo.ts';
import {decodeConfederationTrail} from '../../../src/render/confederation-trail.ts';
import {CONFEDERATION_TRAIL} from '../../../src/render/confederation-trail.generated.ts';
import {marshPatches} from '../../../src/render/marsh-patches.generated.ts';
import {DUNE_GRASS_AUTHORITY} from '../../../src/render/dune-grass-authority.generated.ts';
import {DUNE_SAND_MASK} from '../../../src/render/dune-sand-pins.generated.ts';
import {CANOPY_FENCE} from '../../../src/render/canopy-fence.generated.ts';
import {MASK_BOUNDS as PASTURE_BOUNDS} from '../../../src/render/panmure-pasture/mask.generated.ts';

import {DUNE_RELIEF} from '../../../src/sim/dune-relief.generated.ts';
import {KINGS_DRY_CROWN} from '../../../src/sim/kings-dry-crown.generated.ts';
import {GABLES_GRADE} from '../../../src/sim/gables-grade.generated.ts';
import {HOG_WEST_GRADE} from '../../../src/sim/hog-west-grade.generated.ts';
import {INDIAN_RIVER_GRADE} from '../../../src/sim/indian-river-grade.generated.ts';
import {RUSTICO_GRADE} from '../../../src/sim/rustico-grade.generated.ts';
import {POINT_PRIM_GRADE} from '../../../src/render/point-prim/stamp.ts';
import {ST_DAVIDS} from '../../../src/render/st-davids/source.generated.ts';
import {SUMMERSIDE_STATION} from '../../../src/render/summerside-station/source.generated.ts';
import {LIGHT_STATIONS} from '../../../src/sim/lighthouse-sites.ts';
const [,,root,fieldFile]=process.argv;if(!fieldFile)throw Error('Usage: actual-world REPO_ROOT SUPPORTED_FIELDS_JSON');
const file=p=>fs.readFileSync(join(root,'public','world',p)),J=p=>JSON.parse(file(p)),U=p=>gunzipSync(file(p)),sha=x=>createHash('sha256').update(x).digest('hex'),slice=x=>x.buffer.slice(x.byteOffset,x.byteOffset+x.byteLength);
const hm=J('terrain.json'),raw=file('height.bin.gz'),h=gunzipSync(raw);assert.equal(sha(h),hm.sha256);
const terrain=new Terrain(hm,new Int16Array(h.buffer,h.byteOffset,h.byteLength/2));
const world=Object.assign(Object.create(World.prototype),{terrain,mat:new T.MeshBasicMaterial()});
const na=SURVEY_LOD+1,na2=na**2,out=new Float32Array(WORLD_COLS*WORLD_ROWS*na2),tileWidth=(terrain.right-terrain.left)/WORLD_COLS,tileDepth=(terrain.bottom-terrain.top)/WORLD_ROWS;
const tiles=new Set();
const fields=JSON.parse(fs.readFileSync(fieldFile)).fields;
assert.equal(fields.length,2880);
for(const q of fields){
 const p=q.outline.map(v=>project(...v)),x=p.map(v=>v.x),z=p.map(v=>v.z);
 for(let j=Math.floor((Math.min(...z)-terrain.top)/tileDepth);j<=Math.floor((Math.max(...z)-terrain.top)/tileDepth);j++)
  for(let i=Math.floor((Math.min(...x)-terrain.left)/tileWidth);i<=Math.floor((Math.max(...x)-terrain.left)/tileWidth);i++)tiles.add(j*WORLD_COLS+i);
}
let axes,firstTriangle;
for(const k of tiles){
 const i=k%WORLD_COLS,j=Math.floor(k/WORLD_COLS),x0=terrain.left+i*tileWidth,z0=terrain.top+j*tileDepth;
 const m=world.patch(x0,z0,tileWidth,tileDepth,SURVEY_LOD);m.updateMatrixWorld(true);
 const g=m.geometry,ps=g.getAttribute('position');
 const A={x:Array.from({length:na},(_,i)=>ps.getX(i)),z:Array.from({length:na},(_,i)=>ps.getZ(na*i))};
 if(!axes){axes=A;firstTriangle=Array.from(g.index.array.subarray(0,6));}
 else assert.deepEqual(A,axes);
 for(let t=0;t<na2;t++)out[k*na2+t]=ps.getY(t);
 g.dispose();
}
assert.deepEqual(firstTriangle,[0,113,1,113,114,1]);
fs.writeFileSync('actual-n112.f32',Buffer.from(out.buffer));
const stockRoads=U('roads.bin.gz'),stockSide=U(SIDEWALKS.asset),stockPark=U(MAPPED_PARKING.asset);
assert.equal(sha(stockRoads),J('roads.json').sha256);assert.equal(sha(stockSide),SIDEWALKS.sha256);assert.equal(sha(stockPark),MAPPED_PARKING.sha256);
const runs=RUNWAYS.map(({id,p,dx,dz,length,width})=>({id,x:p.x,z:p.z,dx,dz,length,width}));
const walkway=decodeSidewalks(slice(stockSide)).flatMap(a=>a.paths.flatMap(q=>{
 const s=walkSections(q);return s.slice(1).map(([c,d],i)=>{
   const X=[s[i][0].x,s[i][1].x,c.x,d.x],Z=[s[i][0].z,s[i][1].z,c.z,d.z];
   return [Math.min(...X),Math.min(...Z),Math.max(...X),Math.max(...Z)];
 });
}));
const parking=decodeParkingSurfaces(slice(stockPark)).flatMap(t=>t.lots.flatMap(([,core,rim])=>[...core,...rim].map(poly=>{
 const X=poly[0].map(v=>t.ox+v[0]*.001),Z=poly[0].map(v=>t.oz+v[1]*.001);
 return [Math.min(...X),Math.min(...Z),Math.max(...X),Math.max(...Z)];
})));
const tilesProtected=[...COASTAL_SPECS,...INLAND_SPECS,MONTAGUE_FOUNDATION.ground].map(g=>[g.tileX,g.tileZ]);
const tIdx=(x,z)=>[Math.floor((x-terrain.left)/tileWidth),Math.floor((z-terrain.top)/tileDepth)];
tilesProtected.push(BANK_TILE.split('-').map(Number));
const b=BOWLEY_POND;for(const X of [b.left,b.left+b.width*b.step])for(const Z of [b.top,b.top+b.height*b.step])tilesProtected.push(tIdx(X,Z));
const q=QUARTERMASTER.boundsXZ;for(const X of [q[0],q[2]])for(const Z of [q[1],q[3]])tilesProtected.push(tIdx(X,Z));
// These custom places are held far outside individual mesh dimensions. The terrain-surface exact AOI
// decision remains a runtime gate, including dynamic adaptive application on every other tile.
const special=[[-64.00181,47.05688,'North Cape'],[-63.78999,46.39196,'Spinnakers'],[-63.126,46.23501,'Victoria/CYYG'],[-62.24765,46.35642,'Souris']].map(([lon,lat,id])=>{const t=project(lon,lat);return {id,x:t.x,z:t.z};});
// Export the actual simulator projection and signed cross-checks; downstream GIS
// must never reinterpret the ellipsoid or choose its own metres per degree.
const anchors=[...[[hm.bounds[0],hm.bounds[3]],[hm.bounds[2],hm.bounds[3]],[hm.bounds[0],hm.bounds[1]],[hm.bounds[2],hm.bounds[1]]],
 [ORIGIN.lon,ORIGIN.lat],[ORIGIN.lon+.13,ORIGIN.lat+.27],[ORIGIN.lon-.19,ORIGIN.lat-.21],
 [ORIGIN.lon+.17,ORIGIN.lat-.11],[ORIGIN.lon-.17,ORIGIN.lat+.19]];
const projection={origin:[ORIGIN.lon,ORIGIN.lat],scale:[METRES_PER_LON,-METRES_PER_LAT],points:anchors.map(ll=>{
 const {x,z}=project(...ll),back=geographic(x,z);
 assert(Math.abs(ll[0]-back.lon)<1.e-12&&Math.abs(ll[1]-back.lat)<1.e-12);
 return {ll,x,z};})};
const C=CONFEDERATION_TRAIL,ct=U(C.asset);assert.equal(sha(ct),C.sha256);
const trail=Array.from(decodeConfederationTrail(slice(ct)).values()).flatMap(tile=>tile.paths.flatMap(path=>path.cuts.slice(1).map((b,i)=>{
 const a=path.cuts[i];return [[a.x-a.wX,a.z-a.wZ],[a.x+a.wX,a.z+a.wZ],[b.x+b.wX,b.z+b.wZ],[b.x-b.wX,b.z-b.wZ]];
})));
assert.equal(trail.length,3141);
const fence=file(CANOPY_FENCE.path);assert.equal(sha(fence),CANOPY_FENCE.wireSha);
// These compact surveyed cuts can be mounted in addition to the older
// coastal/inland survey list. Hold one complete parent facet around each.
const localSpecs=[...DUNE_RELIEF,KINGS_DRY_CROWN,GABLES_GRADE,HOG_WEST_GRADE,INDIAN_RIVER_GRADE,RUSTICO_GRADE,POINT_PRIM_GRADE];
const area=(id,bounds)=>({id,bounds});
const localBounds=localSpecs.map(g=>{
 const x=terrain.left+(g.tileX+g.firstX/SURVEY_LOD)*tileWidth,z=terrain.top+(g.tileZ+g.firstZ/SURVEY_LOD)*tileDepth;
 const a=tileWidth/SURVEY_LOD,b=tileDepth/SURVEY_LOD;
 return area(g.id,[x-a,z-b,x+(g.cellsX+1)*a,z+(g.cellsZ+1)*b]);
});
for(const [id,spec] of [['st-davids',ST_DAVIDS],['summerside-station',SUMMERSIDE_STATION]]){
 const b=spec.boundsXZ;
 // Both contracts store local XZ bounds as [minX,minZ,maxX,maxZ].
 assert(b.length===4&&b[0]<b[2]&&b[1]<b[3]);
 localBounds.push(area(id,[b[0]-130,b[1]-130,b[2]+130,b[3]+130]));
}
for(const s of Object.values(LIGHT_STATIONS)){
 const a=project(s.lon,s.lat);localBounds.push(area(s.name,[a.x-180,a.z-180,a.x+180,a.z+180]));
}
const identity={ownerSignature:sha(protectedOwnerContract()),localBounds,marsh:marshPatches,grass:DUNE_GRASS_AUTHORITY,sand:DUNE_SAND_MASK,
 pastureBounds:PASTURE_BOUNDS,trailDecodedSha:C.sha256,fence:CANOPY_FENCE,trail};
fs.writeFileSync('actual-current-owners.json',JSON.stringify(identity));
const meta={projection,dims:[WORLD_COLS,WORLD_ROWS],n:SURVEY_LOD,originXZ:[terrain.left,terrain.top],tileMetres:[tileWidth,tileDepth],coveredTiles:[...tiles].sort((a,b)=>a-b), axes,firstTriangle,tilesProtected,walkway,parking,runs,special,
 pins:{terrain:hm.sha256,cover:J('cover.json').compressedSha256,sides:sha(stockSide),parks:sha(stockPark),roads:sha(stockRoads),aeb:J('buildings/index.json').sha256}};
fs.writeFileSync('actual-stock.json',JSON.stringify(meta));console.log({patches:tiles.size,tileMetres:meta.tileMetres,footwayGuardQuads:walkway.length,oneLotFootprints:parking.length,tilesProtected});
