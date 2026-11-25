// Portable actual Three.js absolute-coordinate emitter and probe. Node >=22.12.
// Usage: node --experimental-strip-types tools/art/tignish-simon-jude-study/nave/emit.mjs
// Optional: --output absolute-triangles.json or --rays caller-private-rows.json.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {Raycaster,Vector3} from 'three';
import {makeTignishRoof} from './roof.ts';
const read=n=>fs.readFileSync(new URL(n,import.meta.url)),sha=x=>createHash('sha256').update(x).digest('hex');
const fit=read('./fit.json'),proof=JSON.parse(fit),group=makeTignishRoof(proof);
const bands=[];
for(const o of group.children){
 const p=o.geometry.getAttribute('position');assert(p.count%3===0);const absoluteXYZTriples=[];
 for(let j=0;j<p.count;j++){
  const q=new Vector3().fromBufferAttribute(p,j).applyMatrix4(o.matrixWorld).toArray();
  assert(q.every(Number.isFinite));absoluteXYZTriples.push(q);
 }
 assert(o.userData.minUpNormal>.43);
 bands.push({name:o.name,role:o.userData.role,areaUV:o.userData.areaUV,mask:o.userData.mask,upNormalMin:o.userData.minUpNormal,triangleCount:p.count/3,absoluteXYZTriples});
}
assert.equal(new Set(bands.map(r=>r.role)).size,11);
const geom=sha(JSON.stringify(bands.map(x=>[x.name,x.absoluteXYZTriples])));
const metric={fitSHA256:sha(fit),emitterSHA256:sha(read('./roof.ts')),adapterSHA256:sha(read('./emit.mjs')),geometrySHA256:geom,scope:'Eleven disjoint roof rectangles trimmed to extracted owner. No linked whole roof or inferred tower.',triangles:bands.reduce((s,p)=>s+p.triangleCount,0),planeMeshes:bands.map(({absoluteXYZTriples,...p})=>p)};
const flag=k=>{const i=process.argv.indexOf(k);if(i===-1)return undefined;assert(process.argv[i+1]&&!process.argv[i+1].startsWith('--'));return process.argv[i+1];};
if(flag('--output'))fs.writeFileSync(flag('--output'),JSON.stringify({...metric,bands,coordinates:'absolute world X east, Y CGVD2013 up, Z south, ordinary metres'})+'\n');
if(flag('--rays')){
 const r=new Raycaster(),d=JSON.parse(fs.readFileSync(flag('--rays'),'utf8'));
 const q=(a,p)=>{if(a.length===0)return null;const b=a.slice().sort((x,y)=>x-y),j=(b.length-1)*p,i=Math.floor(j);return b[i]+(j-i)*(b[Math.min(b.length-1,i+1)]-b[i]);};
 metric.roles={};
 for(const [role,dataset]of Object.entries(d)){
  let missed=0;const crossings={},errors=[];
  for(const row of dataset){
   r.set(new Vector3(row[2],145,row[4]),new Vector3(0,-1,0));const hits=r.intersectObject(group,true);
   if(!hits.length){missed++;continue}
   const h=hits[0];assert(h.object.userData.role===role,'one original mask cannot stand in for another role');
   assert(hits.every(x=>Math.abs(x.point.y-h.point.y)<2e-5));
   const tag=h.object.name;crossings[tag]=(crossings[tag]??0)+1;errors.push(h.point.y-row[3]);
  }
  const a=errors.map(Math.abs);metric.roles[role]={count:dataset.length,missed,matchFraction:errors.length/dataset.length,P50Abs:q(a,.5),P90Abs:q(a,.9),signedMedian:q(errors,.5),crossings};
 }
}
console.log(JSON.stringify(metric,null,2));
