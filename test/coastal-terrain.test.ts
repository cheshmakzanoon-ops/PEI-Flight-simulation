import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {COASTAL_SPECS} from '../src/sim/coastal-surveys.generated.ts';
import {GROUND_LIFT,loadCoastalSurveys,type CoastalSource} from '../src/sim/coastal-terrain.ts';
import {insertCoastalGrid} from '../src/render/coastal-patch.ts';
import {surveyNormals} from '../src/render/coastal-normals.ts';
import {Cover} from '../src/sim/cover.ts';
import {Terrain,OCEAN_Y} from '../src/sim/terrain.ts';
import {project} from '../src/sim/geo.ts';
const root=new URL('../public/world/',import.meta.url);
const get=(p:string)=>readFileSync(new URL(p,root));
const cfg=JSON.parse(get('terrain.json').toString());
const asset=(s:string)=>get('coastal/v1/'+s+'.i16.gz');
const decode=(raw:Buffer)=>Int16Array.from({length:raw.length/2},(_,i)=>raw.readInt16LE(i*2));
const sources:CoastalSource[]=COASTAL_SPECS.map(spec=>({spec,samples:decode(gunzipSync(asset(spec.id)))}));
const t=new Terrain(cfg,decode(gunzipSync(get('height.bin.gz'))),sources);

test('optional coastal packs accept a gzip body or a body already decoded by a static host',async()=>{
 const packs=await loadCoastalSurveys('https://assets.invalid/world/',async(input)=>{
  const url=String(input);
  if(url.endsWith('/east-point.i16.gz'))return new Response(asset('east-point'));
  if(url.endsWith('/west-point.i16.gz'))return new Response(gunzipSync(asset('west-point')));
  throw Error('Unexpected asset URL: '+url);
 });
 assert.deepEqual(packs.map(q=>q.spec.id),COASTAL_SPECS.map(s=>s.id));
 for(const [i,p] of packs.entries())assert.deepEqual(p.samples,sources[i].samples);
});
test('a corrupt, missing, truncated, or stalled coastal pack cannot remove the other site or block a flight',async()=>{
 const east=gunzipSync(asset('east-point'));east[Math.floor(east.length/2)]^=8;
 const factories=[
  ()=>Promise.resolve(new Response(east)),()=>Promise.resolve(new Response(east.subarray(0,64))),
  ()=>Promise.resolve(new Response('missing',{status:404})),()=>Promise.reject(Error('offline')),
  ()=>new Promise<Response>(()=>{})];
 for(const fault of factories){
  const packs=await loadCoastalSurveys('/',async(url)=>String(url).includes('east-point')?fault():new Response(asset('west-point')),150);
  assert.deepEqual(packs.map(q=>q.spec.id),['west-point']);
 }
 const noSurvey=new Terrain(cfg,t.samples);
 const p=project(-61.97183,46.45253);assert.equal(noSurvey.detailElevation(p.x,p.z),undefined);
 assert.equal(noSurvey.coastalSurveys.length,0);
});
test('grounding at both light stations is signed survey relief; inland atlas is unchanged',()=>{
 for(const [lon,lat,h] of [[-61.9718333333,46.4525277778,10.07],[-64.38675,46.6203055556,1.79]]){
  const {x,z}=project(lon,lat); assert.ok(Math.abs(t.meshElevation(x,z)-h)<.25);
  assert.equal(t.meshElevation(x,z),t.elevation(x,z));
 }
 const {x,z}=project(-63.131,46.29);assert.equal(t.detailElevation(x,z),undefined);
 assert.equal(t.elevation(x,z),t.atlasElevation(x,z));
});
test('actual Three triangles replace the old floor without overlapping or cracking across all tile LODs',()=>{
 for(const g of t.coastalGrids){
  const w=(t.right-t.left)/32,d=(t.bottom-t.top)/22,x=t.left+g.spec.tileX*w,z=t.top+g.spec.tileZ*d,cx=x+w/2,cz=z+d/2;
  for(const n of [8,56,112]){
   const geo=new THREE.PlaneGeometry(w,d,n,n);geo.rotateX(-Math.PI/2);
   const pos=geo.getAttribute('position');for(let i=0;i<pos.count;i++)pos.setY(i,t.atlasElevation(pos.getX(i)+cx,pos.getZ(i)+cz)+GROUND_LIFT);
   insertCoastalGrid(geo,n,{x,z,w,d},t,g);
   const points=geo.getAttribute('position'),idx=geo.index!;
   let area=0;
   for(let k=0;k<idx.count;k+=3){
    const a=idx.getX(k),b=idx.getX(k+1),c=idx.getX(k+2);
    const twice=(points.getZ(b)-points.getZ(a))*(points.getX(c)-points.getX(a))-(points.getX(b)-points.getX(a))*(points.getZ(c)-points.getZ(a));
    assert.ok(twice>0,'all projected faces must be positively oriented and non-degenerate');
    area+=twice*.5;
   }
   assert.ok(Math.abs(area-w*d)/(w*d)<5e-7,'watertight projected triangle area did not cover exactly one tile');
   const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial());mesh.position.set(cx,0,cz);mesh.updateMatrixWorld(true);
   const ray=new THREE.Raycaster();ray.ray.direction.set(0,-1,0);
   // Non-vertex positions in the core and on either side of its inherited border.
   for(const [u,v] of [[.431,.527],[.837,.351],[.103,.783],[.00017,.467],[.9981,.691]]){
    const px=g.x0+(g.x1-g.x0)*u,pz=g.z0+(g.z1-g.z0)*v;
    ray.ray.origin.set(px,200,pz);const hits=ray.intersectObject(mesh);
    assert.equal(hits.length,1);assert.ok(Math.abs(hits[0].point.y-GROUND_LIFT-t.detailElevation(px,pz)!)<.001);
   }
   mesh.material.dispose();geo.dispose();
  }
 }
});
test('the near-mesh feather meets each inherited edge without a height step',()=>{
 for(const g of t.coastalGrids){
  for(let i=0;i<=32;i++){const f=(i+.5)/33,eps=.0001;
   for(const [x,z,dx,dz] of [[g.x0,g.z0+(g.z1-g.z0)*f,eps,0],[g.x1,g.z0+(g.z1-g.z0)*f,eps,0],
    [g.x0+(g.x1-g.x0)*f,g.z0,0,eps],[g.x0+(g.x1-g.x0)*f,g.z1,0,eps]]){
    assert.ok(Math.abs(g.height(x-dx,z-dz)!-g.height(x+dx,z+dz)!)<.001);
   }
  }
 }
});

test('the authoritative shoreline keeps water at sea level and covered land continuous across optional detail',()=>{
 const c=JSON.parse(get('cover.json').toString()),cover=new Cover(c.width,c.height,gunzipSync(get('cover.bin.gz')));
 const ground=(x:number,z:number)=>t.contactHeight(x,z,cover.distance(t,x,z)>=0);
 // Old nearest-cell NoData rejected this visible headland just outside the survey's outer collar.
 const x=94177.6372,z=5626.6276;assert.ok(cover.distance(t,x,z)>0);assert.ok(!t.isLand(x,z));
 const h=ground(x,z);assert.ok(h>12&&h<20);assert.ok(Math.abs(h-ground(x+.005,z))<.01);
 const open=project(-63.42,46.65);assert.ok(cover.distance(t,open.x,open.z)<0);assert.equal(ground(open.x,open.z),OCEAN_Y);
 const runway=project(-63.131,46.29);assert.ok(cover.distance(t,runway.x,runway.z)>0);
 assert.equal(ground(runway.x,runway.z),t.atlasElevation(runway.x,runway.z)+GROUND_LIFT);
});
test('measured normal field has unit length, an unchanged exterior and a smooth weight transition',()=>{
 for(const g of t.coastalGrids){
  const {normals:n,weight:w}=surveyNormals(g);
  for(let k=0;k<w.length;k++){
   const i=k%g.nx,j=Math.floor(k/g.nx);
   if(!i||!j||i===g.nx-1||j===g.nz-1)assert.equal(w[k],0);
   assert.ok(n[3*k+1]>0);
   assert.ok(Math.abs(Math.hypot(n[k*3],n[k*3+1],n[k*3+2])/32767-1)<.00004);
  }
  assert.ok(w.includes(255)&&w.some(a=>a>0&&a<255));
 }
});
