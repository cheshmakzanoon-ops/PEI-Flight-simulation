// Deterministic and offline: run from repo root with Node >=22.12.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { Raycaster, Vector3 } from 'three';
import {makeClarkeFront} from './front.ts';
const m=makeClarkeFront(), expected={'display-left':9,'display-right':9,'transom':12,'right-sash':12};m.updateMatrixWorld(true);
const ray=new Raycaster();
function sight(eye,way=[0,0,-1]){
 ray.set(new Vector3(...eye),new Vector3(...way));const hit=ray.intersectObject(m,true)[0];assert(hit,`No witness for ${eye}`);return hit;
}
const counts={};
for(const p of m.userData.panes){
 const h=sight([p.x,p.y,2.5]);assert.equal(h.object.name,'glazing');assert(Math.abs(h.point.z-p.z)<2e-5);
 counts[p.tag]=(counts[p.tag]??0)+1;
}
assert.deepEqual(counts,expected);assert.equal(new Set(m.userData.panes.map(p=>`${p.tag}/${p.row}/${p.col}`)).size,42);
const w=sight([-1.216,1.169,2.5]),r=sight([-2.41,1.99,2.5]),top=sight([-1.15,2.440,2.5]);
assert.equal(w.object.name,'portal-timber');assert.equal(r.object.name,'decorated-timber');assert.equal(top.object.name,'portal-timber');
assert(r.point.z-w.point.z>.475);assert(top.point.z-w.point.z>.30,'missing physical portal ceiling');
for(let i=0;i<15;i++)for(let j=0;j<13;j++){
 const h=sight([-2.036+(1.932/14)*i,2.339+.010*j,2.5]);
 assert(h.point.z>=-.51,'open central seam or missing head stop');
}
assert.equal(sight([2.321,.198,2.5]).object.name,'masonry');
assert.equal(sight([2.295,1.82,2.5]).object.name,'clapboard');
assert.equal(sight([6.05,2.168,-.444],[-1,0,0]).object.name,'return-shingles');
assert.equal(sight([6.05,3.772,-.541],[-1,0,0]).object.name,'decorated-timber');
const y=[1.44,.99,.57].map(z=>{const a=sight([-1.25,2.10,z],[0,-1,0]);assert.equal(a.object.name,'deck');return a.point.y;});
assert(y[0]<y[1]&&y[1]<y[2],'three physical tread heights must be separate and ordered');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
function digest(g){
 const h=crypto.createHash('sha256'),maps=new Set();let triangles=0;
 for(const mesh of g.children){
  const p=mesh.geometry.getAttribute('position');triangles+=p.count/3;
  h.update(mesh.name);h.update(String(p.count));assert.equal(p.count%3,0);assert(mesh.geometry.index===null);
  for(const name of ['position','color','normal','uv']){
   const a=mesh.geometry.getAttribute(name).array;assert(a.every(Number.isFinite));h.update(new Uint8Array(a.buffer));
  }
  for(const k of ['map','normalMap','roughnessMap']){const tex=mesh.material[k];if(tex&&!maps.has(tex)){h.update(tex.image.data);maps.add(tex);}}
 }
 assert(triangles<6500&&g.children.length===10);
 return {geometryAndMaterialsSHA256:h.digest('hex'),triangles,meshBatches:g.children.length};
}
const geometry=digest(m);assert.deepEqual(digest(makeClarkeFront()),geometry);
const read=p=>fs.readFileSync(new URL(p,import.meta.url));
const native=read('./evidence/independent-native-xy-hold.json');
const independentOwner=read('./evidence/independent-stock-owner.json');
assert.equal(hash(native),'65e18a458c65cc4b2f3dea82e473a1231758d56a900239f7f860996554ae5592');
assert.equal(hash(independentOwner),'d54719701bcd2360bd624150185097b585251e6a26669b4a8430ab3ac2e7d5d4');
const own=JSON.parse(read('./evidence/fixed-views.json'));
assert.equal(own.candidate,'q1030/130');assert.equal(own.views.length,4);
assert(own.views.every(v=>v.outsideOnePixelId===0&&v.categoryOutsideOnePixelId===0&&v.stockRestoredIdentical&&v.roofTriangles===7&&v.wallTriangles===18));
assert(own.views.filter(v=>v.roofIdCorePixels>0).length===2);
console.log(JSON.stringify({...geometry,counts,paneRays:42,additionalProbes:10,closedPortalHeadRays:195,compassViews:own.views.length,liveIntegration:false},null,2));
