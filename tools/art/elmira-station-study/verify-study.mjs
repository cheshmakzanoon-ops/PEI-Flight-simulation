// Local, deterministic, offline unit gate for the archived study.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import { makeElmiraRoof } from './roof/roof.ts';
import { applyElmiraShingleFinish } from './roof/shingle-finish.ts';
const path=n=>fileURLToPath(new URL(n,import.meta.url)),read=n=>fs.readFileSync(path(n)),json=n=>JSON.parse(read(n).toString()),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
function run(n){const o=spawnSync(process.execPath,['--experimental-strip-types',path(n)],{encoding:'utf-8'});assert.equal(o.status,0,o.stderr);return JSON.parse(o.stdout);}
const aggrBytes=read('./roof/independent-aggregate.json'),aggr=JSON.parse(aggrBytes),sealed=run('./roof/emit.mjs'),bay=run('./eaves/verify.mjs');
assert.equal(sha(aggrBytes),'9813fad1ee8b82e296478274981ec057d8cd2efcae1d19be945ebed2232f7d3a');
assert.equal(sealed.geometrySHA256,aggr.method.geometrySHA256);assert.equal(sealed.fitSHA256,'e54429bb53fdb0f7b87800a613f0d25c77032f023cf6abedd0619ace66e8fad9');
assert.equal(sealed.emitterSHA256,'2799ffcb9a0794c36caff5f194150b579cf2e8c147591b6d64b41ace8aacb5f0');
assert.equal(sealed.adapterSHA256,'d1e4a27a4eb10001748aa0be968f584411a04cd4a2e94f68759485367fc423bd');
assert.equal(sealed.triangles,36);assert.equal(sealed.parts.length,8);assert(Math.abs(sealed.envelopeAreaUV-sealed.summedProjectedAreaUV)<1e-7);
const r=aggr.method.roles,roofs=Object.entries(r).filter(([k])=>!k.endsWith('dry-turf'));assert.equal(roofs.length,10);assert.equal(roofs.reduce((n,[,v])=>n+v.heldRows,0),169);assert(roofs.every(([,v])=>v.passed&&v.matchedFraction===1));assert.equal(r['eastern-dry-turf'].passed,false);assert.equal(r['yard-dry-turf'].passed,true);assert.equal(aggr.outsideApproval.length,4);
const inp=json('./roof/fit.json'),model=makeElmiraRoof(inp),positions=()=>sha(Buffer.from(model.children.flatMap(m=>Array.from(m.geometry.attributes.position.array)).join(',')));
const before=positions();applyElmiraShingleFinish(model,inp);assert.equal(positions(),before,'finish changed frozen geometry');
assert.equal(bay.hash,json('./eaves/studio-gate.json').geometryAndSurfaceSHA256);
const stock=json('./owner/fixed-frames.json');assert.equal(stock.length,4);assert(stock.every(r=>r.span[0]===12006&&r.span[1]===12048&&r.outsideOnePixelID===0));
console.log(JSON.stringify({roofTriangles:sealed.triangles,roofParts:sealed.parts.length,independentRoofHits:169,westGroundUnopened:true,eastGroundRelease:false,joineryTriangles:bay.surfaceTriangles,physicalPanes:bay.paneCentres,stockCameras:stock.length,metricRoof:sealed.geometrySHA256},null,2));
