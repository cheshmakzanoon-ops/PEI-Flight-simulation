import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {Raycaster,Vector3} from 'three';
import {makeTignishBay} from './masonry-bay.ts';
const g=makeTignishBay();g.updateMatrixWorld(true);
const r=new Raycaster();
function trace(x,y,z=2,dx=0,dy=0,dz=-1){
 r.set(new Vector3(x,y,z),new Vector3(dx,dy,dz).normalize());
 const h=r.intersectObject(g,true)[0];assert(h,`Open void: ${x} ${y}`);return h;
}
const counts={};
for(const p of g.userData.apertures){
 const [x,y]=p.center,k=p.tag.split('/')[0];
 for(const i of [-.017,0,.013]){
  const a=trace(x+i,y+i*.27);assert.equal(a.object.name,'glass',p.tag);assert(Math.abs(a.point.z+.276)<1e-5);
 }
 counts[k]=(counts[k]??0)+1;
}
assert.deepEqual(counts,{light:9,cusp:3,trefoil:3});
const structural=[[-1.65,2.544,2,'brick'],[-1.39,2.544,2,'arch'],[-1.32,2.544,2,'masonry-reveal'],[-1.24,2.544,2,'tracery'],[-.57,1.029,2,'stone'],[-.11,2.544,2,'tracery']];
for(const [x,y,z,name]of structural)assert.equal(trace(x,y,z).object.name,name);
const depth=[.68,1.87,3.24,4.44].map(y=>trace(1.657,y).point.z);
assert(depth[0]>depth[1]&&depth[1]>depth[2]&&depth[2]>depth[3]);
for(const [y,z]of [[1.4,.52],[2.79,.40],[4.03,.27],[4.875,.125]]){
 const hit=trace(1.657,y,z,0,-1,0);
 assert.equal(hit.object.name,'stone');
 assert(hit.point.y<y&&y-hit.point.y<.066);
}
const sha=buf=>crypto.createHash('sha256').update(buf).digest('hex'),read=n=>fs.readFileSync(new URL(n,import.meta.url)),h=read('./evidence/independent-native-xy-hold.json');
assert.equal(sha(h),'003808de3ff023002a82aead9af772a546a49c18ad3edc6e826eb3c67e6637df');
const owner=read('./evidence/fixed-owner-frames.json');
assert.equal(sha(owner),'c804ecd2cc5b39f7eb9963515803fde0df6602d7c8aa5bdbbc8d0041c2570f44');
assert(JSON.parse(owner).every(v=>v.span[0]===6642&&v.span[1]===6807&&v.vertexCount===18048&&v.outsideOnePixelID===0));
const xy=JSON.parse(read('./evidence/xy-plan.json'));
assert.equal(xy.stockOwner.tile,'q221232');assert.equal(xy.stockOwner.ordinal,98);assert(Math.abs(xy.stockOwner.areaM2EPSG2954-932.0076)<1e-4);
assert.equal(xy.stockOwner.vertexCount,19);assert.deepEqual(Object.keys(xy.keepStock).sort(),['278','43','84']);
function digest(group){
 const a=crypto.createHash('sha256'),textures=new Set();let triangles=0;
 for(const o of group.children){
  const p=o.geometry.attributes.position;assert.equal(p.count%3,0);triangles+=p.count/3;a.update(o.name);
  for(const k of ['position','normal','uv','color']){
   const bytes=o.geometry.attributes[k].array;assert(bytes.every(Number.isFinite));a.update(new Uint8Array(bytes.buffer));
  }
  for(const k of ['map','normalMap','roughnessMap'])if(o.material[k]&&!textures.has(o.material[k])){textures.add(o.material[k]);a.update(o.material[k].image.data);}
 }
 assert.equal(group.children.length,9);assert(triangles<12500);
 return {triangles,batches:group.children.length,geometryAndMaterialSHA256:a.digest('hex')};
}
const q=digest(g);assert.deepEqual(digest(makeTignishBay()),q);
console.log(JSON.stringify({...q,apertureGroups:counts,actualGlassRays:45,hardProbes:14,stockViews:3,wholeBuildingReplacement:false},null,2));
