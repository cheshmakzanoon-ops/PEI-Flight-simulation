#!/usr/bin/env node
/** Detached, offline studio replay. Run from a checkout with the locked Three.js dependency. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as THREE from 'three';

const here=dirname(fileURLToPath(import.meta.url));
const repo=fileURLToPath(new URL('../../../',import.meta.url));
const out=process.argv[2]?resolve(process.argv[2]):undefined;
assert.ok(process.argv.length<=3,'usage: reproduce.mjs [output directory]');
const receipt=JSON.parse(readFileSync(join(here,'model-receipt.json'),'utf8'));
const files=['exterior.ts','materials.ts','roof.ts','source.generated.ts'];
assert.equal(Object.keys(receipt.model).length,files.length);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=arr=>new Uint8Array(arr.buffer,arr.byteOffset,arr.byteLength);
const stage=mkdtempSync(join(tmpdir(),'pei-courthouse-study-'));
try{
  const modelFolder=join(stage,'src/render/georgetown-courthouse');
  const sim=join(stage,'src/sim');
  mkdirSync(modelFolder,{recursive:true});mkdirSync(sim,{recursive:true});
  symlinkSync(join(repo,'node_modules'),join(stage,'node_modules'),'dir');
  for(const file of files){
    const b=readFileSync(join(here,'model',file));
    assert.equal(sha(b),receipt.model[file],`${file} checksum`);
    writeFileSync(join(modelFolder,file),b);
  }
  const projection=readFileSync(join(repo,'src/sim/geo.ts'));
  assert.equal(sha(projection),receipt.projectionSha256,'Study must use the original projection');
  writeFileSync(join(sim,'geo.ts'),projection);
  const {project}=await import(pathToFileURL(join(sim,'geo.ts')).href);
  const {createCourthouseExterior}=await import(pathToFileURL(join(modelFolder,'exterior.ts')).href);
  const {COURTHOUSE_RING,roofCells,roofY}=await import(pathToFileURL(join(modelFolder,'roof.ts')).href);
  const exterior=createCourthouseExterior();exterior.updateMatrixWorld(true);

  const polygonArea=ring=>Math.abs(ring.reduce((s,p,i)=>{
    const q=ring[(i+1)%ring.length];return s+p.x*q.z-q.x*p.z;
  },0)*.5);
  const perimeter=polygonArea(COURTHOUSE_RING);
  assert.ok(Math.abs(perimeter-roofCells().reduce((s,q)=>s+polygonArea(q.points),0))<1e-5,'partition area');
  const perimeterRelation=(x,z)=>{
    let inside=false,distance=Infinity;
    for(let i=0;i<COURTHOUSE_RING.length;i++){
      const p=COURTHOUSE_RING[i],q=COURTHOUSE_RING[(i+1)%COURTHOUSE_RING.length];
      const dx=q.x-p.x,dz=q.z-p.z;
      if((p.z>z)!==(q.z>z)&&x<p.x+dx*(z-p.z)/dz)inside=!inside;
      const k=Math.max(0,Math.min(1,((x-p.x)*dx+(z-p.z)*dz)/(dx*dx+dz*dz)));
      distance=Math.min(distance,Math.hypot(x-p.x-k*dx,z-p.z-k*dz));
    }
    return {inside,distance};
  };
  const attributes=['position','normal','uv','color'];
  const bufferHash=createHash('sha256');let triangles=0,maxOutside=0;
  const model={frame:'local metres; origin translates into the simulator WGS84 approximation',origin:exterior.position.toArray(),meshes:[]};
  for(const m of exterior.children){
    const count=m.geometry.getAttribute('position').count;
    assert.equal(count%3,0);
    const normal=m.geometry.getAttribute('normal');
    const pos=m.geometry.getAttribute('position');
    for(let i=0;i<count;i++){
      const v=[pos.getX(i),pos.getY(i),pos.getZ(i)];
      assert.ok(v.every(Number.isFinite));
      const q=perimeterRelation(v[0],v[2]);
      if(!q.inside)maxOutside=Math.max(maxOutside,q.distance);
      assert.ok(Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i))>.9,'nondegenerate surface');
    }
    triangles+=count/3;
    bufferHash.update(m.name+'\0');
    const arrays=Object.fromEntries(attributes.map(name=>{
      const attr=m.geometry.getAttribute(name);
      assert.equal(attr.count,count);
      bufferHash.update(name+'\0').update(bytes(attr.array));
      return [name,{itemSize:attr.itemSize,data:out?Array.from(attr.array):undefined}];
    }));
    model.meshes.push({role:m.name,triangles:count/3,arrays});
  }
  assert.equal(triangles,receipt.triangles);
  assert.equal(model.meshes.length,receipt.draws);
  assert.ok(maxOutside<.001,'no measurable plan expansion');

  const roof=exterior.getObjectByName('Courthouse roof');
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
  let probes=0,maxMeshToPlane=0;
  for(let x=-19.91;x<29;x+=.251)for(let z=-16.873;z<29;z+=.251){
    const q=perimeterRelation(x,z);
    if(!q.inside||q.distance<.015)continue;
    ray.set(new THREE.Vector3(exterior.position.x+x,50,exterior.position.z+z),down);
    const h=ray.intersectObject(roof)[0]?.point.y;
    assert.ok(h!==undefined,'continuous interior roof cover');
    maxMeshToPlane=Math.max(maxMeshToPlane,Math.abs(h-roofY({x,z})));
    probes++;
  }
  assert.equal(probes,receipt.roofProbes);
  assert.ok(maxMeshToPlane<.004);
  function silhouette(east,south,dist,eyeY){
    const W=760,H=505,origin=project(-62.53321509,46.184092727);
    const cam=new THREE.PerspectiveCamera(53,W/H,.08,350000);
    const s=dist/Math.hypot(east,south);
    cam.position.set(origin.x+east*s,eyeY,origin.z+south*s);
    cam.lookAt(origin.x,15,origin.z);cam.updateMatrixWorld(true);
    const w=new THREE.Vector3();let paths='';
    for(const m of exterior.children){
      const pos=m.geometry.getAttribute('position');
      for(let i=0;i<pos.count;i+=3){
        const points=[0,1,2].map(j=>{
          w.fromBufferAttribute(pos,i+j).applyMatrix4(m.matrixWorld).project(cam);
          return `${((w.x+1)*W*.5).toFixed(3)},${((1-w.y)*H*.5).toFixed(3)}`;
        });
        paths+=`<path d="M${points.join('L')}Z"/>\n`;
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Detached courthouse study outline">\n<rect width="100%" height="100%" fill="#eef1f3"/><g fill="#253747">\n${paths}</g></svg>\n`;
  }
  const views={west:silhouette(-31.8,4.4,32.2,12.1),southwest:silhouette(-20.8,30.7,37.1,11.9)};
  const report={study:'Held E (not installed in the ordinary simulator)',triangles,draws:model.meshes.length,perimeterM2:perimeter,
    probes,maxOutsideM:maxOutside,maxMeshToPlaneM:maxMeshToPlane,buffersSha256:bufferHash.digest('hex'),
    silhouettesSha256:Object.fromEntries(Object.entries(views).map(([name,svg])=>[name,sha(svg)]))};
  if(receipt.buffersSha256)assert.equal(report.buffersSha256,receipt.buffersSha256,'roof/material input buffers changed');
  if(receipt.silhouettesSha256)assert.deepEqual(report.silhouettesSha256,receipt.silhouettesSha256,'silhouettes changed');
  if(out){
    mkdirSync(out,{recursive:true});
    writeFileSync(join(out,'geometry.json'),JSON.stringify(model)+'\n');
    writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
    for(const [name,svg] of Object.entries(views))writeFileSync(join(out,`${name}-silhouette.svg`),svg);
  }
  console.log(JSON.stringify(report,null,2));
}finally{rmSync(stage,{recursive:true,force:true});}
