// Run from the repository root: node --experimental-strip-types tools/art/elmira-station-study/eaves/verify.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Raycaster, Vector3 } from 'three';
import { buildElmiraTrackside } from './trackside.ts';
const model=buildElmiraTrackside();model.updateMatrixWorld(true);
const rc=new Raycaster();
function ray(p,d){
 rc.set(new Vector3(...p),new Vector3(...d).normalize());
 const q=rc.intersectObject(model,true)[0];return q?{part:q.object.name,distance:q.distance}:null;
}
const panes=model.userData.glassCenters;
assert.equal(panes.length,18);assert.equal(new Set(panes.map(p=>[p.col,p.row].join())).size,18);
for(const {cx,cy} of panes)assert.equal(ray([cx,cy,2],[0,0,-1])?.part,'glass','clear pane must hit glazing first');
const probes=[
 ['meeting rail',[-.24,1.71,1.75],[0,0,-1],'joinery'],['diagonal brace',[1.15,2.70,.92],[0,0,-1],'joinery'],
 ['left cheek',[.82,2.7,.455],[1,0,0],'joinery'],['right cheek',[1.43,2.7,.455],[-1,0,0],'joinery'],
 ['underside',[.35,2.76,.82],[0,1,0],'soffit'],['weathered roof',[.52,3.6,1.009],[0,-1,0],'roof'],
 ['light shingles',[.60,2.01,1.7],[0,0,-1],'shingles'],['lower boards',[.6,.31,1.7],[0,0,-1],'plinth'],
 ['platform',[.6,1,.44],[0,-1,0],'deck']
];
for(const [label,eye,d,k] of probes){const h=ray(eye,d);assert.equal(h?.part,k,label);if(label.includes('cheek'))assert.ok(h.distance<.30,label);}
let t=0;
function digest(m){
 const hash=createHash('sha256');
 for(const c of m.children){
  const g=c.geometry;assert.notEqual(g.index,undefined);
  for(const k of ['position','normal','color','uv']){
   const a=g.getAttribute(k).array;assert.ok(a.every(Number.isFinite),k);hash.update(new Uint8Array(a.buffer));
  }
  if(c.material.map)for(const a of [c.material.map,c.material.normalMap,c.material.roughnessMap])hash.update(a.image.data);
 }return hash.digest('hex');
}
for(const c of model.children){
 const g=c.geometry;if(c.name==='glass')assert.equal(g.getAttribute('position').count/3,18*12);
 t+=g.getAttribute('position').count/3;
}
assert.equal(model.children.length,9);assert.ok(t<6000,'study geometry budget (one lighted cutaway)');
assert.equal(digest(model),digest(buildElmiraTrackside()),'nondeterministic rebuild');
console.log(JSON.stringify({meshBatches:model.children.length,surfaceTriangles:t,paneCentres:panes.length,probes:probes.length,hash:digest(model)},null,2));
