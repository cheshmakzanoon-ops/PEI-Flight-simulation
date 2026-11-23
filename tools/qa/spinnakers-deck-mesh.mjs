/** Actual Three boardwalk mesh, source holdout and explicit existing-water guard. */
import * as T from 'three';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {Cover} from '../../src/sim/cover.ts';
import {Terrain,OCEAN_Y} from '../../src/sim/terrain.ts';
import {project} from '../../src/sim/geo.ts';
import {loadSpinnakersDeck,buildSpinnakersDeck} from '../../src/render/spinnakers-deck.ts';
import {SPINNAKERS_DECK as data} from '../../src/render/spinnakers-deck.generated.ts';
const file=name=>fs.readFileSync(new URL('../../public/world/'+name,import.meta.url));
const tm=JSON.parse(file('terrain.json')),cm=JSON.parse(file('cover.json')),height=gunzipSync(file(tm.file)),land=gunzipSync(file(cm.file));
const t=new Terrain(tm,new Int16Array(height.buffer,height.byteOffset,height.byteLength/2));
const c=new Cover(cm.width,cm.height,land,undefined,cm.compressedSha256);
const body=file(data.asset),b=await loadSpinnakersDeck('/',async()=>new Response(body),500);
assert(b);
const wrong=gunzipSync(body);wrong[109]^=7;
assert.equal(await loadSpinnakersDeck('/',async()=>new Response(gzipSync(wrong)),500),undefined);
assert.equal(await loadSpinnakersDeck('/',async()=>new Response('',{status:404}),500),undefined);
const g=buildSpinnakersDeck(b,c,t);assert(g,'A valid deck remains over actual game water');
g.updateMatrixWorld(true);
const mesh=g.children[0],ray=new T.Raycaster(),p=new T.Vector3(),down=new T.Vector3(0,-1,0);
const tests=fs.readFileSync(new URL('./data/spinnakers/deck-holdout.csv',import.meta.url),'utf8').trim().split('\n').map(r=>r.split(',').map(Number));
const errors=[],prior=[];let bad=0,holes=0,positiveClearance=Infinity;
for(const [lon,lat,y]of tests){
 const {x,z}=project(lon,lat),land=c.distance(t,x,z)>=0;
 if(land)bad++;
 assert.equal(t.contactHeight(x,z,land),OCEAN_Y);
 ray.set(p.set(x,30,z),down);
 const hit=ray.intersectObject(mesh)[0];if(!hit){holes++;continue;}
 errors.push(Math.abs(hit.point.y-y));prior.push(Math.abs(OCEAN_Y-y));
 positiveClearance=Math.min(positiveClearance,hit.point.y-OCEAN_Y);
}
assert.equal(bad,0);assert.equal(holes,0);
const idx=mesh.geometry.getIndex(),p3=mesh.geometry.getAttribute('position');
let triWorst=-Infinity,topArea=0,flipped=0;
for(let i=0;i<idx.count;i+=3){
 const a=idx.getX(i),b=idx.getX(i+1),v=idx.getX(i+2);
 const x=(p3.getX(a)+p3.getX(b)+p3.getX(v))/3+g.position.x,z=(p3.getZ(a)+p3.getZ(b)+p3.getZ(v))/3+g.position.z;
 triWorst=Math.max(triWorst,c.distance(t,x,z));
 const d=(p3.getX(b)-p3.getX(a))*(p3.getZ(v)-p3.getZ(a))-(p3.getX(v)-p3.getX(a))*(p3.getZ(b)-p3.getZ(a));
 if(d>=0)flipped++;topArea-=d/2;
}
assert(triWorst<0);assert.equal(flipped,0);assert(topArea>1680&&topArea<1810);
const stats=p=>{p.sort((a,b)=>a-b);return p[Math.floor((p.length-1)*.9)];};
const o={heldout:tests.length,holes,topAreaGameM2:topArea,p90FromMeasuredDepthM:stats(errors),emptyWaterRawP90M:stats(prior),
 maxDistanceOfAnyTriangleCenterM:triWorst,minDeckHeightAboveFixedSeaM:positiveClearance,flipped,
 geometryTriangles:idx.count/3,visualOnly:true};
console.log(JSON.stringify(o,null,2));
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(o,null,2)+'\n');
