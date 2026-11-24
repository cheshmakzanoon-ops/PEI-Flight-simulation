import assert from 'node:assert/strict';
import {test} from 'node:test';
import {project} from '../src/sim/geo.ts';
import {GABLES_GRAVEL_CLEARANCE as limit,GABLES_GRAVEL_STATIONS as core,GABLES_GRAVEL_NODES as path,
 gablesGravelDistance,gablesGravelIntersects,gablesGravelGeometryMatches,gablesGravelAtlasMatches,GABLES_GRAVEL_PINS as P} from '../src/render/gables-gravel.ts';

test('the inboard gravel material follows the mapped walkway but stops before either join',()=>{
 const p=path.map(([lo,la])=>project(lo,la));
 assert.equal(gablesGravelDistance(p[1].x,p[1].z),0);
 assert.deepEqual(core,[7.625,15.5]);
 for(const q of [p[0],p[2]])assert(gablesGravelDistance(q.x,q.z)>6);
 assert.equal(limit,.70);
 for(const k of [0,2]){
  const {x,z}=p[1],dx=p[k].x-x,dz=p[k].z-z,L=Math.hypot(dx,dz);
  const xx=x+dx*.10,zz=z+dz*.10,nx=-dz/L,nz=dx/L;
  assert(gablesGravelDistance(xx+nx*.5,zz+nz*.5)<limit);
  assert(gablesGravelDistance(xx+nx*.78,zz+nz*.78)>limit);
  assert(gablesGravelIntersects(xx-.2,zz-.2,xx+.2,zz+.2));
  assert(!gablesGravelIntersects(xx+5,zz,xx+12,zz+5));
 }
});

test('both the original ground and its protected surrounding meshes must match the mapped material',()=>{
 assert(gablesGravelAtlasMatches(P.terrain,P.cover,P.coverRaw));
 assert(!gablesGravelAtlasMatches(P.terrain,P.cover));
 assert(gablesGravelGeometryMatches(P.roads,P.buildings));
 assert(!gablesGravelGeometryMatches(P.roads,'other-buildings'));
});

test('the guarded footprint uses the exact checked-in terrain, Cover, roads, and building data',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {createHash}=await import('node:crypto');
 const {gunzipSync}=await import('node:zlib');
 const at=(f:string)=>readFile(new URL('../public/world/'+f,import.meta.url));
 const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
 const t=JSON.parse(await at('terrain.json')),c=JSON.parse(await at('cover.json'));
 const cover=await at(c.file),road=await at('roads.bin.gz');
 const atlas=JSON.parse(await at('buildings/index.json'));
 assert(gablesGravelAtlasMatches(t.sha256,sha(cover),sha(gunzipSync(cover))));
 assert(gablesGravelGeometryMatches(sha(gunzipSync(road)),atlas.sourceGeometrySha256??atlas.sha256));
});
