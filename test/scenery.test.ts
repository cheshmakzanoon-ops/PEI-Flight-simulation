import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Terrain} from '../src/sim/terrain.ts';
import {project} from '../src/sim/geo.ts';
import {replacesBasilicaFootprint} from '../src/render/basilica.ts';
const world=new URL('../public/world/',import.meta.url);
const manifest=(p:string)=>JSON.parse(readFileSync(new URL(p,world),'utf8'));
function heights(dir:string,name:string){const m=manifest(dir+name),z=gunzipSync(readFileSync(new URL(dir+m.file,world)));return new Terrain(m,new Int16Array(z.buffer,z.byteOffset,z.byteLength/2));}
test('Cape Jourimain strand anchors the bridge without mainland covering PEI or the open channel',()=>{
 const m=heights('mainland/','context.json'),pei=heights('','terrain.json');
 const nb=project(-63.8152993,46.163458),water=project(-63.755,46.210),land=project(-63.125295,46.233718);
 assert.equal(m.isLand(nb.x,nb.z),true);assert.ok(m.elevation(nb.x,nb.z)<10);
 assert.equal(m.isLand(water.x,water.z),false);assert.equal(m.isLand(land.x,land.z),false);assert.equal(pei.isLand(land.x,land.z),true);
 assert.equal(pei.isLand(nb.x,nb.z),false);
});
test('hand-built basilica suppresses exactly one LiDAR extrusion at its surveyed location',()=>{
 const atlas=manifest('buildings/index.json'),pack=readFileSync(new URL('buildings/tiles.pack',world));let count=0;
 for(const t of atlas.tiles){const [w,s,e,n]=t.bounds;if(-63.125295<w-.001||-63.125295>e+.001||46.233718<s-.001||46.233718>n+.001)continue;
  const {features}=JSON.parse(gunzipSync(pack.subarray(t.offset,t.offset+t.bytes)).toString());
  for(const f of features){const ring=f.footprint as [number,number][];const [lon,lat]=ring.reduce(([x,y],[u,v])=>[x+u,y+v],[0,0]);if(replacesBasilicaFootprint(lon/ring.length,lat/ring.length))count++;}
 }
 assert.equal(count,1);
});
