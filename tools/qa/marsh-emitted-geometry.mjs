#!/usr/bin/env node
// Run from a repository checkout: node --experimental-strip-types tools/qa/marsh-emitted-geometry.mjs
// Synthetic emitter proof. No asset, camera, terrain or site data reads.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {marshBladeGeometry,marshHash} from '../../src/render/marsh-foliage/blades.ts';
import {MarshPatch,MARSH_INPUT_LIMIT} from '../../src/render/marsh-foliage/marsh-patch.ts';

const pin=q=>createHash('sha256').update(q).digest('hex');
const parts=[true,false].map(marshBladeGeometry);
const V=new T.Vector3(),U=new T.Vector3(),S=new T.Vector3(),X=new T.Vector3();
const meshResults=[],basal=[];
for(const {geometry:g,triangles,maxRadius,maxY,units} of parts){
 const p=g.getAttribute('position'),index=g.getIndex(),organ=g.getAttribute('marshBlade');
 assert.equal(index.count/3,triangles);assert.equal(triangles,Object.values(units).reduce((s,a)=>s+a,0));
 assert.ok(maxRadius>.49&&maxRadius<1&&maxY>.74&&maxY<1.2);
 assert.ok(organ.count===p.count);
 let smallest=Infinity,below=0,midribs=0,meanY=0;const low=[];
 for(let i=0;i<p.count;i++){
  assert.ok([p.getX(i),p.getY(i),p.getZ(i),organ.getX(i),organ.getW(i)].every(Number.isFinite));
  if(p.getY(i)<0)below++;if(organ.getZ(i)===0&&organ.getY(i)===0)midribs++;meanY+=p.getY(i)/p.count;
 }
 for(let i=0;i<index.count;i+=3){
  V.fromBufferAttribute(p,index.getX(i));U.fromBufferAttribute(p,index.getX(i+1));S.fromBufferAttribute(p,index.getX(i+2));
  const area=U.sub(V).cross(X.copy(S).sub(V)).length()*.5;
  assert.ok(area>1.e-12,{i,area});
  smallest=Math.min(smallest,area);
  const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];
  if(ids.every(j=>organ.getZ(j)===3))low.push(ids.map(j=>[p.getX(j),p.getY(j),p.getZ(j),organ.getX(j),organ.getY(j),organ.getW(j)]));
 }
 assert.ok(below<p.count*.06 && midribs>8);
 meshResults.push({triangles,units,maxRadius,maxY,meanY,belowZero:below,midribOrTipVertices:midribs,minTriangleArea:smallest,vertices:p.count});
 basal.push(low);g.dispose();
}

assert.equal(basal[1].length,120);
assert.deepEqual(basal[0].slice(0,basal[1].length),basal[1]);

const origin=new T.Vector3(38_357,13.1,-26_047),sun=new T.Vector3(-.5,.7,.5);
let rejectGuard=true;
const dir=new T.Vector2(.93,-.37).normalize(),guards=new Map(),rows=[],read=new Map();
const seed=(k,c)=>marshHash(k,c);
const allow=(x,z,r,id)=>{
 const q=read.get(id);
 assert.ok(q&&Math.abs(x-q.x)<1e-9&&Math.abs(z-q.z)<1e-9&&r<=q.permittedRadius+1e-8);
 if(rejectGuard&&id%7===0)return false;
 guards.set(id,r);return true;
};
const patch=new MarshPatch(origin,allow,{sun,wind:dir},true);
for(let i=1;i<353;i++){
 const x=origin.x-4.65+9.3*seed(i,5),z=origin.z-6.21+12.42*seed(i,12),id=(i+416)*13;
 const q={x,y:origin.y+seed(i,2)*.301,z,id,permittedRadius:.62+.30*seed(i,414),
   damp:seed(i,9),age:seed(i,15),height:.24+1.10*seed(i,22),spread:.70+.63*seed(i,23)};
 rows.push(q);read.set(id,q);
}
assert.throws(()=>patch.admission(Array.from({length:MARSH_INPUT_LIMIT+1},()=>rows[0])));
const source=patch.admission(rows);
assert.ok(source.accepted>250&&source.rejected>40&&!patch.group.visible);
rejectGuard=false;
assert.equal(patch.admission(rows).accepted,rows.length);
const eye=origin.clone().add(new T.Vector3(0,2.40,7.8));
patch.observe(eye,2.4,0,1);
const active=patch.state,max=patch.maximum;
assert.ok(active.near===max.close&&active.mid===max.mid&&active.draws===2&&active.triangles===max.triangles);
const I=new T.Matrix4();
const keys=new Set();
let largestRatio=0,centres=0,vertices=0,underground=0;
for(const m of patch.group.children){
 const g=m.geometry,p=g.getAttribute('position'),v=g.getAttribute('marshLook');
 for(let j=0;j<m.count;j++){
  m.getMatrixAt(j,I);
  const a=I.elements,x=origin.x+a[12],y=origin.y+a[13],z=origin.z+a[14];
  const q=rows.find(r=>Math.hypot(r.x-x,r.y-y,r.z-z)<9e-7);
  assert.ok(q&&!keys.has(q.id),{x,y,z});
  const rad=guards.get(q.id);assert.ok(rad>0);
  keys.add(q.id);centres++;
  const ux=a[0],uz=a[2],vx=a[8],vz=a[10];
  const d0=ux*ux+uz*uz,d1=vx*vx+vz*vz;
  for(const time of [0,.573,2.53,6.171,19.19,40.62]){
   for(let k=0;k<p.count;k++){
    const Qx=p.getX(k),Qy=Math.max(0,p.getY(k)),Z=p.getZ(k);
    const phi=2*Math.PI*v.getX(j)+.093*x-.077*z;
    const f=.40*Math.sin(time*1.29+phi)+.20*Math.sin(time*.53+phi*.74)+.12*Math.sin(time*3.5+phi+6.*Qx);
    const cx=(dir.x*(.034+.044*f)+dir.y*.015*f)*Qy*Qy;
    const cz=(dir.y*(.034+.044*f)-dir.x*.015*f)*Qy*Qy;
    const pX=Qx+(cx*ux+cz*uz)/Math.max(.09,d0),pZ=Z+(cx*vx+cz*vz)/Math.max(.09,d1);
    const G=V.set(pX,p.getY(k),pZ).applyMatrix4(I);
    const ratio=Math.hypot(G.x-a[12],G.z-a[14])/rad;
    if(G.y<a[13]-.012)underground++;
    assert.ok(ratio<=1+1e-7,{q,r:ratio});
    largestRatio=Math.max(largestRatio,ratio);vertices++;
   }
  }
 }
}
assert.equal(underground,0);
const original=patch.group.children.map(m=>m.instanceMatrix.array.slice(0,m.count*16));
patch.observe(eye.clone().add(new T.Vector3(.55,0,0)),2.4,2.5,1);
patch.group.children.forEach((m,i)=>assert.deepEqual(m.instanceMatrix.array.slice(0,m.count*16),original[i]));
patch.admission([rows[1]]);assert.equal(patch.state.draws,0);
assert.ok(patch.group.children.every(m=>m.count===0));
patch.observe(eye,3,4,1);
patch.observe(eye,100,8,1);assert.equal(patch.state.draws,0);
patch.dispose();assert.equal(patch.group.children.length,0);
const files={};
for(const file of ['blades.ts','marsh-material.ts','marsh-patch.ts']){
 files[file]=pin(readFileSync(new URL('../../src/render/marsh-foliage/'+file,import.meta.url)));
}
console.log(JSON.stringify({scope:'Synthetic geometry/wind fixture; no site placement, terrain, uploader, or field measurements',analytics:{max,meshResults,identicalBasalTrianglesAcrossLods:basal[1].length},
 guardRun:{...source,centres,verticesReviewedAcrossSixWindSamples:vertices,maxFractionOfApprovedSweptRadius:largestRatio,
 stableEyeShiftMetres:.55,oldInstancesRemovedImmediately:true,untouchedPositionInputs:true},files},null,2));
