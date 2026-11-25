import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {makeMillFront,silhouette} from './mill-front.ts';

const root=makeMillFront(false),byName=n=>root.getObjectByName(n);
root.updateMatrixWorld(true);
const vec=x=>new T.Vector3(...x);
const caster=new T.Raycaster();
function ray(origin,direction,meshes=root.children){
 caster.set(vec(origin),vec(direction).normalize());
 return caster.intersectObjects(meshes,false);
}
function toCenter(p,d,depth=.65){
 const k=vec(p).addScaledVector(vec(d),depth);
 return ray(k.toArray(),d.map(x=>-x));
}
const lights=root.userData.normalizedGlazingCenters, panes=byName('real-glazing');
const countBy={};
let hit=0;
for(const o of lights){
 countBy[o.opening]=(countBy[o.opening]??0)+1;
 const tang=o.axis[2]===1?[1,0,0]:[0,0,1];
 for(const [u,v]of [[0,0],[-.22,0],[.22,0],[0,-.19],[0,.19]]){
  const dir=vec(o.axis).addScaledVector(vec(tang),u).add(vec([0,v,0])).toArray();
  const h=toCenter(o.center,dir)[0];
  assert.ok(h&&h.object===panes,JSON.stringify({o,u,v,actual:h?.object.name}));
  assert.ok(vec(o.center).distanceTo(h.point)<1e-5);
  hit++;
 }
}
assert.deepEqual(countBy,{'upper':48,'lower-bank':32,'lower-sash':16,'east-sash-1':12,'east-sash-2':2,'east-sash-3':2,'east-sash-4':2});
let slider=0;
for(let ix=0;ix<19;ix++)for(let iy=0;iy<13;iy++)for(const dx of [-.13,0,.13]){
 const at=[.019+ix/18*1.356,.047+(iy/12)*1.276,-.083],a=toCenter(at,[dx,.012,1])[0];
 assert.ok(a&&['industrial-slider-leaves','slider-head-and-threshold','folded-eave-and-crest'].includes(a.object.name),JSON.stringify({at,dx,actual:a?.object.name}));
 slider++;
}
const names=['near-folded-metal-roof','higher-folded-gable-roof'];
let near=0,high=0;
for(const name of names){
 const roof=byName(name);
 const depths=name===names[0]?[-2.31,-1.73,-.6,-.20]:[-5.52,-4.87,-4.22,-3.11];
 for(const Z of depths)for(const x of [-4.48,-3.94,-2.77,-1.47,.42,1.28,2.88,4.18]){
  const h=ray([x,10,Z],[0,-1,0]);
  assert.equal(h[0]?.object,roof,[x,Z,name].join(';'));
  if(name===names[0])near++;else high++;
 }
}
let apron=0, rolled=0;
for(const z of [-2.88,-3.42,-4.03,-4.96,-5.46]){
 for(const x of [-5.08,-5.01,-4.93,-4.79,-4.72]){
  const h=ray([x,10,z],[0,-1,0],[byName(names[0])])[0];
  assert.ok(h&&h.point.y>1.9&&h.point.y<2.22);
  apron++;
 }
}
let peak=0,trough=1;
for(let j=0;j<41;j++){
 const h=ray([-3.3+j*.005,1.71,1.1],[0,0,-1])[0];
 assert.equal(h?.object,byName('front-roll-formed-skin'));
 peak=Math.max(peak,h.point.z);trough=Math.min(trough,h.point.z);rolled++;
}
assert.ok(peak-trough>.012&&peak-trough<.024);
let raceways=0;
for(const y of [1.23,1.61,1.94,2.23,2.57]){
 for(const x of [-2.277,-2.169]){
  const a=ray([x,y,.79],[0,0,-1])[0];assert.equal(a?.object,byName('service-conduit'));raceways++;
 }
 const b=ray([-2.223,y,.79],[0,0,-1])[0];assert.equal(b?.object,byName('front-roll-formed-skin'));
}
const conforms=['folded-eave-and-crest','front-roll-formed-skin','service-conduit','conduit-mounting','white-window-joinery','sash-reveals-and-backing'];
let eave=0;
for(let i=1;i<silhouette.length;i++){
 const[a,b]=silhouette[i-1],[c,d]=silhouette[i];
 for(const t of [.021,.139,.258,.387,.512,.641,.778,.902,.985])for(const dy of [-.047,-.103,-.152]){
  const x=a+(c-a)*t,y=b+(d-b)*t+dy;
  const h=ray([x,y,1.8],[0,0,-1])[0];
  assert.ok(h&&conforms.includes(h.object.name),JSON.stringify({x,y,object:h?.object.name}));
  eave++;
 }
}
const parts=root.children.map(p=>{
 const n=p.geometry.getAttribute('position').count/3;
 assert.ok(Number.isSafeInteger(n)&&n>0);
 return [p.name,n];
});
const files=['mill-front.ts','fabrication.ts','finish.ts','studio.ts'];
const sha=x=>createHash('sha256').update(x).digest('hex');
const digest=Object.fromEntries(files.map(k=>[k,sha(readFileSync(new URL(k,import.meta.url)))]));
console.log(JSON.stringify({artifact:'Detached qualitative mesh; no surveyed material or position',files:digest,
 geometry:{triangles:parts.reduce((a,x)=>a+x[1],0),parts}, glazingPlateCenters:lights.length,
 glassDirectionalRayHits:hit, glassCountsByOpening:countBy, closedSliderHeadAndFrontRays:slider,
 layeredRoofHits:{near,higher:high,easternApron:apron}, eaveFrontClosurePoints:eave, frontRolledProfile:{rayHits:rolled,reliefInAuthoringUnits:peak-trough}, twoIndependentRaceways:{positiveRayHits:raceways,gapWallHits:raceways/2}},null,2));
