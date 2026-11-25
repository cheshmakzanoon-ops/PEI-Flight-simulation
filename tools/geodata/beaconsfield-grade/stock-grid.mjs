/** Export the real source/renderer frame; externally authored ground and imagery are never read here. */
import fs from 'node:fs';import {join} from 'node:path';import {createHash} from 'node:crypto';import {gunzipSync} from 'node:zlib';import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Vegetation} from '../../../src/render/vegetation.ts';
import {TREE_PITCH,TREE_TILE_SIDE} from '../../../src/sim/tree-layout.ts';
import {Terrain} from '../../../src/sim/terrain.ts';import {Cover} from '../../../src/sim/cover.ts';
import {ORIGIN,METRES_PER_LON,METRES_PER_LAT,project,geographic} from '../../../src/sim/geo.ts';
import {WORLD_COLS,WORLD_ROWS,SURVEY_LOD,GROUND_LIFT,facet} from '../../../src/sim/coastal-terrain.ts';import {World} from '../../../src/render/world.ts';
import {BEACON_REVIEW as S} from '../../../src/render/beaconsfield-review-spec.ts';import {BEACON_ASSET} from '../../../src/render/beaconsfield-review-asset.ts';
import {decodeRoads} from '../../../src/render/roads.ts';import {SIDEWALKS} from '../../../src/render/sidewalks.generated.ts';import {decodeSidewalks,walkSections} from '../../../src/render/sidewalks.ts';
import {MAPPED_PARKING} from '../../../src/render/parking-surfaces.generated.ts';import {decodeParkingSurfaces} from '../../../src/render/parking-surfaces.ts';
const [,,root,out]=process.argv; if(!out)throw Error('Usage: bundle this module with esbuild as documented, then: node stock.mjs checkout outDir');fs.mkdirSync(out,{recursive:true});
const F=n=>fs.readFileSync(join(root,'public','world',n)), U=n=>gunzipSync(F(n)),sha=b=>createHash('sha256').update(b).digest('hex'), J=n=>JSON.parse(F(n)), ab=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),xz=p=>[p.x,p.z], features=[];
const terrainJ=J('terrain.json'),coverJ=J('cover.json'),H=U(terrainJ.file),CN=U('cover.bin.gz'),Cwire=F('cover.bin.gz');assert.equal(sha(H),terrainJ.sha256);assert.equal(sha(Cwire),coverJ.compressedSha256);
const terrain=new Terrain(terrainJ,new Int16Array(ab(H))),cover=new Cover(coverJ.width,coverJ.height,CN),world=Object.assign(Object.create(World.prototype),{terrain,mat:new THREE.MeshBasicMaterial()});
const [ox,oz]=S.centroidXZ,pad=62,within=(arr,r=0)=>Math.min(...arr.map(p=>p[0]))<=ox+pad+r&&Math.max(...arr.map(p=>p[0]))>=ox-pad-r&&Math.min(...arr.map(p=>p[1]))<=oz+pad+r&&Math.max(...arr.map(p=>p[1]))>=oz-pad-r;
const bIndex=J('buildings/index.json'),bPack=F('buildings/tiles.pack'),target=bIndex.tiles.find(t=>t.id===S.tile);assert.equal(sha(bPack),S.pack);assert.equal(target.offset,S.offset);const meshChunk=bPack.subarray(target.offset,target.offset+target.bytes);assert.equal(sha(meshChunk),S.chunk);
for(const t of bIndex.tiles){const [w,s,e,n]=t.bounds;if(!within([xz(project(w,n)),xz(project(e,s))],.1))continue;
const rows=JSON.parse(gunzipSync(bPack.subarray(t.offset,t.offset+t.bytes))); for(const [i,row] of rows.features.entries()){
const rings=[row.footprint,...(row.holes??[])].map(r=>r.map(ll=>xz(project(...ll))));if(within(rings[0]))features.push({owner:'aeb',tile:t.id,row:i,target:t.id===S.tile&&i===S.ordinal,rings});
}}
assert.equal(features.filter(q=>q.target).length,1);
const rr=U('roads.bin.gz'),sw=U(SIDEWALKS.asset),pk=U(MAPPED_PARKING.asset); assert.equal(sha(rr),J('roads.json').sha256);assert.equal(sha(sw),SIDEWALKS.sha256);assert.equal(sha(pk),MAPPED_PARKING.sha256);
for(const [i,r] of decodeRoads(ab(rr)).entries())for(let j=1;j<r.points.length;j++){const l=[xz(r.points[j-1]),xz(r.points[j])];const half=[2,2.8,3.6,4.8,6.4][r.flags&7]; if(within(l,half+2))features.push({owner:'road',row:i,rowSegment:j-1,half,line:l});}
for(const t of decodeSidewalks(ab(sw)))for(const q of t.paths){const s=walkSections(q);for(let i=1;i<s.length;i++){const quad=[s[i-1][0],s[i-1][1],s[i][1],s[i][0]].map(xz);if(within(quad,2))features.push({owner:'walk',tile:t.id,rings:[quad]});}}
for(const t of decodeParkingSurfaces(ab(pk)))for(const [,core,rim] of t.lots)for(const poly of [...core,...rim]){const rings=poly.map(r=>r.map(v=>[t.ox+v[0]*.001,t.oz+v[1]*.001]));if(within(rings[0],2))features.push({owner:'parking',tile:t.id,rings});}
const [u,v]=terrain.uv(ox,oz),tx=Math.floor(u*WORLD_COLS),tz=Math.floor(v*WORLD_ROWS),tw=(terrain.right-terrain.left)/WORLD_COLS,th=(terrain.bottom-terrain.top)/WORLD_ROWS,x0=terrain.left+tx*tw,z0=terrain.top+tz*th,w=world.patch(x0,z0,tw,th,SURVEY_LOD),g=w.geometry,pos=g.getAttribute('position'),index=g.index;
assert.deepEqual(Array.from(index.array.slice(0,6)),[0,113,1,113,114,1]);const ax=Array.from({length:113},(_,i)=>pos.getX(i)+w.position.x),az=Array.from({length:113},(_,i)=>pos.getZ(i*113)+w.position.z); const lowX=93,lowZ=51,cellsX=2,cellsZ=2,sub=64,gw=cellsX*sub+1,gh=cellsZ*sub+1,xs=[],zs=[],stock=[],contact=[],coast=[],lc=[];
const dx=tw/SURVEY_LOD,dz=th/SURVEY_LOD;assert(tx===16&&tz===16&&(ox-x0)/dx>93&&(oz-z0)/dz>52);
for(let i=0;i<gw;i++)xs.push(x0+(lowX+i/sub)*dx);for(let j=0;j<gh;j++)zs.push(z0+(lowZ+j/sub)*dz);
for(const z of zs)for(const x of xs){const ci=Math.min(111,Math.max(0,ax.findIndex(a=>a>x)-1)),cj=Math.min(111,Math.max(0,az.findIndex(a=>a>z)-1));const ix=ci+113*cj;
stock.push(facet((x-ax[ci])/(ax[ci+1]-ax[ci]),(z-az[cj])/(az[cj+1]-az[cj]),pos.getY(ix),pos.getY(ix+1),pos.getY(ix+113),pos.getY(ix+114)));contact.push(terrain.contactHeight(x,z,true));coast.push(cover.distance(terrain,x,z));lc.push(cover.sample(terrain,x,z));}
function write(n,a,C){const b=new C(a);fs.writeFileSync(join(out,n),Buffer.from(b.buffer));return sha(Buffer.from(b.buffer));}
const meta={baseline:'edb24d27effe41263d21a16df9eed87182e535b8',title:'Actual stock visual N112 terrain; unaltered optional historic house and current protected public source contracts',source:{terrain:sha(H),cover:sha(CN),coverWire:sha(Cwire),allBuildings:sha(bPack),owner:S.chunk,roads:sha(rr),sidewalk:sha(sw),parking:sha(pk),art:BEACON_ASSET.compressedSha256},frame:{originXZ:S.centroidXZ,modelRing:S.footprint.map(ll=>xz(project(...ll))),geoOrigin:ORIGIN,scales:[METRES_PER_LON,-METRES_PER_LAT],resolutionM:[dx/sub,dz/sub],tileX:tx,tileZ:tz,firstX:lowX,firstZ:lowZ,cellsX,cellsZ,sub,nx:gw,nz:gh,firstVertex:[xs[0],zs[0]],groundLift:GROUND_LIFT,localCorners:[geographic(xs[0],zs[0]),geographic(xs.at(-1),zs.at(-1))]},authoritativeObstacles:features,arrays:{stockY:write('drawn-y.f64',stock,Float64Array),gameGround:write('stock-contact.f64',contact,Float64Array),shoreDistance:write('dry-distance.f32',coast,Float32Array),cover:write('cover.u8',lc,Uint8Array)}};
// Call the original deterministic emitter (no alternative scatter/height process).
const trees=Object.assign(Object.create(Vegetation.prototype),{t:terrain,cover,roofBits:new Uint32Array(8)});
const span=TREE_PITCH*TREE_TILE_SIDE,stemRoster=[];
for(let tz=Math.floor((oz-80)/span);tz<=Math.floor((oz+80)/span);tz++)for(let tx=Math.floor((ox-80)/span);tx<=Math.floor((ox+80)/span);tx++){
const a=trees.tile(tx,tz);for(let k=0;k<a.length;k+=8){if(Math.hypot(a[k]-ox,a[k+2]-oz)<=65)stemRoster.push(Array.from(a.subarray(k,k+7)));}
}
stemRoster.sort((a,b)=>a[0]-b[0]||a[2]-b[2]); meta.roster=stemRoster;assert(stemRoster.length===38);
fs.writeFileSync(join(out,'stock-world.json'),JSON.stringify(meta)+'\n');console.log({frame:meta.frame,protectedObjects:features.reduce((a,q)=>(a[q.owner]=(a[q.owner]??0)+1,a),{})});
