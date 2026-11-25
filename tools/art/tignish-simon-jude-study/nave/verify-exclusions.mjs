import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Raycaster,Vector3} from 'three';
import {makeTignishRoof} from './roof.ts';
const input=JSON.parse(fs.readFileSync(new URL('./fit.json',import.meta.url))),model=makeTignishRoof(input),r=new Raycaster();
const {worldXZAtUV00:o,worldXZPerU:U,worldXZPerV:V}=input.world;
const bound=(x,a,b)=>x>=a-1e-5&&x<=b+1e-5;
const roles=new Set();
for(const o of model.children){
 const ro=o.userData.role,p=input.patches.find(r=>r.id===ro);assert(p);roles.add(ro);
 const a=o.geometry.attributes.uv;
 for(let j=0;j<a.count;j++)assert(bound(a.getX(j),...p.u)&&bound(a.getY(j),...p.v),'Triangle left its frozen domain');
}
assert.equal(roles.size,11);
let tested=0;
// Dense projected test independently exercises excluded gaps at the center seam,
// tower and all grade, not just the label attached to each VBO.
for(let u=-19.17;u<28;u+=.533)for(let v=-16.51;v<19;v+=.543){
 const eligible=input.patches.some(p=>bound(u,...p.u)&&bound(v,...p.v));
 if(eligible)continue;
 r.set(new Vector3(o[0]+U[0]*u+V[0]*v,110,o[1]+U[1]*u+V[1]*v),new Vector3(0,-1,0));
 assert.equal(r.intersectObject(model,true).length,0,`geometry in excluded position ${u},${v}`);tested++;
}
const reply=spawnSync(process.execPath,['--experimental-strip-types',fileURLToPath(new URL('./emit.mjs',import.meta.url))],{encoding:'utf-8'});assert.equal(reply.status,0,reply.stderr);
const doc=JSON.parse(reply.stdout);assert.equal(doc.geometrySHA256,'69c713ca0575d306ac292c29e2514aad8a742fc08f5796f3e3d66cc54eed5835');
assert.equal(doc.fitSHA256,'4c61681c63bd89cbc611e15ccf15c6c7c1e92cfcf3a05a5d7405e0d96ea2f81c');
assert.equal(doc.emitterSHA256,'c857b4a9bc26058a413f763b44c60fb8270136da192d0dff6386a40fe3782780');
assert.equal(doc.adapterSHA256,'ce914d2e214a6f183b859c3df57f49d0bfb983df81214e41e52f6877a9a72701');
assert.equal(doc.triangles,58);
const receipt=fs.readFileSync(new URL('./independent-held-aggregate.json',import.meta.url));
assert.equal(createHash('sha256').update(receipt).digest('hex'),'1b3dcad96e378bad0943d987feb75d2c0b59c5ed1c56189ab8cd1b9122627d4c');
const held=JSON.parse(receipt);assert.equal(held.digests.signedActualGeometry,doc.geometrySHA256);
assert.equal(held.roofValidation.samplesCompared,891);assert.equal(held.roofValidation.rolesPassed,11);assert.equal(held.untouchedTerrain.rolesPassed,0);assert(held.heldCheckExactlyOnce&&held.noSecondFit&&!held.rawNumericSurveyIncluded);

console.log(JSON.stringify({originalRoles:roles.size,exactTriangles:doc.triangles,emptyExclusionRays:tested,independentRays:891,eligibleGroundRolesPassing:0,geometrySHA256:doc.geometrySHA256},null,2));
