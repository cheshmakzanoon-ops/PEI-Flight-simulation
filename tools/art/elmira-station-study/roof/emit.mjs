/** Node >=22.12. From repo root:
 * node --experimental-strip-types tools/art/elmira-station-study/roof/emit.mjs
 * Optional: --output file (all absolute world triangles) or --rays file
 * (JSON map role->rows [u,v,sceneX,nativeY,sceneZ]); emits aggregate metrics only.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { Raycaster, Vector3 } from 'three';
import { makeElmiraRoof } from './roof.ts';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fit=fs.readFileSync(new URL('./fit.json',import.meta.url)),src=fs.readFileSync(new URL('./roof.ts',import.meta.url)),adapter=fs.readFileSync(new URL('./emit.mjs',import.meta.url));
const proof=JSON.parse(fit.toString()),group=makeElmiraRoof(proof),q=proof.ringUV;
const planArea=Math.abs(q.reduce((s,p,i)=>s+p[0]*q[(i+1)%q.length][1]-p[1]*q[(i+1)%q.length][0],0))*.5;
let area=0,triangles=0;const positions=[],parts=[];
for(const m of group.children){
 const geo=m.geometry,p=geo.getAttribute('position');assert(!(p.count%3));const world=[];
 for(let i=0;i<p.count;i++){
  const v=new Vector3().fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);assert(v.toArray().every(Number.isFinite));
  world.push(v.toArray());positions.push(...v.toArray());
 }
 assert(m.userData.minNormalY>.5);parts.push({role:m.name,triangles:p.count/3,minNormalY:m.userData.minNormalY,projectedAreaUV:m.userData.projectedAreaUV,absoluteXYZTriples:world});
 triangles+=p.count/3;area+=m.userData.projectedAreaUV;
}
assert.equal(parts.length,8);assert(Math.abs(area-planArea)<1e-7,'roof areas fail to tile observed envelope');
const meshDigest=sha(Buffer.from(JSON.stringify(parts.map(s=>[s.role,s.absoluteXYZTriples]))));
const receipt={owner:proof.owner,upperSurfaceOnly:true,fitSHA256:sha(fit),emitterSHA256:sha(src),adapterSHA256:sha(adapter),geometrySHA256:meshDigest,triangles,parts:parts.map(({absoluteXYZTriples,...s})=>s),absoluteAxes:'scene X east, Y CGVD2013 up, Z south; metres',summedProjectedAreaUV:area,envelopeAreaUV:planArea,overlapPolicy:'interior partition; only edges/vertices coincide. Choose nearest opaque hit from above.'};
const arg=k=>{const i=process.argv.indexOf(k);if(i<0)return;assert(process.argv[i+1]&&!process.argv[i+1].startsWith('--'));return process.argv[i+1];};
if(arg('--output'))fs.writeFileSync(arg('--output'),JSON.stringify({...receipt,parts})+'\n');
const rf=arg('--rays');if(rf){
 const queries=JSON.parse(fs.readFileSync(rf,'utf8')),rc=new Raycaster();
 const quant=(a,p)=>{if(!a.length)return null;const b=[...a].sort((a,b)=>a-b),k=(b.length-1)*p,i=Math.floor(k);return b[i]+(b[Math.min(i+1,b.length-1)]-b[i])*(k-i);};
 receipt.roles={};
 for(const [key,rows]of Object.entries(queries)){
  let misses=0;const hits={},errors=[],topologyDoubles=0;
  for(const r of rows){
   rc.set(new Vector3(r[2],80,r[4]),new Vector3(0,-1,0));
   const matches=rc.intersectObject(group,true);if(!matches.length){misses++;continue}
   const h=matches[0];hits[h.object.name]=(hits[h.object.name]??0)+1;errors.push(h.point.y-r[3]);
   assert(matches.every(o=>Math.abs(h.point.y-o.point.y)<2e-5),'multiple elevated sheets found');
  }
  receipt.roles[key]={n:rows.length,misses,hits,absP50:quant(errors.map(Math.abs),.5),absP90:quant(errors.map(Math.abs),.9),signedMedian:quant(errors,.5)};
 }
}
console.log(JSON.stringify(receipt,null,2));
