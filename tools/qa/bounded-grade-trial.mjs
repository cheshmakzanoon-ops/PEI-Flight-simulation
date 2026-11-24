import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {Terrain} from '../../src/sim/terrain.ts';
import {BoundedGrade} from '../../src/sim/bounded-grade.ts';
import {project} from '../../src/sim/geo.ts';
import {GROUND_LIFT} from '../../src/sim/coastal-terrain.ts';
import {insertCoastalGrid} from '../../src/render/coastal-patch.ts';
const cwd=new URL('../../public/world/',import.meta.url);
const [metaFile,assetFile,controlsFile]=process.argv.slice(2);
const spec=JSON.parse(readFileSync(new URL('terrain.json',cwd))),file=gunzipSync(readFileSync(new URL(spec.file,cwd)));
const h=new Int16Array(file.buffer,file.byteOffset,file.length/2);
const atlas=new Terrain(spec,h),foot=(x,z)=>atlas.atlasElevation(x,z);
const experiment=JSON.parse(readFileSync(metaFile)),meta=experiment.shape,bytes=gunzipSync(readFileSync(assetFile));
assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.sha256);
const n=experiment.dimensionsXY.reduce((a,b)=>a*b,1);
const grade=new BoundedGrade(atlas,meta,new Int16Array(bytes.buffer,bytes.byteOffset,n),bytes.subarray(n*2),foot);
const w=(atlas.right-atlas.left)/32,d=(atlas.bottom-atlas.top)/22,x=atlas.left+meta.tileX*w,z=atlas.top+meta.tileZ*d,shape={x,z,w,d};
const make=(adopt)=>{
 const g=new THREE.PlaneGeometry(w,d,112,112).rotateX(-Math.PI/2),p=g.getAttribute('position'),t=g.getAttribute('uv');
 for(let i=0;i<p.count;i++){
  const wx=p.getX(i)+x+w/2,wz=p.getZ(i)+z+d/2;
  p.setY(i,foot(wx,wz)+GROUND_LIFT);t.setXY(i,...atlas.uv(wx,wz));
 }
 if(adopt)insertCoastalGrid(g,112,shape,atlas,grade.grid);
 const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
 m.position.set(x+w/2,0,z+d/2);m.updateMatrixWorld();return m;
};
const baseline=make(false),modified=make(true);
const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,1000);
function hit(m,x,z){
 ray.ray.origin.set(x,100,z);return ray.intersectObject(m,false)[0]?.point.y;
}
const rows=JSON.parse(readFileSync(controlsFile)),old=[],now=[];
let protectedMax=0,match=0,absMin=0,hits=0,syntheticCount=0,stillBelow=0,areaAbove30=0,protectedThermal=0;
for(let i=0;i<rows.length;i++){
 const [lo,la,approved,point,bare]=rows[i],{x,z}=project(lo,la);
 const visual=grade.visualY(x,z)??point,delta=visual-point,stock=atlas.contactHeight(x,z,true);
 const can=grade.contactY(x,z,stock),outside=grade.weight(x,z)===0;
 if(!approved){assert(outside);protectedThermal=Math.max(protectedThermal,Math.abs(can-stock));}
 if(approved){
  old.push(Math.abs(point-bare));now.push(Math.abs(visual-bare));
  absMin=Math.max(absMin,delta);stillBelow+=Number(visual-bare<-.3);areaAbove30+=Number(delta>.30);
 }
 if(i%9!==4)continue;
 const a=hit(baseline,x,z),b=hit(modified,x,z);assert(a!==undefined&&b!==undefined);hits++;
 assert(Math.abs(a-point)<.0015,[i,a,point]);
 if(outside){protectedMax=Math.max(protectedMax,Math.abs(a-b));syntheticCount++;}
 else match=Math.max(match,Math.abs(b-visual));
}
function q(a,t){a.sort((x,y)=>x-y);return a[Math.floor((a.length-1)*t)];}
const report={nativeStations:rows.length,approved:old.length,realThreeRayTraces:hits,
 baselineTriangles:baseline.geometry.index.count/3,newTriangles:modified.geometry.index.count/3,
 protectedRealRays:syntheticCount,protectedRayDifferenceMetres:protectedMax,protectedContactChangeMetres:protectedThermal,
 proofActiveRayDeviationMetres:match,raisedNativeCellsAbove30Cm:areaAbove30,
 oldMedianM:q(old,.5),newMedianM:q(now,.5),oldP90M:q(old,.9),newP90M:q(now,.9),holdMaxDeltaMetres:absMin,beyond30BelowSurveyStill:stillBelow};
assert(protectedMax<.0002&&match<.0002&&protectedThermal===0,report);
console.log(JSON.stringify(report,null,2));
