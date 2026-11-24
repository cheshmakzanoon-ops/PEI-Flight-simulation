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
import {project} from '../../../src/sim/geo.ts';
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
const meta={dims:[WORLD_COLS,WORLD_ROWS],n:SURVEY_LOD,originXZ:[terrain.left,terrain.top],tileMetres:[tileWidth,tileDepth],coveredTiles:[...tiles].sort((a,b)=>a-b), axes,firstTriangle,tilesProtected,walkway,parking,runs,special,
 pins:{terrain:hm.sha256,cover:J('cover.json').compressedSha256,sides:sha(stockSide),parks:sha(stockPark),roads:sha(stockRoads),aeb:J('buildings/index.json').sha256}};
fs.writeFileSync('actual-stock.json',JSON.stringify(meta));console.log({patches:tiles.size,tileMetres:meta.tileMetres,footwayGuardQuads:walkway.length,oneLotFootprints:parking.length,tilesProtected});
