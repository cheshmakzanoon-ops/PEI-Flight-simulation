import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {BASIN_CANNERY as S} from '../src/render/basin-cannery.generated.ts';
import {basinCanneryWorld,canneryRoofAt,createBasinCannery} from '../src/render/basin-cannery.ts';

test('Cannery keeps both measured roof pitches and the smaller lower eave kick in the actual mesh',()=>{
 const house=createBasinCannery();
 house.updateMatrixWorld(true);
 const attached=house.children,roof=attached.filter(a=>a.name==='Cannery roof'||a.name==='Cannery harbourRoof');
 assert.equal(roof.length,2);assert.equal(attached.length,8);
 for(const v of [.07,.43,.65,.91]){
  const probes=([.145,.409,.664,.936]).filter(u=>{
   // Omit authored dormers/cupola while testing planar surfaces.
   return !((v===.65||v===.91)&&(u<.2||u>.89));
  });
  for(const u of probes){
   const p=basinCanneryWorld(u,v,100),q=canneryRoofAt(u,v);
   const ray=new THREE.Raycaster(new THREE.Vector3(p.x,p.y,p.z),new THREE.Vector3(0,-1,0));
   const hits=ray.intersectObjects(roof,false);assert(hits.length,{u,v});
   assert(Math.abs(hits[0].point.y-q)<.0001,{u,v,expected:q,actual:hits[0].point.y});
  }
 }
 for(const m of attached){
  assert(m instanceof THREE.Mesh);
  assert(m.geometry.getAttribute('position').count%3===0);
  assert(m.geometry.boundingSphere?.radius);
 }
 const at=(u:number)=>canneryRoofAt(u,.48);
 assert(at(.553)>9.28&&at(.553)<9.45);
 assert((at(.91)-at(.967))/.057<(at(.621)-at(.736))/.115);
 assert(Math.abs(S.probedEastWalkHeight-S.authoredFloor)<=.04+1e-9);
});

test('native Cannery grade extension leaves unrelated bank nodes exact and clears the sampled gallery',async()=>{
 const {readFileSync}=await import('node:fs');
 const {gunzipSync}=await import('node:zlib');
 const {BASIN_GROUND}=await import('../src/sim/basin-bank-relief.generated.ts');
 const {NativeBank,loadBasinGround}=await import('../src/sim/basin-bank-relief.ts');
 const {Terrain}=await import('../src/sim/terrain.ts');
 const {project}=await import('../src/sim/geo.ts');
 const url=new URL('../public/world/',import.meta.url);
 const bytes=(p:string)=>readFileSync(new URL(p,url));
 const m=JSON.parse(bytes('terrain.json').toString());
 const a=Uint8Array.from(gunzipSync(bytes(m.file))),t=new Terrain(m,new Int16Array(a.buffer));
 const accepted=await loadBasinGround('/',async()=>new Response(new Uint8Array(bytes(BASIN_GROUND.asset))));assert(accepted);
 const prior=gunzipSync(bytes('harbour/odbl/v1/basin-bank-terrain.cm.gz'));
 const placed=new NativeBank(t,accepted),g=placed.grid;
 const pts=S.worldFrameLonLat.map(([lon,lat])=>project(lon,lat));
 let moved=0,minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;
 for(let j=0;j<g.nz;j++)for(let i=0;i<g.nx;i++){
  const k=j*g.nx+i;
  if(prior.readInt16LE(2*k)===accepted.terrain.samples[k]&&prior[g.nx*g.nz*2+k]===accepted.weights[k])continue;
  const x=g.x0+i*g.stepX,z=g.z0+j*g.stepZ;
  moved++;minX=Math.min(x,minX);maxX=Math.max(x,maxX);minZ=Math.min(z,minZ);maxZ=Math.max(z,maxZ);
  assert(pts.some(p=>Math.hypot(x-p.x,z-p.z)<25),'Bank change escapes the Cannery and its collar.');
 }
 assert(moved>0&&maxX-minX<40&&maxZ-minZ<55);
 const rendered=(u:number,v:number)=>{
  const p=basinCanneryWorld(u,v,0);
  return g.height(p.x,p.z)!+.12;
 };
 assert(rendered(.129,.246)<.40);
 for(let a=0;a<=120;a++)for(let b=0;b<=220;b++){
  const u=.978+(1.188-.978)*a/120,v=.024+(.966-.024)*b/220;
  assert(rendered(u,v)<S.probedEastWalkHeight+.10,{u,v});
 }
});
