import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {MARY_ROLES,MARY_STUDY_ENVELOPE as env,expectedMaryCoreTop,makeDetachedMaryGeometry,makeDetachedSaintMary} from './souris-saint-mary-forms.ts';
import {makeDetachedMaryFinish,patchDetachedMaryShaders} from './souris-saint-mary-finishes.ts';
const sha = v=> createHash('sha256').update(v).digest('hex');
const a=makeDetachedMaryGeometry(), b=makeDetachedMaryGeometry();
const skin=makeDetachedSaintMary(r=>makeDetachedMaryFinish(r)), but=makeDetachedSaintMary(r=>makeDetachedMaryFinish(r,false));
assert.deepEqual([...a.keys()],MARY_ROLES); assert.equal(T.REVISION,'187');
let triN=0, lowD=1,footPhase;
const stats={};
function arrays(g,k){ const x=g.attributes[k].array;return [x,Buffer.from(x.buffer,x.byteOffset,x.byteLength)]; }
for(const [r,g] of a) {
 const attrs=['position','normal','uv'],bufs=attrs.map(k=>arrays(g,k)[1]);
 assert(bufs.every((q,k)=>q.equals(arrays(b.get(r),attrs[k])[1])));
 assert(bufs.every((q,k)=>q.equals(arrays(skin.children.find(c=>c.geometry.name===g.name).geometry,attrs[k])[1])));
 assert(!g.index &&g.attributes.position.count/3%1===0);
 const v=attrs.map(k=>arrays(g,k)[0]);
 assert(v.flatMap(x=>[...x]).every(Number.isFinite));
 const n=g.attributes.position.count/3;
 stats[r]={n,byteSha:Object.fromEntries(attrs.map((k,i)=>[k,sha(bufs[i])])),bounds:[g.boundingBox.min.toArray(),g.boundingBox.max.toArray()]};
 triN+=n;
 for(let i=0;i<n*9;i+=9){
  const p=Array.from({length:3},(_,k)=>new T.Vector3().fromArray(v[0],i+3*k));
  const area=new T.Vector3().crossVectors(p[1].clone().sub(p[0]),p[2].clone().sub(p[0]));
  assert(area.lengthSq()>1e-12,`${r} degenerate ${i/9}`);
  const face=area.normalize();
  for(let k=0;k<3;k++){
   const normal=new T.Vector3().fromArray(v[1],i+3*k);assert(Math.abs(normal.length()-1)<2e-7);
   const d=face.dot(normal); assert(d>.99994,`${r} wrong normal ${i/9} ${d}`);lowD=Math.min(lowD,d);
  }
 }
 const sm=skin.children.find(c=>c.geometry.name===g.name),bm=but.children.find(c=>c.geometry.name===g.name);
 assert(sm.material.color.equals(bm.material.color));assert.equal(sm.material.transparent,false);assert.equal(sm.material.depthWrite,true);
 assert.equal(sm.material.depthTest,true);assert.equal(sm.material.side,T.FrontSide);
 assert.equal(sm.material.map,null);assert.equal(sm.material.normalMap,null);assert.equal(sm.material.envMap,null);
 assert.equal(Object.keys(sm.material).some(k=>k.endsWith('Map')&&sm.material[k]),false);
 const s=T.ShaderLib.standard;
 const x=patchDetachedMaryShaders(s.vertexShader,s.fragmentShader,r);
 if(r==='metal')assert(!x);else{
  assert(x,`existing standard r187 ${r}`);assert(!patchDetachedMaryShaders(x.vertex,x.fragment,r),`no repatch ${r}`);
  if(r!=='glass')assert(!patchDetachedMaryShaders(s.vertexShader.replace('#include <uv_vertex>',''),s.fragmentShader,r));
 }
}
assert(triN<=4800 && skin.children.length===7 && skin.parent===null && skin.position.lengthSq()===0);
skin.updateMatrixWorld(true);
// Rays ignore architectural object staging; same actual BufferGeometry Three math.
const ray = new T.Raycaster();
const roles=Object.fromEntries(skin.children.map(o=>[o.name.split('.').at(-1),o]));
function hit(o,p,d){ray.set(new T.Vector3(...p),new T.Vector3(...d).normalize());return ray.intersectObjects(o,false)[0];}
const roofH=[];
for(let x=-15.48;x<15.22;x+=.347) for(let z=-23.38;z<25.51;z+=.437){
 const pred=expectedMaryCoreTop(x,z), actual=hit([roles.roof],[x,40,z],[0,-1,0]);
 if(pred===0)continue;assert(actual,`${x},${z} roof gap`);
 assert(Math.abs(actual.point.y-pred)<.001,`${x},${z}: roof leak or unintended duplicate max ${actual.point.y} vs. ${pred}`);
 roofH.push(actual.point.y);
}
assert(roofH.length>5000);
const facade=[];
for(const [r,x,y] of [['glass',-4.66,9.61],['glass',.18,11.69],['glass',3.87,9.96],['wood',-3.97,1.40],['wood',.07,1.67],['wood',3.39,1.39]]){
 const entry=hit(skin.children,[x,y,35],[0,0,-1]);
 assert(entry,`missing aperture ray ${x},${y}`);
 assert(entry.object===roles[r],`inscribed front aperture ${x},${y} ${entry.object.name}`);
 assert(Math.abs(entry.point.z-(env.main.front-.29))<.028);facade.push({r,x,y,z:entry.point.z});
}
for(const [x,y]of[[-5.95,10.20],[6.24,10.08],[-7.81,3.94],[6.18,11.12]]) {
 const f=hit(skin.children,[x,y,39],[0,0,-1]);
 assert(f.object===roles.stone,`front wall ${x},${y} ${f.object.name}`);assert(f.point.z>=25.59);
}
const coll=[];
for(const [side,t] of [['west',env.westTower],['east',env.eastTower]]){
 const sample=hit([roles.copper],[t.x+.31,41,t.z+.21],[0,-1,0]);
 assert(sample);const y=sample.point.y;
 assert(y>(side==='west'?29:17)&&y<(side==='west'?30:18));coll.push({side,stamp:[t.x+.31,y,t.z+.21]});
}
assert(coll[0].stamp[1]-coll[1].stamp[1]>10);
for(const o of skin.children.concat(but.children)){o.material.dispose();o.geometry.dispose();}
for(const g of [...a.values(),...b.values()])g.dispose();
const hash=(n)=>sha(readFileSync(new URL(n,import.meta.url)));
console.log(JSON.stringify({r187:T.REVISION,scope:'Detached studio author exact geometry and CPU ray witnesses; no native placement, source images, measurements or claim.',layout:env,triN,batches:skin.children.length,minimumDot:lowD,roofAnalyticInteriors:roofH.length,facadeRecess:facade,unequalCopper:coll,stats,pins:{forms:hash('souris-saint-mary-forms.ts'),finishes:hash('souris-saint-mary-finishes.ts'),source:hash('longworth-horizontal-receipt.json'),prelock:hash('ST-MARYS-DETACHED-ART-LOCK.md')}},null,2));
