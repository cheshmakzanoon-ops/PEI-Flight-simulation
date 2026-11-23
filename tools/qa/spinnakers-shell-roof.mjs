/** Independent-from-renderer-height witness for exact local Three mesh submission. */
import * as T from 'three';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { Terrain } from '../../src/sim/terrain.ts';
import { Cover } from '../../src/sim/cover.ts';
import { project } from '../../src/sim/geo.ts';
import { Buildings } from '../../src/render/buildings.ts';
import { buildSpinnakersDeck,loadSpinnakersDeck,spinnakersDeckSurface } from '../../src/render/spinnakers-deck.ts';
import { buildSpinnakersShells,matchesSpinnakersShells,SPINNAKERS_OMISSIONS } from '../../src/render/spinnakers-shells.ts';
import { SPINNAKERS_DECK } from '../../src/render/spinnakers-deck.generated.ts';
import { SPINNAKERS_SHELLS as spec } from '../../src/render/spinnakers-shells.generated.ts';
const read=name=>fs.readFileSync(new URL('../../public/world/'+name,import.meta.url));
const tm=JSON.parse(read('terrain.json')),cm=JSON.parse(read('cover.json')),bm=JSON.parse(read('buildings/index.json'));
const tr=gunzipSync(read(tm.file)),p=read('buildings/'+bm.file),t=new Terrain(tm,new Int16Array(tr.buffer,tr.byteOffset,tr.byteLength/2));
const cover=new Cover(cm.width,cm.height,gunzipSync(read(cm.file)),undefined,cm.compressedSha256);
const d=await loadSpinnakersDeck('/',async()=>new Response(read(SPINNAKERS_DECK.asset)),700);
assert(d);
const deck=buildSpinnakersDeck(d,cover,t);assert(deck);
const newModel=buildSpinnakersShells(spinnakersDeckSurface(d));
const x=newModel.position.x,z=newModel.position.z;
newModel.updateMatrixWorld(true);
const roofs=newModel.getObjectByName('Spinnakers measured roof planes');assert(roofs);
const tile=bm.tiles.find(x=>x.id===spec.tile);
const all=JSON.parse(gunzipSync(p.subarray(tile.offset,tile.offset+tile.bytes))).features;
const [w,s,e,n]=tile.bounds,a=project(w,n),b=project(e,s);
const limits={...tile,x1:a.x,x2:b.x,z1:a.z,z2:b.z};
assert(matchesSpinnakersShells(bm.sha256,tile.id,all));
assert(!matchesSpinnakersShells('changed',tile.id,all));
const mut=[...all];mut[315]={...all[315],height:11.09};
assert(!matchesSpinnakersShells(bm.sha256,tile.id,mut));
const legacy=new Buildings(new T.Scene(),t,[tile],null,bm.sha256);
const prior=legacy.generate(all,limits,false),candidate=legacy.generate(all,limits,true);
const control=new Buildings(new T.Scene(),t,[tile],null,bm.sha256);
const refs=all.map((r,i)=>SPINNAKERS_OMISSIONS.has(i)?{footprint:[]}:r);
const c=control.generate(refs,limits,false);
const attrs=['position','normal','uv','color','topFlag','facadeStyle'];
for(const k of attrs){
 const na=candidate.geometry.getAttribute(k).array,nb=c.geometry.getAttribute(k).array;
 assert.deepEqual(Buffer.from(na.buffer,na.byteOffset,na.byteLength),Buffer.from(nb.buffer,nb.byteOffset,nb.byteLength));
}
prior.updateMatrixWorld(true);
const ray=new T.Raycaster(),o=new T.Vector3(),down=new T.Vector3(0,-1,0);
const priorA=[],holdoutByWay={};let newWorst=0,missing=0,oldCoverage=0,ambiguous=0;
const values=fs.readFileSync(new URL('./data/spinnakers/roof-holdout.csv',import.meta.url),'utf8').trim().split('\n').slice(1).map(r=>r.split(',').map(Number));
for(const [way,X,Z,y,count] of values){
 ray.set(o.set(x+X,30,z+Z),down);
 const newHits=ray.intersectObject(roofs,false);
 if(!newHits.length){missing++;continue;}
 const hit=newHits[0];
 if(newHits.slice(1).some(q=>Math.abs(q.point.y-hit.point.y)>.000005))ambiguous++;
 const err=Math.abs(hit.point.y-y),group=holdoutByWay[way]??={new:[],pairsOld:[],pairsNew:[]};
 group.new.push(err);newWorst=Math.max(newWorst,err);
 const p=ray.intersectObject(prior,false).find(q=>prior.geometry.getAttribute('topFlag').getX(q.face.a)>.5);
 if(p){ const eps=Math.abs(p.point.y-y);group.pairsOld.push(eps);group.pairsNew.push(err);oldCoverage++; }
}
const q=(s,p)=>s.toSorted((a,b)=>a-b)[Math.floor((s.length-1)*p)];
let area=0,reverse=0;
const pos=roofs.geometry.getAttribute('position');
for(let j=0;j<pos.count;j+=3){
 const a=new T.Vector2(pos.getX(j),pos.getZ(j)),b=new T.Vector2(pos.getX(j+1),pos.getZ(j+1)),c=new T.Vector2(pos.getX(j+2),pos.getZ(j+2));
 const cross=b.sub(a).cross(c.sub(a));
 if(cross>=0)reverse++;
 area-=cross*.5;
}
const plan=spec.models.reduce((A,b)=>{
 const a=b.ring;return A+Math.abs(a.reduce((s,[x,y],j)=>{const [z,w]=a[(j+1)%a.length];return s+x*w-z*y;},0))*.5;
},0);
assert.equal(reverse,0);assert.equal(missing,0);assert.equal(ambiguous,0);assert(Math.abs(area-plan)<.001);assert(newWorst<2.5);
for(const w of Object.values(holdoutByWay))priorA.push(...w.new);
assert(q(priorA,.9)<.24);
const res={nativeRoofWitness:{tested:values.length,miss:missing,multiHeight:ambiguous,max:newWorst,p90:q(priorA,.9),
 previousPairedP90:q(Object.values(holdoutByWay).flatMap(v=>v.pairsOld),.9),newPairedP90:q(Object.values(holdoutByWay).flatMap(v=>v.pairsNew),.9),
 previousCoverage:oldCoverage},footprint:{planGameM2:plan,capGameM2:area,roofTriangles:pos.count/3},
 sidewallTriangles:newModel.getObjectByName('Named-site original timber walls').geometry.getAttribute('position').count/3,
 unchangedNeighbourTriangles:c.geometry.getAttribute('position').count/3,identicalAttributes:attrs,
 materials:newModel.children.length,onlyLegacyOrdinals:[...SPINNAKERS_OMISSIONS],
 byWay:Object.fromEntries(Object.entries(holdoutByWay).map(([k,v])=>[k,{cells:v.new.length,
  p90:q(v.new,.9),oldOverlapping:v.pairsOld.length,oldP90:q(v.pairsOld,.9),newPairedP90:q(v.pairsNew,.9)}]))};
console.log(JSON.stringify(res,null,2));
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(res,null,2)+'\n');
